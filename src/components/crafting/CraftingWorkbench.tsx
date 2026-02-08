/**
 * CraftingWorkbench - Active crafting project with setup/design/craft phases.
 * Extracted from CraftingTab lines 213-667.
 */

import { useState, useEffect, useMemo } from 'react';
import { QUALITIES } from '../../constants';
import { toNumberOr, upsertCraft, removeCraft, refundMaterialsFromProject } from '../../utils/helpers';
import { DiceRoller } from '../DiceRoller';
import { craftingLog } from '../../utils/activityLogger';
import type {
  Craft,
  CraftDesign,
  CraftShift,
  Material,
  MaterialType,
  CustomTemplates,
} from '../../types/campaign';
import type { CraftingWorker } from '../../hooks/useCraftingData';
import type { DowntimeState } from '../../types/downtime';
import type { DowntimeAction } from '../../state/downtime/downtimeActions';
import { createAndResolveTask } from '../../utils/createAutoResolvedTask';
import { selectCharacterAssignmentForSlot } from '../../state/downtime/downtimeSelectors';

// ============================================================================
// Types
// ============================================================================

interface CraftingWorkbenchProps {
  craft: Craft | null;
  materials: Material[];
  materialTypes: MaterialType[];
  customTemplates: CustomTemplates;
  workers: CraftingWorker[];
  crafts: Craft[];
  craftDesigns: CraftDesign[];
  saveMaterials: (materials: Material[]) => void;
  saveCrafts: (crafts: Craft[]) => void;
  saveCraftDesigns: (designs: CraftDesign[]) => void;
  addLogEntry: (entry: any) => void;
  weatherSkillBonus: number;
  onProjectCompleted: () => void;
  onProjectAbandoned: () => void;
  onDesignPhaseComplete: (craft: Craft) => void;
  onCraftUpdated: (craft: Craft | null) => void;
  /** Downtime state for time slot tracking */
  downtimeState?: DowntimeState;
  /** Dispatch function for downtime actions */
  downtimeDispatch?: React.Dispatch<DowntimeAction>;
  /** Current day key */
  currentDayKey?: number;
  /** Current time slot */
  currentSlot?: number;
}

interface DiceRoll {
  dice: number[];
  total: number;
}

// ============================================================================
// Utilities
// ============================================================================

