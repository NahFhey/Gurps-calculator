import { useState, useMemo, useCallback, useRef } from 'react';
import { QUALITIES } from '../constants';
import { toNumberOr, upsertCraft, removeCraft, refundMaterialsFromProject } from '../utils/helpers';
import { DiceRoller } from './DiceRoller';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';
import { craftingLog } from '../utils/activityLogger';
import { useWeatherModifiers } from '../hooks/useWeatherModifiers';

// ============================================================================
// Types
// ============================================================================

interface Worker {
  id: string;
  name: string;
  skills: Record<string, number>;
  st?: number;
}

interface Material {
  id: string;
  name: string;
  type: string;
  quantity: number;
  [key: string]: unknown;
}

interface MaterialType {
  name: string;
  difficulty: number;
  ht: number;
  weightMod?: number;
  hpMod?: number;
  [key: string]: unknown;
}

interface SelectedMaterial {
  requirementIndex: number;
  requiredType: string;
  requiredAmount: number;
  selectedMaterialId: string | null;
}

interface ConsumedMaterial {
  materialId: string;
  amount: number;
  name: string;
  type: string;
}

interface Shift {
  id: string;
  date: string;
  day: number;
  worker: string;
  skill: number;
  roll: number;
  effectiveSkill: number;
  result: string;
  hoursAdded: number;
  qualityChange: number;
  phase: string;
}

interface Craft {
  id: string;
  phase: 'setup' | 'design' | 'craft';
  templateType: string;
  template: string;
  quality: string;
  currentQuality: string;
  mods: Array<{ difficulty?: number; [key: string]: unknown }>;
  shifts: Shift[];
  designShifts?: Shift[];
  selectedMaterials: SelectedMaterial[];
  consumedMaterials?: ConsumedMaterial[];
  startDate: string;
  startDay: number;
  completed?: boolean;
  completedDate?: string;
  completedDay?: number;
  name?: string;
}

interface CraftDesign {
  id: string;
  name: string;
  templateType: string;
  template: string;
  quality: string;
  mods: Array<{ difficulty?: number; [key: string]: unknown }>;
  selectedMaterials: SelectedMaterial[];
  consumedMaterials?: ConsumedMaterial[];
  designShifts?: Shift[];
  savedDate: string;
}

interface Template {
  weight: number;
  hp: number;
  materials?: Array<{ type: string; amount: number }>;
  damage?: string;
  reach?: string;
  parry?: string;
  cost?: number;
  ST?: number;
  notes?: string;
  Acc?: number;
  range?: string;
  RoF?: string;
  shots?: string;
  bulk?: number;
  RCl?: number;
  LC?: number;
  location?: string;
  DR?: number;
  fuse?: string;
}

interface CustomTemplates {
  weapons: Record<string, Template>;
  armor: Record<string, Template>;
  ranged: Record<string, Template>;
  explosives: Record<string, Template>;
  [key: string]: Record<string, Template>;
}

interface DiceRoll {
  dice: number[];
  total: number;
}

type CraftingView = 'list' | 'craft' | 'designs';

// ============================================================================
// CraftingTab Component
// ============================================================================

/**
 * CraftingTab Component - Manages GURPS crafting projects with design and craft phases
 *
 * MIGRATED: Now uses useCampaignStore directly instead of bridge contexts.
 */
