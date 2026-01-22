import React from 'react';
import PropTypes from 'prop-types';
import { startBatchFromFormula } from '../../utils/alchemy';

export function FormulasView({ reagents, formulas, batches, saveReagents, saveBatches }) {

  function startBatch(formula) {
    const result = startBatchFromFormula(formula, reagents, batches);
    if (!result.ok) {
      // Show structured error message
      alert(result.error.message);
      return;
    }

    // Success - update reagents and batches
    saveReagents(result.reagents);
    saveBatches([...batches, result.batch]);
    alert(`Batch started! ${formula.name}`);
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">Alchemy Formulas</h2>
          <p className="text-sm text-gray-400 mt-1">
            Available formulas for brewing. Design and manage formulas in the Manager tab.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {formulas.map(f => (
          <div key={f.id} className="bg-gray-700 p-4 rounded">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold text-lg">{f.name}</h3>
              <button onClick={() => startBatch(f)} className="bg-purple-600 px-3 py-1 rounded text-sm">
                Start Batch
              </button>
            </div>
            <div className="text-sm space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-400">Tier:</span> <span className="text-yellow-400 font-bold">{f.tier || 1}</span> |
                  <span className="text-gray-400 ml-2">TB:</span> <span className="text-purple-400">{f.traitBudget || 10}</span>
                </div>
                <div>
                  <span className="text-gray-400">Vector:</span> <span className="text-gray-300">{f.vector || 'Potion'}</span>
                </div>
              </div>
              <div>
                <span className="text-gray-400">Aspects:</span> <span className="text-blue-400">{f.dominantAspect}</span> / <span className="text-blue-400">{f.secondaryAspect}</span>
              </div>
              <div>
                <span className="text-gray-400">Potency:</span> <span className="text-green-400">{f.finalPotency || f.potency || 'P1'}</span> |
                <span className="text-gray-400 ml-2">WR:</span> <span className="text-orange-400">{f.baseWR}</span> |
                <span className="text-gray-400 ml-2">DM:</span> <span className="text-orange-400">{f.baseDM >= 0 ? '+' : ''}{f.baseDM}</span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {f.ingredients.map(i => `${i.reagentName} (${i.role}, ${i.unitsUsed}U)`).join(', ')}
              </div>

              {/* Traits Summary */}
              {f.traits && f.traits.length > 0 && (
                <div className="text-xs text-purple-400 mt-2">
                  Traits: {f.traits.map(t => `${t.name} (${t.cost}pts)`).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}

        {formulas.length === 0 && (
          <div className="text-gray-500 text-center py-8">No formulas available. Design formulas in the Manager tab.</div>
        )}
      </div>
    </div>
  );
}

FormulasView.propTypes = {
  reagents: PropTypes.array.isRequired,
  formulas: PropTypes.array.isRequired,
  batches: PropTypes.array.isRequired,
  saveReagents: PropTypes.func.isRequired,
  saveBatches: PropTypes.func.isRequired
};