function calcStats(
  craft: Craft,
  customTemplates: CustomTemplates,
  materials: Material[],
  materialTypes: MaterialType[]
) {
  const t = customTemplates[craft.templateType]?.[craft.template];
  if (!t) return { finalWeight: 0, finalHP: 0, finalHT: 10, totalDifficulty: 0, designTime: 0, craftTime: 0 };
  const q = QUALITIES[craft.quality as keyof typeof QUALITIES];

  let matDiff = 0;
  let matHT = 10;
  let matWeightMod = 0;
  let matHPMod = 0;

  if (craft.selectedMaterials && craft.selectedMaterials.length > 0) {
    const selectedMatTypes = craft.selectedMaterials
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

  const w = Math.round((t.weight || 0) * (1 + matWeightMod / 100) * 10) / 10;
  const hp = Math.round((t.hp || 0) * (1 + matHPMod / 100));
  const ht = matHT + (q?.htBonus ?? 0);
  let diff = matDiff + (q?.difficulty ?? 0);
  craft.mods.forEach((mod, i) => { diff += mod.difficulty || 0; if (i > 0) diff -= 1; });
  return { finalWeight: w, finalHP: hp, finalHT: ht, totalDifficulty: diff, designTime: 2 * hp, craftTime: hp };
}

// ============================================================================
// Component
// ============================================================================

export function CraftingWorkbench({
  craft: externalCraft,
  materials,
  materialTypes,
  customTemplates,
  workers,
  crafts,
  craftDesigns: _craftDesigns,
  saveMaterials,
  saveCrafts,
  saveCraftDesigns: _saveCraftDesigns,
  addLogEntry,
  weatherSkillBonus: _weatherSkillBonus,
  onProjectCompleted,
  onProjectAbandoned,
  onDesignPhaseComplete,
  onCraftUpdated,
  downtimeState,
  downtimeDispatch,
  currentDayKey,
  currentSlot,
}: CraftingWorkbenchProps) {
  void _craftDesigns; void _saveCraftDesigns; void _weatherSkillBonus; // reserved for future use
  const [current, setCurrent] = useState<Craft | null>(externalCraft);
  const [skill, setSkill] = useState('');
  const [roll, setRoll] = useState<DiceRoll>({ dice: [], total: 0 });
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentDay, setCurrentDay] = useState(1);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [abandonConfirm, setAbandonConfirm] = useState(false);

  /**
   * Try to reserve the current time slot for the selected worker.
   * Returns true if successful (or if downtime tracking is not active).
   * Returns false and shows an alert if the character is already busy.
   */
  function tryReserveSlot(message: string, qualityTarget?: string): boolean {
    if (!downtimeState || !downtimeDispatch || currentDayKey === undefined || currentSlot === undefined) return true;
    const workerObj = workers.find(w => w.name === selectedWorker);
    const workerId = workerObj?.id || selectedWorker;
    const result = createAndResolveTask(downtimeState, downtimeDispatch, {
      activityType: 'crafting',
      dayKey: currentDayKey,
      slot: currentSlot,
      leaderId: workerId,
      activityData: {
        type: 'crafting',
        recipeId: current?.template || '',
        materialInstanceIds: [],
        toolInstanceIds: [],
        qualityTarget: (qualityTarget as any) || 'standard',
        skillModifier: 0,
      },
      resultMessage: message,
    });
    if (!result.success) {
      alert(result.error);
      return false;
    }
    return true;
  }

  // Filter out workers who are unavailable (already assigned this time slot)
  const availableWorkers = useMemo(() => {
    if (!downtimeState || currentDayKey === undefined || currentSlot === undefined) return workers;
    return workers.filter(w => !selectCharacterAssignmentForSlot(downtimeState, w.id, currentDayKey, currentSlot));
  }, [workers, downtimeState, currentDayKey, currentSlot]);

  // Sync with external craft prop changes
  useEffect(() => {
    setCurrent(externalCraft);
    if (externalCraft && externalCraft.shifts && externalCraft.shifts.length > 0) {
      const lastShift = externalCraft.shifts[externalCraft.shifts.length - 1];
      setSelectedWorker(lastShift.worker || '');
      setCurrentDay(lastShift.day || externalCraft.startDay || 1);
    } else if (externalCraft) {
      setSelectedWorker('');
      setCurrentDay(externalCraft.startDay || 1);
    }
    setCurrentDate(new Date().toISOString().split('T')[0]);
    setSkill('');
    setRoll({ dice: [], total: 0 });
  }, [externalCraft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill skill when worker selection or craft phase changes
  useEffect(() => {
    if (!selectedWorker || !current) return;
    const worker = availableWorkers.find(w => w.name === selectedWorker);
    if (worker?.skills) {
      setSkill(String(current.phase === 'design' ? (worker.skills.designing ?? 10) : (worker.skills.crafting ?? 10)));
    }
  }, [selectedWorker, current?.phase, availableWorkers]);

  function startNew() {
    const weaponKeys = Object.keys(customTemplates.weapons || {});
    if (weaponKeys.length === 0) {
      alert('No weapon templates available. Add one in Manager \u2192 Templates.');
      return;
    }

    const firstTemplate = weaponKeys[0];
    const templateData = customTemplates.weapons[firstTemplate];
    const selectedMats = (templateData.materials || []).map((req, idx) => ({
      requirementIndex: idx,
      requiredType: req.type,
      requiredAmount: req.amount,
      selectedMaterialId: null as string | null
    }));
    const today = new Date().toISOString().split('T')[0];
    const newCraft: Craft = {
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
    };
    setCurrent(newCraft);
    onCraftUpdated(newCraft);
    setCurrentDate(today);
    setCurrentDay(1);
    setSelectedWorker(workers[0]?.name || '');
  }

  if (!current) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No active project. Start a new one or select from the Projects tab.</p>
        <button onClick={startNew} className="bg-green-600 px-6 py-3 rounded hover:bg-green-700">
          New Project
        </button>
      </div>
    );
  }

  const stats = calcStats(current, customTemplates, materials, materialTypes);
  const progress = current.shifts ? current.shifts.reduce((s, x) => s + x.hoursAdded, 0) : 0;

  const phaseColors = {
    setup: { bg: 'bg-gray-800', border: 'border-blue-500', text: 'text-blue-400' },
    design: { bg: 'bg-gray-800', border: 'border-purple-500', text: 'text-purple-400' },
    craft: { bg: 'bg-gray-800', border: 'border-green-500', text: 'text-green-400' },
    complete: { bg: 'bg-gray-800', border: 'border-green-500', text: 'text-green-400' },
  };
  const colors = phaseColors[current.phase] || phaseColors.setup;

  function handleStartDesign() {
    if (!current) return;

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
    }

    // Check time slot availability and mark character as busy (before either branch)
    if (!tryReserveSlot(`Started design phase: ${current.template || 'Unknown'}`)) return;

    if (current.selectedMaterials && current.selectedMaterials.length > 0) {
      const consumedMaterials = current.selectedMaterials.map(req => {
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
        return { ...m, quantity: m.quantity - u.amount };
      });
      saveMaterials(newMaterials);

      const newCur: Craft = { ...current, phase: 'design', consumedMaterials };
      setCurrent(newCur);
      onCraftUpdated(newCur);
      saveCrafts(upsertCraft(crafts, newCur) as Craft[]);
      addLogEntry(craftingLog.projectStarted(current.template || 'Unknown'));
    } else {
      const newCur: Craft = { ...current, phase: 'design' };
      setCurrent(newCur);
      onCraftUpdated(newCur);
      saveCrafts(upsertCraft(crafts, newCur) as Craft[]);
      addLogEntry(craftingLog.projectStarted(current.template || 'Unknown'));
    }

    if (workers && workers.length > 0 && !selectedWorker) {
      const defaultWorker = workers[0];
      setSelectedWorker(defaultWorker.name);
      if (defaultWorker.skills) {
        setSkill(String(defaultWorker.skills.designing || 10));
      }
    }
  }

  function handleAddShift() {
    if (!current) return;
    const s = parseInt(skill), r = roll.total;
    if (isNaN(s) || !r || !selectedWorker || !currentDate || isNaN(currentDay)) { alert('Fill all fields'); return; }

    // Check time slot availability and mark character as busy
    const shiftMessage = `Craft shift: ${current.phase === 'design' ? 'Design' : 'Craft'} on ${current.template || 'Unknown'}`;
    if (!tryReserveSlot(shiftMessage, current.currentQuality as string)) return;

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
        const refunded = refundMaterialsFromProject(current as any, materials) as Material[];
        saveMaterials(refunded);
        saveCrafts(removeCraft(crafts, current.id) as Craft[]);
        setCurrent(null);
        onCraftUpdated(null);
        onProjectAbandoned();
        return;
      }
    }

    const newShift: CraftShift = {
      id: crypto.randomUUID(),
      date: currentDate,
      day: currentDay,
      worker: selectedWorker,
      skill: s,
      roll: r,
      effectiveSkill: eff,
      result: res,
      hoursAdded: hrs,
      qualityChange: qc,
      phase: current.phase
    };
    const newShifts = [...current.shifts, newShift];
    const newProg = newShifts.reduce((sum, x) => sum + x.hoursAdded, 0);
    const ql = ['cheap', 'good', 'fine', 'very fine', 'legendary'];
    let qi = ql.indexOf(current.currentQuality as string);
    qi = Math.max(0, Math.min(4, qi + qc));
    const newCur: Craft = { ...current, shifts: newShifts, currentQuality: ql[qi] };

    if (current.phase === 'design' && newProg >= stats.designTime) {
      newCur.phase = 'craft';
      newCur.designShifts = newShifts;
      newCur.shifts = [];
      saveCrafts(upsertCraft(crafts, newCur) as Craft[]);
      if (workers && workers.length > 0) {
        const defaultWorker = workers[0];
        setSelectedWorker(defaultWorker.name);
        if (defaultWorker.skills) {
          setSkill(String(defaultWorker.skills.crafting || 10));
        }
      }
      setRoll({ dice: [], total: 0 });
      setCurrent(newCur);
      onCraftUpdated(newCur);
      onDesignPhaseComplete(newCur);
      return;
    } else if (current.phase === 'craft' && newProg >= stats.craftTime) {
      alert('Craft complete!');
      newCur.completed = true;
      newCur.completedDate = currentDate;
      newCur.completedDay = currentDay;
      saveCrafts(upsertCraft(crafts, newCur) as Craft[]);
      addLogEntry(craftingLog.projectCompleted(
        newCur.name || newCur.template || 'Unknown',
        (newCur.currentQuality as string) || 'Standard',
        selectedWorker
      ));
      setCurrent(null);
      onCraftUpdated(null);
      onProjectCompleted();
      return;
    } else {
      saveCrafts(upsertCraft(crafts, newCur) as Craft[]);
    }
    setCurrent(newCur);
    onCraftUpdated(newCur);
    setSkill('');
    setRoll({ dice: [], total: 0 });
  }

  return (
    <div>
      {/* Abandon Confirm Modal */}
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
                    const refunded = refundMaterialsFromProject(current as any, materials) as Material[];
                    saveMaterials(refunded);
                    saveCrafts(removeCraft(crafts, current?.id || '') as Craft[]);
                  } catch (error) {
                    console.error('Error during project cancellation:', error);
                  } finally {
                    setCurrent(null);
                    onCraftUpdated(null);
                    setAbandonConfirm(false);
                    onProjectAbandoned();
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

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button onClick={startNew} className="bg-green-600 px-4 py-2 rounded">New Project</button>
        {current && (
          <button onClick={() => setAbandonConfirm(true)} className="bg-orange-600 px-4 py-2 rounded">
            Cancel Current
          </button>
        )}
      </div>

      {/* Phase-specific content */}
      <div className={`${colors.bg} rounded-lg p-6 border-2 ${colors.border}`}>
        <h2 className={`text-xl font-bold mb-4 ${colors.text}`}>
          {current.phase === 'setup' ? 'Setup Phase' : current.phase === 'design' ? 'Design Phase' : 'Crafting Phase'}
        </h2>

        {/* Setup Phase */}
        {current.phase === 'setup' && (
          <div className="space-y-4">
            <div>
              <label className="block mb-2">Template Type</label>
              <select value={current.templateType} onChange={(e) => {
                const newType = e.target.value;
                const firstTemplate = Object.keys(customTemplates[newType])[0];
                const templateData = customTemplates[newType][firstTemplate];
                const selectedMats = (templateData.materials || []).map((req: any, idx: number) => ({
                  requirementIndex: idx,
                  requiredType: req.type,
                  requiredAmount: req.amount,
                  selectedMaterialId: null as string | null
                }));
                const updated = { ...current, templateType: newType as Craft['templateType'], template: firstTemplate, selectedMaterials: selectedMats };
                setCurrent(updated);
                onCraftUpdated(updated);
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
                const templateData = customTemplates[current.templateType][newTemplate];
                const selectedMats = (templateData.materials || []).map((req: any, idx: number) => ({
                  requirementIndex: idx,
                  requiredType: req.type,
                  requiredAmount: req.amount,
                  selectedMaterialId: null as string | null
                }));
                const updated = { ...current, template: newTemplate, selectedMaterials: selectedMats };
                setCurrent(updated);
                onCraftUpdated(updated);
              }} className="w-full bg-gray-700 px-3 py-2 rounded">
                {Object.keys(customTemplates[current.templateType] || {}).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-2">Target Quality</label>
              <select value={current.quality as string} onChange={(e) => {
                const updated = { ...current, quality: e.target.value, currentQuality: e.target.value };
                setCurrent(updated);
                onCraftUpdated(updated);
              }} className="w-full bg-gray-700 px-3 py-2 rounded">
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
                          newSelected[idx] = { ...newSelected[idx], selectedMaterialId: e.target.value || null };
                          const updated = { ...current, selectedMaterials: newSelected };
                          setCurrent(updated);
                          onCraftUpdated(updated);
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
              <input type="date" value={current.startDate} onChange={(e) => {
                const updated = { ...current, startDate: e.target.value };
                setCurrent(updated);
                onCraftUpdated(updated);
              }} className="w-full bg-gray-700 px-3 py-2 rounded" />
            </div>

            <div>
              <label className="block mb-2">Start Day (In-Universe)</label>
              <input type="number" min="1" value={current.startDay} onChange={(e) => {
                const updated = { ...current, startDay: Math.max(1, toNumberOr(e.target.value, 1)) };
                setCurrent(updated);
                onCraftUpdated(updated);
              }} className="w-full bg-gray-700 px-3 py-2 rounded" />
            </div>

            <div className="bg-gray-700 p-4 rounded text-sm">
              <div>Weight: {stats.finalWeight} lbs | HP: {stats.finalHP} | HT: {stats.finalHT} | Difficulty: {stats.totalDifficulty}</div>
              <div>Design: {stats.designTime}h | Craft: {stats.craftTime}h</div>
            </div>
            <button onClick={handleStartDesign} className="w-full bg-green-600 py-3 rounded">Start Design</button>
          </div>
        )}

        {/* Design / Craft Phase */}
        {(current.phase === 'design' || current.phase === 'craft') && (
          <div className="space-y-4">
            <div className="bg-gray-700 p-4 rounded">
              <div className="mb-2 text-sm">Target: {current.phase === 'design' ? stats.designTime : stats.craftTime}h | Progress: {progress}h | Difficulty: {stats.totalDifficulty} | Quality: {current.currentQuality}</div>
              <div className="w-full bg-gray-600 rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${Math.min(100, (progress / (current.phase === 'design' ? stats.designTime : stats.craftTime)) * 100)}%` }} />
              </div>
            </div>
            {current.shifts.map((s, i) => (
              <div key={s.id || i} className="bg-gray-700 p-3 rounded text-sm">
                <div>Shift {i + 1}: {s.result} {s.date && <span className="text-blue-400">({s.date})</span>} {s.day && <span className="text-green-400">[Day {s.day}]</span>}</div>
                <div className="text-gray-400">{s.worker && <span>Worker: {s.worker} | </span>}Skill {s.skill} &rarr; Eff {s.effectiveSkill} | Roll: {s.roll} | +{s.hoursAdded}h{(s.qualityChange ?? s.qualityShift ?? 0) !== 0 && ` | Qual ${(s.qualityChange ?? s.qualityShift ?? 0) > 0 ? '+' : ''}${s.qualityChange ?? s.qualityShift}`}</div>
              </div>
            ))}
            <div className="bg-gray-700 p-4 rounded grid grid-cols-2 gap-4">
              <div><label className="block mb-2 text-sm">Date</label><input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" /></div>
              <div><label className="block mb-2 text-sm">Day (In-Universe)</label><input type="number" min="1" value={currentDay} onChange={(e) => setCurrentDay(Math.max(1, toNumberOr(e.target.value, 1)))} className="w-full bg-gray-600 px-3 py-2 rounded" /></div>
              <div><label className="block mb-2 text-sm">Worker</label><select value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded"><option value="">Select worker...</option>{availableWorkers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}</select></div>
              <div><label className="block mb-2 text-sm">Skill</label><input type="number" value={skill} onChange={(e) => setSkill(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" /></div>
              <div className="col-span-2">
                <label className="block mb-2 text-sm">Roll (3d6)</label>
                <div className="flex gap-2">
                  <input type="number" value={roll.total || ''} onChange={(e) => setRoll({ dice: [], total: parseInt(e.target.value) || 0 })} className="flex-1 bg-gray-600 px-3 py-2 rounded" />
                  <DiceRoller dice={roll.dice} total={roll.total} onRoll={(dice: number[], total: number) => setRoll({ dice, total })} onTotalChange={(total: number) => setRoll(prev => ({ ...prev, total }))} />
                </div>
              </div>
            </div>
            <button onClick={handleAddShift} className="w-full bg-green-600 py-3 rounded">Add Shift</button>
          </div>
        )}
      </div>
    </div>
  );
}
