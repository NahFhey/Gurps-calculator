import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DiceRoller } from '../DiceRoller';
import {
  calculateProcessingDifficulty,
  roll3d6,
  evaluateProcessingResult,
  createDerivedReagentName
} from '../../utils/alchemy';
import { POTENCY_LEVELS } from '../../constants';

/**
 * Refinement level progression for reagents
 * crude -> prepared -> refined (terminal state)
 * @type {Object<string, {next: string|null, label: string}>}
 */
const REFINEMENT_LEVELS = {
  crude: { next: 'prepared', label: 'Crude' },
  prepared: { next: 'refined', label: 'Prepared' },
  refined: { next: null, label: 'Refined' }
};

/**
 * ConcentrationRefinementView Component - Manages GURPS alchemy reagent processing
 *
 * This component implements the alchemy processing system with two operations:
 * 1. Refinement - Improves reagent quality (crude -> prepared -> refined)
 * 2. Concentration - Increases reagent potency (P1 -> P2 -> P3 -> P4)
 *
 * Key mechanics implemented:
 * - 2:1 input/output ratio (always consumes 2U input per 1U output attempt)
 * - Cumulative batch penalty (-1 for first unit, -2 for second, etc.)
 * - Unit-by-unit processing with individual roll results
 * - Derived reagent creation with identityId linking for shared identification
 * - Hazard accumulation on minor failures (MoF -1 to -2)
 * - Critical success allows 1U input reclaim
 *
 * Processing workflow:
 * 1. Select reagent, operation type, lab, and worker
 * 2. Set desired output units (determines input consumption)
 * 3. Start processing - enters unit-by-unit roll mode
 * 4. Roll for each unit individually with cumulative penalties
 * 5. Results applied: input consumed, output created or lost
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} props.reagents - Available reagents with quantity, refinement, potency
 * @param {Array<Object>} props.labs - Available labs with id, name, rating bonus
 * @param {Array<Object>} props.workers - Available workers with alchemy skill
 * @param {Function} props.saveReagents - Callback to persist reagent inventory changes
 * @returns {JSX.Element} The processing interface
 */
