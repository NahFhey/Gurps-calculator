import React, { useState } from 'react';

const REFINEMENT_LEVELS = {
  crude: { next: 'prepared', label: 'Crude' },
  prepared: { next: 'refined', label: 'Prepared' },
  refined: { next: null, label: 'Refined' }
};

export function ConcentrationRefinementView({ reagents, saveReagents }) {
  const [selectedReagent, setSelectedReagent] = useState(null);
  const [operation, setOperation] = useState('refine'); // 'refine' or 'concentrate'
  const [unitsToProcess, setUnitsToProcess] = useState(1);

  function performRefinement() {
    if (!selectedReagent) {
      alert('Select a reagent');
      return;
    }

    if (selectedReagent.quantity < unitsToProcess) {
      alert(`Not enough reagent quantity (requires ${unitsToProcess}U, have ${selectedReagent.quantity}U)`);
      return;
    }

    const currentRefinement = selectedReagent.refinement || 'crude';
    const nextRefinement = REFINEMENT_LEVELS[currentRefinement]?.next;

    if (!nextRefinement) {
      alert('This reagent is already at maximum refinement level (Refined)');
      return;
    }

    // Update reagent: reduce quantity, increase refinement
    const updatedReagents = reagents.map(r => {
      if (r.id === selectedReagent.id) {
        return {
          ...r,
          quantity: r.quantity - unitsToProcess,
          refinement: nextRefinement
        };
      }
      return r;
    });

    saveReagents(updatedReagents);
    const updated = updatedReagents.find(r => r.id === selectedReagent.id);
    setSelectedReagent(updated);
    alert(`Successfully refined ${selectedReagent.name} from ${REFINEMENT_LEVELS[currentRefinement].label} to ${REFINEMENT_LEVELS[nextRefinement].label}!`);
  }

  function performConcentration() {
    if (!selectedReagent) {
      alert('Select a reagent');
      return;
    }

    if (selectedReagent.quantity < unitsToProcess) {
      alert(`Not enough reagent quantity (requires ${unitsToProcess}U, have ${selectedReagent.quantity}U)`);
      return;
    }

    // Update reagent: reduce quantity, increase concentration steps
    const updatedReagents = reagents.map(r => {
      if (r.id === selectedReagent.id) {
        return {
          ...r,
          quantity: r.quantity - unitsToProcess,
          concentrationSteps: (r.concentrationSteps || 0) + 1
        };
      }
      return r;
    });

    saveReagents(updatedReagents);
    const updated = updatedReagents.find(r => r.id === selectedReagent.id);
    setSelectedReagent(updated);
    alert(`Successfully concentrated ${selectedReagent.name}! Concentration steps: ${(selectedReagent.concentrationSteps || 0) + 1}`);
  }

  function handleProcess() {
    if (operation === 'refine') {
      performRefinement();
    } else {
      performConcentration();
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 p-4 rounded">
        <h3 className="text-xl font-bold mb-4">Concentration & Refinement</h3>
        <p className="text-sm text-gray-400 mb-4">
          Process reagents to improve their quality or potency. Each operation consumes units of the reagent.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Reagent</label>
            <select
              value={selectedReagent?.id || ''}
              onChange={(e) => {
                const reagent = reagents.find(r => r.id === e.target.value);
                setSelectedReagent(reagent || null);
              }}
              className="w-full bg-gray-700 px-3 py-2 rounded"
            >
              <option value="">-- Choose Reagent --</option>
              {reagents.filter(r => r.quantity > 0).map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.quantity}U)
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

        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Units to Process</label>
          <input
            type="number"
            value={unitsToProcess}
            onChange={(e) => setUnitsToProcess(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-gray-700 px-3 py-2 rounded"
            min="1"
          />
          <p className="text-xs text-gray-500 mt-1">
            {operation === 'refine'
              ? 'Refinement consumes units to improve quality level'
              : 'Concentration consumes units to increase concentration steps'}
          </p>
        </div>

        {selectedReagent && (
          <div className="bg-gray-700 p-4 rounded mb-4">
            <h4 className="text-lg font-semibold mb-2">Current Status: {selectedReagent.name}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Refinement:</span>
                <span className="ml-2 capitalize font-semibold text-blue-400">
                  {REFINEMENT_LEVELS[selectedReagent.refinement || 'crude'].label}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Concentration Steps:</span>
                <span className="ml-2 font-semibold text-green-400">
                  {selectedReagent.concentrationSteps || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Base Potency:</span>
                <span className="ml-2 font-semibold text-purple-400">
                  {selectedReagent.basePotency || 'P1'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Available Quantity:</span>
                <span className="ml-2 font-semibold text-yellow-400">
                  {selectedReagent.quantity}U
                </span>
              </div>
            </div>

            {operation === 'refine' && (
              <div className="mt-3 p-2 bg-gray-800 rounded">
                {REFINEMENT_LEVELS[selectedReagent.refinement || 'crude'].next ? (
                  <p className="text-sm text-green-400">
                    ✓ Can refine from <span className="font-semibold capitalize">{REFINEMENT_LEVELS[selectedReagent.refinement || 'crude'].label}</span> to <span className="font-semibold capitalize">{REFINEMENT_LEVELS[REFINEMENT_LEVELS[selectedReagent.refinement || 'crude'].next].label}</span>
                  </p>
                ) : (
                  <p className="text-sm text-red-400">
                    ✗ Already at maximum refinement level
                  </p>
                )}
              </div>
            )}

            {operation === 'concentrate' && (
              <div className="mt-3 p-2 bg-gray-800 rounded">
                <p className="text-sm text-green-400">
                  ✓ Will increase concentration steps from <span className="font-semibold">{selectedReagent.concentrationSteps || 0}</span> to <span className="font-semibold">{(selectedReagent.concentrationSteps || 0) + 1}</span>
                </p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleProcess}
          disabled={!selectedReagent}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold"
        >
          {operation === 'refine' ? 'Refine Reagent' : 'Concentrate Reagent'}
        </button>
      </div>

      <div className="bg-gray-800 p-4 rounded">
        <h4 className="text-lg font-semibold mb-3">Process Information</h4>
        <div className="space-y-3 text-sm">
          <div className="bg-gray-700 p-3 rounded">
            <h5 className="font-semibold text-blue-400 mb-2">Refinement</h5>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Improves reagent quality: Crude → Prepared → Refined</li>
              <li>Consumes specified units to upgrade refinement level</li>
              <li>Higher refinement provides better results in brewing</li>
              <li>Cannot refine beyond Refined level</li>
            </ul>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <h5 className="font-semibold text-green-400 mb-2">Concentration</h5>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Increases concentration steps by +1</li>
              <li>Consumes specified units per concentration step</li>
              <li>Higher concentration increases effective potency in formulas</li>
              <li>Affects potency load calculation for tier determination</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
