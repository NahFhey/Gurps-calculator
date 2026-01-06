import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { INGREDIENT_ROLES, VECTORS } from '../../constants';
import { toNumberOr } from '../../utils/helpers';
import { calculateFormulaStats, startBatchFromFormula, tallyAspects, computeDominantSecondary } from '../../utils/alchemy';

export function FormulasView({ reagents, formulas, batches, saveReagents, saveFormulas, saveBatches }) {
  const [showDesigner, setShowDesigner] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [formulaName, setFormulaName] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [selectedVector, setSelectedVector] = useState('Potion');

  function addIngredient() {
    if (reagents.length === 0) {
      alert('No reagents available!');
      return;
    }
    setIngredients([...ingredients, {
      id: crypto.randomUUID(),
      reagentId: reagents[0].id,
      role: 'active',
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

  function createFormula() {
    if (!formulaName.trim()) {
      alert('Enter formula name');
      return;
    }
    if (ingredients.length === 0) {
      alert('Add at least one ingredient');
      return;
    }

    const reagentsMap = new Map(reagents.map(r => [r.id, r]));

    const ingredientsSnapshot = ingredients.map(ing => {
      const r = reagentsMap.get(ing.reagentId);
      return {
        reagentId: ing.reagentId,
        reagentName: r?.name || 'Unknown',
        role: ing.role,
        unitsUsed: ing.unitsUsed,
        refinement: ing.refinement,
        aspects: r ? {...r.aspects} : {}
      };
    });

    const tempFormula = { ingredients: ingredientsSnapshot };
    const stats = calculateFormulaStats(tempFormula, reagentsMap, selectedVector);

    const newFormula = {
      id: crypto.randomUUID(),
      name: formulaName,
      ingredients: ingredientsSnapshot,
      tier: stats.tier,
      vector: stats.vector,
      baseWR: stats.baseWR,
      baseDM: stats.baseDM,
      dominantAspect: stats.dominantAspect,
      secondaryAspect: stats.secondaryAspect,
      basePotency: stats.basePotency,
      finalPotency: stats.finalPotency,
      concentrationSteps: stats.concentrationSteps,
      totalConcentrationSteps: stats.totalConcentrationSteps,
      traitBudget: stats.traitBudget,
      hasMatchingStabilizer: stats.hasMatchingStabilizer
    };

    saveFormulas([...formulas, newFormula]);
    setFormulaName('');
    setIngredients([]);
    setSelectedVector('Potion');
    setShowDesigner(false);
    alert('Formula created!');
  }

  function startBatch(formula) {
    const result = startBatchFromFormula(formula, reagents, batches);
    if (result) {
      saveReagents(result.newReagents);
      saveBatches([...batches, result.newBatch]);
      alert(`Batch started! ${formula.name}`);
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Delete formula "{deleteConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={() => {
                saveFormulas(formulas.filter(f => f.id !== deleteConfirm.id));
                setDeleteConfirm(null);
              }} className="px-4 py-2 bg-red-600 rounded">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Alchemy Formulas</h2>
        <button onClick={() => setShowDesigner(!showDesigner)} className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded">
          <Plus size={20} /> {showDesigner ? 'Cancel' : 'Design Formula'}
        </button>
      </div>

      {showDesigner && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Formula Name</label>
              <input
                value={formulaName}
                onChange={(e) => setFormulaName(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
                placeholder="e.g., Healing Draught"
              />
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

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold">Ingredients</label>
              <button onClick={addIngredient} className="bg-blue-600 px-3 py-1 rounded text-sm">
                <Plus size={14} className="inline" /> Add Ingredient
              </button>
            </div>

            {ingredients.map(ing => {
              return (
                <div key={ing.id} className="bg-gray-600 p-3 rounded mb-2 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <select
                      value={ing.reagentId}
                      onChange={(e) => updateIngredient(ing.id, 'reagentId', e.target.value)}
                      className="bg-gray-700 px-2 py-1 rounded text-sm"
                    >
                      {reagents.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.quantity}U)</option>
                      ))}
                    </select>
                    <select
                      value={ing.role}
                      onChange={(e) => updateIngredient(ing.id, 'role', e.target.value)}
                      className="bg-gray-700 px-2 py-1 rounded text-sm"
                    >
                      {INGREDIENT_ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <select
                      value={ing.refinement}
                      onChange={(e) => updateIngredient(ing.id, 'refinement', e.target.value)}
                      className="bg-gray-700 px-2 py-1 rounded text-sm"
                    >
                      <option value="crude">Crude</option>
                      <option value="prepared">Prepared</option>
                      <option value="refined">Refined</option>
                    </select>
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
            const actives = ingredients.filter(i => i.role === 'active' || i.role === 'Active');
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
              <div className="bg-gray-600 p-3 rounded">
                <div className="text-sm font-semibold mb-2">Formula Preview</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div>Tier: <span className="text-yellow-400 font-bold">{stats.tier}</span></div>
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
            );
          })()}

          <button onClick={createFormula} className="w-full bg-green-600 px-4 py-2 rounded">
            Save Formula
          </button>
        </div>
      )}

      <div className="space-y-3">
        {formulas.map(f => (
          <div key={f.id} className="bg-gray-700 p-4 rounded">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold text-lg">{f.name}</h3>
              <div className="flex gap-2">
                <button onClick={() => startBatch(f)} className="bg-purple-600 px-3 py-1 rounded text-sm">
                  Start Batch
                </button>
                <button onClick={() => setDeleteConfirm({id: f.id, name: f.name})} className="bg-red-600 px-3 py-1 rounded text-sm">
                  <Trash2 size={14} />
                </button>
              </div>
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
            </div>
          </div>
        ))}

        {formulas.length === 0 && (
          <div className="text-gray-500 text-center py-8">No formulas yet. Design one to get started!</div>
        )}
      </div>
    </div>
  );
}
