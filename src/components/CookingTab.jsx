import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toNumberOr } from '../utils/helpers';
import { DiceRoller } from './DiceRoller';

/**
 * CookingTab Component - Manages recipe creation and cooking in GURPS
 *
 * This component handles two main workflows:
 * 1. Recipe Creation - Create new recipes from available food ingredients
 * 2. Recipe Remaking - Cook existing recipes with optional ingredient substitutions
 *
 * Key GURPS mechanics implemented:
 * - Difficulty modifier based on unique ingredient count: -(unique - 1)
 * - Skill rolls required based on ingredient types and critical success
 * - Kitchen rating bonus applied to effective cooking skill
 * - Critical success/failure thresholds per GURPS rules
 * - Substitution penalties: -1 (same type), -3 (similar), -5 (unrelated)
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} props.foods - Available food inventory with id, name, types, quantity
 * @param {Array<Object>} props.recipes - Saved recipes with ingredients, difficulty, skills
 * @param {Function} props.saveFoods - Callback to persist food inventory changes
 * @param {Function} props.saveRecipes - Callback to persist recipe changes
 * @param {Array<Object>} props.workers - Available workers with cooking skills
 * @param {Array<Object>} props.kitchens - Available kitchens with id, name, rating bonus
 * @param {Array<Object>} props.cookingSkills - Skill table for random skill selection
 * @returns {JSX.Element} The cooking tab interface
 */
