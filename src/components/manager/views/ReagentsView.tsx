import { useState } from 'react';
import { Plus, Save, X, Trash2 } from 'lucide-react';
import { toNumberOr } from '../../../utils/helpers';
import { ASPECTS, POTENCY_LEVELS, INGREDIENT_ROLES, HAZARD_TAGS } from '../../../constants';
import type { ReagentsViewProps, AlchemyReagent } from '../../../types/views';

interface NewReagentFormState {
  newPrimary: string;
  newSecondary: string;
  newTertiary: string;
  newPotency: string;
  newRefinement: string;
  newRoles: string[];
  newHazards: string[];
  newQuantity: string;
}

const defaultFormState: NewReagentFormState = {
  newPrimary: 'Water',
  newSecondary: 'Air',
  newTertiary: 'Fire',
  newPotency: 'P1',
  newRefinement: 'crude',
  newRoles: [],
  newHazards: [],
  newQuantity: '10'
};

/**
 * ReagentsView - Manages alchemy reagent inventory with full properties
 *
 * Reagents are the raw materials for alchemy with complex properties:
 * - Aspects: Primary (3pts), Secondary (2pts), Tertiary (1pt)
 * - Potency: P0-P4 levels
 * - Refinement: crude, prepared, refined
 * - Roles: 8 types (Active, Catalyst, Stabilizer, etc.)
 * - Hazards: 7 types (Flammable, Volatile, etc.)
 * - Identification: 0-4 levels (affects player visibility)
 * - False Profiles: For critical failures on identification
 */
