import React, { useState } from 'react';
import { DiceRoller } from '../DiceRoller';
import { ASPECTS } from '../../constants';

function generateFalseProfile() {
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

function getIdentificationResult(mos) {
  if (mos >= 6) return 4; // Full Profile
  if (mos >= 4) return 3; // Complete Aspect Profile
  if (mos >= 2) return 2; // Basic (Primary + Secondary)
  return 1; // Partial (Primary only)
}

export function AnalysisView({ reagents, workers, alchemySettings, saveReagents }) {
  const [selectedReagent, setSelectedReagent] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [skill, setSkill] = useState('');
  const [roll, setRoll] = useState('');

  function performAnalysis() {
    if (!selectedReagent || !skill || !roll) {
      alert('Fill all fields');
      return;
    }

    const skillValue = parseInt(skill);
    const rollValue = parseInt(roll);

    if (isNaN(skillValue) || isNaN(rollValue)) {
      alert('Invalid skill or roll values');
      return;
    }

    // Check if reagent has enough quantity
    if (selectedReagent.quantity < 1) {
      alert('Not enough reagent quantity for analysis (requires 1U)');
      return;
    }

    // Calculate margin of success
    const mos = skillValue - rollValue;

    // Determine if critical success or critical failure
    const isCritSuccess = rollValue <= 4 || (rollValue === 5 && skillValue >= 15) || (rollValue === 6 && skillValue >= 16);
    const isCritFail = rollValue === 18 || (rollValue === 17 && skillValue <= 15) || (rollValue === 16 && skillValue <= 6);

    let newIdentificationLevel = selectedReagent.identificationLevel;
    let falseProfile = selectedReagent.falseProfile;

    if (isCritSuccess) {
      newIdentificationLevel = 4; // Full Profile
    } else if (isCritFail) {
      // Generate false profile
      falseProfile = generateFalseProfile();
      newIdentificationLevel = selectedReagent.identificationLevel; // No increase
      alert('Critical Failure! A false profile has been recorded for this reagent. Check the Manager tab to correct it.');
    } else if (mos >= 0) {
      // Success
      const identLevel = getIdentificationResult(mos);
      newIdentificationLevel = Math.max(selectedReagent.identificationLevel, identLevel);
    } else {
      // Failure - no change
      alert(`Analysis failed (MoS: ${mos}). No new information revealed.`);
    }

    // Record analysis in history
    const analysisRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      worker: selectedWorker,
      skill: skillValue,
      roll: rollValue,
      mos: mos,
      result: isCritSuccess ? 'Critical Success' : isCritFail ? 'Critical Failure' : mos >= 0 ? 'Success' : 'Failure',
      identificationLevelBefore: selectedReagent.identificationLevel,
      identificationLevelAfter: newIdentificationLevel
    };

    // Update reagent
    const updatedReagents = reagents.map(r => {
      if (r.id === selectedReagent.id) {
        return {
          ...r,
          quantity: r.quantity - 1, // Consume 1U
          identificationLevel: newIdentificationLevel,
          falseProfile: falseProfile,
          analysisHistory: [...(r.analysisHistory || []), analysisRecord]
        };
      }
      return r;
    });

    saveReagents(updatedReagents);

    // Update local state
    const updated = updatedReagents.find(r => r.id === selectedReagent.id);
    setSelectedReagent(updated);

    // Clear inputs
    setSkill('');
    setRoll('');

    if (!isCritFail && newIdentificationLevel > selectedReagent.identificationLevel) {
      const levels = ['Unidentified', 'Partial', 'Basic', 'Complete', 'Full'];
      alert(`Analysis successful! Identification Level: ${levels[newIdentificationLevel]} (Level ${newIdentificationLevel}/4)`);
    }
  }

  const levelNames = ['Unidentified', 'Partial', 'Basic', 'Complete Aspects', 'Full Profile'];

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
                  {selectedReagent.identificationLevel}/4 - {levelNames[selectedReagent.identificationLevel]}
                </span>
              </div>
            </div>

            {selectedReagent.falseProfile && (
              <div className="mt-3 p-2 bg-red-900 bg-opacity-30 border border-red-500 rounded text-xs text-red-300">
                ⚠️ Warning: This reagent has a false profile from a critical failure. Edit in Manager tab to correct.
              </div>
            )}
          </div>

          {selectedReagent.quantity >= 1 && selectedReagent.identificationLevel < 4 && (
            <div className="bg-gray-700 p-4 rounded space-y-3">
              <h4 className="font-semibold">Perform Analysis</h4>
              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs mb-1">Alchemy Skill</label>
                  <input
                    type="number"
                    value={skill}
                    onChange={(e) => setSkill(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                    placeholder="e.g., 14"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs mb-1">Roll (3d6)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={roll}
                      onChange={(e) => setRoll(e.target.value)}
                      className="flex-1 bg-gray-600 px-3 py-2 rounded"
                      placeholder="3-18"
                      min="3"
                      max="18"
                    />
                    <DiceRoller onRoll={(total) => setRoll(String(total))} />
                  </div>
                  {skill && (
                    <div className="text-xs text-gray-400 mt-1">
                      MoS: {roll ? parseInt(skill) - parseInt(roll) : '?'}
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

          {selectedReagent.identificationLevel >= 4 && (
            <div className="bg-green-900 bg-opacity-30 border border-green-500 p-4 rounded text-center">
              <div className="text-green-400 font-semibold">Fully Identified</div>
              <div className="text-sm text-gray-300 mt-1">
                All properties of this reagent are known.
              </div>
            </div>
          )}

          {selectedReagent.analysisHistory && selectedReagent.analysisHistory.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Analysis History</h4>
              {selectedReagent.analysisHistory.map((a) => (
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
                    Quantity: {r.quantity}U | ID Level: {r.identificationLevel}/4 - {levelNames[r.identificationLevel]}
                    {r.falseProfile && <span className="text-red-400 ml-2">⚠️ False Profile</span>}
                  </div>
                </div>
                <div className="text-sm">
                  <div
                    className={`px-2 py-1 rounded ${
                      r.identificationLevel === 4
                        ? 'bg-green-600'
                        : r.identificationLevel >= 2
                        ? 'bg-yellow-600'
                        : 'bg-gray-600'
                    }`}
                  >
                    {levelNames[r.identificationLevel]}
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