export function ConcentrationRefinementView({ reagents, labs, workers, saveReagents }) {
  const [selectedReagentId, setSelectedReagentId] = useState(null);
  const [operation, setOperation] = useState('refine'); // 'refine' or 'concentrate'
  const [outputUnits, setOutputUnits] = useState(1);
  const [selectedLabId, setSelectedLabId] = useState(labs?.[0]?.id || 'default');
  const [selectedWorkerId, setSelectedWorkerId] = useState(workers?.[0]?.id || '1');

  // Processing state
  const [processingState, setProcessingState] = useState('idle'); // 'idle', 'processing', 'completed', 'aborted'
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [currentRoll, setCurrentRoll] = useState({ dice: [], total: 0 });
  const [unitResults, setUnitResults] = useState([]);
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

  /**
   * Initializes a new processing batch
   * Resets all processing state and enters 'processing' mode for unit-by-unit rolls
   *
   * @returns {void}
   */
  function startProcessing() {
    if (!canProcess || !selectedReagent) {
      alert('Cannot process: check reagent selection and availability');
      return;
    }

    // Initialize processing state
    setProcessingState('processing');
    setCurrentUnitIndex(0);
    setCurrentRoll('');
    setUnitResults([]);
    setProcessingLog([]);
    setShowResults(true);
  }

  /**
   * Processes the current unit with the entered roll value
   *
   * This function:
   * 1. Calculates effective skill with cumulative batch penalty for this unit
   * 2. Evaluates roll result (success, minor failure, failure, critical)
   * 3. Tracks hazards accumulated from previous successful units
   * 4. Stores result and either advances to next unit or completes processing
   *
   * Cumulative batch penalty: Each unit gets -N penalty where N = unit number
   * (Unit 1 = -1, Unit 2 = -2, Unit 3 = -3, etc.)
   *
   * @returns {void}
   */
  function processCurrentUnit() {
    if (!currentRoll) {
      alert('Please enter or roll a 3d6 result for this unit');
      return;
    }

    const rollValue = currentRoll.total;
    const unitNumber = currentUnitIndex + 1;

    // Calculate cumulative batch penalty for this unit
    const cumulativeBatchPenalty = -unitNumber;

    // Recalculate difficulty with cumulative penalty
    const currentRefinement = selectedReagent.refinement || 'crude';
    const currentPotency = selectedReagent.basePotency || 'P1';

    const unitDifficulty = calculateProcessingDifficulty({
      operation,
      currentRefinement,
      targetRefinement,
      inputPotency: currentPotency,
      targetPotency: targetPotency,
      outputUnits: 1, // Calculate for single unit
      alchemySkill: selectedWorker.skills.alchemy,
      labRating: selectedLab.rating,
      cumulativeBatchPenalty
    });

    // Get current hazards from all previous successful outputs
    const accumulatedHazards = unitResults
      .filter(r => r.outputProduced)
      .flatMap(r => r.hazardAdded ? [r.hazardAdded] : []);
    const outputHazards = [...(selectedReagent.hazards || []), ...accumulatedHazards];

    // Evaluate result
    const result = evaluateProcessingResult(rollValue, unitDifficulty.effectiveSkill, outputHazards);

    // Store result
    const unitResult = {
      attemptNumber: unitNumber,
      roll: rollValue,
      effectiveSkill: unitDifficulty.effectiveSkill,
      batchPenalty: cumulativeBatchPenalty,
      ...result
    };

    const newResults = [...unitResults, unitResult];
    setUnitResults(newResults);
    setProcessingLog(prev => [...prev, unitResult]);

    // Check if this was the last unit
    if (currentUnitIndex + 1 >= outputUnits) {
      // Processing complete
      setProcessingState('completed');
      applyProcessingResults(newResults);
    } else {
      // Move to next unit
      setCurrentUnitIndex(currentUnitIndex + 1);
      setCurrentRoll('');
    }
  }

  /**
   * Aborts the current processing batch early
   * Applies partial results for completed units and sets state to aborted
   *
   * @returns {void}
   */
  function abortProcessing() {
    setProcessingState('aborted');
    // Apply partial results and reclaim remaining ingredients
    applyProcessingResults(unitResults, true);
  }

  /**
   * Applies processing results to reagent inventory
   *
   * This is the core state mutation function that:
   * 1. Calculates total input consumed (2U per attempt, minus reclaims)
   * 2. Calculates total output produced (successful units only)
   * 3. Aggregates hazards from minor failures across all units
   * 4. Creates or updates derived reagent variant
   * 5. Links derived reagent via identityId for shared identification
   *
   * Derived reagent naming:
   * - Refinement adds prefix: "Prepared", "Refined"
   * - Concentration adds suffix: "+1", "+2", etc.
   * - Example: "Refined Nightshade +2"
   *
   * Identity linking:
   * - All derived variants share identityId with source reagent
   * - Identification progress on any variant applies to all
   *
   * @param {Array<Object>} results - Array of unit processing results
   * @param {number} results[].attemptNumber - Which unit (1-indexed)
   * @param {boolean} results[].outputProduced - Whether unit produced output
   * @param {string} results[].hazardAdded - Hazard tag if minor failure
   * @param {boolean} results[].reclaim - Whether critical success reclaimed input
   * @param {boolean} [isAborted=false] - Whether processing was aborted early
   * @returns {void}
   */
  function applyProcessingResults(results, isAborted = false) {
    // Calculate totals from results
    let inputConsumed = 0;
    let outputProduced = 0;
    const outputHazards = [...(selectedReagent.hazards || [])];

    for (const result of results) {
      inputConsumed += 2; // Always consume 2U per attempt

      if (result.outputProduced) {
        outputProduced += 1;
        if (result.hazardAdded) {
          outputHazards.push(result.hazardAdded);
        }
        if (result.reclaim) {
          inputConsumed -= 1; // Critical success reclaims 1U
        }
      }
    }

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
      aborted: isAborted,
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

        {/* Selection Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Reagent</label>
            <select
              value={selectedReagentId || ''}
              onChange={(e) => setSelectedReagentId(e.target.value)}
              className="w-full bg-gray-700 px-3 py-2 rounded"
              disabled={processingState !== 'idle'}
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
              disabled={processingState !== 'idle'}
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
              disabled={processingState !== 'idle'}
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
              disabled={processingState !== 'idle'}
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
            disabled={processingState !== 'idle'}
          />
          <p className="text-xs text-gray-500 mt-1">
            Requires {inputUnitsRequired}U input (2:1 ratio). Each unit gets cumulative batch penalty (-1, -2, -3, etc.).
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

        {/* Difficulty Display - Initial Preview */}
        {difficultyCalc && canProcess && processingState === 'idle' && (() => {
          const firstUnitDifficulty = calculateProcessingDifficulty({
            operation,
            currentRefinement: selectedReagent.refinement || 'crude',
            targetRefinement,
            inputPotency: selectedReagent.basePotency || 'P1',
            targetPotency: targetPotency,
            outputUnits: 1,
            alchemySkill: selectedWorker.skills.alchemy,
            labRating: selectedLab.rating,
            cumulativeBatchPenalty: -1
          });

          return (
            <div className="bg-gray-700 p-4 rounded mb-4">
              <h4 className="text-lg font-semibold mb-2">
                Processing Difficulty Preview
                <span className="text-xs text-gray-400 ml-2 font-normal">(First Unit)</span>
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                <div>
                  <span className="text-gray-400">Base Skill:</span>
                  <span className="ml-2 font-semibold text-blue-400">{firstUnitDifficulty.alchemySkill}</span>
                </div>
                <div>
                  <span className="text-gray-400">Lab Rating:</span>
                  <span className="ml-2 font-semibold text-green-400">+{firstUnitDifficulty.labRating}</span>
                </div>
                <div>
                  <span className="text-gray-400">Process Step:</span>
                  <span className="ml-2 font-semibold text-orange-400">{firstUnitDifficulty.processStepDM}</span>
                </div>
                <div>
                  <span className="text-gray-400">Batch Penalty (1st):</span>
                  <span className="ml-2 font-semibold text-yellow-400">{firstUnitDifficulty.batchSizePenalty}</span>
                </div>
                <div>
                  <span className="text-gray-400">Potency Control:</span>
                  <span className="ml-2 font-semibold text-purple-400">{firstUnitDifficulty.potencyControlPenalty}</span>
                </div>
                <div>
                  <span className="text-gray-400">Effective Skill:</span>
                  <span className="ml-2 font-bold text-cyan-400">{firstUnitDifficulty.effectiveSkill}</span>
                </div>
              </div>
              <p className="text-xs mt-2 font-mono">
                <span className="text-blue-400">{firstUnitDifficulty.alchemySkill}</span>
                <span className="text-gray-400"> + </span>
                <span className="text-green-400">{firstUnitDifficulty.labRating}</span>
                <span className="text-gray-400"> + </span>
                <span className="text-orange-400">{firstUnitDifficulty.processStepDM}</span>
                <span className="text-gray-400"> + </span>
                <span className="text-yellow-400">{firstUnitDifficulty.batchSizePenalty}</span>
                <span className="text-gray-400"> + </span>
                <span className="text-purple-400">{firstUnitDifficulty.potencyControlPenalty}</span>
                <span className="text-gray-400"> = </span>
                <span className="text-cyan-400 font-bold">{firstUnitDifficulty.effectiveSkill}</span>
              </p>
              {outputUnits > 1 && (
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠ Cumulative penalty: Unit 2 = -2, Unit 3 = -3, etc.
                </p>
              )}
            </div>
          );
        })()}

        {/* Process Button */}
        {processingState === 'idle' && (
          <button
            onClick={startProcessing}
            disabled={!canProcess}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold"
          >
            Start Processing
          </button>
        )}
      </div>

      {/* Visual Progress Bar */}
      {(processingState === 'processing' || processingState === 'completed' || processingState === 'aborted') && (
        <div className="bg-gray-800 p-4 rounded">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-semibold">Processing Progress</h4>
            {processingState === 'completed' && (
              <span className="text-green-400 font-semibold">✓ Complete</span>
            )}
            {processingState === 'aborted' && (
              <span className="text-orange-400 font-semibold">⚠ Aborted</span>
            )}
          </div>

          {/* Progress boxes */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {Array.from({ length: outputUnits }, (_, i) => {
              const result = unitResults[i];
              let bgColor = 'bg-gray-700'; // Not processed yet
              let borderColor = 'border-gray-600';

              if (result) {
                if (result.success && !result.minor) {
                  bgColor = 'bg-green-600';
                  borderColor = 'border-green-500';
                } else if (result.minor) {
                  bgColor = 'bg-yellow-600';
                  borderColor = 'border-yellow-500';
                } else {
                  bgColor = 'bg-red-600';
                  borderColor = 'border-red-500';
                }
              } else if (i === currentUnitIndex && processingState === 'processing') {
                bgColor = 'bg-blue-600';
                borderColor = 'border-blue-500';
              }

              return (
                <div
                  key={i}
                  className={`w-12 h-12 ${bgColor} border-2 ${borderColor} rounded flex items-center justify-center font-bold text-sm`}
                  title={result ? `Unit ${i + 1}: ${result.success ? 'Success' : 'Failure'}` : `Unit ${i + 1}: Pending`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>

          {/* Reset Button for Completed/Aborted */}
          {(processingState === 'completed' || processingState === 'aborted') && (
            <button
              onClick={() => {
                setProcessingState('idle');
                setCurrentUnitIndex(0);
                setCurrentRoll('');
                setUnitResults([]);
                setProcessingLog([]);
                setShowResults(false);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold"
            >
              Start New Batch
            </button>
          )}

          {/* Current Unit Roll Input */}
          {processingState === 'processing' && (
            <div className="bg-gray-700 p-4 rounded mb-4">
              <h5 className="font-semibold mb-2">
                Unit {currentUnitIndex + 1} of {outputUnits}
                <span className="text-yellow-400 ml-2">(Batch Penalty: -{currentUnitIndex + 1})</span>
              </h5>

              {/* Show difficulty for current unit */}
              {difficultyCalc && (() => {
                const unitDifficulty = calculateProcessingDifficulty({
                  operation,
                  currentRefinement: selectedReagent.refinement || 'crude',
                  targetRefinement,
                  inputPotency: selectedReagent.basePotency || 'P1',
                  targetPotency: targetPotency,
                  outputUnits: 1,
                  alchemySkill: selectedWorker.skills.alchemy,
                  labRating: selectedLab.rating,
                  cumulativeBatchPenalty: -(currentUnitIndex + 1)
                });

                return (
                  <div className="mb-3 text-sm">
                    <div className="text-gray-400">
                      Effective Skill: <span className="text-cyan-400 font-semibold">{unitDifficulty.effectiveSkill}</span>
                    </div>
                    <div className="text-xs font-mono mt-1">
                      <span className="text-blue-400">{unitDifficulty.alchemySkill}</span>
                      <span className="text-gray-400"> + </span>
                      <span className="text-green-400">{unitDifficulty.labRating}</span>
                      <span className="text-gray-400"> + </span>
                      <span className="text-orange-400">{unitDifficulty.processStepDM}</span>
                      <span className="text-gray-400"> + </span>
                      <span className="text-yellow-400">{unitDifficulty.batchSizePenalty}</span>
                      <span className="text-gray-400"> + </span>
                      <span className="text-purple-400">{unitDifficulty.potencyControlPenalty}</span>
                      <span className="text-gray-400"> = </span>
                      <span className="text-cyan-400 font-bold">{unitDifficulty.effectiveSkill}</span>
                    </div>
                  </div>
                );
              })()}

              <label className="block text-sm text-gray-400 mb-2">Roll Result (3d6)</label>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  value={currentRoll.total || ''}
                  onChange={(e) => setCurrentRoll({ dice: [], total: parseInt(e.target.value) || 0 })}
                  placeholder="3-18"
                  min="3"
                  max="18"
                  className="flex-1 bg-gray-600 px-3 py-2 rounded"
                />
                <DiceRoller
                  dice={currentRoll.dice}
                  total={currentRoll.total}
                  onRoll={(dice, total) => setCurrentRoll({ dice, total })}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={processCurrentUnit}
                  disabled={!currentRoll}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold"
                >
                  Process Unit {currentUnitIndex + 1}
                </button>
                <button
                  onClick={abortProcessing}
                  className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold"
                >
                  Abort Batch
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processing Results Log */}
      {showResults && processingLog.length > 0 && (
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-lg font-semibold mb-3">Processing Results</h4>
          <div className="space-y-2">
            {processingLog.map((result, idx) => (
              <div
                key={idx}
                className={`p-3 rounded ${
                  result.critical && result.success
                    ? 'bg-green-900 border-2 border-green-500'
                    : result.critical && !result.success
                    ? 'bg-red-900 border-2 border-red-500'
                    : result.minor
                    ? 'bg-yellow-900 border-2 border-yellow-500'
                    : result.success
                    ? 'bg-green-800 border border-green-600'
                    : 'bg-red-800 border border-red-600'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-semibold">
                    Unit {result.attemptNumber}
                    {result.batchPenalty && (
                      <span className="text-xs text-yellow-400 ml-2">(Penalty: {result.batchPenalty})</span>
                    )}
                  </span>
                  <span className="text-sm">Roll: {result.roll} vs {result.effectiveSkill}</span>
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

ConcentrationRefinementView.propTypes = {
  reagents: PropTypes.array.isRequired,
  labs: PropTypes.array.isRequired,
  workers: PropTypes.array.isRequired,
  saveReagents: PropTypes.func.isRequired
};