export function ReagentsView({ alchemyReagents, saveAlchemyReagents, onDelete }: ReagentsViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [formState, setFormState] = useState<NewReagentFormState>(defaultFormState);

  function handleSaveReagent() {
    if (!newType.trim()) {
      alert('Enter reagent name');
      return;
    }

    const newReagent: AlchemyReagent = {
      id: crypto.randomUUID(),
      name: newType.trim(),
      aspects: {
        primary: formState.newPrimary,
        secondary: formState.newSecondary,
        tertiary: formState.newTertiary
      },
      refinement: formState.newRefinement as 'crude' | 'prepared' | 'refined',
      basePotency: formState.newPotency,
      concentrationSteps: 0,
      roles: formState.newRoles.length > 0 ? formState.newRoles : ['Active'],
      primaryRole: (formState.newRoles.length > 0 ? formState.newRoles : ['Active'])[0],
      hazards: formState.newHazards,
      processingNotes: '',
      quantity: toNumberOr(formState.newQuantity, 10),
      identificationLevel: 4, // New reagents start fully identified for GM
      analysisHistory: [],
      falseProfile: null
    };

    saveAlchemyReagents([...(alchemyReagents || []), newReagent]);
    setNewType('');
    setFormState(defaultFormState);
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Reagent Management</h2>
          <p className="text-sm text-gray-400 mt-1">
            Full reagent properties including identification data. Players see limited info based on identification level.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-green-600 px-4 py-2 rounded h-fit"
        >
          <Plus size={20} className="inline" /> Add Reagent
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
          <div>
            <label className="block text-sm mb-1">Reagent Name</label>
            <input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full bg-gray-600 px-3 py-2 rounded"
              placeholder="e.g., Lunar Moss"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Primary Aspect (3pts)</label>
              <select
                value={formState.newPrimary}
                onChange={(e) => setFormState({...formState, newPrimary: e.target.value})}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Secondary Aspect (2pts)</label>
              <select
                value={formState.newSecondary}
                onChange={(e) => setFormState({...formState, newSecondary: e.target.value})}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Tertiary Aspect (1pt)</label>
              <select
                value={formState.newTertiary}
                onChange={(e) => setFormState({...formState, newTertiary: e.target.value})}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Base Potency</label>
              <select
                value={formState.newPotency}
                onChange={(e) => setFormState({...formState, newPotency: e.target.value})}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {POTENCY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Refinement</label>
              <select
                value={formState.newRefinement}
                onChange={(e) => setFormState({...formState, newRefinement: e.target.value})}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                <option value="crude">Crude</option>
                <option value="prepared">Prepared</option>
                <option value="refined">Refined</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Quantity (Units)</label>
              <input
                type="number"
                value={formState.newQuantity}
                onChange={(e) => setFormState({...formState, newQuantity: e.target.value})}
                className="w-full bg-gray-600 px-3 py-2 rounded"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2">Roles</label>
            <div className="grid grid-cols-4 gap-2">
              {INGREDIENT_ROLES.map(role => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formState.newRoles.includes(role)}
                    onChange={(e) => {
                      setFormState({
                        ...formState,
                        newRoles: e.target.checked
                          ? [...formState.newRoles, role]
                          : formState.newRoles.filter(r => r !== role)
                      });
                    }}
                    className="w-4 h-4"
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2">Hazards</label>
            <div className="grid grid-cols-3 gap-2">
              {HAZARD_TAGS.map(hazard => (
                <label key={hazard} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formState.newHazards.includes(hazard)}
                    onChange={(e) => {
                      setFormState({
                        ...formState,
                        newHazards: e.target.checked
                          ? [...formState.newHazards, hazard]
                          : formState.newHazards.filter(h => h !== hazard)
                      });
                    }}
                    className="w-4 h-4"
                  />
                  <span>{hazard}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveReagent}
              className="flex-1 bg-green-600 px-4 py-2 rounded"
            >
              <Save size={20} className="inline" /> Save Reagent
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewType('');
                setFormState(defaultFormState);
              }}
              className="bg-red-600 px-4 py-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(alchemyReagents || []).map(r => (
          <div key={r.id} className="bg-gray-700 rounded">
            <div
              className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
              onClick={() => setExpanded(p => ({...p, [r.id]: !p[r.id]}))}
            >
              <span className="flex-1 font-medium">{r.name}</span>
              <span className="text-sm text-blue-400">
                {r.aspects?.primary}/{r.aspects?.secondary}/{r.aspects?.tertiary}
              </span>
              <span className="text-sm text-gray-400">{r.quantity}U</span>
              <span className="text-sm text-purple-400">{r.basePotency || 'P1'}</span>
              {(r.identificationLevel ?? 4) < 4 && (
                <span className="text-xs px-2 py-1 bg-yellow-600 rounded">
                  ID: {r.identificationLevel}/4
                </span>
              )}
              {r.falseProfile && (
                <span className="text-xs text-red-400">⚠️ False</span>
              )}
              <span className="text-gray-400">{expanded[r.id] ? '▼' : '▶'}</span>
            </div>

            {expanded[r.id] && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-600 pt-3">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input
                      value={r.name}
                      onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, name: e.target.value} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Quantity (Units)</label>
                    <input
                      type="number"
                      value={r.quantity}
                      onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, quantity: toNumberOr(e.target.value, 0)} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    />
                  </div>
                </div>

                {/* Aspects */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Primary (3pts)</label>
                    <select
                      value={r.aspects?.primary || 'Water'}
                      onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, aspects: {...x.aspects, primary: e.target.value}} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    >
                      {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Secondary (2pts)</label>
                    <select
                      value={r.aspects?.secondary || 'Air'}
                      onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, aspects: {...x.aspects, secondary: e.target.value}} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    >
                      {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Tertiary (1pt)</label>
                    <select
                      value={r.aspects?.tertiary || 'Fire'}
                      onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, aspects: {...x.aspects, tertiary: e.target.value}} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    >
                      {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                {/* Potency & Refinement */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Base Potency</label>
                    <select
                      value={r.basePotency || 'P1'}
                      onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, basePotency: e.target.value} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    >
                      {POTENCY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Refinement</label>
                    <select
                      value={r.refinement || 'crude'}
                      onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, refinement: e.target.value as 'crude' | 'prepared' | 'refined'} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    >
                      <option value="crude">Crude</option>
                      <option value="prepared">Prepared</option>
                      <option value="refined">Refined</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Concentration Steps</label>
                    <input
                      type="number"
                      value={r.concentrationSteps || 0}
                      onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, concentrationSteps: toNumberOr(e.target.value, 0)} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                      min="0"
                    />
                  </div>
                </div>

                {/* Roles */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Roles</label>
                  <div className="grid grid-cols-4 gap-2">
                    {INGREDIENT_ROLES.map(role => (
                      <label key={role} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={(r.roles || []).includes(role)}
                          onChange={(e) => {
                            const roles = r.roles || [];
                            const newRoles = e.target.checked
                              ? [...roles, role]
                              : roles.filter(rl => rl !== role);
                            saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, roles: newRoles, primaryRole: newRoles[0] || 'Active'} : x));
                          }}
                          className="w-4 h-4"
                        />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Hazards */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Hazards</label>
                  <div className="grid grid-cols-3 gap-2">
                    {HAZARD_TAGS.map(hazard => (
                      <label key={hazard} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={(r.hazards || []).includes(hazard)}
                          onChange={(e) => {
                            const hazards = r.hazards || [];
                            const newHazards = e.target.checked
                              ? [...hazards, hazard]
                              : hazards.filter(h => h !== hazard);
                            saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, hazards: newHazards} : x));
                          }}
                          className="w-4 h-4"
                        />
                        <span>{hazard}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Processing Notes */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Processing Notes</label>
                  <textarea
                    value={r.processingNotes || ''}
                    onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, processingNotes: e.target.value} : x))}
                    className="w-full bg-gray-600 px-3 py-2 rounded text-sm"
                    rows={2}
                    placeholder="e.g., must be ground, requires heating"
                  />
                </div>

                {/* Identification Level */}
                <div className="bg-gray-800 p-3 rounded">
                  <label className="block text-xs text-gray-400 mb-2">
                    Identification Level (affects player view)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="4"
                      value={r.identificationLevel || 0}
                      onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, identificationLevel: parseInt(e.target.value)} : x))}
                      className="flex-1"
                    />
                    <span className="text-sm font-semibold">{r.identificationLevel || 0}/4</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {r.identificationLevel === 0 && 'Unidentified'}
                    {r.identificationLevel === 1 && 'Partial (Primary Aspect)'}
                    {r.identificationLevel === 2 && 'Basic (Primary + Secondary)'}
                    {r.identificationLevel === 3 && 'Complete (All Aspects)'}
                    {r.identificationLevel === 4 && 'Full Profile'}
                  </div>
                </div>

                {/* False Profile Warning/Editor */}
                {r.falseProfile && (
                  <div className="bg-red-900 bg-opacity-30 border border-red-500 p-3 rounded">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-semibold text-red-400">
                        ⚠️ False Profile (from critical failure)
                      </label>
                      <button
                        onClick={() => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, falseProfile: null} : x))}
                        className="text-xs px-2 py-1 bg-red-600 rounded"
                      >
                        Clear False Profile
                      </button>
                    </div>
                    <div className="text-xs text-gray-300">
                      Players see: {r.falseProfile.aspects?.primary}/{r.falseProfile.aspects?.secondary}/{r.falseProfile.aspects?.tertiary} | {r.falseProfile.basePotency}
                    </div>
                  </div>
                )}

                {/* Delete Button */}
                <button
                  onClick={() => onDelete('reagent', r.name, { id: r.id })}
                  className="w-full bg-red-600 py-2 rounded text-sm"
                >
                  <Trash2 size={16} className="inline" /> Delete Reagent
                </button>
              </div>
            )}
          </div>
        ))}

        {(!alchemyReagents || alchemyReagents.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            No reagents. Add your first reagent above.
          </div>
        )}
      </div>
    </div>
  );
}
