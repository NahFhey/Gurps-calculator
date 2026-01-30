import { useState } from 'react';
import { DiceRoller } from '../DiceRoller';
import { ASPECTS } from '../../constants';
import type { AlchemyReagent, Worker } from '../../types/views';
import type { AlchemyLab, AlchemySettings } from '../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface FalseProfile {
  aspects: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  basePotency: string;
  hazards: string[];
}

interface AnalysisRecord {
  id: string;
  date: string;
  worker: string;
  lab: string;
  skill: number;
  labBonus: number;
  effectiveSkill: number;
  roll: number;
  mos: number;
  result: 'Critical Success' | 'Critical Failure' | 'Success' | 'Failure';
  identificationLevelBefore: number;
  identificationLevelAfter: number;
}

interface DiceRollState {
  dice: number[];
  total: number;
}

export interface AnalysisViewProps {
  reagents: AlchemyReagent[];
  labs: AlchemyLab[];
  workers: Worker[];
  _alchemySettings?: AlchemySettings;
  saveReagents: (reagents: AlchemyReagent[]) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateFalseProfile(): FalseProfile {
  const randomAspect = () => ASPECTS[Math.floor(Math.random() * ASPECTS.length)];
  const randomPotency = () => ['P0', 'P1', 'P2', 'P3', 'P4'][Math.floor(Math.random() * 5)];

  return {
    aspects: {
      primary: randomAspect(),
      secondary: randomAspect(),
      tertiary: randomAspect()
    },
    basePotency: randomPotency(),
    hazards: [] // Could add random hazards here if desired
  };
}

function getIdentificationResult(mos: number): number {
  if (mos >= 6) return 4; // Full Profile
  if (mos >= 4) return 3; // Complete Aspect Profile
  if (mos >= 2) return 2; // Basic (Primary + Secondary)
  return 1; // Partial (Primary only)
}

// ============================================================================
// COMPONENT
// ============================================================================

const levelNames = ['Unidentified', 'Partial', 'Basic', 'Complete Aspects', 'Full Profile'];

export function AnalysisView({ reagents, labs, workers, saveReagents }: AnalysisViewProps) {
  const [selectedReagent, setSelectedReagent] = useState<AlchemyReagent | null>(null);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedLabId, setSelectedLabId] = useState(labs?.[0]?.id || 'default');
  const [skill, setSkill] = useState('');
  const [roll, setRoll] = useState<DiceRollState>({ dice: [], total: 0 });

  function performAnalysis() {
    if (!selectedReagent || !skill || !roll.total) {
      alert('Fill all fields');
      return;
    }

    const skillValue = parseInt(skill);
    const rollValue = roll.total;

    if (isNaN(skillValue) || isNaN(rollValue)) {
      alert('Invalid skill or roll values');
      return;
    }

    // Check if reagent has enough quantity
    if (selectedReagent.quantity < 1) {
      alert('Not enough reagent quantity for analysis (requires 1U)');
      return;
    }

    // Get lab and apply lab rating bonus
    const selectedLab = labs?.find(l => l.id === selectedLabId) || { id: 'default', name: 'Basic Lab', rating: 0 };
    const labBonus = selectedLab.rating || 0;
    const effectiveSkill = skillValue + labBonus;

    // Calculate margin of success with lab bonus
    const mos = effectiveSkill - rollValue;

    // Determine if critical success or critical failure (use effective skill with lab bonus)
    const isCritSuccess = rollValue <= 4 || (rollValue === 5 && effectiveSkill >= 15) || (rollValue === 6 && effectiveSkill >= 16);
    const isCritFail = rollValue === 18 || (rollValue === 17 && effectiveSkill <= 15) || (rollValue === 16 && effectiveSkill <= 6);

    let newIdentificationLevel = selectedReagent.identificationLevel ?? 0;
    let falseProfile = selectedReagent.falseProfile;

    if (isCritSuccess) {
      newIdentificationLevel = 4; // Full Profile
    } else if (isCritFail) {
      // Generate false profile
      falseProfile = generateFalseProfile();
      newIdentificationLevel = selectedReagent.identificationLevel ?? 0; // No increase
      alert('Critical Failure! A false profile has been recorded for this reagent. Check the Manager tab to correct it.');
    } else if (mos >= 0) {
      // Success
      const identLevel = getIdentificationResult(mos);
      newIdentificationLevel = Math.max(selectedReagent.identificationLevel ?? 0, identLevel);
    } else {
      // Failure - no change
      alert(`Analysis failed (MoS: ${mos}). No new information revealed.`);
    }

    // Record analysis in history
    const analysisRecord: AnalysisRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      worker: selectedWorker,
      lab: selectedLab.name,
      skill: skillValue,
      labBonus: labBonus,
      effectiveSkill: effectiveSkill,
      roll: rollValue,
      mos: mos,
      result: isCritSuccess ? 'Critical Success' : isCritFail ? 'Critical Failure' : mos >= 0 ? 'Success' : 'Failure',
      identificationLevelBefore: selectedReagent.identificationLevel ?? 0,
      identificationLevelAfter: newIdentificationLevel
    };

