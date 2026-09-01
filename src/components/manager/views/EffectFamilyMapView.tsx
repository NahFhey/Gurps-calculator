import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { ASPECTS } from '../../../constants';
import type { EffectFamilyMapViewProps, EffectPairData, EffectDefinition } from '../../../types/views';

/**
 * EffectFamilyMapView - Manages aspect pairing effects for alchemy
 *
 * Defines what effects are possible when combining different aspects.
 * Each aspect pairing can have multiple named effects with:
 * - Name and keywords
 * - Player-facing notes
 * - Hidden GM notes
 */
export function EffectFamilyMapView({ effectFamilyMap, saveEffectFamilyMap }: EffectFamilyMapViewProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function addEffect(pairKey: string, pairData: EffectPairData) {
    const newEffect: EffectDefinition = {
      id: crypto.randomUUID(),
      name: '',
      keywords: '',
      notes: '',
      gmNotes: '',
      gmNotesVisible: false
    };

    saveEffectFamilyMap({
      ...effectFamilyMap,
      [pairKey]: {
        ...pairData,
        effects: [...(pairData.effects || []), newEffect]
      }
    });
  }

  function updateEffect(pairKey: string, pairData: EffectPairData, idx: number, updates: Partial<EffectDefinition>) {
    const updatedEffects = [...(pairData.effects || [])];
    updatedEffects[idx] = {...updatedEffects[idx], ...updates};
    saveEffectFamilyMap({
      ...effectFamilyMap,
      [pairKey]: {...pairData, effects: updatedEffects}
    });
  }

  function deleteEffect(pairKey: string, pairData: EffectPairData, idx: number) {
    const updatedEffects = (pairData.effects || []).filter((_, i) => i !== idx);
    saveEffectFamilyMap({
      ...effectFamilyMap,
      [pairKey]: {...pairData, effects: updatedEffects}
    });
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Effect Family Map (Aspect Pairings)</h2>
      <p className="text-sm text-fg-muted mb-6">
        Define possible effects for each aspect pairing. Click a pairing to expand and add effects.
      </p>

      <div className="space-y-2">
        {ASPECTS.map(dominant =>
          ASPECTS.map(secondary => {
            const pairKey = `${dominant}/${secondary}`;
            const pairData: EffectPairData = effectFamilyMap[pairKey] || { summary: '', effects: [] };
            const isExpanded = expanded[pairKey];

            return (
              <div key={pairKey} className="bg-surface-2 rounded">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-3"
                  onClick={() => setExpanded(p => ({...p, [pairKey]: !p[pairKey]}))}
                >
                  <span className="font-semibold w-32">{dominant}/{secondary}</span>
                  <span className="flex-1 text-sm text-fg-muted italic">
                    {pairData.summary || 'No summary'}
                  </span>
                  <span className="text-xs text-accent-400">
                    {pairData.effects?.length || 0} effect{pairData.effects?.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-fg-muted">{isExpanded ? '▼' : '▶'}</span>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-4 border-t border-edge-strong pt-3">
                    {/* Summary field */}
                    <div>
                      <label className="block text-xs text-fg-muted mb-1">Summary (quick reference)</label>
                      <textarea
                        value={pairData.summary || ''}
                        onChange={(e) => {
                          saveEffectFamilyMap({
                            ...effectFamilyMap,
                            [pairKey]: {
                              ...pairData,
                              summary: e.target.value
                            }
                          });
                        }}
                        placeholder="Brief summary of possible effects for this pairing..."
                        className="w-full bg-surface-3 px-3 py-2 rounded text-sm"
                        rows={2}
                      />
                    </div>

                    {/* Effects list */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-semibold">Named Effects</label>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addEffect(pairKey, pairData);
                          }}
                          className="bg-accent-600 px-3 py-1 rounded text-sm"
                        >
                          <Plus size={14} className="inline" /> Add Effect
                        </button>
                      </div>

                      {(!pairData.effects || pairData.effects.length === 0) && (
                        <div className="text-fg-faint text-sm italic mb-2">No effects defined</div>
                      )}

                      {pairData.effects?.map((effect, idx) => (
                        <div key={effect.id} className="bg-surface-1 p-3 rounded mb-2 space-y-2">
                          <div className="flex gap-2">
                            <input
                              value={effect.name}
                              onChange={(e) => updateEffect(pairKey, pairData, idx, { name: e.target.value })}
                              placeholder="Effect name (e.g., 'Quicksilver Reflex')"
                              className="flex-1 bg-surface-3 px-3 py-1 rounded text-sm font-semibold"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEffect(pairKey, pairData, idx);
                              }}
                              className="text-danger-400 px-2"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div>
                            <label className="block text-xs text-fg-faint mb-1">Keywords/Tags</label>
                            <input
                              value={effect.keywords}
                              onChange={(e) => updateEffect(pairKey, pairData, idx, { keywords: e.target.value })}
                              placeholder="speed, reflex, stamina"
                              className="w-full bg-surface-3 px-3 py-1 rounded text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-fg-faint mb-1">Notes / Trait Packages</label>
                            <textarea
                              value={effect.notes}
                              onChange={(e) => updateEffect(pairKey, pairData, idx, { notes: e.target.value })}
                              placeholder="Player-facing notes, trait packages, etc."
                              className="w-full bg-surface-3 px-3 py-1 rounded text-sm"
                              rows={2}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-fg-faint">GM Notes</label>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateEffect(pairKey, pairData, idx, { gmNotesVisible: !effect.gmNotesVisible });
                                }}
                                className="text-xs px-2 py-1 bg-surface-2 rounded flex items-center gap-1"
                              >
                                {effect.gmNotesVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                {effect.gmNotesVisible ? 'Visible' : 'Hidden'}
                              </button>
                            </div>
                            <textarea
                              value={effect.gmNotes}
                              onChange={(e) => updateEffect(pairKey, pairData, idx, { gmNotes: e.target.value })}
                              placeholder="Hidden GM notes..."
                              className="w-full bg-surface-3 px-3 py-1 rounded text-sm"
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