export function CookingTab({ foods, recipes, saveFoods, saveRecipes, workers, kitchens, cookingSkills }) {
  const [view, setView] = useState('create');
  const [selected, setSelected] = useState([]);
  const [numPeople, setNumPeople] = useState(10);
  const [name, setName] = useState('');
  const [crit, setCrit] = useState(false);
  const [skills, setSkills] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedKitchenId, setSelectedKitchenId] = useState(kitchens?.[0]?.id || 'default');
  const [cookingSkillValue, setCookingSkillValue] = useState('');
  const [roll, setRoll] = useState({ dice: [], total: 0 });
  const [expandedRecipes, setExpandedRecipes] = useState({});

  // Remake recipe state
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [remakeIngredients, setRemakeIngredients] = useState([]);
  const [remakeWorker, setRemakeWorker] = useState('');
  const [remakeKitchenId, setRemakeKitchenId] = useState(kitchens?.[0]?.id || 'default');
  const [remakeSkill, setRemakeSkill] = useState('');
  const [remakeRoll, setRemakeRoll] = useState({ dice: [], total: 0 });

  /**
   * Computed recipe statistics based on selected ingredients
   * Calculates difficulty modifier and required skill rolls per GURPS cooking rules
   *
   * @type {{unique: number, total: number, diff: number, rolls: number}}
   * - unique: Count of distinct ingredients
   * - total: Sum of all ingredient amounts (must match numPeople)
   * - diff: Difficulty modifier = -(unique - 1), more ingredients = harder
   * - rolls: Number of skill rolls = floor(unique/2) + extra types + critical bonus
   */
  const stats = (() => {
    const unique = selected.length;
    const total = selected.reduce((s, i) => s + i.amount, 0);
    // Difficulty penalty increases with ingredient complexity
    const diff = -(unique - 1);
    // Base rolls: 1 per 2 unique ingredients
    let rolls = Math.floor(unique / 2);
    // Additional rolls for multi-type ingredients (e.g., "meat/dairy" adds 1 roll)
    selected.forEach(i => {
      const f = foods.find(x => x.id === i.foodId);
      if (f) rolls += f.types.length - 1;
    });
    // Critical success grants one extra skill roll
    if (crit) rolls += 1;
    return { unique, total, diff, rolls };
  })();

  /**
   * Creates a new recipe from selected ingredients
   * Validates requirements, calculates skill check results, and persists the recipe
   *
   * GURPS Critical Success: roll <= 4, or 5 with skill >= 15, or 6 with skill >= 16
   * GURPS Critical Failure: roll = 18, or 17 with skill <= 15, or 16 with skill <= 6
   *
   * @returns {void} - Alerts user with result and updates state
   */
  function create() {
    if (stats.total !== numPeople || !name.trim() || skills.length !== stats.rolls) {
      alert('Check requirements'); return;
    }
    if (!selectedWorker || !cookingSkillValue || !roll.total) {
      alert('Please select worker, skill, and roll for recipe creation');
      return;
    }

    const skillValue = parseInt(cookingSkillValue);
    const rollValue = roll.total;

    if (isNaN(skillValue) || isNaN(rollValue)) {
      alert('Invalid skill or roll values');
      return;
    }

    // Get kitchen and apply kitchen rating bonus
    const selectedKitchen = kitchens?.find(k => k.id === selectedKitchenId) || { id: 'default', name: 'Basic Kitchen', rating: 0 };
    const kitchenBonus = selectedKitchen.rating || 0;
    const effectiveSkill = skillValue + kitchenBonus;

    // Calculate margin of success with kitchen bonus
    const mos = effectiveSkill - rollValue;

    // Determine if critical success or critical failure
    const isCritSuccess = rollValue <= 4 || (rollValue === 5 && effectiveSkill >= 15) || (rollValue === 6 && effectiveSkill >= 16);
    const isCritFail = rollValue === 18 || (rollValue === 17 && effectiveSkill <= 15) || (rollValue === 16 && effectiveSkill <= 6);

    let result = 'Failure';
    if (isCritSuccess) {
      result = 'Critical Success';
    } else if (isCritFail) {
      result = 'Critical Failure';
    } else if (mos >= 0) {
      result = 'Success';
    }

    // Record creation log
    const creationLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      worker: selectedWorker,
      kitchen: selectedKitchen.name,
      cookingSkill: skillValue,
      kitchenBonus: kitchenBonus,
      effectiveSkill: effectiveSkill,
      roll: rollValue,
      mos: mos,
      result: result,
      substitutes: [] // No substitutes on initial creation
    };

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
      criticalSuccess: crit,
      creationHistory: [creationLog]
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
    setSelected([]); setName(''); setCrit(false); setSkills([]); setSelectedWorker(''); setCookingSkillValue(''); setRoll('');
    alert(`Recipe created! Result: ${result} (MoS: ${mos})`);
  }

  /**
   * Initiates the remake workflow for an existing recipe
   * Checks ingredient availability and sets up substitution options
   *
   * @param {Object} recipe - The recipe to remake
   * @param {string} recipe.id - Unique recipe identifier
   * @param {string} recipe.name - Recipe name
   * @param {Array<Object>} recipe.ingredients - Required ingredients with foodId, amount
   */
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

  /**
   * Toggles between using original ingredient or substitutes
   * Initializes substitute array when switching to substitution mode
   *
   * @param {number} index - Index of ingredient in remakeIngredients array
   */
  function toggleSubstitute(index) {
    const updated = [...remakeIngredients];
    updated[index].useOriginal = !updated[index].useOriginal;
    if (!updated[index].useOriginal && updated[index].substitutes.length === 0) {
      updated[index].substitutes = [{ foodId: null, amount: updated[index].original.amount }];
    }
    setRemakeIngredients(updated);
  }

  /**
   * Adds a new empty substitute slot for an ingredient
   *
   * @param {number} ingredientIndex - Index of ingredient to add substitute to
   */
  function addSubstitute(ingredientIndex) {
    const updated = [...remakeIngredients];
    updated[ingredientIndex].substitutes.push({ foodId: null, amount: 1 });
    setRemakeIngredients(updated);
  }

  /**
   * Updates a substitute ingredient's field and auto-calculates penalty
   *
   * Penalty calculation based on food type matching:
   * - Same type (e.g., meat -> meat): -1
   * - Similar type (fruit <-> vegetable): -3
   * - Unrelated type: -5
   *
   * @param {number} ingredientIndex - Index of ingredient in remakeIngredients
   * @param {number} subIndex - Index of substitute within ingredient's substitutes array
   * @param {string} field - Field to update ('foodId' or 'amount')
   * @param {*} value - New value for the field
   */
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

  /**
   * Manually overrides the substitution penalty for an ingredient
   *
   * @param {number} ingredientIndex - Index of ingredient
   * @param {number} penalty - Penalty value (-1, -3, or -5)
   */
  function updateSubstitutePenalty(ingredientIndex, penalty) {
    const updated = [...remakeIngredients];
    updated[ingredientIndex].penalty = penalty;
    setRemakeIngredients(updated);
  }

  /**
   * Removes a substitute from an ingredient's substitute list
   *
   * @param {number} ingredientIndex - Index of ingredient
   * @param {number} subIndex - Index of substitute to remove
   */
  function removeSubstitute(ingredientIndex, subIndex) {
    const updated = [...remakeIngredients];
    updated[ingredientIndex].substitutes.splice(subIndex, 1);
    setRemakeIngredients(updated);
  }

  /**
   * Calculates total difficulty modifier for remaking recipe
   * Combines base recipe difficulty with all substitution penalties
   *
   * @returns {number} Total difficulty modifier (negative value)
   */
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

  /**
   * Executes the remake of an existing recipe
   *
   * This function:
   * 1. Validates all substitutes are selected
   * 2. Calculates effective skill with kitchen bonus
   * 3. Determines success/failure using GURPS critical rules
   * 4. Consumes ingredients (original or substitutes) from inventory
   * 5. Records the creation log with full roll details
   *
   * Material consumption logic:
   * - If using original: deduct from original food's quantity
   * - If using substitutes: deduct from each substitute food's quantity
   *
   * @returns {void} - Alerts user with result and updates state
   */
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

    if (!remakeWorker || !remakeSkill || !remakeRoll.total) {
      alert('Please select worker, skill, and roll for remaking recipe');
      return;
    }

    const skillValue = parseInt(remakeSkill);
    const rollValue = remakeRoll.total;

    if (isNaN(skillValue) || isNaN(rollValue)) {
      alert('Invalid skill or roll values');
      return;
    }

    // Get kitchen and apply kitchen rating bonus
    const selectedKitchen = kitchens?.find(k => k.id === remakeKitchenId) || { id: 'default', name: 'Basic Kitchen', rating: 0 };
    const kitchenBonus = selectedKitchen.rating || 0;
    const effectiveSkill = skillValue + kitchenBonus;

    // Calculate margin of success with kitchen bonus
    const mos = effectiveSkill - rollValue;

    // Determine if critical success or critical failure
    const isCritSuccess = rollValue <= 4 || (rollValue === 5 && effectiveSkill >= 15) || (rollValue === 6 && effectiveSkill >= 16);
    const isCritFail = rollValue === 18 || (rollValue === 17 && effectiveSkill <= 15) || (rollValue === 16 && effectiveSkill <= 6);

    let result = 'Failure';
    if (isCritSuccess) {
      result = 'Critical Success';
    } else if (isCritFail) {
      result = 'Critical Failure';
    } else if (mos >= 0) {
      result = 'Success';
    }

    // Build substitutes list
    const substitutes = [];
    remakeIngredients.forEach(ing => {
      if (!ing.useOriginal && ing.substitutes.length > 0) {
        ing.substitutes.forEach(sub => {
          const subFood = foods.find(f => f.id === sub.foodId || String(f.id) === sub.foodId);
          substitutes.push({
            original: ing.original.foodName,
            replacement: subFood?.name || 'Unknown',
            amount: sub.amount
          });
        });
      }
    });

    // Record remake log
    const remakeLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      worker: remakeWorker,
      kitchen: selectedKitchen.name,
      cookingSkill: skillValue,
      kitchenBonus: kitchenBonus,
      effectiveSkill: effectiveSkill,
      roll: rollValue,
      mos: mos,
      result: result,
      substitutes: substitutes
    };

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

    // Update recipe with new log
    const updatedRecipes = recipes.map(r => {
      if (r.id === selectedRecipe.id) {
        return {
          ...r,
          creationHistory: [...(r.creationHistory || []), remakeLog]
        };
      }
      return r;
    });
    saveRecipes(updatedRecipes);

    alert(`Recipe "${selectedRecipe.name}" remade! Result: ${result} (MoS: ${mos}, Difficulty: ${calculateRemakeDifficulty()})`);
    setView('library');
    setSelectedRecipe(null);
    setRemakeIngredients([]);
    setRemakeWorker(''); setRemakeSkill(''); setRemakeRoll('');
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

          <div className="bg-gray-700 p-4 rounded space-y-3">
            <h4 className="font-semibold">Recipe Creation Roll</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs mb-1">Worker</label>
                <select
                  value={selectedWorker}
                  onChange={(e) => {
                    const worker = workers?.find(w => w.name === e.target.value);
                    setSelectedWorker(e.target.value);
                    if (worker?.skills) {
                      setCookingSkillValue(String(worker.skills.cooking || 10));
                    }
                  }}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="">Select worker...</option>
                  {(workers || []).map(w => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Kitchen</label>
                <select
                  value={selectedKitchenId}
                  onChange={(e) => setSelectedKitchenId(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  {(kitchens || [{ id: 'default', name: 'Basic Kitchen', rating: 0 }]).map(kitchen => (
                    <option key={kitchen.id} value={kitchen.id}>
                      {kitchen.name} (+{kitchen.rating})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Cooking Skill</label>
                <input
                  type="number"
                  value={cookingSkillValue}
                  onChange={(e) => setCookingSkillValue(e.target.value)}
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
                  />
                </div>
                {cookingSkillValue && (
                  <div className="text-xs text-gray-400 mt-1">
                    {(() => {
                      const selectedKitchen = kitchens?.find(k => k.id === selectedKitchenId) || { rating: 0 };
                      const kitchenBonus = selectedKitchen.rating || 0;
                      const effectiveSkill = parseInt(cookingSkillValue) + kitchenBonus;
                      const mos = roll.total ? effectiveSkill - roll.total : '?';
                      return kitchenBonus > 0
                        ? `Effective Skill: ${cookingSkillValue} + ${kitchenBonus} (kitchen) = ${effectiveSkill} | MoS: ${mos}`
                        : `MoS: ${mos}`;
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block mb-2">Skill Names (Granted by Recipe)</label>
            {Array.from({length: stats.rolls}).map((_, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={skills[i] || ''}
                  onChange={(e) => { const s = [...skills]; s[i] = e.target.value; setSkills(s); }}
                  className="flex-1 bg-gray-700 px-3 py-2 rounded"
                  placeholder={`Skill ${i+1}`}
                />
                <button
                  onClick={() => {
                    if (!cookingSkills || cookingSkills.length === 0) {
                      alert('No skills in table! Add skills in Manager tab first.');
                      return;
                    }
                    const randomSkill = cookingSkills[Math.floor(Math.random() * cookingSkills.length)];
                    const s = [...skills];
                    s[i] = randomSkill.name;
                    setSkills(s);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm whitespace-nowrap"
                  title="Randomly select from skills table"
                >
                  🎲 Random
                </button>
              </div>
            ))}
          </div>
          <button onClick={create} className="w-full bg-green-600 py-3 rounded font-semibold">Create Recipe</button>
        </div>
      )}

      {view === 'library' && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          {recipes.map(r => (
            <div key={r.id} className="bg-gray-700 rounded">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-600"
                onClick={() => setExpandedRecipes(prev => ({...prev, [r.id]: !prev[r.id]}))}
              >
                <span className="text-gray-400">
                  {expandedRecipes[r.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </span>
                <h3 className="flex-1 font-semibold text-lg">{r.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRemake(r); }}
                    className="bg-green-600 px-4 py-2 rounded text-sm hover:bg-green-700"
                  >
                    Make Recipe
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({id: r.id, name: r.name}); }}
                    className="bg-red-600 px-4 py-2 rounded text-sm hover:bg-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {expandedRecipes[r.id] && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-600 pt-3">
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
                    <div><strong>Skills Granted:</strong> {r.skills.join(', ')}</div>
                    {r.criticalSuccess && <div className="text-yellow-400">⭐ Critical Success!</div>}
                  </div>

                  {r.creationHistory && r.creationHistory.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Creation History</h4>
                      {r.creationHistory.map((log) => (
                        <div key={log.id} className="bg-gray-600 p-3 rounded text-sm">
                          <div className="flex justify-between">
                            <span className={log.result === 'Critical Success' ? 'text-green-400' : log.result === 'Critical Failure' ? 'text-red-400' : log.result === 'Success' ? 'text-blue-400' : 'text-gray-400'}>
                              {log.result}
                            </span>
                            <span className="text-gray-400">{new Date(log.date).toLocaleDateString()}</span>
                          </div>
                          <div className="text-xs text-gray-300 mt-1">
                            <div>Worker: {log.worker} | Kitchen: {log.kitchen}</div>
                            <div>Cooking Skill: {log.cookingSkill} + {log.kitchenBonus} (kitchen) = {log.effectiveSkill} | Roll: {log.roll} | MoS: {log.mos}</div>
                            {log.substitutes && log.substitutes.length > 0 && (
                              <div className="mt-1 text-yellow-300">
                                <strong>Substitutions:</strong>
                                {log.substitutes.map((sub, idx) => (
                                  <div key={idx} className="ml-2">
                                    • {sub.original} → {sub.replacement} ({sub.amount} lbs)
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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

          <div className="bg-gray-700 p-4 rounded space-y-3 mb-6">
            <h4 className="font-semibold">Cooking Roll</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs mb-1">Worker</label>
                <select
                  value={remakeWorker}
                  onChange={(e) => {
                    const worker = workers?.find(w => w.name === e.target.value);
                    setRemakeWorker(e.target.value);
                    if (worker?.skills) {
                      setRemakeSkill(String(worker.skills.cooking || 10));
                    }
                  }}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="">Select worker...</option>
                  {(workers || []).map(w => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Kitchen</label>
                <select
                  value={remakeKitchenId}
                  onChange={(e) => setRemakeKitchenId(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  {(kitchens || [{ id: 'default', name: 'Basic Kitchen', rating: 0 }]).map(kitchen => (
                    <option key={kitchen.id} value={kitchen.id}>
                      {kitchen.name} (+{kitchen.rating})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Cooking Skill</label>
                <input
                  type="number"
                  value={remakeSkill}
                  onChange={(e) => setRemakeSkill(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                  placeholder="e.g., 14"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs mb-1">Roll (3d6)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={remakeRoll.total || ''}
                    onChange={(e) => setRemakeRoll({ dice: [], total: parseInt(e.target.value) || 0 })}
                    className="flex-1 bg-gray-600 px-3 py-2 rounded"
                    placeholder="3-18"
                    min="3"
                    max="18"
                  />
                  <DiceRoller
                    dice={remakeRoll.dice}
                    total={remakeRoll.total}
                    onRoll={(dice, total) => setRemakeRoll({ dice, total })}
                  />
                </div>
                {remakeSkill && (
                  <div className="text-xs text-gray-400 mt-1">
                    {(() => {
                      const selectedKitchen = kitchens?.find(k => k.id === remakeKitchenId) || { rating: 0 };
                      const kitchenBonus = selectedKitchen.rating || 0;
                      const effectiveSkill = parseInt(remakeSkill) + kitchenBonus;
                      const mos = remakeRoll.total ? effectiveSkill - remakeRoll.total : '?';
                      return kitchenBonus > 0
                        ? `Effective Skill: ${remakeSkill} + ${kitchenBonus} (kitchen) = ${effectiveSkill} | MoS: ${mos}`
                        : `MoS: ${mos}`;
                    })()}
                  </div>
                )}
              </div>
            </div>
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