    // Update reagent and all sister reagents sharing the same identityId
    const targetIdentityId = (selectedReagent as AlchemyReagent & { identityId?: string }).identityId || selectedReagent.id;
    const updatedReagents = reagents.map(r => {
      const reagentWithIdentity = r as AlchemyReagent & { identityId?: string };
      // Check if this is the analyzed reagent
      if (r.id === selectedReagent.id) {
        return {
          ...r,
          quantity: r.quantity - 1, // Consume 1U
          identificationLevel: newIdentificationLevel,
          falseProfile: falseProfile,
          analysisHistory: [...(r.analysisHistory || []), analysisRecord]
        };
      }
      // Check if this is a sister reagent (shares identityId)
      const reagentIdentityId = reagentWithIdentity.identityId || r.id;
      if (reagentIdentityId === targetIdentityId && r.id !== selectedReagent.id) {
        // Update identification level but don't consume quantity or add history
        return {
          ...r,
          identificationLevel: Math.max(r.identificationLevel ?? 0, newIdentificationLevel),
          falseProfile: falseProfile // Apply same false profile if crit fail
        };
      }
      return r;
    });

    saveReagents(updatedReagents);

    // Update local state
    const updated = updatedReagents.find(r => r.id === selectedReagent.id);
    if (updated) {
      setSelectedReagent(updated);
    }

    // Clear inputs
    setSkill('');
    setRoll({ dice: [], total: 0 });