export function CraftingTab() {
  const { state, actions } = useCampaignStore();

  // Get weather modifiers for crafting
  const { modifiers: weatherModifiers, hasEffect, effectDescription, locationName, skillBonus: weatherSkillBonus } = useWeatherModifiers('crafting');

  // Derive data from normalized state
  const materials = useMemo(() =>
    denormalizeObject(state.entities.materials) as Material[],
    [state.entities.materials]
  );

  const materialTypes = state.entities.materialTypes as MaterialType[];

  const crafts = useMemo(() =>
    denormalizeObject(state.entities.crafts) as Craft[],
    [state.entities.crafts]
  );

  const craftDesigns = useMemo(() =>
    denormalizeObject(state.entities.craftDesigns) as CraftDesign[],
    [state.entities.craftDesigns]
  );

  const customTemplates = state.entities.customTemplates as CustomTemplates;

  // Derive workers from characters
  const workers = useMemo(() =>
    Object.values(state.entities.characters).map((character: Record<string, unknown>) => ({
      id: character.id as string,
      name: character.name as string,
      skills: (character.work as Record<string, unknown>)?.skills as Record<string, number> || {},
      st: character.st as number | undefined
    })) as Worker[],
    [state.entities.characters]
  );

  // Save callbacks
  const saveMaterials = useCallback((materialsArray: Material[]) => {
    actions.setMaterials(normalizeArray(materialsArray));
  }, [actions]);

  const saveCrafts = useCallback((craftsArray: Craft[]) => {
    actions.setCrafts(normalizeArray(craftsArray));
  }, [actions]);

  const saveCraftDesigns = useCallback((designsArray: CraftDesign[]) => {
    actions.setCraftDesigns(normalizeArray(designsArray));
  }, [actions]);

  // Local state
  const [view, setView] = useState<CraftingView>('list');
  const [current, setCurrent] = useState<Craft | null>(null);
  const [skill, setSkill] = useState('');
  const [roll, setRoll] = useState<DiceRoll>({ dice: [], total: 0 });
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentDay, setCurrentDay] = useState(1);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [expandedCrafts, setExpandedCrafts] = useState<Record<string, boolean>>({});
  const [abandonConfirm, setAbandonConfirm] = useState(false);
  const [saveDesignPrompt, setSaveDesignPrompt] = useState<Craft | null>(null);
  const [designName, setDesignName] = useState('');

  const allTemplates = customTemplates;

  /**
   * Initializes a new crafting project in setup phase
   */
  function startNew() {
    const weaponKeys = Object.keys(allTemplates.weapons || {});
    if (weaponKeys.length === 0) {
      alert('No weapon templates available. Add one in Manager → Templates.');
      setView('list');
      return;
    }

    const firstTemplate = weaponKeys[0];
    const templateData = allTemplates.weapons[firstTemplate];
    const selectedMats: SelectedMaterial[] = (templateData.materials || []).map((req, idx) => ({
      requirementIndex: idx,
      requiredType: req.type,
      requiredAmount: req.amount,
      selectedMaterialId: null
    }));
    const today = new Date().toISOString().split('T')[0];
    setCurrent({
      id: crypto.randomUUID(),
      phase: 'setup',
      templateType: 'weapons',
      template: firstTemplate,
      quality: 'good',
      mods: [],
      shifts: [],
      currentQuality: 'good',
      selectedMaterials: selectedMats,
      startDate: today,
      startDay: 1
    });
    setCurrentDate(today);
    setCurrentDay(1);
    setSelectedWorker(workers[0]?.name || '');
    setView('craft');
  }

  /**
   * Calculates derived statistics for the current crafting project
   */
  function calcStats() {
    if (!current) return { finalWeight: 0, finalHP: 0, finalHT: 10, totalDifficulty: 0, designTime: 0, craftTime: 0 };
    const t = allTemplates[current.templateType]?.[current.template];
    if (!t) return { finalWeight: 0, finalHP: 0, finalHT: 10, totalDifficulty: 0, designTime: 0, craftTime: 0 };
    const q = QUALITIES[current.quality as keyof typeof QUALITIES];

    let matDiff = 0;
    let matHT = 10;
    let matWeightMod = 0;
    let matHPMod = 0;

    if (current.selectedMaterials && current.selectedMaterials.length > 0) {
      const selectedMatTypes = current.selectedMaterials
        .map(sm => {
          const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
          if (!mat || !mat.type) return null;
          return materialTypes.find(mt => mt.name === mat.type);
        })
        .filter((mt): mt is MaterialType => mt !== null);

      if (selectedMatTypes.length > 0) {
        matDiff = Math.round(selectedMatTypes.reduce((sum, mt) => sum + mt.difficulty, 0) / selectedMatTypes.length);
        matHT = Math.round(selectedMatTypes.reduce((sum, mt) => sum + mt.ht, 0) / selectedMatTypes.length);
        matWeightMod = selectedMatTypes.reduce((sum, mt) => sum + (mt.weightMod || 0), 0) / selectedMatTypes.length;
        matHPMod = selectedMatTypes.reduce((sum, mt) => sum + (mt.hpMod || 0), 0) / selectedMatTypes.length;
      }
    }

    const w = Math.round(t.weight * (1 + matWeightMod / 100) * 10) / 10;
    const hp = Math.round(t.hp * (1 + matHPMod / 100));
    const ht = matHT + q.htBonus;
    let diff = matDiff + q.difficulty;
    current.mods.forEach((mod, i) => { diff += mod.difficulty || 0; if (i > 0) diff -= 1; });
    return { finalWeight: w, finalHP: hp, finalHT: ht, totalDifficulty: diff, designTime: 2 * hp, craftTime: hp };
  }

  const stats = calcStats();
  const progress = current?.shifts ? current.shifts.reduce((s, x) => s + x.hoursAdded, 0) : 0;

  return (
    <div>
      {saveDesignPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md border-2 border-purple-500">
            <h3 className="text-xl font-bold mb-4 text-purple-400">Save Design?</h3>
            <p className="mb-4 text-gray-300">
              Design phase complete! Would you like to save this as a reusable craft design?
            </p>
            <div className="mb-4">
              <label className="block text-sm mb-2">Design Name</label>
              <input
                type="text"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                placeholder={`${saveDesignPrompt.currentQuality} ${saveDesignPrompt.template}`}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setSaveDesignPrompt(null);
                  setDesignName('');
                  setCurrent(saveDesignPrompt);
                  setView('craft');
                }}
                className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  const name = designName.trim() || `${saveDesignPrompt.currentQuality} ${saveDesignPrompt.template}`;
                  const design: CraftDesign = {
                    id: crypto.randomUUID(),
                    name,
                    templateType: saveDesignPrompt.templateType,
                    template: saveDesignPrompt.template,
                    quality: saveDesignPrompt.currentQuality,
                    mods: saveDesignPrompt.mods || [],
                    selectedMaterials: saveDesignPrompt.selectedMaterials || [],
                    consumedMaterials: saveDesignPrompt.consumedMaterials || [],
                    designShifts: saveDesignPrompt.designShifts || saveDesignPrompt.shifts || [],
                    savedDate: new Date().toISOString()
                  };
                  saveCraftDesigns([...(craftDesigns || []), design]);
                  setSaveDesignPrompt(null);
                  setDesignName('');
                  setCurrent(saveDesignPrompt);
                  setView('craft');
                  alert('Design saved!');
                }}
                className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700"
              >
                Save Design
              </button>
            </div>
          </div>
        </div>
      )}

      {abandonConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Abandon Project?</h3>
            <p className="mb-6">
              This will cancel the current project and refund all materials.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setAbandonConfirm(false)}
                className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500"
              >
                Keep Working
              </button>
              <button
                onClick={() => {
                  try {
                    const refunded = refundMaterialsFromProject(current, materials);
                    saveMaterials(refunded);
                    saveCrafts(removeCraft(crafts, current?.id || ''));
                  } catch (error) {
                    console.error('Error during project cancellation:', error);
                  } finally {
                    setCurrent(null);
                    setView('list');
                    setAbandonConfirm(false);
                  }
                }}
                className="px-4 py-2 bg-orange-600 rounded hover:bg-orange-700"
              >
                Abandon Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weather Effects Banner */}
      {hasEffect && (
        <div className="mb-4 px-3 py-2 rounded bg-blue-900/30 border border-blue-700/50">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-400">Weather Effect:</span>
            <span className="text-gray-300">{effectDescription}</span>
            {locationName && <span className="text-gray-500 text-xs">at {locationName}</span>}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('list')} className={`px-4 py-2 rounded ${view === 'list' ? 'bg-blue-600' : 'bg-gray-700'}`}>Projects ({crafts.length})</button>
        <button onClick={() => setView('designs')} className={`px-4 py-2 rounded ${view === 'designs' ? 'bg-blue-600' : 'bg-gray-700'}`}>Saved Designs ({(craftDesigns || []).length})</button>
        <button onClick={startNew} className="bg-green-600 px-4 py-2 rounded">New Project</button>
        {current && (
          <button
            onClick={() => setAbandonConfirm(true)}
            className="bg-orange-600 px-4 py-2 rounded"
          >
            Cancel Current
          </button>
        )}
      </div>

      {view === 'craft' && current && (() => {
        const phaseColors = {
          setup: { bg: 'bg-gray-800', border: 'border-blue-500', text: 'text-blue-400' },
          design: { bg: 'bg-gray-800', border: 'border-purple-500', text: 'text-purple-400' },
          craft: { bg: 'bg-gray-800', border: 'border-green-500', text: 'text-green-400' }
        };
        const colors = phaseColors[current.phase] || phaseColors.setup;

        return (<div className={`${colors.bg} rounded-lg p-6 border-2 ${colors.border}`}>
          <h2 className={`text-xl font-bold mb-4 ${colors.text}`}>{current.phase === 'setup' ? 'Setup Phase' : current.phase === 'design' ? 'Design Phase' : 'Crafting Phase'}</h2>
          {current.phase === 'setup' && (
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Template Type</label>
                <select value={current.templateType} onChange={(e) => {
                  const newType = e.target.value;
                  const firstTemplate = Object.keys(allTemplates[newType])[0];
                  const templateData = allTemplates[newType][firstTemplate];
                  const selectedMats: SelectedMaterial[] = (templateData.materials || []).map((req, idx) => ({
                    requirementIndex: idx,
                    requiredType: req.type,
                    requiredAmount: req.amount,
                    selectedMaterialId: null
                  }));
                  setCurrent({...current, templateType: newType, template: firstTemplate, selectedMaterials: selectedMats});
                }} className="w-full bg-gray-700 px-3 py-2 rounded">
                  <option value="weapons">Weapons</option>
                  <option value="armor">Armor</option>
                  <option value="ranged">Ranged</option>
                  <option value="explosives">Explosives</option>
                </select>
              </div>
              <div>
                <label className="block mb-2">Template</label>
                <select value={current.template} onChange={(e) => {
                  const newTemplate = e.target.value;
                  const templateData = allTemplates[current.templateType][newTemplate];
                  const selectedMats: SelectedMaterial[] = (templateData.materials || []).map((req, idx) => ({
                    requirementIndex: idx,
                    requiredType: req.type,
                    requiredAmount: req.amount,
                    selectedMaterialId: null
                  }));
                  setCurrent({...current, template: newTemplate, selectedMaterials: selectedMats});
                }} className="w-full bg-gray-700 px-3 py-2 rounded">
                  {Object.keys(allTemplates[current.templateType]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-2">Target Quality</label>
                <select value={current.quality} onChange={(e) => setCurrent({...current, quality: e.target.value, currentQuality: e.target.value})} className="w-full bg-gray-700 px-3 py-2 rounded">
                  {Object.keys(QUALITIES).map(q => <option key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</option>)}
                </select>
              </div>

              {current.selectedMaterials && current.selectedMaterials.length > 0 && (
                <div className="bg-gray-600 p-4 rounded">
                  <label className="block mb-3 font-semibold">Required Materials</label>
                  {current.selectedMaterials.map((req, idx) => {
                    const availableMats = materials.filter(m => m.type === req.requiredType);
                    return (
                      <div key={idx} className="mb-3">
                        <div className="text-sm text-gray-300 mb-1">
                          {req.requiredType} - {req.requiredAmount} lbs required
                        </div>
                        <select
                          value={req.selectedMaterialId || ''}
                          onChange={(e) => {
                            const newSelected = [...current.selectedMaterials];
                            newSelected[idx].selectedMaterialId = e.target.value || null;
                            setCurrent({...current, selectedMaterials: newSelected});
                          }}
                          className="w-full bg-gray-700 px-3 py-2 rounded"
                        >
                          <option value="">Select material...</option>
                          {availableMats.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.quantity} lbs available)
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="block mb-2">Start Date</label>
                <input type="date" value={current.startDate} onChange={(e) => setCurrent({...current, startDate: e.target.value})} className="w-full bg-gray-700 px-3 py-2 rounded" />
              </div>

              <div>
                <label className="block mb-2">Start Day (In-Universe)</label>
                <input type="number" min="1" value={current.startDay} onChange={(e) => setCurrent({...current, startDay: Math.max(1, toNumberOr(e.target.value, 1))})} className="w-full bg-gray-700 px-3 py-2 rounded" />
              </div>

              <div className="bg-gray-700 p-4 rounded text-sm">
                <div>Weight: {stats.finalWeight} lbs | HP: {stats.finalHP} | HT: {stats.finalHT} | Difficulty: {stats.totalDifficulty}</div>
                <div>Design: {stats.designTime}h | Craft: {stats.craftTime}h</div>
              </div>
              <button onClick={() => {
                if (current.selectedMaterials && current.selectedMaterials.length > 0) {
                  const allSelected = current.selectedMaterials.every(req => req.selectedMaterialId !== null);
                  if (!allSelected) {
                    alert('Please select all required materials');
                    return;
                  }
                  for (const req of current.selectedMaterials) {
                    const mat = materials.find(m => m.id === req.selectedMaterialId || String(m.id) === req.selectedMaterialId);
                    if (!mat || mat.quantity < req.requiredAmount) {
                      alert(`Not enough ${req.requiredType}. Need ${req.requiredAmount} lbs.`);
                      return;
                    }
                  }

                  const consumedMaterials: ConsumedMaterial[] = current.selectedMaterials.map(req => {
                    const mat = materials.find(m => m.id === req.selectedMaterialId || String(m.id) === req.selectedMaterialId);
                    return {
                      materialId: req.selectedMaterialId!,
                      amount: req.requiredAmount,
                      name: mat?.name || 'unknown',
                      type: mat?.type || req.requiredType
                    };
                  });

                  const newMaterials = materials.map(m => {
                    const u = consumedMaterials.find(c => c.materialId === m.id || c.materialId === String(m.id));
                    if (!u) return m;
                    return {...m, quantity: m.quantity - u.amount};
                  });
                  saveMaterials(newMaterials);

                  const newCur: Craft = {...current, phase: 'design', consumedMaterials};
                  setCurrent(newCur);
                  saveCrafts(upsertCraft(crafts, newCur));
                  actions.addLogEntry(craftingLog.projectStarted(current.template || 'Unknown'));
                  if (workers && workers.length > 0 && !selectedWorker) {
                    const defaultWorker = workers[0];
                    setSelectedWorker(defaultWorker.name);
                    if (defaultWorker.skills) {
                      setSkill(String(defaultWorker.skills.designing || 10));
                    }
                  }
                } else {
                  const newCur: Craft = {...current, phase: 'design'};
                  setCurrent(newCur);
                  saveCrafts(upsertCraft(crafts, newCur));
                  actions.addLogEntry(craftingLog.projectStarted(current.template || 'Unknown'));
                  if (workers && workers.length > 0 && !selectedWorker) {
                    const defaultWorker = workers[0];
                    setSelectedWorker(defaultWorker.name);
                    if (defaultWorker.skills) {
                      setSkill(String(defaultWorker.skills.designing || 10));
                    }
                  }
                }
              }} className="w-full bg-green-600 py-3 rounded">Start Design</button>
            </div>
          )}
          {(current.phase === 'design' || current.phase === 'craft') && (
            <div className="space-y-4">
              <div className="bg-gray-700 p-4 rounded">
                <div className="mb-2 text-sm">Target: {current.phase === 'design' ? stats.designTime : stats.craftTime}h | Progress: {progress}h | Difficulty: {stats.totalDifficulty} | Quality: {current.currentQuality}</div>
                <div className="w-full bg-gray-600 rounded-full h-4">
                  <div className="bg-blue-600 h-4 rounded-full" style={{width: `${Math.min(100, (progress / (current.phase === 'design' ? stats.designTime : stats.craftTime)) * 100)}%`}} />
                </div>
              </div>
              {current.shifts.map((s, i) => (
                <div key={s.id} className="bg-gray-700 p-3 rounded text-sm">
                  <div>Shift {i+1}: {s.result} {s.date && <span className="text-blue-400">({s.date})</span>} {s.day && <span className="text-green-400">[Day {s.day}]</span>}</div>
                  <div className="text-gray-400">{s.worker && <span>Worker: {s.worker} | </span>}Skill {s.skill} → Eff {s.effectiveSkill} | Roll: {s.roll} | +{s.hoursAdded}h{s.qualityChange !== 0 && ` | Qual ${s.qualityChange > 0 ? '+' : ''}${s.qualityChange}`}</div>
                </div>
              ))}
              <div className="bg-gray-700 p-4 rounded grid grid-cols-2 gap-4">
                <div><label className="block mb-2 text-sm">Date</label><input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" /></div>
                <div><label className="block mb-2 text-sm">Day (In-Universe)</label><input type="number" min="1" value={currentDay} onChange={(e) => setCurrentDay(Math.max(1, toNumberOr(e.target.value, 1)))} className="w-full bg-gray-600 px-3 py-2 rounded" /></div>
                <div><label className="block mb-2 text-sm">Worker</label><select value={selectedWorker} onChange={(e) => { const worker = workers.find(w => w.name === e.target.value); setSelectedWorker(e.target.value); if (worker?.skills) setSkill(String(current.phase === 'design' ? worker.skills.designing : worker.skills.crafting)); }} className="w-full bg-gray-600 px-3 py-2 rounded">{workers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}</select></div>
                <div><label className="block mb-2 text-sm">Skill</label><input type="number" value={skill} onChange={(e) => setSkill(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" /></div>
                <div className="col-span-2"><label className="block mb-2 text-sm">Roll (3d6)</label><div className="flex gap-2"><input type="number" value={roll.total || ''} onChange={(e) => setRoll({ dice: [], total: parseInt(e.target.value) || 0 })} className="flex-1 bg-gray-600 px-3 py-2 rounded" /><DiceRoller dice={roll.dice} total={roll.total} onRoll={(dice: number[], total: number) => setRoll({ dice, total })} /></div></div>
              </div>
              <button onClick={() => {
                const s = parseInt(skill), r = roll.total;
                if (isNaN(s) || !r || !selectedWorker || !currentDate || isNaN(currentDay)) { alert('Fill all fields'); return; }
                const eff = s + stats.totalDifficulty;
                let hrs = 0, qc = 0, res = '';
                if (current.phase === 'design') {
                  if (r <= 4 || (r === 5 && eff >= 15)) { hrs = s; qc = 1; res = 'Crit Success'; }
                  else if (r <= eff) { hrs = 8; res = 'Success'; }
                  else { const m = r - eff; hrs = m <= 2 ? 6 : m <= 4 ? 4 : 0; res = `Fail by ${m}`; }
                  if (r >= 18 || (r === 17 && eff <= 15)) { hrs = -4; qc = -1; res = 'Crit Fail'; }
                } else {
                  if (r <= 4 || (r === 5 && eff >= 15)) { hrs = 8; qc = 1; res = 'Crit Success'; }
                  else if (r <= eff) { hrs = 8; res = 'Success'; }
                  else { const m = r - eff; hrs = 4; qc = m <= 2 ? 0 : m <= 4 ? -1 : -2; res = `Fail by ${m}`; }
                  if (r >= 18 || (r === 17 && eff <= 15)) {
                    alert('Crit Fail! Project destroyed. Materials refunded.');

                    const refunded = refundMaterialsFromProject(current, materials);
                    saveMaterials(refunded);
                    saveCrafts(removeCraft(crafts, current.id));

                    setCurrent(null);
                    setView('list');
                    return;
                  }
                }
                const newShift: Shift = {id: crypto.randomUUID(), date: currentDate, day: currentDay, worker: selectedWorker, skill: s, roll: r, effectiveSkill: eff, result: res, hoursAdded: hrs, qualityChange: qc, phase: current.phase};
                const newShifts = [...current.shifts, newShift];
                const newProg = newShifts.reduce((sum, x) => sum + x.hoursAdded, 0);
                const ql = ['cheap','good','fine','very fine','legendary'];
                let qi = ql.indexOf(current.currentQuality);
                qi = Math.max(0, Math.min(4, qi + qc));
                const newCur: Craft = {...current, shifts: newShifts, currentQuality: ql[qi]};
                if (current.phase === 'design' && newProg >= stats.designTime) {
                  newCur.phase = 'craft';
                  newCur.designShifts = newShifts;
                  newCur.shifts = [];
                  saveCrafts(upsertCraft(crafts, newCur));
                  if (workers && workers.length > 0) {
                    const defaultWorker = workers[0];
                    setSelectedWorker(defaultWorker.name);
                    if (defaultWorker.skills) {
                      setSkill(String(defaultWorker.skills.crafting || 10));
                    }
                  }
                  setRoll({ dice: [], total: 0 });
                  setSaveDesignPrompt(newCur);
                  return;
                }
                else if (current.phase === 'craft' && newProg >= stats.craftTime) {
                  alert('Craft complete!');
                  newCur.completed = true;
                  newCur.completedDate = currentDate;
                  newCur.completedDay = currentDay;
                  saveCrafts(upsertCraft(crafts, newCur));
                  actions.addLogEntry(craftingLog.projectCompleted(
                    newCur.name || newCur.template || 'Unknown',
                    newCur.currentQuality || 'Standard',
                    selectedWorker
                  ));
                  setCurrent(null);
                  setView('list');
                  return;
                } else {
                  saveCrafts(upsertCraft(crafts, newCur));
                }
                setCurrent(newCur); setSkill(''); setRoll({ dice: [], total: 0 });
              }} className="w-full bg-green-600 py-3 rounded">Add Shift</button>
            </div>
          )}
        </div>);
      })()}

      {view === 'list' && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-4 text-yellow-400">In-Progress Projects</h2>
            <div className="space-y-4">
              {crafts.filter(c => !c.completed).map(c => {
                if (!c.templateType || !c.template) {
                  return null;
                }

                const t = allTemplates[c.templateType]?.[c.template] || {weight: 0, hp: 0};
                const q = QUALITIES[c.currentQuality as keyof typeof QUALITIES] || QUALITIES['good'] || {htBonus: 0};

                let avgHT = 10, avgWeightMod = 0, avgHPMod = 0;
                if (c.selectedMaterials && Array.isArray(c.selectedMaterials) && c.selectedMaterials.length > 0) {
                  const matTypes = c.selectedMaterials.map(sm => {
                    if (!sm || !sm.selectedMaterialId) return null;
                    const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
                    if (!mat || !mat.type) return null;
                    return materialTypes.find(mt => mt && mt.name === mat.type);
                  }).filter((mt): mt is MaterialType => mt !== null && mt !== undefined);
                  if (matTypes.length > 0) {
                    avgHT = Math.round(matTypes.reduce((sum, mt) => sum + (mt.ht || 10), 0) / matTypes.length);
                    avgWeightMod = matTypes.reduce((sum, mt) => sum + (mt.weightMod || 0), 0) / matTypes.length;
                    avgHPMod = matTypes.reduce((sum, mt) => sum + (mt.hpMod || 0), 0) / matTypes.length;
                  }
                }

                const finalWeight = Math.round((t.weight || 0) * (1 + avgWeightMod / 100) * 10) / 10;
                const finalHP = Math.round((t.hp || 0) * (1 + avgHPMod / 100));

                const materialList =
                  (c.consumedMaterials && Array.isArray(c.consumedMaterials) ? c.consumedMaterials.map(u => u?.name || 'unknown').join(', ') : null)
                  || (c.selectedMaterials && Array.isArray(c.selectedMaterials) ? c.selectedMaterials.map(sm => {
                    if (!sm || !sm.selectedMaterialId) return 'unknown';
                    const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
                    return mat ? `${mat.name}` : 'unknown';
                  }).join(', ') : null)
                  || 'no materials';

                const phaseStyles = {
                  setup: { bg: 'bg-blue-900 bg-opacity-30', border: 'border-blue-600', text: 'text-blue-400' },
                  design: { bg: 'bg-purple-900 bg-opacity-30', border: 'border-purple-600', text: 'text-purple-400' },
                  craft: { bg: 'bg-green-900 bg-opacity-30', border: 'border-green-600', text: 'text-green-400' }
                };
                const phaseStyle = phaseStyles[c.phase] || phaseStyles.setup;

                const designTime = 2 * finalHP;
                const craftTime = finalHP;
                const prog = (c.shifts || []).reduce((sum, s) => sum + (s.hoursAdded || 0), 0);

                let targetHours = 0;
                let currentProgress = 0;
                if (c.phase === 'design') {
                  targetHours = designTime;
                  currentProgress = prog;
                } else if (c.phase === 'craft') {
                  targetHours = craftTime;
                  currentProgress = prog;
                } else {
                  targetHours = 1;
                  currentProgress = 0;
                }
                const progressPercent = targetHours > 0 ? Math.min(100, (currentProgress / targetHours) * 100) : 0;

                return (
                  <div key={c.id} className={`${phaseStyle.bg} border ${phaseStyle.border} rounded p-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg capitalize">{c.name || `${c.currentQuality} ${c.template}`}</h3>
                        <div className="text-sm text-gray-400">Phase: <span className={phaseStyle.text}>{c.phase}</span> | Started: {c.startDate || 'unknown'} {c.startDay && <span className="text-green-400">[Day {c.startDay}]</span>}</div>
                        {c.phase !== 'setup' && (
                          <div className="text-xs text-gray-400 mt-1">Progress: {currentProgress}/{targetHours}h ({Math.round(progressPercent)}%)</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setCurrent(c);
                          setCurrentDate(new Date().toISOString().split('T')[0]);
                          if (c.shifts && c.shifts.length > 0) {
                            const lastShift = c.shifts[c.shifts.length - 1];
                            setSelectedWorker(lastShift.worker || workers[0]?.name || '');
                            setCurrentDay(lastShift.day || c.startDay || 1);
                          } else {
                            setSelectedWorker(workers[0]?.name || '');
                            setCurrentDay(c.startDay || 1);
                          }
                          setView('craft');
                        }} className="bg-blue-600 px-4 py-2 rounded">Resume</button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete in-progress project "${c.name || c.template}"?`)) {
                              saveCrafts(crafts.filter(x => x.id !== c.id));
                            }
                          }}
                          className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">Materials: {materialList}</div>
                    <div className="text-sm text-gray-400 mb-2">W: {finalWeight} lbs | HP: {finalHP} | HT: {avgHT + q.htBonus}</div>
                    {c.phase !== 'setup' && (
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${phaseStyle.text === 'text-purple-400' ? 'bg-purple-600' : 'bg-green-600'}`}
                          style={{width: `${progressPercent}%`}}
                        />
                      </div>
                    )}
                  </div>
                );

              }).filter(Boolean)}
              {crafts.filter(c => !c.completed).length === 0 && (
                <div className="text-gray-500 italic">No in-progress projects</div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4 text-green-400">Completed Projects</h2>
            <div className="space-y-4">
              {crafts.filter(c => c.completed).map(c => {
                if (!c.templateType || !c.template) {
                  return null;
                }

                const t = allTemplates[c.templateType]?.[c.template] || {weight: 0, hp: 0};
                const q = QUALITIES[c.currentQuality as keyof typeof QUALITIES] || QUALITIES['good'] || {htBonus: 0};

                let avgHT = 10, avgWeightMod = 0, avgHPMod = 0;
                if (c.selectedMaterials && Array.isArray(c.selectedMaterials) && c.selectedMaterials.length > 0) {
                  const matTypes = c.selectedMaterials.map(sm => {
                    if (!sm || !sm.selectedMaterialId) return null;
                    const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
                    if (!mat || !mat.type) return null;
                    return materialTypes.find(mt => mt && mt.name === mat.type);
                  }).filter((mt): mt is MaterialType => mt !== null && mt !== undefined);
                  if (matTypes.length > 0) {
                    avgHT = Math.round(matTypes.reduce((sum, mt) => sum + (mt.ht || 10), 0) / matTypes.length);
                    avgWeightMod = matTypes.reduce((sum, mt) => sum + (mt.weightMod || 0), 0) / matTypes.length;
                    avgHPMod = matTypes.reduce((sum, mt) => sum + (mt.hpMod || 0), 0) / matTypes.length;
                  }
                }

                const finalWeight = Math.round((t.weight || 0) * (1 + avgWeightMod / 100) * 10) / 10;
                const finalHP = Math.round((t.hp || 0) * (1 + avgHPMod / 100));

                const materialList =
                  (c.consumedMaterials && Array.isArray(c.consumedMaterials) ? c.consumedMaterials.map(u => `${u?.name || 'unknown'} (${u?.type || 'unknown'})`).join(', ') : null)
                  || (c.selectedMaterials && Array.isArray(c.selectedMaterials) ? c.selectedMaterials.map(sm => {
                    if (!sm || !sm.selectedMaterialId) return 'unknown';
                    const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
                    return mat ? `${mat.name} (${mat.type})` : 'unknown';
                  }).join(', ') : null)
                  || 'no materials';

                return (
                  <div key={c.id} className="bg-gray-700 rounded">
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-600"
                      onClick={() => setExpandedCrafts(p => ({...p, [c.id]: !p[c.id]}))}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg capitalize">{c.name || `${c.currentQuality} ${c.template}`}</h3>
                        <div className="text-sm text-gray-400 mt-1">Completed: {c.completedDate || 'unknown'} | Materials: {materialList}</div>
                      </div>
                      <div className="text-sm text-gray-400">
                        <div>W: {finalWeight} lbs</div>
                        <div>HP: {finalHP} | HT: {avgHT + q.htBonus}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete completed project "${c.name || c.template}"?`)) {
                            saveCrafts(crafts.filter(x => x.id !== c.id));
                          }
                        }}
                        className="bg-red-600 px-3 py-1 rounded hover:bg-red-700 text-sm"
                      >
                        Delete
                      </button>
                      <span className="text-gray-400">{expandedCrafts[c.id] ? '▼' : '▶'}</span>
                    </div>

                    {expandedCrafts[c.id] && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-600 pt-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Custom Name</label>
                          <input
                            value={c.name || ''}
                            onChange={(e) => saveCrafts(crafts.map(x => x.id === c.id ? {...x, name: e.target.value} : x))}
                            placeholder={`${c.currentQuality} ${c.template}`}
                            className="w-full bg-gray-600 px-3 py-2 rounded"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Quality</label>
                          <select
                            value={c.currentQuality}
                            onChange={(e) => saveCrafts(crafts.map(x => x.id === c.id ? {...x, currentQuality: e.target.value} : x))}
                            className="w-full bg-gray-600 px-3 py-2 rounded"
                          >
                            {Object.keys(QUALITIES).map(q => <option key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</option>)}
                          </select>
                        </div>

                        <div className="bg-gray-600 p-3 rounded">
                          <div className="text-sm font-semibold mb-2">Template Details</div>
                          <div className="text-sm space-y-1">
                            <div>Type: <span className="text-gray-300 capitalize">{c.templateType} - {c.template}</span></div>
                            <div>Started: <span className="text-gray-300">{c.startDate || 'unknown'}</span> {c.startDay && <span className="text-green-400">[Day {c.startDay}]</span>}</div>
                            <div>Completed: <span className="text-gray-300">{c.completedDate || 'unknown'}</span> {c.completedDay && <span className="text-green-400">[Day {c.completedDay}]</span>}</div>
                            <div>Materials Used: <span className="text-gray-300">{materialList}</span></div>
                            <div>Base Weight: <span className="text-gray-300">{t.weight} lbs</span> → Final: <span className="text-blue-300">{finalWeight} lbs</span></div>
                            <div>Base HP: <span className="text-gray-300">{t.hp}</span> → Final: <span className="text-blue-300">{finalHP}</span></div>
                            <div>Final HT: <span className="text-gray-300">{avgHT + q.htBonus}</span></div>

                            {c.templateType === 'weapons' && (
                              <>
                                {t.damage && <div>Damage: <span className="text-gray-300">{t.damage}</span></div>}
                                {t.reach && <div>Reach: <span className="text-gray-300">{t.reach}</span></div>}
                                {t.parry && <div>Parry: <span className="text-gray-300">{t.parry}</span></div>}
                                {t.cost !== undefined && <div>Cost: <span className="text-gray-300">${t.cost}</span></div>}
                                {t.ST && <div>ST: <span className="text-gray-300">{t.ST}</span></div>}
                                {t.notes && <div>Notes: <span className="text-gray-300">{t.notes}</span></div>}
                              </>
                            )}

                            {c.templateType === 'ranged' && (
                              <>
                                {t.damage && <div>Damage: <span className="text-gray-300">{t.damage}</span></div>}
                                {t.Acc !== undefined && <div>Acc: <span className="text-gray-300">{t.Acc}</span></div>}
                                {t.range && <div>Range: <span className="text-gray-300">{t.range}</span></div>}
                                {t.RoF && <div>RoF: <span className="text-gray-300">{t.RoF}</span></div>}
                                {t.shots && <div>Shots: <span className="text-gray-300">{t.shots}</span></div>}
                                {t.cost !== undefined && <div>Cost: <span className="text-gray-300">${t.cost}</span></div>}
                                {t.ST && <div>ST: <span className="text-gray-300">{t.ST}</span></div>}
                                {t.bulk !== undefined && <div>Bulk: <span className="text-gray-300">{t.bulk}</span></div>}
                                {t.RCl !== undefined && <div>RCl: <span className="text-gray-300">{t.RCl}</span></div>}
                                {t.LC !== undefined && <div>LC: <span className="text-gray-300">{t.LC}</span></div>}
                                {t.notes && <div>Notes: <span className="text-gray-300">{t.notes}</span></div>}
                              </>
                            )}

                            {c.templateType === 'armor' && (
                              <>
                                {t.location && <div>Location: <span className="text-gray-300">{t.location}</span></div>}
                                {t.DR !== undefined && <div>DR: <span className="text-gray-300">{t.DR}</span></div>}
                                {t.cost !== undefined && <div>Cost: <span className="text-gray-300">${t.cost}</span></div>}
                                {t.LC !== undefined && <div>LC: <span className="text-gray-300">{t.LC}</span></div>}
                                {t.notes && <div>Notes: <span className="text-gray-300">{t.notes}</span></div>}
                              </>
                            )}

                            {c.templateType === 'explosives' && (
                              <>
                                {t.damage && <div>Damage: <span className="text-gray-300">{t.damage}</span></div>}
                                {t.fuse && <div>Fuse: <span className="text-gray-300">{t.fuse}</span></div>}
                                {t.cost !== undefined && <div>Cost: <span className="text-gray-300">${t.cost}</span></div>}
                                {t.LC !== undefined && <div>LC: <span className="text-gray-300">{t.LC}</span></div>}
                                {t.notes && <div>Notes: <span className="text-gray-300">{t.notes}</span></div>}
                              </>
                            )}
                          </div>
                        </div>

                        {((c.designShifts && c.designShifts.length > 0) || (c.shifts && c.shifts.length > 0)) && (
                          <div className="bg-gray-600 p-3 rounded">
                            <div className="text-sm font-semibold mb-2">Project History</div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {Array.isArray(c.designShifts) && c.designShifts.length > 0 && (
                                <>
                                  <div className="text-xs font-semibold text-yellow-400 mt-2">Design Phase</div>
                                  {c.designShifts.filter(s => s).map((s, i) => (
                                    <div key={s.id || i} className="text-xs bg-gray-700 p-2 rounded">
                                      <div>Shift {i+1}: {s.result || 'unknown'} {s.date && <span className="text-blue-400">({s.date})</span>} {s.day && <span className="text-green-400">[Day {s.day}]</span>}</div>
                                      <div className="text-gray-400">{s.worker && <span>Worker: {s.worker} | </span>}Skill {s.skill || '?'} → Eff {s.effectiveSkill || '?'} | Roll: {s.roll || '?'} | +{s.hoursAdded || 0}h{s.qualityChange !== 0 && s.qualityChange !== undefined && ` | Qual ${s.qualityChange > 0 ? '+' : ''}${s.qualityChange}`}</div>
                                    </div>
                                  ))}
                                </>
                              )}
                              {Array.isArray(c.shifts) && c.shifts.length > 0 && (
                                <>
                                  <div className="text-xs font-semibold text-green-400 mt-2">Craft Phase</div>
                                  {c.shifts.filter(s => s).map((s, i) => (
                                    <div key={s.id || i} className="text-xs bg-gray-700 p-2 rounded">
                                      <div>Shift {i+1}: {s.result || 'unknown'} {s.date && <span className="text-blue-400">({s.date})</span>} {s.day && <span className="text-green-400">[Day {s.day}]</span>}</div>
                                      <div className="text-gray-400">{s.worker && <span>Worker: {s.worker} | </span>}Skill {s.skill || '?'} → Eff {s.effectiveSkill || '?'} | Roll: {s.roll || '?'} | +{s.hoursAdded || 0}h{s.qualityChange !== 0 && s.qualityChange !== undefined && ` | Qual ${s.qualityChange > 0 ? '+' : ''}${s.qualityChange}`}</div>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="pt-3 border-t border-gray-600">
                          <button
                            onClick={() => {
                              if (confirm(`Delete completed project "${c.name || c.template}"?`)) {
                                saveCrafts(crafts.filter(x => x.id !== c.id));
                              }
                            }}
                            className="w-full px-4 py-2 bg-red-600 rounded hover:bg-red-700 text-sm"
                          >
                            Delete Completed Project
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }).filter(Boolean)}
              {crafts.filter(c => c.completed).length === 0 && (
                <div className="text-gray-500 italic">No completed projects</div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'designs' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-purple-400">Saved Craft Designs</h2>
          <p className="text-sm text-gray-400 mb-4">
            Start crafting immediately from a completed design, skipping the design phase.
          </p>
          <div className="space-y-4">
            {(craftDesigns || []).map(design => {
              const t = allTemplates[design.templateType]?.[design.template] || {weight: 0, hp: 0};
              const q = QUALITIES[design.quality as keyof typeof QUALITIES] || {htBonus: 0};

              let avgHT = 10, avgWeightMod = 0, avgHPMod = 0;
              if (design.selectedMaterials && design.selectedMaterials.length > 0) {
                const matTypes = design.selectedMaterials.map(sm => {
                  const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
                  if (!mat || !mat.type) return null;
                  return materialTypes.find(mt => mt.name === mat.type);
                }).filter((mt): mt is MaterialType => mt !== null);
                if (matTypes.length > 0) {
                  avgHT = Math.round(matTypes.reduce((sum, mt) => sum + mt.ht, 0) / matTypes.length);
                  avgWeightMod = matTypes.reduce((sum, mt) => sum + (mt.weightMod || 0), 0) / matTypes.length;
                  avgHPMod = matTypes.reduce((sum, mt) => sum + (mt.hpMod || 0), 0) / matTypes.length;
                }
              }

              const finalWeight = Math.round(t.weight * (1 + avgWeightMod / 100) * 10) / 10;
              const finalHP = Math.round(t.hp * (1 + avgHPMod / 100));

              const requiredMaterials = design.selectedMaterials || [];
              const canStart = requiredMaterials.every(req => {
                const mat = materials.find(m => m.id === req.selectedMaterialId || String(m.id) === req.selectedMaterialId);
                return mat && mat.quantity >= req.requiredAmount;
              });

              return (
                <div key={design.id} className="bg-purple-900 bg-opacity-20 border border-purple-600 rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-lg capitalize">{design.name}</h3>
                      <div className="text-sm text-gray-400">
                        {design.templateType} - {design.template} | Quality: {design.quality}
                      </div>
                      <div className="text-sm text-gray-400">
                        W: {finalWeight} lbs | HP: {finalHP} | HT: {avgHT + q.htBonus}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!canStart) {
                            alert('Insufficient materials to start this design');
                            return;
                          }

                          const newMaterials = materials.map(m => {
                            const used = requiredMaterials.find(req => req.selectedMaterialId === m.id || req.selectedMaterialId === String(m.id));
                            if (used) {
                              return {...m, quantity: m.quantity - used.requiredAmount};
                            }
                            return m;
                          });
                          saveMaterials(newMaterials);

                          const today = new Date().toISOString().split('T')[0];
                          const newCraft: Craft = {
                            id: crypto.randomUUID(),
                            phase: 'craft',
                            templateType: design.templateType,
                            template: design.template,
                            quality: design.quality,
                            currentQuality: design.quality,
                            mods: design.mods || [],
                            selectedMaterials: design.selectedMaterials || [],
                            consumedMaterials: (design.consumedMaterials || []).length > 0 ? design.consumedMaterials : design.selectedMaterials.map(sm => {
                              const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
                              return {
                                materialId: sm.selectedMaterialId!,
                                amount: sm.requiredAmount,
                                name: mat?.name || 'unknown',
                                type: mat?.type || sm.requiredType
                              };
                            }),
                            designShifts: design.designShifts || [],
                            shifts: [],
                            startDate: today,
                            startDay: 1
                          };

                          saveCrafts([...crafts, newCraft]);
                          actions.addLogEntry(craftingLog.projectStarted(design.name || design.template || 'Unknown'));
                          setCurrent(newCraft);
                          setCurrentDate(today);
                          setCurrentDay(1);
                          if (workers && workers.length > 0) {
                            const defaultWorker = workers[0];
                            setSelectedWorker(defaultWorker.name);
                            if (defaultWorker.skills) {
                              setSkill(String(defaultWorker.skills.crafting || 10));
                            }
                          } else {
                            setSelectedWorker('');
                          }
                          setView('craft');
                          alert('Craft started from design!');
                        }}
                        disabled={!canStart}
                        className={`px-4 py-2 rounded ${canStart ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 cursor-not-allowed'}`}
                      >
                        {canStart ? 'Start Craft' : 'Need Materials'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete design "${design.name}"?`)) {
                            saveCraftDesigns((craftDesigns || []).filter(d => d.id !== design.id));
                          }
                        }}
                        className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {requiredMaterials.length > 0 && (
                    <div className="text-sm text-gray-400 mt-2">
                      <div className="font-semibold mb-1">Required Materials:</div>
                      <div className="space-y-1">
                        {requiredMaterials.map((req, idx) => {
                          const mat = materials.find(m => m.id === req.selectedMaterialId || String(m.id) === req.selectedMaterialId);
                          const hasEnough = mat && mat.quantity >= req.requiredAmount;
                          return (
                            <div key={idx} className={hasEnough ? 'text-green-400' : 'text-red-400'}>
                              {req.requiredType}: {req.requiredAmount} lbs {mat ? `(${mat.quantity} available)` : '(not found)'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {(craftDesigns || []).length === 0 && (
              <div className="text-gray-500 italic">No saved designs. Complete a design phase to save one!</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
