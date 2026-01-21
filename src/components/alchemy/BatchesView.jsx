import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { applyWorkBlockResult, calculateFormulaStats } from '../../utils/alchemy';
import { DiceRoller } from '../DiceRoller';
import { INGREDIENT_ROLES, VECTORS } from '../../constants';
import { toNumberOr } from '../../utils/helpers';

export function BatchesView({ batches, workers, formulas, reagents, labs, saveBatches, saveFormulas, saveReagents }) {
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [workerName, setWorkerName] = useState('');
  const [skill, setSkill] = useState('');
  const [roll, setRoll] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [showForecast, setShowForecast] = useState(false);
  const [showMicroAssay, setShowMicroAssay] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [completedBatch, setCompletedBatch] = useState(null);
  const [saveAsName, setSaveAsName] = useState('');

  // New batch creation state
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [selectedVector, setSelectedVector] = useState('Potion');
  const [selectedTier, setSelectedTier] = useState(1);
  const [selectedLabId, setSelectedLabId] = useState(labs?.[0]?.id || 'default');

  const activeBatches = batches.filter(b => b.phase === 'brewing');
  const completedBatches = batches.filter(b => b.phase !== 'brewing');

  function performForecast() {
    if (!selectedBatch || selectedBatch.forecast) {
      return;
    }

    const currentCP = selectedBatch.CP;
    const qualityMap = ['Clean', 'Minor Flaw', 'Unstable', 'Flawed', 'Mishap'];
    const predictedQuality = qualityMap[Math.min(currentCP, 4)];

    const updated = {
      ...selectedBatch,
      forecast: {
        performedAt: new Date().toISOString(),
        currentCP,
        predictedQuality,
        dmBonus: -1  // Forecast gives -1 DM bonus
      },
      DM: selectedBatch.DM - 1  // Apply forecast bonus immediately
    };

    const newBatches = batches.map(b => b.id === selectedBatch.id ? updated : b);
    saveBatches(newBatches);
    setSelectedBatch(updated);
    setShowForecast(false);
    alert(`Forecast: Based on current CP (${currentCP}), predicted quality is "${predictedQuality}". DM improved by 1!`);
  }

  function performMicroAssay() {
    if (!selectedBatch || selectedBatch.microAssay) {
      return;
    }

    const updated = {
      ...selectedBatch,
      microAssay: {
        performedAt: new Date().toISOString(),
        dominantAspect: selectedBatch.dominantAspect,
        secondaryAspect: selectedBatch.secondaryAspect,
        revealed: true
      }
    };

    const newBatches = batches.map(b => b.id === selectedBatch.id ? updated : b);
    saveBatches(newBatches);
    setSelectedBatch(updated);
    setShowMicroAssay(false);
    alert(`Micro-Assay: Dominant aspect is ${selectedBatch.dominantAspect}, Secondary is ${selectedBatch.secondaryAspect}`);
  }

  function saveRecipeFromBatch() {
    if (!completedBatch || !saveFormulas) return;

    const recipeName = saveAsName.trim() || completedBatch.formulaName;

    // Reconstruct formula from batch data
    const savedFormula = {
      id: crypto.randomUUID(),
      name: recipeName,
      ingredients: completedBatch.consumedIngredients || [],
      tier: completedBatch.tier || 1,
      vector: completedBatch.vector || 'Potion',
      baseWR: completedBatch.WR,
      baseDM: completedBatch.DM,
      dominantAspect: completedBatch.dominantAspect,
      secondaryAspect: completedBatch.secondaryAspect,
      basePotency: completedBatch.basePotency || 'P1',
      finalPotency: completedBatch.finalPotency || 'P1',
      concentrationSteps: completedBatch.concentrationSteps || 0,
      totalConcentrationSteps: completedBatch.totalConcentrationSteps || 0,
      traitBudget: completedBatch.traitBudget || 10,
      hasMatchingStabilizer: completedBatch.hasMatchingStabilizer || false,
      traits: completedBatch.traits || []
    };

    saveFormulas([...(formulas || []), savedFormula]);
    setShowSavePrompt(false);
    setCompletedBatch(null);
    setSaveAsName('');
    alert(`Recipe "${recipeName}" saved to formulas!`);
  }

  // New batch creation helper functions
  function addIngredient() {
    if (reagents.length === 0) {
      alert('No reagents available!');
      return;
    }
    setIngredients([...ingredients, {
      id: crypto.randomUUID(),
      reagentId: reagents[0].id,
      role: 'Active',
      unitsUsed: 1,
      refinement: 'crude'
    }]);
  }

  function removeIngredient(id) {
    setIngredients(ingredients.filter(i => i.id !== id));
  }

  function updateIngredient(id, field, value) {
    setIngredients(ingredients.map(i => i.id === id ? {...i, [field]: value} : i));
  }

  function createNewBatch() {
    if (!batchName.trim()) {
      alert('Enter batch name');
      return;
    }
    if (ingredients.length === 0) {
      alert('Add at least one ingredient');
      return;
    }

    // Check reagent availability
    for (const ing of ingredients) {
      const reagent = reagents.find(r => r.id === ing.reagentId);
      if (!reagent || reagent.quantity < ing.unitsUsed) {
        alert(`Insufficient ${reagent?.name || 'reagent'}: need ${ing.unitsUsed}U, have ${reagent?.quantity || 0}U`);
        return;
      }
    }

    const reagentsMap = new Map(reagents.map(r => [r.id, r]));

    // Get selected lab info
    const selectedLab = labs?.find(l => l.id === selectedLabId) || { id: 'default', name: 'Basic Lab', rating: 0 };

    const ingredientsSnapshot = ingredients.map(ing => {
      const r = reagentsMap.get(ing.reagentId);
      return {
        reagentId: ing.reagentId,
        reagentName: r?.name || 'Unknown',
        role: ing.role,
        unitsUsed: ing.unitsUsed,
        refinement: r?.refinement || 'crude',
        aspects: r ? {...r.aspects} : {},
        potency: r?.basePotency || 'P0',
        concentrationSteps: r?.concentrationSteps || 0
      };
    });

    const tempFormula = { ingredients: ingredientsSnapshot };
    const stats = calculateFormulaStats(tempFormula, reagentsMap, selectedVector);

    // VALIDATION CHECKS - block if critical errors
    if (!stats.batchValidation.valid) {
      alert('Cannot start batch: ' + stats.batchValidation.errors.join(', '));
      return;
    }

    // Block if missing critical roles (Active, Tool, etc.)
    if (stats.roleCoverage.wrDelta >= 999) {
      const blockingMessages = stats.roleCoverage.messages.filter(msg =>
        msg.includes('Cannot brew')
      );
      alert('Cannot start batch:\n\n' + blockingMessages.join('\n'));
      return;
    }

    // WARNINGS - show but allow to proceed (non-blocking missing roles)
    const warnings = [];
    if (!stats.roleCoverage.valid && stats.roleCoverage.wrDelta < 999) {
      warnings.push(...stats.roleCoverage.messages);
    }
    if (stats.batchValidation.warnings.length > 0) {
      warnings.push(...stats.batchValidation.warnings);
    }
    if (stats.hazardEvaluation.count > 0) {
      warnings.push(`Hazards present: ${stats.hazardEvaluation.hazards.join(', ')}`);
    }

    if (warnings.length > 0) {
      const proceed = confirm(
        'Warnings detected:\n\n' +
        warnings.map(w => '• ' + w).join('\n') +
        '\n\nDo you want to proceed anyway?'
      );
      if (!proceed) return;
    }

    // Consume reagents
    const newReagents = reagents.map(r => {
      const used = ingredients.find(ing => ing.reagentId === r.id);
      if (used) {
        return {...r, quantity: Math.max(0, r.quantity - used.unitsUsed)};
      }
      return r;
    });

    const newBatch = {
      id: crypto.randomUUID(),
      formulaId: null,
      formulaName: batchName,
      phase: 'brewing',
      consumedIngredients: ingredientsSnapshot,
      tier: stats.tier, // Auto-calculated
      calculatedTier: stats.calculatedTier,
      potencyLoad: stats.potencyLoad,
      vector: stats.vector,
      WR: stats.baseWR,
      DM: stats.baseDM,
      PP: 0,
      CP: 0,
      dominantAspect: stats.dominantAspect,
      secondaryAspect: stats.secondaryAspect,
      basePotency: stats.basePotency || 'P1',
      finalPotency: stats.finalPotency || 'P1',
      concentrationSteps: stats.concentrationSteps || 0,
      traitBudget: stats.traitBudget || 10,
      traits: [],
      forecast: null,
      microAssay: null,
      hasMatchingStabilizer: stats.hasMatchingStabilizer || false,
      shifts: [],
      quality: null,
      startDate: new Date().toISOString(),
      completedDate: null,
      // Store hazard info for triggering during work blocks
      hazards: stats.hazardEvaluation.hazards,
      hazardDetails: stats.hazardEvaluation.details,
      // Store lab info (locked for entire batch)
      labId: selectedLab.id,
      labName: selectedLab.name,
      labRating: selectedLab.rating
    };

    saveReagents(newReagents);
    saveBatches([...batches, newBatch]);
    setBatchName('');
    setIngredients([]);
    setSelectedVector('Potion');
    setShowNewBatch(false);
    alert(`Batch "${batchName}" started! Tier ${stats.tier} (Potency Load: ${stats.potencyLoad})`);
  }

  function addWorkBlock() {
    if (!selectedBatch || !workerName || !skill || !roll) {
      alert('Fill all fields');
      return;
    }

    const updated = applyWorkBlockResult(
      selectedBatch,
      parseInt(skill),
      parseInt(roll),
      workerName,
      currentDate
    );

    // Add initial amount to completed batches
    if (updated.phase === 'completed' && !updated.amount) {
      updated.amount = 1;
    }

    const newBatches = batches.map(b => b.id === selectedBatch.id ? updated : b);
    saveBatches(newBatches);

    if (updated.phase === 'completed') {
      // Show save prompt for successful batches (not Mishap)
      if (updated.quality !== 'Mishap' && saveFormulas) {
        setCompletedBatch(updated);
        setSaveAsName(updated.formulaName);
        setShowSavePrompt(true);
      } else {
        alert(`Batch complete! Quality: ${updated.quality}`);
      }
      setSelectedBatch(null);
    } else if (updated.phase === 'failed') {
      alert(`Batch failed! Mishap occurred.`);
      setSelectedBatch(null);
    } else {
      setSelectedBatch(updated);
    }

    // Only clear roll, keep worker and skill for next work block
    setRoll('');
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Save Recipe Prompt */}
      {showSavePrompt && completedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md border-2 border-green-600">
            <h3 className="text-xl font-bold mb-2 text-green-400">Batch Complete!</h3>
            <p className="mb-4">
              Quality: <span className={`font-bold ${completedBatch.quality === 'Clean' ? 'text-green-400' : 'text-yellow-400'}`}>
                {completedBatch.quality}
              </span>
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Would you like to save this as a reusable formula?
            </p>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Recipe Name</label>
              <input
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
                placeholder="Enter recipe name..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSavePrompt(false);
                  setCompletedBatch(null);
                  setSaveAsName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 rounded"
              >
                Skip
              </button>
              <button
                onClick={saveRecipeFromBatch}
                className="flex-1 px-4 py-2 bg-green-600 rounded"
              >
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedBatch ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{selectedBatch.formulaName}</h3>
            <button onClick={() => setSelectedBatch(null)} className="bg-gray-600 px-4 py-2 rounded">
              ← Back to List
            </button>
          </div>

          <div className="bg-gray-700 p-4 rounded">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress: {selectedBatch.PP} / {selectedBatch.WR}</span>
              <span>Contamination: {selectedBatch.CP}</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-4 mb-2">
              <div
                className="bg-blue-600 h-4 rounded-full"
                style={{width: `${Math.min(100, (selectedBatch.PP / selectedBatch.WR) * 100)}%`}}
              />
            </div>
            <div className="text-xs text-gray-400 grid grid-cols-2 gap-2">
              <div>
                Tier: <span className="text-yellow-400 font-bold">{selectedBatch.tier || 1}</span> |
                DM: {selectedBatch.DM}
                {selectedBatch.forecast && <span className="text-green-400 ml-1">(Forecast +1)</span>}
              </div>
              <div>Vector: {selectedBatch.vector || 'Potion'}</div>
              <div>
                Lab: <span className="text-cyan-400">{selectedBatch.labName || 'Basic Lab'}</span>
                <span className="text-gray-500 ml-1">(+{selectedBatch.labRating || 0})</span>
              </div>
              <div>Dominant: {selectedBatch.dominantAspect}</div>
              <div>Potency: {selectedBatch.finalPotency || selectedBatch.potency || 'P1'}</div>
              <div>TB: <span className="text-purple-400">{selectedBatch.traitBudget || 10} pts</span></div>
              <div>Started: {new Date(selectedBatch.startDate).toLocaleDateString()}</div>
            </div>

            {/* Traits display */}
            {selectedBatch.traits && selectedBatch.traits.length > 0 && (
              <div className="mt-2 text-xs text-purple-400">
                Traits: {selectedBatch.traits.map(t => `${t.name} (${t.cost}pts)`).join(', ')}
              </div>
            )}

            {/* Forecast & Micro-Assay Actions */}
            <div className="mt-4 flex gap-2">
              {!selectedBatch.forecast && (
                <button
                  onClick={() => setShowForecast(!showForecast)}
                  className="flex-1 bg-purple-600 px-3 py-2 rounded text-sm"
                >
                  {showForecast ? 'Cancel' : 'Perform Forecast'}
                </button>
              )}
              {!selectedBatch.microAssay && (
                <button
                  onClick={() => setShowMicroAssay(!showMicroAssay)}
                  className="flex-1 bg-cyan-600 px-3 py-2 rounded text-sm"
                >
                  {showMicroAssay ? 'Cancel' : 'Perform Micro-Assay'}
                </button>
              )}
            </div>

            {/* Forecast Dialog */}
            {showForecast && (
              <div className="mt-3 bg-gray-800 p-3 rounded border border-purple-500">
                <div className="text-sm font-semibold mb-2">Forecast Quality</div>
                <div className="text-xs text-gray-400 mb-3">
                  Predict the final quality based on current contamination. Provides +1 DM bonus for remaining work.
                </div>
                <button
                  onClick={performForecast}
                  className="w-full bg-purple-600 px-3 py-2 rounded text-sm"
                >
                  Confirm Forecast
                </button>
              </div>
            )}

            {/* Micro-Assay Dialog */}
            {showMicroAssay && (
              <div className="mt-3 bg-gray-800 p-3 rounded border border-cyan-500">
                <div className="text-sm font-semibold mb-2">Micro-Assay</div>
                <div className="text-xs text-gray-400 mb-3">
                  Analyze the batch composition to reveal dominant and secondary aspects.
                </div>
                <button
                  onClick={performMicroAssay}
                  className="w-full bg-cyan-600 px-3 py-2 rounded text-sm"
                >
                  Confirm Micro-Assay
                </button>
              </div>
            )}

            {/* Display completed Forecast */}
            {selectedBatch.forecast && (
              <div className="mt-3 bg-purple-900 bg-opacity-30 p-3 rounded border border-purple-500">
                <div className="text-sm font-semibold text-purple-400">Forecast Complete</div>
                <div className="text-xs text-gray-300 mt-1">
                  Predicted Quality: <span className="font-semibold">{selectedBatch.forecast.predictedQuality}</span>
                  <span className="text-gray-400 ml-2">(based on CP: {selectedBatch.forecast.currentCP})</span>
                </div>
                <div className="text-xs text-green-400 mt-1">DM Bonus: +1 applied</div>
              </div>
            )}

            {/* Display completed Micro-Assay */}
            {selectedBatch.microAssay && (
              <div className="mt-3 bg-cyan-900 bg-opacity-30 p-3 rounded border border-cyan-500">
                <div className="text-sm font-semibold text-cyan-400">Micro-Assay Complete</div>
                <div className="text-xs text-gray-300 mt-1">
                  Aspects: <span className="text-blue-400">{selectedBatch.microAssay.dominantAspect}</span> /
                  <span className="text-blue-400 ml-1">{selectedBatch.microAssay.secondaryAspect}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-700 p-4 rounded space-y-3">
            <h4 className="font-semibold">Add Work Block</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1">Worker</label>
                <select
                  value={workerName}
                  onChange={(e) => {
                    const selectedWorker = workers.find(w => w.name === e.target.value);
                    setWorkerName(e.target.value);
                    if (selectedWorker && selectedWorker.skills) {
                      setSkill(String(selectedWorker.skills.alchemy || 10));
                    }
                  }}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="">Select worker...</option>
                  {workers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Date</label>
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                />
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
                <div className="text-xs text-gray-400 mt-1">
                  {(() => {
                    if (!skill) return 'Effective: ?';
                    const baseSkill = parseInt(skill);
                    const labBonus = selectedBatch.labRating || 0;
                    const effective = baseSkill + selectedBatch.DM + labBonus;
                    return labBonus > 0
                      ? `Effective: ${baseSkill} + ${selectedBatch.DM} (DM) + ${labBonus} (lab) = ${effective}`
                      : `Effective: ${baseSkill} + ${selectedBatch.DM} (DM) = ${effective}`;
                  })()}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1">Roll (3d6)</label>
                <div className="flex gap-2 items-start">
                  <input
                    type="number"
                    value={roll}
                    onChange={(e) => setRoll(e.target.value)}
                    className="flex-1 bg-gray-600 px-3 py-2 rounded"
                    placeholder="3-18"
                    min="3"
                    max="18"
                  />
                  <DiceRoller onRoll={(dice, total) => setRoll(String(total))} />
                </div>
              </div>
            </div>
            <button onClick={addWorkBlock} className="w-full bg-green-600 px-4 py-2 rounded">
              Add Work Block
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Work History</h4>
            {selectedBatch.shifts.map((s, i) => (
              <div key={s.id} className="bg-gray-700 p-3 rounded text-sm">
                <div className="flex justify-between">
                  <span>Block {i+1}: {s.result}</span>
                  <span className="text-gray-400">{s.date}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {s.worker} | Lab: {s.labName || selectedBatch.labName || 'Basic Lab'} |
                  Skill {s.skill} + {s.labRating !== undefined ? s.labRating : (selectedBatch.labRating || 0)} (lab) = {s.effectiveSkill} |
                  Roll: {s.roll} | PP +{s.ppAdded} |
                  CP {s.cpChange > 0 ? '+' : ''}{s.cpChange}
                </div>
              </div>
            ))}
            {selectedBatch.shifts.length === 0 && (
              <div className="text-gray-500 text-center py-4">No work blocks yet</div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Alchemy Batches</h2>
            <button
              onClick={() => setShowNewBatch(!showNewBatch)}
              className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded"
            >
              <Plus size={20} /> {showNewBatch ? 'Cancel' : 'Start New Batch'}
            </button>
          </div>

          {showNewBatch && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-sm mb-1">Batch Name</label>
                  <input
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                    placeholder="e.g., Experimental Potion"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Lab</label>
                  <select
                    value={selectedLabId}
                    onChange={(e) => setSelectedLabId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    {(labs || [{id: 'default', name: 'Basic Lab', rating: 0}]).map(lab => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name} (+{lab.rating})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Vector Type</label>
                  <select
                    value={selectedVector}
                    onChange={(e) => setSelectedVector(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    {VECTORS.map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name} (WR {v.wrMod >= 0 ? '+' : ''}{v.wrMod}, DM {v.dmMod >= 0 ? '+' : ''}{v.dmMod})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-gray-600 p-2 rounded">
                <div className="text-xs text-gray-400 mb-1">Tier (Auto-calculated)</div>
                <div className="text-sm text-gray-300">
                  Tier is automatically determined by the potency load of active ingredients.
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold">Ingredients</label>
                  <button onClick={addIngredient} className="bg-blue-600 px-3 py-1 rounded text-sm">
                    <Plus size={14} className="inline" /> Add Ingredient
                  </button>
                </div>

                {ingredients.map(ing => {
                  const selectedReagent = reagents.find(r => r.id === ing.reagentId);
                  const availableRoles = selectedReagent?.roles || ['Active'];
                  const reagentRefinement = selectedReagent?.refinement || 'crude';
                  return (
                    <div key={ing.id} className="bg-gray-600 p-3 rounded mb-2">
                      <div className="grid grid-cols-4 gap-2">
                        <select
                          value={ing.reagentId}
                          onChange={(e) => updateIngredient(ing.id, 'reagentId', e.target.value)}
                          className="bg-gray-700 px-2 py-1 rounded text-sm"
                        >
                          {reagents.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.quantity}U)
                            </option>
                          ))}
                        </select>
                        <select
                          value={ing.role}
                          onChange={(e) => updateIngredient(ing.id, 'role', e.target.value)}
                          className="bg-gray-700 px-2 py-1 rounded text-sm"
                        >
                          {availableRoles.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                        <div className="bg-gray-700 px-2 py-1 rounded text-sm flex items-center capitalize">
                          {reagentRefinement}
                        </div>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={ing.unitsUsed}
                            onChange={(e) => updateIngredient(ing.id, 'unitsUsed', Math.max(1, toNumberOr(e.target.value, 1)))}
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                            min="1"
                          />
                          <button
                            onClick={() => removeIngredient(ing.id)}
                            className="bg-red-600 px-2 rounded"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {ingredients.length > 0 && (() => {
                const reagentsMap = new Map(reagents.map(r => [r.id, r]));
                const actives = ingredients.filter(i => i.role === 'Active' || i.role === 'active');
                if (actives.length === 0) return null;

                const ingredientsSnapshot = ingredients.map(ing => {
                  const r = reagentsMap.get(ing.reagentId);
                  return {
                    reagentId: ing.reagentId,
                    role: ing.role,
                    unitsUsed: ing.unitsUsed,
                    refinement: ing.refinement,
                    aspects: r ? {...r.aspects} : {}
                  };
                });

                const tempFormula = { ingredients: ingredientsSnapshot };
                const stats = calculateFormulaStats(tempFormula, reagentsMap, selectedVector);

                return (
                  <div className="space-y-3">
                    {/* Validation warnings */}
                    {!stats.roleCoverage.valid && (
                      <div className="bg-red-900 bg-opacity-30 border border-red-500 p-2 rounded text-xs">
                        <div className="font-semibold text-red-300 mb-1">⚠️ Missing Required Roles</div>
                        {stats.roleCoverage.messages.map((msg, idx) => (
                          <div key={idx} className="text-red-200">• {msg}</div>
                        ))}
                      </div>
                    )}

                    {!stats.batchValidation.valid && (
                      <div className="bg-red-900 bg-opacity-30 border border-red-500 p-2 rounded text-xs">
                        <div className="font-semibold text-red-300 mb-1">⚠️ Constraint Violations</div>
                        {stats.batchValidation.errors.map((err, idx) => (
                          <div key={idx} className="text-red-200">• {err}</div>
                        ))}
                      </div>
                    )}

                    {stats.batchValidation.warnings.length > 0 && (
                      <div className="bg-yellow-900 bg-opacity-30 border border-yellow-500 p-2 rounded text-xs">
                        <div className="font-semibold text-yellow-300 mb-1">⚠️ Warnings</div>
                        {stats.batchValidation.warnings.map((warn, idx) => (
                          <div key={idx} className="text-yellow-200">• {warn}</div>
                        ))}
                      </div>
                    )}

                    {stats.hazardEvaluation.count > 0 && (
                      <div className="bg-orange-900 bg-opacity-30 border border-orange-500 p-2 rounded text-xs">
                        <div className="font-semibold text-orange-300 mb-1">⚠️ Hazards Present ({stats.hazardEvaluation.count})</div>
                        {stats.hazardEvaluation.details.map((h, idx) => (
                          <div key={idx} className="text-orange-200">
                            <strong>{h.hazard}</strong>: {h.effect}
                            {h.wrMod > 0 && ` [+${h.wrMod} WR]`}
                            {h.dmMod !== 0 && ` [${h.dmMod >= 0 ? '+' : ''}${h.dmMod} DM]`}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-gray-600 p-3 rounded">
                      <div className="text-sm font-semibold mb-2">Batch Preview</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div>
                            Tier: <span className="text-yellow-400 font-bold">{stats.tier}</span>
                            <span className="text-xs text-gray-400 ml-2">(Potency Load: {stats.potencyLoad})</span>
                          </div>
                          <div>Dominant: <span className="text-blue-400">{stats.dominantAspect || 'None'}</span></div>
                          <div>Secondary: <span className="text-blue-400">{stats.secondaryAspect || 'None'}</span></div>
                          <div>Potency: <span className="text-green-400">{stats.basePotency} {stats.concentrationSteps > 0 ? `+${stats.concentrationSteps} → ${stats.finalPotency}` : ''}</span></div>
                        </div>
                        <div className="space-y-1">
                          <div>WR: <span className="text-orange-400">{stats.baseWR}</span></div>
                          <div>DM: <span className="text-orange-400">{stats.baseDM >= 0 ? '+' : ''}{stats.baseDM}</span></div>
                          <div>TB: <span className="text-purple-400">{stats.traitBudget} points</span></div>
                          <div>Vector: <span className="text-gray-300">{stats.vector}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <button onClick={createNewBatch} className="w-full bg-green-600 px-4 py-2 rounded">
                Start Batch
              </button>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">Active Batches ({activeBatches.length})</h3>
            {activeBatches.map(b => {
              const progressPercent = Math.min(100, (b.PP / b.WR) * 100);
              return (
                <div key={b.id} className="bg-gray-700 p-3 rounded mb-2 cursor-pointer hover:bg-gray-600" onClick={() => setSelectedBatch(b)}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{b.formulaName}</span>
                    <span className="text-sm text-gray-400">{b.PP}/{b.WR} PP | CP: {b.CP}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 mb-2">
                    Tier {b.tier || 1} | {b.vector || 'Potion'} | {b.dominantAspect} | Potency {b.finalPotency || b.potency || 'P1'} | {b.shifts.length} work blocks
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{width: `${progressPercent}%`}}
                    />
                  </div>
                </div>
              );
            })}
            {activeBatches.length === 0 && (
              <div className="text-gray-500 text-center py-4">No active batches</div>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Completed Batches ({completedBatches.length})</h3>
            {completedBatches.slice(0, 10).map(b => {
              // Ensure batches have an amount (backward compatibility)
              const batchAmount = b.amount !== undefined ? b.amount : 1;

              return (<div key={b.id} className="bg-gray-700 p-3 rounded mb-2">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{b.formulaName}</span>
                      <span className={`text-sm px-2 py-0.5 rounded ${b.quality === 'Clean' ? 'bg-green-600' : b.quality?.includes('Mishap') ? 'bg-red-600' : 'bg-yellow-600'}`}>
                        {b.quality}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Completed: {new Date(b.completedDate).toLocaleDateString()} | {b.shifts.length} work blocks
                    </div>
                    <div className="text-xs text-gray-400">
                      Tier {b.tier} | {b.vector} | Potency: {b.finalPotency}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-sm text-gray-300">Amount:</div>
                      <div className="text-lg font-bold text-blue-400">{batchAmount}×</div>
                    </div>
                    {batchAmount > 0 && (
                      <button
                        onClick={() => {
                          const newAmount = batchAmount - 1;
                          if (newAmount <= 0) {
                            if (confirm(`Consume last dose of "${b.formulaName}"? This will delete the batch.`)) {
                              saveBatches(batches.filter(batch => batch.id !== b.id));
                            }
                          } else {
                            const updated = {...b, amount: newAmount};
                            saveBatches(batches.map(batch => batch.id === b.id ? updated : batch));
                          }
                        }}
                        className="bg-orange-600 hover:bg-orange-700 px-3 py-2 rounded text-sm font-medium"
                      >
                        Consume
                      </button>
                    )}
                  </div>
                </div>
              </div>);
            })}
            {completedBatches.length === 0 && (
              <div className="text-gray-500 text-center py-4">No completed batches yet</div>
            )}
            {completedBatches.length > 10 && (
              <div className="text-xs text-gray-500 text-center mt-2">
                Showing 10 of {completedBatches.length} completed batches
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
