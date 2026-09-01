/**
 * CraftingProjectList - Shows in-progress and completed crafting projects.
 * Extracted from CraftingTab lines 669-992.
 */

import { useState } from 'react';
import { QUALITIES } from '../../constants';
import type {
  Craft,
  Material,
  MaterialType,
  CustomTemplates,
  CraftingTemplateDetails,
} from '../../types/campaign';
import type { CraftingWorker } from '../../hooks/useCraftingData';

interface CraftingProjectListProps {
  crafts: Craft[];
  materials: Material[];
  materialTypes: MaterialType[];
  customTemplates: CustomTemplates;
  workers: CraftingWorker[];
  saveCrafts: (crafts: Craft[]) => void;
  onSelectProject: (craft: Craft) => void;
}

export function CraftingProjectList({
  crafts,
  materials,
  materialTypes,
  customTemplates,
  workers: _workers,
  saveCrafts,
  onSelectProject,
}: CraftingProjectListProps) {
  void _workers; // reserved for future use
  const [expandedCrafts, setExpandedCrafts] = useState<Record<string, boolean>>({});

  function computeStats(c: Craft) {
    const t: CraftingTemplateDetails =
      customTemplates[c.templateType]?.[c.template] || { weight: 0, hp: 0 };
    const q = QUALITIES[c.currentQuality as keyof typeof QUALITIES] || QUALITIES['good'] || { htBonus: 0 };

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

    return { t, q, avgHT, finalWeight, finalHP, designTime: 2 * finalHP, craftTime: finalHP };
  }

  function getMaterialList(c: Craft, detailed = false) {
    if (c.consumedMaterials && Array.isArray(c.consumedMaterials) && c.consumedMaterials.length > 0) {
      return c.consumedMaterials.map(u => detailed ? `${u?.name || 'unknown'} (${u?.type || 'unknown'})` : (u?.name || 'unknown')).join(', ');
    }
    if (c.selectedMaterials && Array.isArray(c.selectedMaterials)) {
      return c.selectedMaterials.map(sm => {
        if (!sm || !sm.selectedMaterialId) return 'unknown';
        const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
        return mat ? (detailed ? `${mat.name} (${mat.type})` : mat.name) : 'unknown';
      }).join(', ');
    }
    return 'no materials';
  }

  const phaseStyles = {
    setup: { bg: 'bg-accent-900 bg-opacity-30', border: 'border-accent-600', text: 'text-accent-400' },
    design: { bg: 'bg-purple-900 bg-opacity-30', border: 'border-purple-600', text: 'text-purple-400' },
    craft: { bg: 'bg-success-900 bg-opacity-30', border: 'border-success-600', text: 'text-success-400' },
    complete: { bg: 'bg-success-900 bg-opacity-30', border: 'border-success-600', text: 'text-success-400' },
  };

  return (
    <div className="bg-surface-1 rounded-lg p-6 space-y-6">
      {/* In-Progress Projects */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-yellow-400">In-Progress Projects</h2>
        <div className="space-y-4">
          {crafts.filter(c => !c.completed).map(c => {
            if (!c.templateType || !c.template) return null;

            const { q, avgHT, finalWeight, finalHP, designTime, craftTime } = computeStats(c);
            const materialList = getMaterialList(c);
            const phaseStyle = phaseStyles[c.phase] || phaseStyles.setup;
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
                    <div className="text-sm text-fg-muted">Phase: <span className={phaseStyle.text}>{c.phase}</span> | Started: {c.startDate || 'unknown'} {c.startDay && <span className="text-success-400">[Day {c.startDay}]</span>}</div>
                    {c.phase !== 'setup' && (
                      <div className="text-xs text-fg-muted mt-1">Progress: {currentProgress}/{targetHours}h ({Math.round(progressPercent)}%)</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      onSelectProject(c);
                    }} className="bg-accent-600 px-4 py-2 rounded">Resume</button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete in-progress project "${c.name || c.template}"?`)) {
                          saveCrafts(crafts.filter(x => x.id !== c.id));
                        }
                      }}
                      className="bg-danger-600 px-4 py-2 rounded hover:bg-danger-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="text-sm text-fg-muted">Materials: {materialList}</div>
                <div className="text-sm text-fg-muted mb-2">W: {finalWeight} lbs | HP: {finalHP} | HT: {avgHT + q.htBonus}</div>
                {c.phase !== 'setup' && (
                  <div className="w-full bg-surface-3 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${phaseStyle.text === 'text-purple-400' ? 'bg-purple-600' : 'bg-success-600'}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          }).filter(Boolean)}
          {crafts.filter(c => !c.completed).length === 0 && (
            <div className="text-fg-faint italic">No in-progress projects</div>
          )}
        </div>
      </div>

      {/* Completed Projects */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-success-400">Completed Projects</h2>
        <div className="space-y-4">
          {crafts.filter(c => c.completed).map(c => {
            if (!c.templateType || !c.template) return null;

            const { t, q, avgHT, finalWeight, finalHP } = computeStats(c);
            const materialList = getMaterialList(c, true);

            return (
              <div key={c.id} className="bg-surface-2 rounded">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-3"
                  onClick={() => setExpandedCrafts(p => ({ ...p, [c.id]: !p[c.id] }))}
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg capitalize">{c.name || `${c.currentQuality} ${c.template}`}</h3>
                    <div className="text-sm text-fg-muted mt-1">Completed: {c.completedDate || 'unknown'} | Materials: {materialList}</div>
                  </div>
                  <div className="text-sm text-fg-muted">
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
                    className="bg-danger-600 px-3 py-1 rounded hover:bg-danger-700 text-sm"
                  >
                    Delete
                  </button>
                  <span className="text-fg-muted">{expandedCrafts[c.id] ? '\u25BC' : '\u25B6'}</span>
                </div>

                {expandedCrafts[c.id] && (
                  <div className="px-4 pb-4 space-y-3 border-t border-edge-strong pt-3">
                    <div>
                      <label className="block text-xs text-fg-muted mb-1">Custom Name</label>
                      <input
                        value={c.name || ''}
                        onChange={(e) => saveCrafts(crafts.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))}
                        placeholder={`${c.currentQuality} ${c.template}`}
                        className="w-full bg-surface-3 px-3 py-2 rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-fg-muted mb-1">Quality</label>
                      <select
                        value={c.currentQuality}
                        onChange={(e) => saveCrafts(crafts.map(x => x.id === c.id ? { ...x, currentQuality: e.target.value } : x))}
                        className="w-full bg-surface-3 px-3 py-2 rounded"
                      >
                        {Object.keys(QUALITIES).map(qKey => <option key={qKey} value={qKey}>{qKey.charAt(0).toUpperCase() + qKey.slice(1)}</option>)}
                      </select>
                    </div>

                    <div className="bg-surface-3 p-3 rounded">
                      <div className="text-sm font-semibold mb-2">Template Details</div>
                      <div className="text-sm space-y-1">
                        <div>Type: <span className="text-fg-secondary capitalize">{c.templateType} - {c.template}</span></div>
                        <div>Started: <span className="text-fg-secondary">{c.startDate || 'unknown'}</span> {c.startDay && <span className="text-success-400">[Day {c.startDay}]</span>}</div>
                        <div>Completed: <span className="text-fg-secondary">{c.completedDate || 'unknown'}</span> {c.completedDay && <span className="text-success-400">[Day {c.completedDay}]</span>}</div>
                        <div>Materials Used: <span className="text-fg-secondary">{materialList}</span></div>
                        <div>Base Weight: <span className="text-fg-secondary">{t.weight} lbs</span> &rarr; Final: <span className="text-accent-300">{finalWeight} lbs</span></div>
                        <div>Base HP: <span className="text-fg-secondary">{t.hp}</span> &rarr; Final: <span className="text-accent-300">{finalHP}</span></div>
                        <div>Final HT: <span className="text-fg-secondary">{avgHT + q.htBonus}</span></div>

                        {c.templateType === 'weapons' && (
                          <>
                            {t.damage && <div>Damage: <span className="text-fg-secondary">{String(t.damage)}</span></div>}
                            {t.reach && <div>Reach: <span className="text-fg-secondary">{String(t.reach)}</span></div>}
                            {t.parry && <div>Parry: <span className="text-fg-secondary">{String(t.parry)}</span></div>}
                            {t.cost !== undefined && <div>Cost: <span className="text-fg-secondary">${t.cost}</span></div>}
                            {t.ST && <div>ST: <span className="text-fg-secondary">{String(t.ST)}</span></div>}
                            {t.notes && <div>Notes: <span className="text-fg-secondary">{String(t.notes)}</span></div>}
                          </>
                        )}

                        {c.templateType === 'ranged' && (
                          <>
                            {t.damage && <div>Damage: <span className="text-fg-secondary">{String(t.damage)}</span></div>}
                            {t.Acc !== undefined && <div>Acc: <span className="text-fg-secondary">{String(t.Acc)}</span></div>}
                            {t.range && <div>Range: <span className="text-fg-secondary">{String(t.range)}</span></div>}
                            {t.RoF && <div>RoF: <span className="text-fg-secondary">{String(t.RoF)}</span></div>}
                            {t.shots && <div>Shots: <span className="text-fg-secondary">{String(t.shots)}</span></div>}
                            {t.cost !== undefined && <div>Cost: <span className="text-fg-secondary">${t.cost}</span></div>}
                            {t.ST && <div>ST: <span className="text-fg-secondary">{String(t.ST)}</span></div>}
                            {t.bulk !== undefined && <div>Bulk: <span className="text-fg-secondary">{String(t.bulk)}</span></div>}
                            {t.RCl !== undefined && <div>RCl: <span className="text-fg-secondary">{String(t.RCl)}</span></div>}
                            {t.LC !== undefined && <div>LC: <span className="text-fg-secondary">{String(t.LC)}</span></div>}
                            {t.notes && <div>Notes: <span className="text-fg-secondary">{String(t.notes)}</span></div>}
                          </>
                        )}

                        {c.templateType === 'armor' && (
                          <>
                            {t.location && <div>Location: <span className="text-fg-secondary">{String(t.location)}</span></div>}
                            {(t.DR !== undefined || t.dr !== undefined) && <div>DR: <span className="text-fg-secondary">{String(t.DR ?? t.dr)}</span></div>}
                            {t.cost !== undefined && <div>Cost: <span className="text-fg-secondary">${t.cost}</span></div>}
                            {t.LC !== undefined && <div>LC: <span className="text-fg-secondary">{String(t.LC)}</span></div>}
                            {t.notes && <div>Notes: <span className="text-fg-secondary">{String(t.notes)}</span></div>}
                          </>
                        )}

                        {c.templateType === 'explosives' && (
                          <>
                            {t.damage && <div>Damage: <span className="text-fg-secondary">{String(t.damage)}</span></div>}
                            {t.fuse && <div>Fuse: <span className="text-fg-secondary">{String(t.fuse)}</span></div>}
                            {t.cost !== undefined && <div>Cost: <span className="text-fg-secondary">${t.cost}</span></div>}
                            {t.LC !== undefined && <div>LC: <span className="text-fg-secondary">{String(t.LC)}</span></div>}
                            {t.notes && <div>Notes: <span className="text-fg-secondary">{String(t.notes)}</span></div>}
                          </>
                        )}
                      </div>
                    </div>

                    {((c.designShifts && c.designShifts.length > 0) || (c.shifts && c.shifts.length > 0)) && (
                      <div className="bg-surface-3 p-3 rounded">
                        <div className="text-sm font-semibold mb-2">Project History</div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {Array.isArray(c.designShifts) && c.designShifts.length > 0 && (
                            <>
                              <div className="text-xs font-semibold text-yellow-400 mt-2">Design Phase</div>
                              {c.designShifts.filter(s => s).map((s, i) => (
                                <div key={s.id || i} className="text-xs bg-surface-2 p-2 rounded">
                                  <div>Shift {i + 1}: {s.result || 'unknown'} {s.date && <span className="text-accent-400">({s.date})</span>} {s.day && <span className="text-success-400">[Day {s.day}]</span>}</div>
                                  <div className="text-fg-muted">{s.worker && <span>Worker: {s.worker} | </span>}Skill {s.skill || '?'} &rarr; Eff {s.effectiveSkill || '?'} | Roll: {s.roll || '?'} | +{s.hoursAdded || 0}h{(s.qualityChange ?? s.qualityShift) !== 0 && (s.qualityChange ?? s.qualityShift) !== undefined && ` | Qual ${(s.qualityChange ?? s.qualityShift ?? 0) > 0 ? '+' : ''}${s.qualityChange ?? s.qualityShift}`}</div>
                                </div>
                              ))}
                            </>
                          )}
                          {Array.isArray(c.shifts) && c.shifts.length > 0 && (
                            <>
                              <div className="text-xs font-semibold text-success-400 mt-2">Craft Phase</div>
                              {c.shifts.filter(s => s).map((s, i) => (
                                <div key={s.id || i} className="text-xs bg-surface-2 p-2 rounded">
                                  <div>Shift {i + 1}: {s.result || 'unknown'} {s.date && <span className="text-accent-400">({s.date})</span>} {s.day && <span className="text-success-400">[Day {s.day}]</span>}</div>
                                  <div className="text-fg-muted">{s.worker && <span>Worker: {s.worker} | </span>}Skill {s.skill || '?'} &rarr; Eff {s.effectiveSkill || '?'} | Roll: {s.roll || '?'} | +{s.hoursAdded || 0}h{(s.qualityChange ?? s.qualityShift) !== 0 && (s.qualityChange ?? s.qualityShift) !== undefined && ` | Qual ${(s.qualityChange ?? s.qualityShift ?? 0) > 0 ? '+' : ''}${s.qualityChange ?? s.qualityShift}`}</div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-edge-strong">
                      <button
                        onClick={() => {
                          if (confirm(`Delete completed project "${c.name || c.template}"?`)) {
                            saveCrafts(crafts.filter(x => x.id !== c.id));
                          }
                        }}
                        className="w-full px-4 py-2 bg-danger-600 rounded hover:bg-danger-700 text-sm"
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
            <div className="text-fg-faint italic">No completed projects</div>
          )}
        </div>
      </div>
    </div>
  );
}