    if (!isCritFail && newIdentificationLevel > (selectedReagent.identificationLevel ?? 0)) {
      const levels = ['Unidentified', 'Partial', 'Basic', 'Complete', 'Full'];
      alert(`Analysis successful! Identification Level: ${levels[newIdentificationLevel]} (Level ${newIdentificationLevel}/4)`);
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Reagent Analysis</h2>
      <p className="text-sm text-gray-400 mb-6">
        Analyze reagents to identify their properties. Each analysis consumes 1U of the reagent.
      </p>

      {selectedReagent ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{selectedReagent.name}</h3>
            <button
              onClick={() => setSelectedReagent(null)}
              className="bg-gray-600 px-4 py-2 rounded"
            >
              ← Back to List
            </button>
          </div>

          <div className="bg-gray-700 p-4 rounded">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Quantity:</span>{' '}
                <span className={selectedReagent.quantity < 1 ? 'text-red-400' : 'text-white'}>
                  {selectedReagent.quantity}U
                </span>
              </div>
              <div>
                <span className="text-gray-400">Identification Level:</span>{' '}
                <span className="text-blue-400">
                  {selectedReagent.identificationLevel ?? 0}/4 - {levelNames[selectedReagent.identificationLevel ?? 0]}
                </span>
              </div>
            </div>

            {selectedReagent.falseProfile && (
              <div className="mt-3 p-2 bg-red-900 bg-opacity-30 border border-red-500 rounded text-xs text-red-300">
                ⚠️ Warning: This reagent has a false profile from a critical failure. Edit in Manager tab to correct.
              </div>
            )}
          </div>

          {selectedReagent.quantity >= 1 && (selectedReagent.identificationLevel ?? 0) < 4 && (
            <div className="bg-gray-700 p-4 rounded space-y-3">
              <h4 className="font-semibold">Perform Analysis</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs mb-1">Worker</label>
                  <select
                    value={selectedWorker}
                    onChange={(e) => {
                      const worker = workers.find(w => w.name === e.target.value);
                      setSelectedWorker(e.target.value);
                      if (worker?.skills) {
                        setSkill(String(worker.skills.alchemy || 10));
                      }
                    }}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">Select worker...</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Lab</label>
                  <select
                    value={selectedLabId}
                    onChange={(e) => setSelectedLabId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    {(labs || [{ id: 'default', name: 'Basic Lab', rating: 0 }]).map(lab => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name} (+{lab.rating})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Alchemy Skill</label>
                  <input
                    type="number"
                    value={skill}
                    onChange={(e) => setSkill(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                    placeholder="e.g., 14"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs mb-1">Roll (3d6)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={roll.total || ''}
                      onChange={(e) => setRoll({ dice: [], total: parseInt(e.target.value) || 0 })}
                      className="flex-1 bg-gray-600 px-3 py-2 rounded"
                      placeholder="3-18"
                      min="3"
                      max="18"
                    />
                    <DiceRoller
                      dice={roll.dice}
                      total={roll.total}
                      onRoll={(dice, total) => setRoll({ dice, total })}
                      onTotalChange={(total) => setRoll({ dice: [], total })}
                    />
                  </div>
                  {skill && (
                    <div className="text-xs text-gray-400 mt-1">
                      {(() => {
                        const selectedLab = labs?.find(l => l.id === selectedLabId) || { rating: 0 };
                        const labBonus = selectedLab.rating || 0;
                        const effectiveSkill = parseInt(skill) + labBonus;
                        const mos = roll.total ? effectiveSkill - roll.total : '?';
                        return labBonus > 0
                          ? `Effective Skill: ${skill} + ${labBonus} (lab) = ${effectiveSkill} | MoS: ${mos}`
                          : `MoS: ${mos}`;
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={performAnalysis}
                className="w-full bg-green-600 px-4 py-2 rounded hover:bg-green-700"
              >
                Perform Analysis (Consumes 1U)
              </button>

              <div className="text-xs text-gray-400 bg-gray-800 p-3 rounded">
                <div className="font-semibold mb-1">Identification Levels:</div>
                <div>MoS 0-1: Level 1 (Primary Aspect)</div>
                <div>MoS 2-3: Level 2 (Primary + Secondary)</div>
                <div>MoS 4-5: Level 3 (All Aspects)</div>
                <div>MoS 6+: Level 4 (Full Profile: Aspects + Potency + Hazards)</div>
                <div className="mt-2">Critical Success: Full Profile immediately</div>
                <div>Critical Failure: False profile recorded (no ID increase)</div>
              </div>
            </div>
          )}

          {(selectedReagent.identificationLevel ?? 0) >= 4 && (
            <div className="bg-green-900 bg-opacity-30 border border-green-500 p-4 rounded text-center">
              <div className="text-green-400 font-semibold">Fully Identified</div>
              <div className="text-sm text-gray-300 mt-1">
                All properties of this reagent are known.
              </div>
            </div>
          )}

          {selectedReagent.analysisHistory && (selectedReagent.analysisHistory as AnalysisRecord[]).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Analysis History</h4>
              {(selectedReagent.analysisHistory as AnalysisRecord[]).map((a) => (
                <div key={a.id} className="bg-gray-700 p-3 rounded text-sm">
                  <div className="flex justify-between">
                    <span>{a.result}</span>
                    <span className="text-gray-400">{new Date(a.date).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {a.worker} | Skill {a.skill} | Roll: {a.roll} | MoS: {a.mos} | Level {a.identificationLevelBefore} → {a.identificationLevelAfter}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-semibold mb-2">Select Reagent to Analyze</h3>
          {reagents.filter(r => r.quantity > 0).map((r) => (
            <div
              key={r.id}
              className="bg-gray-700 p-3 rounded cursor-pointer hover:bg-gray-600"
              onClick={() => setSelectedReagent(r)}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Quantity: {r.quantity}U | ID Level: {r.identificationLevel ?? 0}/4 - {levelNames[r.identificationLevel ?? 0]}
                    {r.falseProfile && <span className="text-red-400 ml-2">⚠️ False Profile</span>}
                  </div>
                </div>
                <div className="text-sm">
                  <div
                    className={`px-2 py-1 rounded ${
                      (r.identificationLevel ?? 0) === 4
                        ? 'bg-green-600'
                        : (r.identificationLevel ?? 0) >= 2
                        ? 'bg-yellow-600'
                        : 'bg-gray-600'
                    }`}
                  >
                    {levelNames[r.identificationLevel ?? 0]}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {reagents.filter(r => r.quantity > 0).length === 0 && (
            <div className="text-gray-500 text-center py-4">No reagents available for analysis</div>
          )}
        </div>
      )}
    </div>
  );
}
