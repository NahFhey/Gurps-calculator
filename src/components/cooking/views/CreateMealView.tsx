import { Plus, Trash2 } from 'lucide-react';
import { DiceRoller } from '../../DiceRoller';
import type {
  DiceRoll,
  Food,
  Kitchen,
  RecipeStats,
  SelectedIngredient,
  Worker,
} from '../types';

export interface CreateMealViewProps {
  foods: Food[];
  selected: SelectedIngredient[];
  numPeople: number;
  name: string;
  crit: boolean;
  skills: string[];
  selectedWorker: string;
  selectedKitchenId: string;
  cookingSkillValue: string;
  roll: DiceRoll;
  workers: Worker[];
  kitchens: Kitchen[];
  stats: RecipeStats;
  onNameChange: (value: string) => void;
  onNumPeopleChange: (value: string) => void;
  onAddIngredient: () => void;
  onIngredientFoodChange: (id: string, foodId: string) => void;
  onIngredientAmountChange: (id: string, value: string) => void;
  onRemoveIngredient: (id: string) => void;
  onCritChange: (checked: boolean) => void;
  onWorkerChange: (workerName: string) => void;
  onKitchenChange: (id: string) => void;
  onCookingSkillChange: (value: string) => void;
  onRollChange: (roll: DiceRoll) => void;
  onRollTotalChange: (total: number) => void;
  onSkillChange: (index: number, value: string) => void;
  onRandomSkill: (index: number) => void;
  onCreate: () => void;
}

export function CreateMealView({
  foods, selected, numPeople, name, crit, skills, selectedWorker,
  selectedKitchenId, cookingSkillValue, roll, workers, kitchens,
  stats, onNameChange, onNumPeopleChange, onAddIngredient,
  onIngredientFoodChange, onIngredientAmountChange, onRemoveIngredient,
  onCritChange, onWorkerChange, onKitchenChange, onCookingSkillChange,
  onRollChange, onRollTotalChange, onSkillChange, onRandomSkill, onCreate,
}: CreateMealViewProps) {
  const ingredientAvailability = selected.map(ingredient => {
    const food = foods.find(entry => entry.id === ingredient.foodId);
    return {
      ingredient,
      food,
      hasEnough: !!food && food.quantity >= ingredient.amount,
    };
  });
  const hasEnoughIngredients = ingredientAvailability.every(entry => entry.hasEnough);

  return (
    <div className="bg-surface-1 rounded-lg p-6 space-y-4">
      <input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Recipe name" className="w-full bg-surface-2 px-3 py-2 rounded" />
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block mb-2">People</label><input type="number" value={numPeople} onChange={(e) => onNumPeopleChange(e.target.value)} className="w-full bg-surface-2 px-3 py-2 rounded" /></div>
      </div>
      <div>
        <div className="flex justify-between mb-2">
          <label>Ingredients</label>
          <button onClick={onAddIngredient} className="bg-success-600 px-3 py-1 rounded text-sm"><Plus size={16} className="inline" /> Add</button>
        </div>
        {selected.map(i => (
          <div key={i.id} className="flex gap-2 mb-2">
            <select value={i.foodId} onChange={(e) => onIngredientFoodChange(i.id, e.target.value)} className="flex-1 bg-surface-2 px-3 py-1 rounded">
              {foods.map(f => <option key={f.id} value={f.id}>{f.name} ({f.types.join('/')}) - {f.quantity} lbs</option>)}
            </select>
            <input type="number" value={i.amount} onChange={(e) => onIngredientAmountChange(i.id, e.target.value)} className="w-20 bg-surface-2 px-3 py-1 rounded" />
            <button onClick={() => onRemoveIngredient(i.id)} className="text-danger-400"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
      {ingredientAvailability.length > 0 && (
        <div className="text-sm text-fg-muted">
          <div className="font-semibold mb-1">Required Ingredients:</div>
          <div className="space-y-1">
            {ingredientAvailability.map(({ ingredient, food, hasEnough }) => (
              <div key={ingredient.id} className={hasEnough ? 'text-success-400' : 'text-danger-400'}>
                {food?.name || 'Unknown Food'}: {ingredient.amount} lbs required{' '}
                {food ? `(${food.quantity} lbs available)` : '(not found)'}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-surface-2 p-4 rounded text-sm">
        <div>Unique: {stats.unique} | Total: {stats.total}/{numPeople} | Difficulty: {stats.diff} | Skill Rolls: {stats.rolls}</div>
      </div>
      <label className="flex items-center gap-3"><input type="checkbox" checked={crit} onChange={(e) => onCritChange(e.target.checked)} className="w-5 h-5" /><span>Critical Success? (+1 roll)</span></label>

      <div className="bg-surface-2 p-4 rounded space-y-3">
        <h4 className="font-semibold">Recipe Creation Roll</h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1">Worker</label>
            <select value={selectedWorker} onChange={(e) => onWorkerChange(e.target.value)} className="w-full bg-surface-3 px-3 py-2 rounded">
              <option value="">Select worker...</option>
              {(workers || []).map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">Kitchen</label>
            <select value={selectedKitchenId} onChange={(e) => onKitchenChange(e.target.value)} className="w-full bg-surface-3 px-3 py-2 rounded">
              {(kitchens || [{ id: 'default', name: 'Basic Kitchen', rating: 0 }]).map(kitchen => <option key={kitchen.id} value={kitchen.id}>{kitchen.name} (+{kitchen.rating})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">Cooking Skill</label>
            <input type="number" value={cookingSkillValue} onChange={(e) => onCookingSkillChange(e.target.value)} className="w-full bg-surface-3 px-3 py-2 rounded" placeholder="e.g., 14" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs mb-1">Roll (3d6)</label>
            <div className="flex gap-2">
              <input type="number" value={roll.total || ''} onChange={(e) => onRollChange({ dice: [], total: parseInt(e.target.value) || 0 })} className="flex-1 bg-surface-3 px-3 py-2 rounded" placeholder="3-18" min="3" max="18" />
              <DiceRoller dice={roll.dice} total={roll.total} onRoll={(dice, total) => onRollChange({ dice, total })} onTotalChange={onRollTotalChange} />
            </div>
            {cookingSkillValue && (
              <div className="text-xs text-fg-muted mt-1">
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
            <input value={skills[i] || ''} onChange={(e) => onSkillChange(i, e.target.value)} className="flex-1 bg-surface-2 px-3 py-2 rounded" placeholder={`Skill ${i+1}`} />
            <button onClick={() => onRandomSkill(i)} className="bg-accent-600 hover:bg-accent-500 px-4 py-2 rounded text-sm whitespace-nowrap" title="Randomly select from skills table">Random</button>
          </div>
        ))}
      </div>
      <button
        onClick={onCreate}
        disabled={!hasEnoughIngredients}
        className={`w-full py-3 rounded font-semibold ${hasEnoughIngredients ? 'bg-success-600 hover:bg-success-700' : 'bg-surface-3 cursor-not-allowed'}`}
      >
        {hasEnoughIngredients ? 'Create Recipe' : 'Need Ingredients'}
      </button>
    </div>
  );
}
