import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toNumberOr } from '../utils/helpers';

export function CookingTab({ foods, recipes, saveFoods, saveRecipes }) {
  const [view, setView] = useState('create');
  const [selected, setSelected] = useState([]);
  const [numPeople, setNumPeople] = useState(10);
  const [name, setName] = useState('');
  const [crit, setCrit] = useState(false);
  const [skills, setSkills] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Remake recipe state
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [remakeIngredients, setRemakeIngredients] = useState([]);

  const stats = (() => {
    const unique = selected.length;
    const total = selected.reduce((s, i) => s + i.amount, 0);
    const diff = -(unique - 1);
    let rolls = Math.floor(unique / 2);
    selected.forEach(i => {
      const f = foods.find(x => x.id === i.foodId);
      if (f) rolls += f.types.length - 1;
    });
    if (crit) rolls += 1;
    return { unique, total, diff, rolls };
  })();

  function create() {
    if (stats.total !== numPeople || !name.trim() || skills.length !== stats.rolls) {
      alert('Check requirements'); return;
    }
    const recipe = {
      id: crypto.randomUUID(),
      name,
      ingredients: selected.map(i => {
        const food = foods.find(f => f.id === i.foodId || String(f.id) === i.foodId || f.id === String(i.foodId));
        return {
          foodId: i.foodId,
          foodName: food?.name || 'Unknown Food',
          foodTypes: food?.types || [],
          amount: i.amount
        };
      }),
      difficulty: stats.diff,
      skills,
      criticalSuccess: crit
    };
    saveRecipes([...recipes, recipe]);
    const newFoods = foods.map(f => {
      const ingredient = selected.find(i => i.foodId === f.id || String(i.foodId) === f.id || i.foodId === String(f.id));
      if (ingredient) {
        const newQty = f.quantity - ingredient.amount;
        return {...f, quantity: newQty < 0 ? 0 : newQty};
      }
      return f;
    });
    saveFoods(newFoods);
    setSelected([]); setName(''); setCrit(false); setSkills([]);
    alert('Recipe created!');
  }

  function startRemake(recipe) {
    setSelectedRecipe(recipe);
    const ingredients = recipe.ingredients.map(ing => {
      const available = foods.find(f =>
        f.id === ing.foodId ||
        String(f.id) === ing.foodId ||
        f.id === String(ing.foodId)
      );
      const hasEnough = available && available.quantity >= ing.amount;
      return {
        original: ing,
        useOriginal: hasEnough,
        substitutes: hasEnough ? [] : [{ foodId: null, amount: ing.amount }],
        penalty: 0
      };
    });
    setRemakeIngredients(ingredients);
    setView('remake');
  }

  function toggleSubstitute(index) {
    const updated = [...remakeIngredients];
    updated[index].useOriginal = !updated[index].useOriginal;
    if (!updated[index].useOriginal && updated[index].substitutes.length === 0) {
      updated[index].substitutes = [{ foodId: null, amount: updated[index].original.amount }];
    }
    setRemakeIngredients(updated);
  }

  function addSubstitute(ingredientIndex) {
    const updated = [...remakeIngredients];
    updated[ingredientIndex].substitutes.push({ foodId: null, amount: 1 });
    setRemakeIngredients(updated);
  }

  function updateSubstitute(ingredientIndex, subIndex, field, value) {
    const updated = [...remakeIngredients];
    updated[ingredientIndex].substitutes[subIndex][field] = value;

    if (field === 'foodId' && value) {
      const originalTypes = updated[ingredientIndex].original.foodTypes || [];
      const subFood = foods.find(f =>
        f.id === value ||
        String(f.id) === value ||
        f.id === String(value)
      );

      if (subFood) {
        const subTypes = subFood.types;
        const hasMatchingType = originalTypes.some(t => subTypes.includes(t));

        if (hasMatchingType) {
          updated[ingredientIndex].penalty = -1;
        } else {
          const isSimilar = (originalTypes.includes('fruit') && subTypes.includes('vegetable')) ||
                           (originalTypes.includes('vegetable') && subTypes.includes('fruit'));
          updated[ingredientIndex].penalty = isSimilar ? -3 : -5;
        }
      }
    }

    setRemakeIngredients(updated);
  }

  function updateSubstitutePenalty(ingredientIndex, penalty) {
    const updated = [...remakeIngredients];
    updated[ingredientIndex].penalty = penalty;
    setRemakeIngredients(updated);
  }

  function removeSubstitute(ingredientIndex, subIndex) {
    const updated = [...remakeIngredients];
    updated[ingredientIndex].substitutes.splice(subIndex, 1);
    setRemakeIngredients(updated);
  }

  function calculateRemakeDifficulty() {
    if (!selectedRecipe) return 0;
    let totalPenalty = selectedRecipe.difficulty;
    remakeIngredients.forEach(ing => {
      if (!ing.useOriginal) {
        totalPenalty += ing.penalty;
      }
    });
    return totalPenalty;
  }

  function executeRemake() {
    for (let ing of remakeIngredients) {
      if (!ing.useOriginal) {
        for (let sub of ing.substitutes) {
          if (!sub.foodId) {
            alert('Please select all substitute ingredients');
            return;
          }
        }
      }
    }

    const newFoods = [...foods];
    remakeIngredients.forEach(ing => {
      if (ing.useOriginal) {
        const foodIndex = newFoods.findIndex(f =>
          f.id === ing.original.foodId ||
          String(f.id) === ing.original.foodId ||
          f.id === String(ing.original.foodId)
        );
        if (foodIndex !== -1) {
          newFoods[foodIndex].quantity -= ing.original.amount;
          if (newFoods[foodIndex].quantity < 0) newFoods[foodIndex].quantity = 0;
        }
      } else {
        ing.substitutes.forEach(sub => {
          const foodIndex = newFoods.findIndex(f =>
            f.id === sub.foodId ||
            String(f.id) === sub.foodId ||
            f.id === String(sub.foodId)
          );
          if (foodIndex !== -1) {
            newFoods[foodIndex].quantity -= sub.amount;
            if (newFoods[foodIndex].quantity < 0) newFoods[foodIndex].quantity = 0;
          }
        });
      }
    });
    saveFoods(newFoods);

    alert(`Recipe "${selectedRecipe.name}" remade! Difficulty: ${calculateRemakeDifficulty()}`);
    setView('library');
    setSelectedRecipe(null);
    setRemakeIngredients([]);
  }

  return (
    <div>
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Delete recipe "{deleteConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={() => { saveRecipes(recipes.filter(r => r.id !== deleteConfirm.id)); setDeleteConfirm(null); }} className="px-4 py-2 bg-red-600 rounded">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('create')} className={`px-4 py-2 rounded ${view === 'create' ? 'bg-blue-600' : 'bg-gray-700'}`}>Create Recipe</button>
        <button onClick={() => setView('library')} className={`px-4 py-2 rounded ${view === 'library' ? 'bg-blue-600' : 'bg-gray-700'}`}>Library ({recipes.length})</button>
        {view === 'remake' && (
          <button
            onClick={() => {
              setView('library');
              setSelectedRecipe(null);
              setRemakeIngredients([]);
            }}
            className="px-4 py-2 rounded bg-gray-700"
          >
            ← Back to Library
          </button>
        )}
      </div>

      {view === 'create' && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" className="w-full bg-gray-700 px-3 py-2 rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block mb-2">People</label><input type="number" value={numPeople} onChange={(e) => setNumPeople(Math.max(1, toNumberOr(e.target.value, 1)))} className="w-full bg-gray-700 px-3 py-2 rounded" /></div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label>Ingredients</label>
              <button onClick={() => { if (foods.length > 0) setSelected([...selected, {id: crypto.randomUUID(), foodId: foods[0].id, amount: 1}]); }} className="bg-green-600 px-3 py-1 rounded text-sm"><Plus size={16} className="inline" /> Add</button>
            </div>
            {selected.map(i => (
              <div key={i.id} className="flex gap-2 mb-2">
                <select value={i.foodId} onChange={(e) => setSelected(selected.map(x => x.id === i.id ? {...x, foodId: e.target.value} : x))} className="flex-1 bg-gray-700 px-3 py-1 rounded">
                  {foods.map(f => <option key={f.id} value={f.id}>{f.name} ({f.types.join('/')}) - {f.quantity} lbs</option>)}
                </select>
                <input type="number" value={i.amount} onChange={(e) => setSelected(selected.map(x => x.id === i.id ? {...x, amount: Math.max(0.1, toNumberOr(e.target.value, 1))} : x))} className="w-20 bg-gray-700 px-3 py-1 rounded" />
                <button onClick={() => setSelected(selected.filter(x => x.id !== i.id))} className="text-red-400"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
          <div className="bg-gray-700 p-4 rounded text-sm">
            <div>Unique: {stats.unique} | Total: {stats.total}/{numPeople} | Difficulty: {stats.diff} | Skill Rolls: {stats.rolls}</div>
          </div>
          <label className="flex items-center gap-3"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} className="w-5 h-5" /><span>Critical Success? (+1 roll)</span></label>
          <div>
            <label className="block mb-2">Skill Names</label>
            {Array.from({length: stats.rolls}).map((_, i) => (
              <input key={i} value={skills[i] || ''} onChange={(e) => { const s = [...skills]; s[i] = e.target.value; setSkills(s); }} className="w-full bg-gray-700 px-3 py-2 rounded mb-2" placeholder={`Skill ${i+1}`} />
            ))}
          </div>
          <button onClick={create} className="w-full bg-green-600 py-3 rounded font-semibold">Create Recipe</button>
        </div>
      )}

      {view === 'library' && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          {recipes.map(r => (
            <div key={r.id} className="bg-gray-700 p-4 rounded">
              <div className="flex justify-between mb-2">
                <h3 className="font-semibold text-lg">{r.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => startRemake(r)}
                    className="bg-green-600 px-4 py-2 rounded text-sm"
                  >
                    Make Recipe
                  </button>
                  <button onClick={() => setDeleteConfirm({id: r.id, name: r.name})} className="bg-red-600 px-4 py-2 rounded text-sm"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="text-sm space-y-1">
                <div><strong>Ingredients:</strong></div>
                {r.ingredients.map((i, idx) => {
                  const food = foods.find(f => f.id === i.foodId || f.id === String(i.foodId));
                  const displayName = food?.name || i.foodName || 'Unknown Food';
                  const displayTypes = food?.types || i.foodTypes || [];
                  return (
                    <div key={idx} className="ml-4">
                      • {i.amount} lbs {displayName} {displayTypes.length > 0 && <span className="text-blue-400">({displayTypes.join('/')})</span>}
                    </div>
                  );
                })}
                <div><strong>Difficulty:</strong> {r.difficulty}</div>
                <div><strong>Skills:</strong> {r.skills.join(', ')}</div>
                {r.criticalSuccess && <div className="text-yellow-400">⭐ Critical Success!</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'remake' && selectedRecipe && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Make Recipe: {selectedRecipe.name}</h2>

          <div className="bg-gray-700 p-4 rounded mb-4">
            <div className="text-sm space-y-1">
              <div><strong>Original Difficulty:</strong> {selectedRecipe.difficulty}</div>
              <div><strong>Current Difficulty:</strong> {calculateRemakeDifficulty()}</div>
              <div><strong>Skill Bonuses:</strong> {selectedRecipe.skills.join(', ')}</div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {remakeIngredients.map((ing, ingIndex) => {
              const originalFood = foods.find(f =>
                f.id === ing.original.foodId ||
                String(f.id) === ing.original.foodId ||
                f.id === String(ing.original.foodId)
              );
              const hasEnough = originalFood && originalFood.quantity >= ing.original.amount;
              const foodTypes = ing.original.foodTypes || [];

              return (
                <div key={ingIndex} className="bg-gray-700 p-4 rounded">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold">
                        {ing.original.foodName}
                        {foodTypes.length > 0 && (
                          <span className="text-blue-400 ml-2">({foodTypes.join('/')})</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        Need: {ing.original.amount} lbs |
                        Available: {originalFood ? originalFood.quantity : 0} lbs
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={ing.useOriginal}
                        onChange={() => toggleSubstitute(ingIndex)}
                        disabled={!hasEnough}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Use Original</span>
                    </label>
                  </div>

                  {!ing.useOriginal && (
                    <div className="space-y-3 border-t border-gray-600 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-yellow-400">Substitutes:</span>
                        <button
                          onClick={() => addSubstitute(ingIndex)}
                          className="bg-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          <Plus size={14} className="inline" /> Add Substitute
                        </button>
                      </div>

                      {ing.substitutes.map((sub, subIndex) => (
                        <div key={subIndex} className="bg-gray-600 p-3 rounded space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={sub.foodId || ''}
                              onChange={(e) => updateSubstitute(ingIndex, subIndex, 'foodId', e.target.value)}
                              className="flex-1 bg-gray-700 px-3 py-2 rounded"
                            >
                              <option value="">Select substitute...</option>
                              {foods.filter(f => f.quantity > 0).map(f => (
                                <option key={f.id} value={f.id}>
                                  {f.name} ({f.types.join('/')}) - {f.quantity} lbs
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={sub.amount}
                              onChange={(e) => updateSubstitute(ingIndex, subIndex, 'amount', parseFloat(e.target.value) || 1)}
                              className="w-24 bg-gray-700 px-3 py-2 rounded"
                              min="0.1"
                            />
                            <button
                              onClick={() => removeSubstitute(ingIndex, subIndex)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="bg-gray-600 p-3 rounded">
                        <label className="block text-sm mb-2">Substitution Penalty</label>
                        <select
                          value={ing.penalty}
                          onChange={(e) => updateSubstitutePenalty(ingIndex, parseInt(e.target.value))}
                          className="w-full bg-gray-700 px-3 py-2 rounded"
                        >
                          <option value="-1">Same Type (-1)</option>
                          <option value="-3">Similar Type (fruit ↔ vegetable) (-3)</option>
                          <option value="-5">Unrelated Type (-5)</option>
                        </select>
                        <div className="text-xs text-gray-400 mt-1">
                          Auto-calculated based on first substitute, adjust if needed
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={executeRemake}
            className="w-full bg-green-600 py-3 rounded font-semibold hover:bg-green-700"
          >
            Cook Recipe (Difficulty: {calculateRemakeDifficulty()})
          </button>
        </div>
      )}
    </div>
  );
}
