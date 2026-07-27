import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toNumberOr } from '../../../utils/helpers';
import { INGREDIENT_ROLES, VECTORS } from '../../../constants';
import { calculateFormulaStats } from '../../../utils/alchemy';
import { TBBuilderPanel } from '../../alchemy/TBBuilderPanel';
import type { FormulasViewProps, AlchemyFormula, FormulaIngredient, FormulaTrait } from '../../../types/views';

interface LocalIngredient {
  id: string;
  reagentId: string;
  role: string;
  unitsUsed: number;
  refinement: 'crude' | 'prepared' | 'refined';
}

interface FormulaStats {
  tier: number;
  calculatedTier?: number;
  potencyLoad: number;
  vector: string;
  baseWR: number;
  baseDM: number;
  dominantAspect: string | null;
  secondaryAspect: string | null;
  basePotency: string;
  finalPotency: string;
  concentrationSteps: number;
  totalConcentrationSteps?: number;
  traitBudget: number;
  hasMatchingStabilizer?: boolean;
  roleCoverage: {
    valid: boolean;
    wrDelta: number;
    messages: string[];
  };
  batchValidation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  hazardEvaluation: {
    count: number;
    hazards: string[];
    details: Array<{
      hazard: string;
      source: string;
      effect: string;
      wrMod: number;
      dmMod: number;
    }>;
  };
}

/**
 * FormulasView - Formula designer and management
 *
 * Formulas define recipes for alchemy batches with:
 * - Ingredient list (reagent + role + units + refinement)
 * - Vector selection (Potion, Salve, Ink, Aerosol, Bomb)
 * - Auto-calculated stats (tier, WR, DM, potency, hazards)
 * - Trait budget system for customizing effects
 * - Validation system preventing invalid formulas
 */
