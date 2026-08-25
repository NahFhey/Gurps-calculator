import { Plus, Trash2 } from 'lucide-react';
import { DiceRoller } from '../../DiceRoller';
import type { CookingRecipe as Recipe } from '../../../types/campaign';
import type { DiceRoll, Food, Kitchen, RemakeIngredient, Worker } from '../types';

export interface RemakeViewProps {
  recipe: Recipe;
  foods: Food[];
  ingredients: RemakeIngredient[];
  workers: Worker[];
  kitchens: Kitchen[];
  worker: string;
  kitchenId: string;
  skill: string;
  roll: DiceRoll;
  difficulty: number;
  onToggleSubstitute: (index: number) => void;
  onAddSubstitute: (ingredientIndex: number) => void;
  onUpdateSubstitute: (ingredientIndex: number, subIndex: number, field: 'foodId' | 'amount', value: string | number) => void;
  onRemoveSubstitute: (ingredientIndex: number, subIndex: number) => void;
  onPenaltyChange: (ingredientIndex: number, penalty: number) => void;
  onWorkerChange: (workerName: string) => void;
  onKitchenChange: (id: string) => void;
  onSkillChange: (value: string) => void;
  onRollChange: (roll: DiceRoll) => void;
  onRollTotalChange: (total: number) => void;
  onExecute: () => void;
}

export function RemakeView({
  recipe, foods, ingredients, workers, kitchens, worker, kitchenId, skill, roll,
  difficulty, onToggleSubstitute, onAddSubstitute, onUpdateSubstitute,
  onRemoveSubstitute, onPenaltyChange, onWorkerChange, onKitchenChange,
  onSkillChange, onRollChange, onRollTotalChange, onExecute,
}: RemakeViewProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Make Recipe: {recipe.name}</h2>
      <div className="bg-gray-700 p-4 rounded mb-4">
        <div className="text-sm space-y-1">
          <div><strong>Original Difficulty:</strong> {recipe.difficulty}</div>
          <div><strong>Current Difficulty:</strong> {difficulty}</div>
          <div><strong>Skill Bonuses:</strong> {recipe.skills.join(', ')}</div>
        </div>
      </div>
      <div className="space-y-4 mb-6">
        {ingredients.map((ing, ingIndex) => {
          const originalFood = foods.find(f => f.id === ing.original.foodId || String(f.id) === ing.original.foodId || f.id === String(ing.original.foodId));
          const hasEnough = originalFood && originalFood.quantity >= ing.original.amount;
          const foodTypes = ing.original.foodTypes || [];
          return (
            <div key={ingIndex} className="bg-gray-700 p-4 rounded">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold">{ing.original.foodName}{foodTypes.length > 0 && <span className="text-blue-400 ml-2">({foodTypes.join('/')})</span>}</div>
                  <div className="text-sm text-gray-400">Need: {ing.original.amount} lbs | Available: {originalFood ? originalFood.quantity : 0} lbs</div>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={ing.useOriginal} onChange={() => onToggleSubstitute(ingIndex)} disabled={!hasEnough} className="w-4 h-4" />
                  <span className="text-sm">Use Original</span>
                </label>
              </div>
              {!ing.useOriginal && (
                <div className="space-y-3 border-t border-gray-600 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-yellow-400">Substitutes:</span>
                    <button onClick={() => onAddSubstitute(ingIndex)} className="bg-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-700"><Plus size={14} className="inline" /> Add Substitute</button>
                  </div>
                  {ing.substitutes.map((sub, subIndex) => (
                    <div key={subIndex} className="bg-gray-600 p-3 rounded space-y-2">
                      <div className="flex gap-2">
                        <select value={sub.foodId || ''} onChange={(e) => onUpdateSubstitute(ingIndex, subIndex, 'foodId', e.target.value)} className="flex-1 bg-gray-700 px-3 py-2 rounded">
                          <option value="">Select substitute...</option>
                          {foods.filter(f => f.quantity > 0).map(f => <option key={f.id} value={f.id}>{f.name} ({f.types.join('/')}) - {f.quantity} lbs</option>)}
                        </select>
                        <input type="number" value={sub.amount} onChange={(e) => onUpdateSubstitute(ingIndex, subIndex, 'amount', parseFloat(e.target.value) || 1)} className="w-24 bg-gray-700 px-3 py-2 rounded" min="0.1" />
                        <button onClick={() => onRemoveSubstitute(ingIndex, subIndex)} className="text-red-400 hover:text-red-300"><Trash2 size={20} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="bg-gray-600 p-3 rounded">
                    <label className="block text-sm mb-2">Substitution Penalty</label>
                    <select value={ing.penalty} onChange={(e) => onPenaltyChange(ingIndex, parseInt(e.target.value))} className="w-full bg-gray-700 px-3 py-2 rounded">
                      <option value="-1">Same Type (-1)</option>
                      <option value="-3">Similar Type (fruit - vegetable) (-3)</option>
                      <option value="-5">Unrelated Type (-5)</option>
                    </select>
                    <div className="text-xs text-gray-400 mt-1">Auto-calculated based on first substitute, adjust if needed</div>
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
            <select value={worker} onChange={(e) => onWorkerChange(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
              <option value="">Select worker...</option>
              {(workers || []).map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">Kitchen</label>
            <select value={kitchenId} onChange={(e) => onKitchenChange(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
              {(kitchens || [{ id: 'default', name: 'Basic Kitchen', rating: 0 }]).map(kitchen => <option key={kitchen.id} value={kitchen.id}>{kitchen.name} (+{kitchen.rating})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">Cooking Skill</label>
            <input type="number" value={skill} onChange={(e) => onSkillChange(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" placeholder="e.g., 14" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs mb-1">Roll (3d6)</label>
            <div className="flex gap-2">
              <input type="number" value={roll.total || ''} onChange={(e) => onRollChange({ dice: [], total: parseInt(e.target.value) || 0 })} className="flex-1 bg-gray-600 px-3 py-2 rounded" placeholder="3-18" min="3" max="18" />
              <DiceRoller dice={roll.dice} total={roll.total} onRoll={(dice, total) => onRollChange({ dice, total })} onTotalChange={onRollTotalChange} />
            </div>
            {skill && (
              <div className="text-xs text-gray-400 mt-1">
                {(() => {
                  const selectedKitchen = kitchens?.find(k => k.id === kitchenId) || { rating: 0 };
                  const kitchenBonus = selectedKitchen.rating || 0;
                  const effectiveSkill = parseInt(skill) + kitchenBonus;
                  const mos = roll.total ? effectiveSkill - roll.total : '?';
                  return kitchenBonus > 0
                    ? `Effective Skill: ${skill} + ${kitchenBonus} (kitchen) = ${effectiveSkill} | MoS: ${mos}`
                    : `MoS: ${mos}`;
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
      <button onClick={onExecute} className="w-full bg-green-600 py-3 rounded font-semibold hover:bg-green-700">Cook Recipe (Difficulty: {difficulty})</button>
    </div>
  );
}
