import React, { useState } from 'react';
import { DiceRoller } from '../DiceRoller';
import {
  calculateProcessingDifficulty,
  roll3d6,
  evaluateProcessingResult,
  createDerivedReagentName
} from '../../utils/alchemy';
import { POTENCY_LEVELS } from '../../constants';

const REFINEMENT_LEVELS = {
  crude: { next: 'prepared', label: 'Crude' },
  prepared: { next: 'refined', label: 'Prepared' },
  refined: { next: null, label: 'Refined' }
};

export function ConcentrationRefinementView({ reagents, labs, workers, saveReagents }) {
  const [selectedReagentId, setSelectedReagentId] = useState(null);
  const [operation, setOperation] = useState('refine'); // 'refine' or 'concentrate'
  const [outputUnits, setOutputUnits] = useState(1);
  const [selectedLabId, setSelectedLabId] = useState(labs?.[0]?.id || 'default');
  const [selectedWorkerId, setSelectedWorkerId] = useState(workers?.[0]?.id || '1');
  const [roll, setRoll] = useState('');
  const [processingLog, setProcessingLog] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const selectedReagent = reagents.find(r => r.id === selectedReagentId);
  const selectedLab = labs?.find(l => l.id === selectedLabId) || { id: 'default', name: 'Basic Lab', rating: 0 };
  const selectedWorker = workers?.find(w => w.id === selectedWorkerId) || { name: 'Worker', skills: { alchemy: 10 } };

  // Calculate input units required (2:1 ratio)
  const inputUnitsRequired = outputUnits * 2;

  // Determine target refinement/potency
  let targetRefinement = null;
  let targetPotency = null;
  let canProcess = false;

  if (selectedReagent) {
    const currentRefinement = selectedReagent.refinement || 'crude';
    const currentPotency = selectedReagent.basePotency || 'P1';
    const currentConcentration = selectedReagent.concentrationSteps || 0;

    if (operation === 'refine') {
      targetRefinement = REFINEMENT_LEVELS[currentRefinement]?.next;
      canProcess = targetRefinement && selectedReagent.quantity >= inputUnitsRequired;
    } else {
      // Calculate target potency for concentration
      const currentPotencyIndex = POTENCY_LEVELS.indexOf(currentPotency);
      const targetPotencyIndex = Math.min(POTENCY_LEVELS.length - 1, currentPotencyIndex + currentConcentration + 1);
      targetPotency = POTENCY_LEVELS[targetPotencyIndex];
      canProcess = selectedReagent.quantity >= inputUnitsRequired && targetPotency !== 'P4' || currentPotency !== 'P4';
    }
  }

  // Calculate difficulty
  let difficultyCalc = null;
  if (selectedReagent && canProcess) {
    const currentRefinement = selectedReagent.refinement || 'crude';
    const currentPotency = selectedReagent.basePotency || 'P1';

    difficultyCalc = calculateProcessingDifficulty({
      operation,
      currentRefinement,
      targetRefinement,
      inputPotency: currentPotency,
      targetPotency: targetPotency,
      outputUnits,
      alchemySkill: selectedWorker.skills.alchemy,
      labRating: selectedLab.rating
    });
  }

  function startProcessing() {
    if (!canProcess || !selectedReagent) {
      alert('Cannot process: check reagent selection and availability');
      return;
    }

    if (!roll) {
      alert('Please enter or roll a 3d6 result');
      return;
    }

    setProcessingLog([]);
    setShowResults(false);

    // Process each output unit sequentially
    const results = [];
    let inputConsumed = 0;
    let outputProduced = 0;
    const outputHazards = [...(selectedReagent.hazards || [])];

    for (let i = 0; i < outputUnits; i++) {
      // Use the roll value for all attempts in this batch
      const rollValue = parseInt(roll) || 10;

      // Evaluate result
      const result = evaluateProcessingResult(rollValue, difficultyCalc.effectiveSkill, outputHazards);

      // Update counters
      inputConsumed += 2; // Always consume 2U input per attempt

      if (result.outputProduced) {
        outputProduced += 1;
        if (result.hazardAdded) {
          outputHazards.push(result.hazardAdded);
        }
        if (result.reclaim) {
          inputConsumed -= 1; // Critical success reclaims 1U
        }
      }

      results.push({
        attemptNumber: i + 1,
        roll,
        ...result
      });
    }

    setProcessingLog(results);
    setShowResults(true);

    // Apply results to reagents
    applyProcessingResults(results, inputConsumed, outputProduced, outputHazards);
  }

  function applyProcessingResults(results, inputConsumed, outputProduced, outputHazards) {
    if (outputProduced === 0) {
      // No output, just reduce input reagent
      const updatedReagents = reagents.map(r => {
        if (r.id === selectedReagentId) {
          return {
            ...r,
            quantity: Math.max(0, r.quantity - inputConsumed)
          };
        }
        return r;
      });
      saveReagents(updatedReagents);
      return;
    }

    // Create or update derived reagent
    const currentRefinement = selectedReagent.refinement || 'crude';
    const currentPotency = selectedReagent.basePotency || 'P1';
    const currentConcentration = selectedReagent.concentrationSteps || 0;

    let newRefinement = currentRefinement;
    let newConcentration = currentConcentration;

    if (operation === 'refine') {
      newRefinement = targetRefinement;
    } else {
      newConcentration = currentConcentration + 1;
    }

    // Create derived reagent name
    const derivedName = createDerivedReagentName(
      selectedReagent.baseReagentName || selectedReagent.name,
      newRefinement,
      newConcentration
    );

    // Prepare processing log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      inputUnits: inputConsumed,
      outputUnits: outputProduced,
      worker: selectedWorker.name,
      lab: selectedLab.name,
      results: results.map(r => ({
        attempt: r.attemptNumber,
        roll: r.roll,
        success: r.success,
        message: r.message
      }))
    };

    // Find existing derived reagent or create new
    const existingDerived = reagents.find(r =>
      r.baseReagentName === (selectedReagent.baseReagentName || selectedReagent.name) &&
      r.refinement === newRefinement &&
      (r.concentrationSteps || 0) === newConcentration
    );

    let updatedReagents;

    if (existingDerived) {
      // Add to existing derived reagent
      updatedReagents = reagents.map(r => {
        if (r.id === selectedReagentId) {
          // Reduce input reagent
          return {
            ...r,
            quantity: Math.max(0, r.quantity - inputConsumed)
          };
        } else if (r.id === existingDerived.id) {
          // Add to existing derived
          return {
            ...r,
            quantity: r.quantity + outputProduced,
            hazards: [...new Set([...(r.hazards || []), ...outputHazards])],
            processingLog: [...(r.processingLog || []), logEntry]
          };
        }
        return r;
      });
    } else {
      // Create new derived reagent
      const newDerived = {
        ...selectedReagent,
        id: crypto.randomUUID(),
        name: derivedName,
        baseReagentName: selectedReagent.baseReagentName || selectedReagent.name,
        identityId: selectedReagent.identityId || selectedReagent.id,
        quantity: outputProduced,
        refinement: newRefinement,
        concentrationSteps: newConcentration,
        hazards: outputHazards,
        processingLog: [logEntry]
      };

      updatedReagents = [
        ...reagents.map(r => {
          if (r.id === selectedReagentId) {
            return {
              ...r,
              quantity: Math.max(0, r.quantity - inputConsumed)
            };
          }
          return r;
        }),
        newDerived
      ];
    }

    saveReagents(updatedReagents);
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 p-4 rounded">
        <h3 className="text-xl font-bold mb-4">Reagent Processing</h3>
        <p className="text-sm text-gray-400 mb-4">
          Process reagents through refinement or concentration. Each operation requires Alchemy rolls and consumes 2U input per 1U output.
        </p>

        {/* Roll Input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Roll Result</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={roll}
              onChange={(e) => setRoll(e.target.value)}
              placeholder="3-18"
              min="3"
              max="18"
              className="flex-1 bg-gray-700 px-3 py-2 rounded"
            />
            <DiceRoller onRoll={(total) => setRoll(String(total))} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            This roll will be used for all {outputUnits} output unit attempt{outputUnits !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Selection Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Reagent</label>
            <select
              value={selectedReagentId || ''}
              onChange={(e) => setSelectedReagentId(e.target.value)}
              className="w-full bg-gray-700 px-3 py-2 rounded"
            >
              <option value="">-- Choose Reagent --</option>
              {reagents.filter(r => r.quantity > 0).map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.quantity}U, {REFINEMENT_LEVELS[r.refinement || 'crude'].label}, {r.basePotency || 'P1'}{(r.concentrationSteps || 0) > 0 ? ` +${r.concentrationSteps}` : ''})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Operation</label>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              className="w-full bg-gray-700 px-3 py-2 rounded"
            >
              <option value="refine">Refine (Improve Quality)</option>
              <option value="concentrate">Concentrate (Increase Potency)</option>
            </select>
          </div>
        </div>

        {/* Lab and Worker Selection */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Lab</label>
            <select
              value={selectedLabId}
              onChange={(e) => setSelectedLabId(e.target.value)}
              className="w-full bg-gray-700 px-3 py-2 rounded"
            >
              {(labs || [{ id: 'default', name: 'Basic Lab', rating: 0 }]).map(lab => (
                <option key={lab.id} value={lab.id}>
                  {lab.name} (Rating {lab.rating})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Alchemist</label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full bg-gray-700 px-3 py-2 rounded"
            >
              {workers.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} (Alchemy {w.skills.alchemy})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Output Units */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Output Units to Attempt</label>
          <input
            type="number"
            value={outputUnits}
            onChange={(e) => setOutputUnits(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-gray-700 px-3 py-2 rounded"
            min="1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Requires {inputUnitsRequired}U input (2:1 ratio). Each attempt needs a separate roll.
          </p>
        </div>

        {/* Current Status */}
        {selectedReagent && (
          <div className="bg-gray-700 p-4 rounded mb-4">
            <h4 className="text-lg font-semibold mb-2">Current Status: {selectedReagent.name}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <span className="text-gray-400">Available:</span>
                <span className="ml-2 font-semibold text-yellow-400">{selectedReagent.quantity}U</span>
              </div>
              <div>
                <span className="text-gray-400">Required Input:</span>
                <span className="ml-2 font-semibold text-orange-400">{inputUnitsRequired}U</span>
              </div>
              <div>
                <span className="text-gray-400">Refinement:</span>
                <span className="ml-2 capitalize font-semibold text-blue-400">
                  {REFINEMENT_LEVELS[selectedReagent.refinement || 'crude'].label}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Potency:</span>
                <span className="ml-2 font-semibold text-purple-400">
                  {selectedReagent.basePotency || 'P1'}{(selectedReagent.concentrationSteps || 0) > 0 ? ` +${selectedReagent.concentrationSteps}` : ''}
                </span>
              </div>
            </div>

            {operation === 'refine' && targetRefinement && (
              <div className="p-2 bg-gray-800 rounded">
                <p className="text-sm text-green-400">
                  ✓ Will refine to: <span className="font-semibold capitalize">{REFINEMENT_LEVELS[targetRefinement].label}</span>
                </p>
              </div>
            )}

            {operation === 'refine' && !targetRefinement && (
              <div className="p-2 bg-gray-800 rounded">
                <p className="text-sm text-red-400">
                  ✗ Already at maximum refinement level
                </p>
              </div>
            )}

            {operation === 'concentrate' && targetPotency && (
              <div className="p-2 bg-gray-800 rounded">
                <p className="text-sm text-green-400">
                  ✓ Will concentrate to: <span className="font-semibold">{targetPotency}</span> (+{(selectedReagent.concentrationSteps || 0) + 1} steps)
                </p>
              </div>
            )}

            {!canProcess && selectedReagent.quantity < inputUnitsRequired && (
              <div className="p-2 bg-red-900 rounded mt-2">
                <p className="text-sm text-red-200">
                  Insufficient quantity: need {inputUnitsRequired}U, have {selectedReagent.quantity}U
                </p>
              </div>
            )}
          </div>
        )}

        {/* Difficulty Display */}
        {difficultyCalc && canProcess && (
          <div className="bg-gray-700 p-4 rounded mb-4">
            <h4 className="text-lg font-semibold mb-2">Processing Difficulty</h4>
            <div className="grid grid-cols-2 gap-3 text-sm mb-2">
              <div>
                <span className="text-gray-400">Base Skill:</span>
                <span className="ml-2 font-semibold">{difficultyCalc.alchemySkill}</span>
              </div>
              <div>
                <span className="text-gray-400">Lab Rating:</span>
                <span className="ml-2 font-semibold text-green-400">+{difficultyCalc.labRating}</span>
              </div>
              <div>
                <span className="text-gray-400">Process Step:</span>
                <span className="ml-2 font-semibold text-orange-400">{difficultyCalc.processStepDM}</span>
              </div>
              <div>
                <span className="text-gray-400">Batch Size:</span>
                <span className="ml-2 font-semibold text-orange-400">{difficultyCalc.batchSizePenalty}</span>
              </div>
              <div>
                <span className="text-gray-400">Potency Control:</span>
                <span className="ml-2 font-semibold text-orange-400">{difficultyCalc.potencyControlPenalty}</span>
              </div>
              <div>
                <span className="text-gray-400">Effective Skill:</span>
                <span className="ml-2 font-bold text-cyan-400">{difficultyCalc.effectiveSkill}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 font-mono">
              {difficultyCalc.breakdown}
            </p>
          </div>
        )}

        {/* Process Button */}
        <button
          onClick={startProcessing}
          disabled={!canProcess || !roll}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold"
        >
          {operation === 'refine' ? 'Refine Reagent' : 'Concentrate Reagent'}
        </button>
      </div>

      {/* Processing Results */}
      {showResults && processingLog.length > 0 && (
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-lg font-semibold mb-3">Processing Results</h4>
          <div className="space-y-2">
            {processingLog.map((result, idx) => (
              <div
                key={idx}
                className={`p-3 rounded ${
                  result.critical && result.success
                    ? 'bg-green-900'
                    : result.critical && !result.success
                    ? 'bg-red-900'
                    : result.minor
                    ? 'bg-yellow-900'
                    : result.success
                    ? 'bg-green-800'
                    : 'bg-red-800'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-semibold">Attempt {result.attemptNumber}</span>
                  <span className="text-sm">Roll: {result.roll}</span>
                </div>
                <p className="text-sm mt-1">{result.message}</p>
                {result.hazardAdded && (
                  <p className="text-sm mt-1 text-yellow-300">
                    ⚠ Hazard Added: {result.hazardAdded}
                  </p>
                )}
                {result.reclaim && (
                  <p className="text-sm mt-1 text-cyan-300">
                    ✓ Reclaimed 1U input material
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className="bg-gray-800 p-4 rounded">
        <h4 className="text-lg font-semibold mb-3">Processing Rules</h4>
        <div className="space-y-3 text-sm">
          <div className="bg-gray-700 p-3 rounded">
            <h5 className="font-semibold text-blue-400 mb-2">Material Cost</h5>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>All processing requires 2U input → 1U output</li>
              <li>Each output unit attempt consumes input regardless of success</li>
              <li>Critical success may reclaim +1U input at GM discretion</li>
            </ul>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <h5 className="font-semibold text-green-400 mb-2">Roll Results</h5>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Success: Output produced</li>
              <li>Minor Failure (MoF -1 to -2): Output produced but gains hazard</li>
              <li>Failure (MoF ≤ -3): Input consumed, no output</li>
              <li>Critical Success/Failure: Special effects apply</li>
            </ul>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <h5 className="font-semibold text-purple-400 mb-2">Derived Reagents</h5>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Processing creates new reagent variants (not upgrades)</li>
              <li>Variants share identification progress via identityId</li>
              <li>Hazards from processing apply only to output variant</li>
              <li>Names indicate refinement level and concentration steps</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
