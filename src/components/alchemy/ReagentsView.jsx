import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { getReagentAspectPoints } from '../../utils/alchemy';

export function ReagentsView({ reagents, alchemySettings }) {
  const [expanded, setExpanded] = useState({});

  const levelNames = ['Unidentified', 'Partial', 'Basic', 'Complete', 'Full'];
  const showObviousRoles = alchemySettings?.showObviousRoles !== false;
  const physicalRoles = ['Solvent', 'Binder', 'Tool'];

  function getVisibleInfo(reagent) {
    const level = reagent.identificationLevel || 0;
    const profile = reagent.falseProfile || reagent;

    const visible = {
      name: reagent.name,
      quantity: reagent.quantity,
      identificationLevel: level,
      hasFalseProfile: !!reagent.falseProfile
    };

    // Show physical roles if setting enabled
    if (showObviousRoles && reagent.roles) {
      visible.physicalRoles = reagent.roles.filter(r => physicalRoles.includes(r));
    }

    // Level 1+: Primary Aspect
    if (level >= 1) {
      visible.primaryAspect = profile.aspects?.primary;
    }

    // Level 2+: Secondary Aspect
    if (level >= 2) {
      visible.secondaryAspect = profile.aspects?.secondary;
    }

    // Level 3+: Tertiary Aspect
    if (level >= 3) {
      visible.tertiaryAspect = profile.aspects?.tertiary;
    }

    // Level 4: Full Profile
    if (level >= 4) {
      visible.basePotency = profile.basePotency;
      visible.concentrationSteps = profile.concentrationSteps || 0;
      visible.refinement = profile.refinement;
      visible.roles = profile.roles;
      visible.primaryRole = profile.primaryRole;
      visible.hazards = profile.hazards || [];
      visible.processingNotes = profile.processingNotes;
    }

    return visible;
  }

  function getFinalPotency(basePotency, concentrationSteps) {
    const levels = ['P0', 'P1', 'P2', 'P3', 'P4'];
    const baseLevel = levels.indexOf(basePotency || 'P1');
    const final = Math.min(4, Math.max(0, baseLevel) + (concentrationSteps || 0));
    return levels[final];
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Alchemy Reagents</h2>
        <div className="text-sm text-gray-400">
          {reagents.length} reagent{reagents.length !== 1 ? 's' : ''} available
        </div>
      </div>

      <div className="mb-4 bg-blue-900 bg-opacity-30 border border-blue-500 p-3 rounded text-sm">
        <div className="font-semibold mb-1">Information Display</div>
        <div className="text-xs text-gray-300">
          This view shows only <strong>known information</strong> based on reagent identification level.
          Use the <strong>Analysis</strong> tab to identify reagents and reveal their properties.
          Manage reagents (add/edit/delete) in the <strong>Manager</strong> tab.
        </div>
      </div>

      {reagents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No reagents in inventory. Add reagents in the Manager tab.
        </div>
      )}

      <div className="space-y-2">
        {reagents.map(r => {
          const info = getVisibleInfo(r);
          const level = info.identificationLevel;

          return (
            <div key={r.id} className="bg-gray-700 rounded">
              <div
                className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
                onClick={() => setExpanded(p => ({...p, [r.id]: !p[r.id]}))}
              >
                <span className="flex-1 font-medium">
                  {info.name}
                  {r.baseReagentName && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-purple-600 rounded" title="Derived reagent">⚗️</span>
                  )}
                </span>

                {/* Aspects display */}
                <span className="text-sm text-blue-400">
                  {level >= 1 ? info.primaryAspect : '???'}
                  {' / '}
                  {level >= 2 ? info.secondaryAspect : '???'}
                  {' / '}
                  {level >= 3 ? info.tertiaryAspect : '???'}
                </span>

                {/* Quantity */}
                <span className="text-sm text-gray-400">{info.quantity}U</span>

                {/* Identification level */}
                <span className={`text-xs px-2 py-1 rounded ${
                  level === 4 ? 'bg-green-600' :
                  level >= 2 ? 'bg-yellow-600' :
                  'bg-gray-600'
                }`}>
                  {levelNames[level]}
                </span>

                {/* False profile warning */}
                {info.hasFalseProfile && (
                  <span className="text-xs text-red-400">⚠️</span>
                )}

                <span className="text-gray-400">{expanded[r.id] ? '▼' : '▶'}</span>
              </div>

              {expanded[r.id] && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-600 pt-3">
                  {/* Identification Level */}
                  <div className="bg-gray-800 p-3 rounded">
                    <div className="text-sm font-semibold mb-2">Identification: Level {level}/4 - {levelNames[level]}</div>
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{width: `${(level / 4) * 100}%`}}
                      />
                    </div>
                    {info.hasFalseProfile && (
                      <div className="mt-2 text-xs text-red-300 bg-red-900 bg-opacity-30 p-2 rounded border border-red-500">
                        ⚠️ This reagent has a false profile from a failed analysis. Edit in Manager tab to correct.
                      </div>
                    )}
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Name:</span> {info.name}
                    </div>
                    <div>
                      <span className="text-gray-400">Quantity:</span> {info.quantity} Units
                    </div>
                  </div>

                  {/* Aspects */}
                  <div>
                    <div className="text-sm font-semibold mb-2">Aspects</div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-gray-800 p-2 rounded">
                        <div className="text-xs text-gray-500">Primary (3pts)</div>
                        <div className={level >= 1 ? 'text-blue-400' : 'text-gray-500'}>
                          {level >= 1 ? info.primaryAspect : '???'}
                        </div>
                      </div>
                      <div className="bg-gray-800 p-2 rounded">
                        <div className="text-xs text-gray-500">Secondary (2pts)</div>
                        <div className={level >= 2 ? 'text-blue-400' : 'text-gray-500'}>
                          {level >= 2 ? info.secondaryAspect : '???'}
                        </div>
                      </div>
                      <div className="bg-gray-800 p-2 rounded">
                        <div className="text-xs text-gray-500">Tertiary (1pt)</div>
                        <div className={level >= 3 ? 'text-blue-400' : 'text-gray-500'}>
                          {level >= 3 ? info.tertiaryAspect : '???'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Potency (Level 4 only) */}
                  {level >= 4 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Potency</div>
                      <div className="text-sm bg-gray-800 p-2 rounded">
                        <span className="text-gray-400">Base:</span> {info.basePotency}
                        {info.concentrationSteps > 0 && (
                          <span className="text-purple-400">
                            {' '}+{info.concentrationSteps} → {getFinalPotency(info.basePotency, info.concentrationSteps)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Roles */}
                  <div>
                    <div className="text-sm font-semibold mb-2">Roles</div>
                    {level >= 4 ? (
                      <div className="flex flex-wrap gap-2">
                        {(info.roles || []).map(role => (
                          <span key={role} className="text-xs px-2 py-1 bg-yellow-600 rounded">
                            {role}
                          </span>
                        ))}
                        {(!info.roles || info.roles.length === 0) && (
                          <span className="text-xs text-gray-500">No roles defined</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm">
                        {info.physicalRoles && info.physicalRoles.length > 0 ? (
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Obvious physical roles:</div>
                            <div className="flex flex-wrap gap-2">
                              {info.physicalRoles.map(role => (
                                <span key={role} className="text-xs px-2 py-1 bg-gray-600 rounded">
                                  {role}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            Unknown (requires full identification)
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hazards (Level 4 only) */}
                  {level >= 4 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Hazards</div>
                      {info.hazards && info.hazards.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {info.hazards.map(hazard => (
                            <span key={hazard} className="text-xs px-2 py-1 bg-red-600 rounded">
                              {hazard}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">No hazards</div>
                      )}
                    </div>
                  )}

                  {/* Refinement (Level 4 only) */}
                  {level >= 4 && info.refinement && (
                    <div className="text-sm">
                      <span className="text-gray-400">Refinement:</span>{' '}
                      <span className="capitalize">{info.refinement}</span>
                    </div>
                  )}

                  {/* Derived Reagent Indicator */}
                  {r.baseReagentName && (
                    <div className="bg-purple-900 bg-opacity-30 border border-purple-500 p-3 rounded text-sm">
                      <div className="font-semibold mb-1 text-purple-300">⚗️ Derived Reagent</div>
                      <div className="text-xs text-gray-300">
                        <div><span className="text-gray-400">Base Material:</span> {r.baseReagentName}</div>
                        {r.identityId && <div className="text-xs text-gray-500 mt-1">
                          Shares identification progress with other {r.baseReagentName} variants
                        </div>}
                      </div>
                    </div>
                  )}

                  {/* Processing Log */}
                  {r.processingLog && r.processingLog.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Processing History</div>
                      <div className="space-y-2">
                        {r.processingLog.slice().reverse().map((log, idx) => (
                          <div key={idx} className="bg-gray-800 p-3 rounded text-xs">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-semibold text-cyan-400 capitalize">{log.operation}</span>
                              <span className="text-gray-500">{new Date(log.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-gray-300 mb-2">
                              <div><span className="text-gray-400">Input:</span> {log.inputUnits}U</div>
                              <div><span className="text-gray-400">Output:</span> {log.outputUnits}U</div>
                              <div><span className="text-gray-400">Worker:</span> {log.worker}</div>
                              <div><span className="text-gray-400">Lab:</span> {log.lab}</div>
                            </div>
                            {log.results && log.results.length > 0 && (
                              <div className="border-t border-gray-700 pt-2 mt-2">
                                <div className="text-gray-400 mb-1">Attempts:</div>
                                <div className="space-y-1">
                                  {log.results.map((result, ridx) => (
                                    <div key={ridx} className="flex justify-between text-xs">
                                      <span>#{result.attempt}: Roll {result.roll}</span>
                                      <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                                        {result.success ? '✓' : '✗'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processing Notes (Level 4 only) */}
                  {level >= 4 && info.processingNotes && (
                    <div>
                      <div className="text-sm font-semibold mb-1">Processing Notes</div>
                      <div className="text-xs text-gray-300 bg-gray-800 p-2 rounded">
                        {info.processingNotes}
                      </div>
                    </div>
                  )}

                  {/* Call to action for unidentified/partially identified */}
                  {level < 4 && (
                    <div className="mt-3 bg-blue-900 bg-opacity-30 border border-blue-500 p-3 rounded text-xs">
                      <div className="font-semibold mb-1">Need more information?</div>
                      <div className="text-gray-300">
                        Use the <strong>Analysis</strong> tab to perform identification and reveal additional properties.
                        Each analysis consumes 1U of this reagent.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

ReagentsView.propTypes = {
  reagents: PropTypes.array.isRequired,
  alchemySettings: PropTypes.object
};
