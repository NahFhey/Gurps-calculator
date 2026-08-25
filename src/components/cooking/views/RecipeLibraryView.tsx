import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { CookingRecipe as Recipe } from '../../../types/campaign';
import type { Food } from '../types';

export interface RecipeLibraryViewProps {
  recipes: Recipe[];
  foods: Food[];
  expandedRecipes: Record<string, boolean>;
  onToggleExpanded: (id: string) => void;
  onStartRemake: (recipe: Recipe) => void;
  onDelete: (recipe: Pick<Recipe, 'id' | 'name'>) => void;
}

export function RecipeLibraryView({ recipes, foods, expandedRecipes, onToggleExpanded, onStartRemake, onDelete }: RecipeLibraryViewProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      {recipes.map(r => (
        <div key={r.id} className="bg-gray-700 rounded">
          <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-600" onClick={() => onToggleExpanded(r.id)}>
            <span className="text-gray-400">{expandedRecipes[r.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</span>
            <h3 className="flex-1 font-semibold text-lg">{r.name}</h3>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); onStartRemake(r); }} className="bg-green-600 px-4 py-2 rounded text-sm hover:bg-green-700">Make Recipe</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(r); }} className="bg-red-600 px-4 py-2 rounded text-sm hover:bg-red-700"><Trash2 size={16} /></button>
            </div>
          </div>
          {expandedRecipes[r.id] && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-600 pt-3">
              <div className="text-sm space-y-1">
                <div><strong>Ingredients:</strong></div>
                {r.ingredients.map((ing, idx) => {
                  const food = foods.find(f => f.id === ing.foodId || f.id === String(ing.foodId));
                  const displayName = food?.name || ing.foodName || 'Unknown Food';
                  const displayTypes = food?.types || ing.foodTypes || [];
                  return <div key={idx} className="ml-4">• {ing.amount} lbs {displayName} {displayTypes.length > 0 && <span className="text-blue-400">({displayTypes.join('/')})</span>}</div>;
                })}
                <div><strong>Difficulty:</strong> {r.difficulty}</div>
                <div><strong>Skills Granted:</strong> {r.skills.join(', ')}</div>
                {r.criticalSuccess && <div className="text-yellow-400">Critical Success!</div>}
              </div>
              {r.creationHistory && r.creationHistory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Creation History</h4>
                  {r.creationHistory.map(log => (
                    <div key={log.id} className="bg-gray-600 p-3 rounded text-sm">
                      <div className="flex justify-between">
                        <span className={log.result === 'Critical Success' ? 'text-green-400' : log.result === 'Critical Failure' ? 'text-red-400' : log.result === 'Success' ? 'text-blue-400' : 'text-gray-400'}>{log.result}</span>
                        <span className="text-gray-400">{new Date(log.date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-gray-300 mt-1">
                        <div>Worker: {log.worker} | Kitchen: {log.kitchen}</div>
                        <div>Cooking Skill: {log.cookingSkill} + {log.kitchenBonus} (kitchen) = {log.effectiveSkill} | Roll: {log.roll} | MoS: {log.mos}</div>
                        {log.substitutes && log.substitutes.length > 0 && (
                          <div className="mt-1 text-yellow-300">
                            <strong>Substitutions:</strong>
                            {log.substitutes.map((sub, idx) => <div key={idx} className="ml-2">• {sub.original} → {sub.replacement} ({sub.amount} lbs)</div>)}
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
  );
}
