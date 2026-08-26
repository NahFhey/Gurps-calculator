import { useCallback, useMemo, useState } from 'react';
import { useWeatherModifiers } from '../../hooks/useWeatherModifiers';
import { denormalizeObject, normalizeArray } from '../../state/campaignUtils';
import { selectOwnerFoodHoldings } from '../../state/selectors/inventorySelectors';
import { useCampaignStore } from '../../state/campaignStore';
import type {
  CookingRecipe as Recipe,
  RecipeCreationLog as CreationLog,
} from '../../types/campaign';
import { cookingLog } from '../../utils/activityLogger';
import { computeExcludedCharacterIds, getMealFoodTypes } from '../../utils/dietaryRestrictions';
import { toNumberOr } from '../../utils/helpers';
import type {
  CookingSkill,
  CookingView,
  DiceRoll,
  Food,
  Kitchen,
  RemakeIngredient,
  SelectedIngredient,
  Worker,
} from './types';
import { CreateMealView } from './views/CreateMealView';
import { RecipeLibraryView } from './views/RecipeLibraryView';
import { RemakeView } from './views/RemakeView';

export function CookingTab() {
  const { state, actions } = useCampaignStore();
  const { hasEffect, effectDescription, locationName } = useWeatherModifiers('cooking');
  const foods = useMemo(() => selectOwnerFoodHoldings(state, 'party') as Food[], [state]);
  const recipes = useMemo(() => denormalizeObject(state.entities.recipes) as unknown as Recipe[], [state.entities.recipes]);
  const kitchens = useMemo(() => denormalizeObject(state.entities.kitchens) as unknown as Kitchen[], [state.entities.kitchens]);
  const cookingSkills = state.entities.cookingSkills as CookingSkill[];
  const workers = useMemo(() => Object.values(state.entities.characters).map(character => ({
    id: character.id,
    name: character.name,
    skills: character.work.skills || {},
    st: character.st,
  })) as Worker[], [state.entities.characters]);
  const saveRecipes = useCallback((value: Recipe[]) => actions.setRecipes(normalizeArray(value)), [actions]);

  const [view, setView] = useState<CookingView>('create');
  const [selected, setSelected] = useState<SelectedIngredient[]>([]);
  const [numPeople, setNumPeople] = useState(10);
  const [name, setName] = useState('');
  const [crit, setCrit] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedKitchenId, setSelectedKitchenId] = useState(kitchens?.[0]?.id || 'default');
  const [cookingSkillValue, setCookingSkillValue] = useState('');
  const [roll, setRoll] = useState<DiceRoll>({ dice: [], total: 0 });
  const [expandedRecipes, setExpandedRecipes] = useState<Record<string, boolean>>({});
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [remakeIngredients, setRemakeIngredients] = useState<RemakeIngredient[]>([]);
  const [remakeWorker, setRemakeWorker] = useState('');
  const [remakeKitchenId, setRemakeKitchenId] = useState(kitchens?.[0]?.id || 'default');
  const [remakeSkill, setRemakeSkill] = useState('');
  const [remakeRoll, setRemakeRoll] = useState<DiceRoll>({ dice: [], total: 0 });

  const stats = (() => {
    const unique = selected.length;
    const total = selected.reduce((sum, ingredient) => sum + ingredient.amount, 0);
    const diff = -(unique - 1);
    let rolls = Math.floor(unique / 2);
    selected.forEach(ingredient => {
      const food = foods.find(item => item.id === ingredient.foodId);
      if (food) rolls += food.types.length - 1;
    });
    if (crit) rolls += 1;
    return { unique, total, diff, rolls };
  })();

  function create() {
    if (stats.total !== numPeople || !name.trim() || skills.length !== stats.rolls) {
      alert('Check requirements');
      return;
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
    const selectedKitchen = kitchens?.find(kitchen => kitchen.id === selectedKitchenId) || { id: 'default', name: 'Basic Kitchen', rating: 0 };
    const kitchenBonus = selectedKitchen.rating || 0;
    const effectiveSkill = skillValue + kitchenBonus;
    const mos = effectiveSkill - rollValue;
    const isCritSuccess = rollValue <= 4 || (rollValue === 5 && effectiveSkill >= 15) || (rollValue === 6 && effectiveSkill >= 16);
    const isCritFail = rollValue === 18 || (rollValue === 17 && effectiveSkill <= 15) || (rollValue === 16 && effectiveSkill <= 6);
    let result = 'Failure';
    if (isCritSuccess) result = 'Critical Success';
    else if (isCritFail) result = 'Critical Failure';
    else if (mos >= 0) result = 'Success';
    const creationLog: CreationLog = {
      id: crypto.randomUUID(), date: new Date().toISOString(), worker: selectedWorker,
      kitchen: selectedKitchen.name, cookingSkill: skillValue, kitchenBonus,
      effectiveSkill, roll: rollValue, mos, result, substitutes: [],
    };
    const recipe: Recipe = {
      id: crypto.randomUUID(), name,
      ingredients: selected.map(ingredient => {
        const food = foods.find(item => item.id === ingredient.foodId || String(item.id) === ingredient.foodId || item.id === String(ingredient.foodId));
        return { foodId: ingredient.foodId, foodName: food?.name || 'Unknown Food', foodTypes: food?.types || [], amount: ingredient.amount };
      }),
      difficulty: stats.diff, skills, criticalSuccess: crit, creationHistory: [creationLog],
    };
    if (result === 'Success' || result === 'Critical Success') {
      const mealFoodTypes = getMealFoodTypes(recipe.ingredients);
      actions.setMealBuff({
        day: state.time.day,
        recipeId: recipe.id,
        recipeName: recipe.name,
        skills: [...recipe.skills],
        excludedCharacterIds: computeExcludedCharacterIds(
          Object.values(state.entities.characters),
          mealFoodTypes,
        ),
      });
    }
    saveRecipes([...recipes, recipe]);
    const workerId = workers?.find(worker => worker.name === selectedWorker)?.id;
    actions.addLogEntry(cookingLog.mealPrepared(
      name,
      result,
      selectedWorker,
      workerId ? { characterIds: [workerId] } : undefined
    ));
    actions.consumeFoods('party', selected.map(ingredient => {
      const food = foods.find(item => item.id === ingredient.foodId || String(item.id) === ingredient.foodId);
      return {
        name: food?.name,
        type: food?.types.join(','),
        quantity: ingredient.amount,
      };
    }));
    setSelected([]);
    setName('');
    setCrit(false);
    setSkills([]);
    setSelectedWorker('');
    setCookingSkillValue('');
    setRoll({ dice: [], total: 0 });
    alert(`Recipe created! Result: ${result} (MoS: ${mos})`);
  }

  function startRemake(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setRemakeIngredients(recipe.ingredients.map(original => {
      const available = foods.find(food => food.id === original.foodId || String(food.id) === original.foodId || food.id === String(original.foodId));
      const hasEnough = !!(available && available.quantity >= original.amount);
      return { original, useOriginal: hasEnough, substitutes: hasEnough ? [] : [{ foodId: null, amount: original.amount }], penalty: 0 };
    }));
    setView('remake');
  }

  function toggleSubstitute(index: number) {
    const updated = [...remakeIngredients];
    updated[index].useOriginal = !updated[index].useOriginal;
    if (!updated[index].useOriginal && updated[index].substitutes.length === 0) {
      updated[index].substitutes = [{ foodId: null, amount: updated[index].original.amount }];
    }
    setRemakeIngredients(updated);
  }

  function addSubstitute(index: number) {
    const updated = [...remakeIngredients];
    updated[index].substitutes.push({ foodId: null, amount: 1 });
    setRemakeIngredients(updated);
  }

  function updateSubstitute(ingredientIndex: number, subIndex: number, field: 'foodId' | 'amount', value: string | number) {
    const updated = [...remakeIngredients];
    if (field === 'foodId') updated[ingredientIndex].substitutes[subIndex].foodId = value as string;
    else updated[ingredientIndex].substitutes[subIndex].amount = value as number;
    if (field === 'foodId' && value) {
      const originalTypes = updated[ingredientIndex].original.foodTypes || [];
      const subFood = foods.find(food => food.id === value || String(food.id) === value || food.id === String(value));
      if (subFood) {
        const hasMatchingType = originalTypes.some(type => subFood.types.includes(type));
        const isSimilar = (originalTypes.includes('fruit') && subFood.types.includes('vegetable')) ||
          (originalTypes.includes('vegetable') && subFood.types.includes('fruit'));
        updated[ingredientIndex].penalty = hasMatchingType ? -1 : isSimilar ? -3 : -5;
      }
    }
    setRemakeIngredients(updated);
  }

  function updateSubstitutePenalty(index: number, penalty: number) {
    const updated = [...remakeIngredients];
    updated[index].penalty = penalty;
    setRemakeIngredients(updated);
  }

  function removeSubstitute(ingredientIndex: number, subIndex: number) {
    const updated = [...remakeIngredients];
    updated[ingredientIndex].substitutes.splice(subIndex, 1);
    setRemakeIngredients(updated);
  }

  function calculateRemakeDifficulty() {
    if (!selectedRecipe) return 0;
    return remakeIngredients.reduce((total, ingredient) => total + (ingredient.useOriginal ? 0 : ingredient.penalty), selectedRecipe.difficulty);
  }

  function executeRemake() {
    for (const ingredient of remakeIngredients) {
      if (!ingredient.useOriginal && ingredient.substitutes.some(substitute => !substitute.foodId)) {
        alert('Please select all substitute ingredients');
        return;
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
    const selectedKitchen = kitchens?.find(kitchen => kitchen.id === remakeKitchenId) || { id: 'default', name: 'Basic Kitchen', rating: 0 };
    const kitchenBonus = selectedKitchen.rating || 0;
    const effectiveSkill = skillValue + kitchenBonus;
    const mos = effectiveSkill - rollValue;
    const isCritSuccess = rollValue <= 4 || (rollValue === 5 && effectiveSkill >= 15) || (rollValue === 6 && effectiveSkill >= 16);
    const isCritFail = rollValue === 18 || (rollValue === 17 && effectiveSkill <= 15) || (rollValue === 16 && effectiveSkill <= 6);
    let result = 'Failure';
    if (isCritSuccess) result = 'Critical Success';
    else if (isCritFail) result = 'Critical Failure';
    else if (mos >= 0) result = 'Success';
    if ((result === 'Success' || result === 'Critical Success') && selectedRecipe) {
      const mealFoodTypes = getMealFoodTypes(selectedRecipe.ingredients);
      actions.setMealBuff({
        day: state.time.day,
        recipeId: selectedRecipe.id,
        recipeName: selectedRecipe.name,
        skills: [...selectedRecipe.skills],
        excludedCharacterIds: computeExcludedCharacterIds(
          Object.values(state.entities.characters),
          mealFoodTypes,
        ),
      });
    }
    const substitutes: Array<{ original: string; replacement: string; amount: number }> = [];
    remakeIngredients.forEach(ingredient => {
      if (!ingredient.useOriginal) ingredient.substitutes.forEach(substitute => {
        const food = foods.find(item => item.id === substitute.foodId || String(item.id) === substitute.foodId);
        substitutes.push({ original: ingredient.original.foodName, replacement: food?.name || 'Unknown', amount: substitute.amount });
      });
    });
    const remakeLog: CreationLog = {
      id: crypto.randomUUID(), date: new Date().toISOString(), worker: remakeWorker,
      kitchen: selectedKitchen.name, cookingSkill: skillValue, kitchenBonus,
      effectiveSkill, roll: rollValue, mos, result, substitutes,
    };
    const consumedFoods: Array<{ name?: string; type?: string; quantity: number }> = [];
    remakeIngredients.forEach(ingredient => {
      const used = ingredient.useOriginal ? [{ foodId: ingredient.original.foodId, amount: ingredient.original.amount }] : ingredient.substitutes;
      used.forEach(item => {
        const food = foods.find(entry => entry.id === item.foodId || String(entry.id) === item.foodId);
        consumedFoods.push({
          name: food?.name,
          type: food?.types.join(','),
          quantity: item.amount,
        });
      });
    });
    actions.consumeFoods('party', consumedFoods);
    saveRecipes(recipes.map(recipe => recipe.id === selectedRecipe?.id
      ? { ...recipe, creationHistory: [...(recipe.creationHistory || []), remakeLog] }
      : recipe));
    const workerId = workers?.find(worker => worker.name === remakeWorker)?.id;
    actions.addLogEntry(cookingLog.mealPrepared(
      selectedRecipe?.name || 'Unknown',
      result,
      remakeWorker,
      workerId ? { characterIds: [workerId] } : undefined
    ));
    alert(`Recipe "${selectedRecipe?.name}" remade! Result: ${result} (MoS: ${mos}, Difficulty: ${calculateRemakeDifficulty()})`);
    setView('library');
    setSelectedRecipe(null);
    setRemakeIngredients([]);
    setRemakeWorker('');
    setRemakeSkill('');
    setRemakeRoll({ dice: [], total: 0 });
  }

  function changeCreateWorker(workerName: string) {
    const worker = workers?.find(item => item.name === workerName);
    setSelectedWorker(workerName);
    if (worker?.skills) setCookingSkillValue(String(worker.skills.cooking || 10));
  }

  function changeRemakeWorker(workerName: string) {
    const worker = workers?.find(item => item.name === workerName);
    setRemakeWorker(workerName);
    if (worker?.skills) setRemakeSkill(String(worker.skills.cooking || 10));
  }

  function randomizeSkill(index: number) {
    if (!cookingSkills || cookingSkills.length === 0) {
      alert('No skills in table! Add skills in Manager tab first.');
      return;
    }
    const updated = [...skills];
    updated[index] = cookingSkills[Math.floor(Math.random() * cookingSkills.length)].name;
    setSkills(updated);
  }

  const remakeDifficulty = calculateRemakeDifficulty();
  return (
    <div>
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Delete recipe "{deleteConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={() => { saveRecipes(recipes.filter(recipe => recipe.id !== deleteConfirm.id)); setDeleteConfirm(null); }} className="px-4 py-2 bg-red-600 rounded">Delete</button>
            </div>
          </div>
        </div>
      )}
      {hasEffect && (
        <div className="mb-4 px-3 py-2 rounded bg-blue-900/30 border border-blue-700/50">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-400">Weather Effect:</span>
            <span className="text-gray-300">{effectDescription}</span>
            {locationName && <span className="text-gray-500 text-xs">at {locationName}</span>}
          </div>
        </div>
      )}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('create')} className={`px-4 py-2 rounded ${view === 'create' ? 'bg-blue-600' : 'bg-gray-700'}`}>Create Recipe</button>
        <button onClick={() => setView('library')} className={`px-4 py-2 rounded ${view === 'library' ? 'bg-blue-600' : 'bg-gray-700'}`}>Library ({recipes.length})</button>
        {view === 'remake' && <button onClick={() => { setView('library'); setSelectedRecipe(null); setRemakeIngredients([]); }} className="px-4 py-2 rounded bg-gray-700">← Back to Library</button>}
      </div>
      {view === 'create' && <CreateMealView
        foods={foods} selected={selected} numPeople={numPeople} name={name} crit={crit}
        skills={skills} selectedWorker={selectedWorker} selectedKitchenId={selectedKitchenId}
        cookingSkillValue={cookingSkillValue} roll={roll} workers={workers} kitchens={kitchens}
        stats={stats} onNameChange={setName}
        onNumPeopleChange={value => setNumPeople(Math.max(1, toNumberOr(value, 1)))}
        onAddIngredient={() => { if (foods.length > 0) setSelected([...selected, { id: crypto.randomUUID(), foodId: foods[0].id, amount: 1 }]); }}
        onIngredientFoodChange={(id, foodId) => setSelected(selected.map(item => item.id === id ? { ...item, foodId } : item))}
        onIngredientAmountChange={(id, value) => setSelected(selected.map(item => item.id === id ? { ...item, amount: Math.max(0.1, toNumberOr(value, 1)) } : item))}
        onRemoveIngredient={id => setSelected(selected.filter(item => item.id !== id))}
        onCritChange={setCrit} onWorkerChange={changeCreateWorker} onKitchenChange={setSelectedKitchenId}
        onCookingSkillChange={setCookingSkillValue} onRollChange={setRoll}
        onRollTotalChange={total => setRoll(previous => ({ ...previous, total }))}
        onSkillChange={(index, value) => { const updated = [...skills]; updated[index] = value; setSkills(updated); }}
        onRandomSkill={randomizeSkill} onCreate={create}
      />}
      {view === 'library' && <RecipeLibraryView
        recipes={recipes} foods={foods} expandedRecipes={expandedRecipes}
        onToggleExpanded={id => setExpandedRecipes(previous => ({ ...previous, [id]: !previous[id] }))}
        onStartRemake={startRemake} onDelete={recipe => setDeleteConfirm({ id: recipe.id, name: recipe.name })}
      />}
      {view === 'remake' && selectedRecipe && <RemakeView
        recipe={selectedRecipe} foods={foods} ingredients={remakeIngredients} workers={workers}
        kitchens={kitchens} worker={remakeWorker} kitchenId={remakeKitchenId} skill={remakeSkill}
        roll={remakeRoll} difficulty={remakeDifficulty} onToggleSubstitute={toggleSubstitute}
        onAddSubstitute={addSubstitute} onUpdateSubstitute={updateSubstitute}
        onRemoveSubstitute={removeSubstitute} onPenaltyChange={updateSubstitutePenalty}
        onWorkerChange={changeRemakeWorker} onKitchenChange={setRemakeKitchenId}
        onSkillChange={setRemakeSkill} onRollChange={setRemakeRoll}
        onRollTotalChange={total => setRemakeRoll(previous => ({ ...previous, total }))}
        onExecute={executeRemake}
      />}
    </div>
  );
}
