import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import { startBatchFromFormula } from '../../utils/alchemy';

/**
 * FormulasView Component
 * Displays available alchemy formulas for brewing
 * Memoized to prevent unnecessary re-renders when other alchemy tabs change
 */
function FormulasViewBase({ reagents, formulas, batches, saveReagents, saveBatches }) {

  /**
   * Memoize formula display data
   * Prevents recalculation of formula properties for unchanged formulas
   */
  const formulaDisplayData = useMemo(() => {
    return formulas.map(f => ({
      id: f.id,
      name: f.name,
      tier: f.tier || 1,
      traitBudget: f.traitBudget || 10,
      vector: f.vector || 'Potion',
      dominantAspect: f.dominantAspect,
      secondaryAspect: f.secondaryAspect,
      finalPotency: f.finalPotency || f.potency || 'P1',
      baseWR: f.baseWR,
      baseDM: f.baseDM,
      ingredients: f.ingredients || [],
      traits: f.traits || []
    }));
  }, [formulas]);

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
        {formulaDisplayData.map(f => (
          <div key={f.id} className="bg-gray-700 p-4 rounded">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold text-lg">{f.name}</h3>
              <button onClick={() => startBatch(formulas.find(formula => formula.id === f.id))} className="bg-purple-600 px-3 py-1 rounded text-sm">
                Start Batch
              </button>
            </div>
            <div className="text-sm space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-400">Tier:</span> <span className="text-yellow-400 font-bold">{f.tier}</span> |
                  <span className="text-gray-400 ml-2">TB:</span> <span className="text-purple-400">{f.traitBudget}</span>
                </div>
                <div>
                  <span className="text-gray-400">Vector:</span> <span className="text-gray-300">{f.vector}</span>
                </div>
              </div>
              <div>
                <span className="text-gray-400">Aspects:</span> <span className="text-blue-400">{f.dominantAspect}</span> / <span className="text-blue-400">{f.secondaryAspect}</span>
              </div>
              <div>
                <span className="text-gray-400">Potency:</span> <span className="text-green-400">{f.finalPotency}</span> |
                <span className="text-gray-400 ml-2">WR:</span> <span className="text-orange-400">{f.baseWR}</span> |
                <span className="text-gray-400 ml-2">DM:</span> <span className="text-orange-400">{f.baseDM >= 0 ? '+' : ''}{f.baseDM}</span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {f.ingredients.map(i => `${i.reagentName} (${i.role}, ${i.unitsUsed}U)`).join(', ')}
              </div>

              {/* Traits Summary */}
              {f.traits.length > 0 && (
                <div className="text-xs text-purple-400 mt-2">
                  Traits: {f.traits.map(t => `${t.name} (${t.cost}pts)`).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}

        {formulaDisplayData.length === 0 && (
          <div className="text-gray-500 text-center py-8">No formulas available. Design formulas in the Manager tab.</div>
        )}
      </div>
    </div>
  );
}

export const FormulasView = memo(FormulasViewBase);

FormulasView.propTypes = {
  reagents: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    quantity: PropTypes.number.isRequired
  })).isRequired,
  formulas: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    tier: PropTypes.number,
    traitBudget: PropTypes.number,
    vector: PropTypes.string,
    dominantAspect: PropTypes.string,
    secondaryAspect: PropTypes.string,
    finalPotency: PropTypes.string,
    potency: PropTypes.string,
    baseWR: PropTypes.number,
    baseDM: PropTypes.number,
    ingredients: PropTypes.arrayOf(PropTypes.shape({
      reagentName: PropTypes.string,
      role: PropTypes.string,
      unitsUsed: PropTypes.number
    })),
    traits: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      cost: PropTypes.number
    }))
  })).isRequired,
  batches: PropTypes.arrayOf(PropTypes.object).isRequired,
  saveReagents: PropTypes.func.isRequired,
  saveBatches: PropTypes.func.isRequired
};