export function FormulasView({ alchemyReagents, alchemyFormulas, saveAlchemyFormulas, onDelete }: FormulasViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [formulaName, setFormulaName] = useState('');
  const [ingredients, setIngredients] = useState<LocalIngredient[]>([]);
  const [selectedVector, setSelectedVector] = useState('Potion');
  const [formulaTraits, setFormulaTraits] = useState<FormulaTrait[]>([]);
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null);

  function addIngredient() {
    if (alchemyReagents.length === 0) {
      alert('No reagents available!');
      return;
    }
    setIngredients([...ingredients, {
      id: crypto.randomUUID(),
      reagentId: alchemyReagents[0].id,
      role: 'Active',
      unitsUsed: 1,
      refinement: 'crude'
    }]);
  }

  function removeIngredient(id: string) {
    setIngredients(ingredients.filter(i => i.id !== id));
  }

  function updateIngredient(id: string, field: keyof LocalIngredient, value: string | number) {
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

    const reagentsMap = new Map(alchemyReagents.map(r => [r.id, r]));

    const ingredientsSnapshot: FormulaIngredient[] = ingredients.map(ing => {
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
    const stats = calculateFormulaStats(tempFormula, reagentsMap, selectedVector) as FormulaStats;

    // Check for critical validation failures
    if (!stats.batchValidation.valid) {
      alert('Cannot save formula: ' + stats.batchValidation.errors.join(', '));
      return;
    }

    // Block if missing critical roles (Active, Tool, etc.)
    if (stats.roleCoverage.wrDelta >= 999) {
      const blockingMessages = stats.roleCoverage.messages.filter(msg =>
        msg.includes('Cannot brew')
      );
      alert('Cannot save formula:\n\n' + blockingMessages.join('\n'));
      return;
    }

    const newFormula: AlchemyFormula = {
      id: crypto.randomUUID(),
      name: formulaName,
      ingredients: ingredientsSnapshot,
      tier: stats.tier,
      calculatedTier: stats.calculatedTier,
      potencyLoad: stats.potencyLoad,
      vector: stats.vector,
      baseWR: stats.baseWR,
      baseDM: stats.baseDM,
      dominantAspect: stats.dominantAspect || undefined,
      secondaryAspect: stats.secondaryAspect || undefined,
      basePotency: stats.basePotency,
      finalPotency: stats.finalPotency,
      concentrationSteps: stats.concentrationSteps,
      totalConcentrationSteps: stats.totalConcentrationSteps,
      traitBudget: stats.traitBudget,
      hasMatchingStabilizer: stats.hasMatchingStabilizer,
      traits: [...formulaTraits],
      roleCoverage: stats.roleCoverage,
      hazards: stats.hazardEvaluation.hazards
    };

    saveAlchemyFormulas([...alchemyFormulas, newFormula]);
    setFormulaName('');
    setIngredients([]);
    setSelectedVector('Potion');
    setFormulaTraits([]);
    setShowAdd(false);
    alert('Formula created!');
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">Formula Design</h2>
          <p className="text-sm text-gray-400 mt-1">
            Design and manage alchemy formulas. Players can view and start batches from formulas in the Formulas tab.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded h-fit"
        >
          <Plus size={20} /> {showAdd ? 'Cancel' : 'Design Formula'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-sm mb-1">Formula Name</label>
              <input
                value={formulaName}
                onChange={(e) => setFormulaName(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
                placeholder="e.g., Healing Draught"
              />
            </div>
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-xs text-gray-400 mb-1">Tier (Auto-calculated from potency)</div>
              <div className="text-sm text-gray-300">
                Tier is now automatically determined by the potency load of active ingredients.
                The tier calculation happens when you add ingredients below.
              </div>
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
                      {alchemyReagents.map(r => (
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
            const reagentsMap = new Map(alchemyReagents.map(r => [r.id, r]));
            const actives = ingredients.filter(i => i.role === 'Active' || i.role === 'active');
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
            const stats = calculateFormulaStats(tempFormula, reagentsMap, selectedVector) as FormulaStats;

            return (
              <div className="space-y-3">
                {/* Validation warnings */}
                {!stats.roleCoverage.valid && (
                  <div className="bg-red-900 bg-opacity-30 border border-red-500 p-3 rounded">
                    <div className="text-sm font-semibold text-red-300 mb-1">⚠️ Missing Required Roles</div>
                    <div className="text-xs text-red-200 space-y-1">
                      {stats.roleCoverage.messages.map((msg, idx) => (
                        <div key={idx}>• {msg}</div>
                      ))}
                    </div>
                  </div>
                )}

                {!stats.batchValidation.valid && (
                  <div className="bg-red-900 bg-opacity-30 border border-red-500 p-3 rounded">
                    <div className="text-sm font-semibold text-red-300 mb-1">⚠️ Constraint Violations</div>
                    <div className="text-xs text-red-200 space-y-1">
                      {stats.batchValidation.errors.map((err, idx) => (
                        <div key={idx}>• {err}</div>
                      ))}
                    </div>
                  </div>
                )}

                {stats.batchValidation.warnings.length > 0 && (
                  <div className="bg-yellow-900 bg-opacity-30 border border-yellow-500 p-3 rounded">
                    <div className="text-sm font-semibold text-yellow-300 mb-1">⚠️ Warnings</div>
                    <div className="text-xs text-yellow-200 space-y-1">
                      {stats.batchValidation.warnings.map((warn, idx) => (
                        <div key={idx}>• {warn}</div>
                      ))}
                    </div>
                  </div>
                )}

                {stats.hazardEvaluation.count > 0 && (
                  <div className="bg-orange-900 bg-opacity-30 border border-orange-500 p-3 rounded">
                    <div className="text-sm font-semibold text-orange-300 mb-1">⚠️ Hazards Present ({stats.hazardEvaluation.count})</div>
                    <div className="text-xs text-orange-200 space-y-1">
                      {stats.hazardEvaluation.details.map((h, idx) => (
                        <div key={idx}>
                          <strong>{h.hazard}</strong> ({h.source}): {h.effect}
                          {h.wrMod > 0 && ` [+${h.wrMod} WR]`}
                          {h.dmMod !== 0 && ` [${h.dmMod >= 0 ? '+' : ''}${h.dmMod} DM]`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gray-600 p-3 rounded">
                  <div className="text-sm font-semibold mb-2">Formula Preview</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div>
                        Tier: <span className="text-yellow-400 font-bold">{stats.tier}</span>
                        <span className="text-xs text-gray-400 ml-2">(Potency Load: {stats.potencyLoad})</span>
                      </div>
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

                <TBBuilderPanel
                  traitBudget={stats.traitBudget}
                  initialTraits={formulaTraits}
                  onUpdate={setFormulaTraits}
                />
              </div>
            );
          })()}

          <button onClick={createFormula} className="w-full bg-green-600 px-4 py-2 rounded">
            Save Formula
          </button>
        </div>
      )}

      <div className="space-y-3">
        {alchemyFormulas.map(f => (
          <div key={f.id} className="bg-gray-700 p-4 rounded">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold text-lg">{f.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => onDelete('formula', f.name, { id: f.id })}
                  className="bg-red-600 px-3 py-1 rounded text-sm"
                >
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
                <span className="text-gray-400 ml-2">DM:</span> <span className="text-orange-400">{(f.baseDM ?? 0) >= 0 ? '+' : ''}{f.baseDM}</span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {(f.ingredients || []).map(i => `${i.reagentName} (${i.role}, ${i.unitsUsed}U)`).join(', ')}
              </div>

              {f.traits && f.traits.length > 0 && (
                <div className="text-xs text-purple-400 mt-2">
                  Traits: {f.traits.map(t => `${t.name} (${t.cost}pts)`).join(', ')}
                </div>
              )}
            </div>

            {expandedFormula === f.id && f.traits && (
              <div className="mt-3">
                <TBBuilderPanel
                  traitBudget={f.traitBudget || 10}
                  initialTraits={f.traits || []}
                  onUpdate={(newTraits: FormulaTrait[]) => {
                    const updatedFormulas = alchemyFormulas.map(formula =>
                      formula.id === f.id ? {...formula, traits: newTraits} : formula
                    );
                    saveAlchemyFormulas(updatedFormulas);
                  }}
                />
              </div>
            )}

            {(f.traits && f.traits.length > 0) || expandedFormula === f.id ? (
              <button
                onClick={() => setExpandedFormula(expandedFormula === f.id ? null : f.id)}
                className="mt-2 text-xs text-purple-400 hover:text-purple-300"
              >
                {expandedFormula === f.id ? '▼ Hide Traits' : '▶ Show Traits'}
              </button>
            ) : null}
          </div>
        ))}

        {alchemyFormulas.length === 0 && (
          <div className="text-gray-500 text-center py-8">No formulas yet. Design one to get started!</div>
        )}
      </div>
    </div>
  );
}
