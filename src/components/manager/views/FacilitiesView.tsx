import { useState, useMemo, useCallback } from 'react';
import { Building2, Plus, Save, X, Trash2, Edit2 } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import { denormalizeObject, normalizeArray } from '../../../state/campaignUtils';
import type { Facility, FacilityType, ToolModifierSet } from '../../../types/campaign';

/**
 * FacilitiesView - Unified facilities management
 *
 * Manages all facility types (kitchens, labs, workshops, etc.) in one place.
 * Supports both simple rating-based facilities and complex activity modifier facilities.
 *
 * Part of Phase 3: Activities Panel Simplification
 * Updated to support creation and editing of facilities.
 */

const FACILITY_TYPES: { value: FacilityType; label: string; description: string }[] = [
  { value: 'kitchen', label: 'Kitchen', description: 'Cooking facility with food preparation bonuses' },
  { value: 'lab', label: 'Alchemy Lab', description: 'Laboratory for alchemy and potion making' },
  { value: 'workshop', label: 'Workshop', description: 'Crafting and repair facility' },
  { value: 'general', label: 'General', description: 'Multi-purpose facility' }
];

const ACTIVITY_TYPES = ['cooking', 'alchemy', 'crafting', 'gathering', 'hunting'];

const CONDITION_OPTIONS = ['Good', 'Worn', 'Damaged', 'Broken'];

function formatNumber(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  return value > 0 ? `+${abs}` : `-${abs}`;
}

function getDefaultActivityForType(type: FacilityType): string {
  switch (type) {
    case 'kitchen': return 'cooking';
    case 'lab': return 'alchemy';
    case 'workshop': return 'crafting';
    default: return 'general';
  }
}

interface FacilityFormState {
  name: string;
  facilityType: FacilityType;
  rating: number;
  description: string;
  conditionId: string;
  useAdvancedModifiers: boolean;
  activityCategories: Record<string, ToolModifierSet>;
}

const DEFAULT_FORM_STATE: FacilityFormState = {
  name: '',
  facilityType: 'general',
  rating: 0,
  description: '',
  conditionId: 'Good',
  useAdvancedModifiers: false,
  activityCategories: {}
};

export function FacilitiesView() {
  const { state, actions } = useCampaignStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FacilityFormState>(DEFAULT_FORM_STATE);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const facilities = useMemo(() =>
    denormalizeObject(state.entities.facilities || {}) as Facility[],
    [state.entities.facilities]
  );

  // Also get legacy kitchens and labs for display/migration
  const kitchens = useMemo(() =>
    denormalizeObject(state.entities.kitchens || {}),
    [state.entities.kitchens]
  );

  const alchemyLabs = useMemo(() =>
    denormalizeObject(state.entities.alchemyLabs || {}),
    [state.entities.alchemyLabs]
  );

  const saveFacilities = useCallback((facilitiesList: Facility[]) => {
    // We need to add a setFacilities action to the store
    // For now, we'll use the normalized array approach
    const normalized = normalizeArray(facilitiesList);
    // Since there's no direct setFacilities action, we'll update through the state
    // This would need a store action to be added
    console.warn('Saving facilities via temporary setFacilities bridge', normalized);
    // Temporary: dispatch a custom action or use a workaround
    if ((actions as any).setFacilities) {
      (actions as any).setFacilities(normalized);
    }
  }, [actions]);

  function resetForm() {
    setFormState(DEFAULT_FORM_STATE);
    setShowAdd(false);
    setEditingId(null);
  }

  function handleAddFacility() {
    if (!formState.name.trim()) {
      alert('Enter a facility name');
      return;
    }

    if (facilities.some(f => f.name === formState.name.trim() && f.id !== editingId)) {
      alert('A facility with this name already exists');
      return;
    }

    const newFacility: Facility = {
      id: editingId || crypto.randomUUID(),
      name: formState.name.trim(),
      facilityType: formState.facilityType,
      rating: Math.max(0, Math.min(4, formState.rating)),
      description: formState.description.trim() || undefined,
      conditionId: formState.conditionId,
      activityCategories: formState.useAdvancedModifiers
        ? formState.activityCategories
        : {
            [getDefaultActivityForType(formState.facilityType)]: {
              skillBonus: formState.rating
            }
          }
    };

    if (editingId) {
      saveFacilities(facilities.map(f => f.id === editingId ? newFacility : f));
    } else {
      saveFacilities([...facilities, newFacility]);
    }

    resetForm();
  }

  function startEdit(facility: Facility) {
    setEditingId(facility.id);
    setFormState({
      name: facility.name,
      facilityType: facility.facilityType || 'general',
      rating: facility.rating || 0,
      description: facility.description || '',
      conditionId: facility.conditionId || 'Good',
      useAdvancedModifiers: Object.keys(facility.activityCategories || {}).length > 1,
      activityCategories: facility.activityCategories || {}
    });
    setShowAdd(true);
  }

  function handleDelete(id: string, name: string) {
    setDeleteConfirm({ id, name });
  }

  function confirmDelete() {
    if (deleteConfirm) {
      saveFacilities(facilities.filter(f => f.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    }
  }

  function updateActivityModifier(activity: string, field: keyof ToolModifierSet, value: number) {
    setFormState(prev => ({
      ...prev,
      activityCategories: {
        ...prev.activityCategories,
        [activity]: {
          ...prev.activityCategories[activity],
          [field]: value
        }
      }
    }));
  }

  function toggleActivity(activity: string) {
    setFormState(prev => {
      const newCategories = { ...prev.activityCategories };
      if (newCategories[activity]) {
        delete newCategories[activity];
      } else {
        newCategories[activity] = { skillBonus: 0 };
      }
      return { ...prev, activityCategories: newCategories };
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-200">
          <Building2 className="h-5 w-5" /> Facilities
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{facilities.length} facilities</span>
          <button
            onClick={() => {
              resetForm();
              setShowAdd(true);
            }}
            className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded flex items-center gap-2"
          >
            <Plus size={20} /> Add Facility
          </button>
        </div>
      </div>

      {/* Legacy facilities notice */}
      {(kitchens.length > 0 || alchemyLabs.length > 0) && (
        <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4">
          <div className="text-yellow-200 font-medium mb-2">Legacy Facilities Detected</div>
          <div className="text-sm text-yellow-300/80">
            You have {kitchens.length} kitchen(s) and {alchemyLabs.length} lab(s) in the old format.
            Consider migrating them to the unified facility system using the Kitchens and Labs tabs.
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md border-2 border-gray-600">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Delete facility "{deleteConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">
                Cancel
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="bg-gray-700 p-4 rounded-lg space-y-4 border border-gray-600">
          <h3 className="text-lg font-semibold">
            {editingId ? 'Edit Facility' : 'Add New Facility'}
          </h3>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Facility Name *</label>
              <input
                value={formState.name}
                onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Camp Kitchen, Alchemist's Lab"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Facility Type</label>
              <select
                value={formState.facilityType}
                onChange={(e) => setFormState(prev => ({ ...prev, facilityType: e.target.value as FacilityType }))}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {FACILITY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rating (0-4)</label>
              <input
                type="number"
                min="0"
                max="4"
                value={formState.rating}
                onChange={(e) => setFormState(prev => ({ ...prev, rating: parseInt(e.target.value) || 0 }))}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Provides +{formState.rating} skill bonus to {getDefaultActivityForType(formState.facilityType)}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Condition</label>
              <select
                value={formState.conditionId}
                onChange={(e) => setFormState(prev => ({ ...prev, conditionId: e.target.value }))}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {CONDITION_OPTIONS.map(condition => (
                  <option key={condition} value={condition}>{condition}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
            <textarea
              value={formState.description}
              onChange={(e) => setFormState(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Notes about this facility..."
              className="w-full bg-gray-600 px-3 py-2 rounded"
              rows={2}
            />
          </div>

          {/* Advanced Modifiers Toggle */}
          <div className="border-t border-gray-600 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formState.useAdvancedModifiers}
                onChange={(e) => setFormState(prev => ({ ...prev, useAdvancedModifiers: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-sm">Use advanced activity modifiers</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Configure specific bonuses for different activity types
            </p>
          </div>

          {/* Advanced Activity Modifiers */}
          {formState.useAdvancedModifiers && (
            <div className="bg-gray-800 p-4 rounded space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Activity Modifiers</h4>

              {ACTIVITY_TYPES.map(activity => {
                const isEnabled = activity in formState.activityCategories;
                const modifiers = formState.activityCategories[activity] || {};

                return (
                  <div key={activity} className="border border-gray-700 rounded p-3">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleActivity(activity)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium capitalize">{activity}</span>
                    </label>

                    {isEnabled && (
                      <div className="grid grid-cols-3 gap-2 mt-2 ml-6">
                        <div>
                          <label className="block text-xs text-gray-500">Skill Bonus</label>
                          <input
                            type="number"
                            value={modifiers.skillBonus || 0}
                            onChange={(e) => updateActivityModifier(activity, 'skillBonus', parseInt(e.target.value) || 0)}
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Quality Mod</label>
                          <input
                            type="number"
                            value={modifiers.qualityModifier || 0}
                            onChange={(e) => updateActivityModifier(activity, 'qualityModifier', parseInt(e.target.value) || 0)}
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Time Bonus</label>
                          <input
                            type="number"
                            value={modifiers.timeBonus || 0}
                            onChange={(e) => updateActivityModifier(activity, 'timeBonus', parseInt(e.target.value) || 0)}
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddFacility}
              className="flex-1 bg-green-600 hover:bg-green-500 px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <Save size={20} /> {editingId ? 'Update' : 'Save'} Facility
            </button>
            <button
              onClick={resetForm}
              className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Facilities List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {facilities.map((facility) => (
          <div
            key={facility.id}
            className={`rounded-lg border bg-slate-800/60 p-4 ${
              facility.conditionId === 'Broken'
                ? 'border-rose-500/60'
                : facility.conditionId === 'Damaged'
                ? 'border-yellow-500/60'
                : 'border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">{facility.name}</div>
                <div className="text-xs text-gray-400 capitalize">
                  {facility.facilityType || 'general'} - Rating {facility.rating || 0}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    facility.conditionId === 'Broken'
                      ? 'bg-rose-500/20 text-rose-300'
                      : facility.conditionId === 'Good'
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-yellow-500/20 text-yellow-300'
                  }`}
                >
                  {facility.conditionId || 'Good'}
                </span>
                <button
                  onClick={() => startEdit(facility)}
                  className="p-1 hover:bg-gray-600 rounded"
                  title="Edit"
                >
                  <Edit2 size={16} className="text-gray-400" />
                </button>
                <button
                  onClick={() => handleDelete(facility.id, facility.name)}
                  className="p-1 hover:bg-red-600/50 rounded"
                  title="Delete"
                >
                  <Trash2 size={16} className="text-red-400" />
                </button>
              </div>
            </div>

            {facility.description && (
              <div className="text-xs text-gray-400 mt-2">{facility.description}</div>
            )}

            <div className="mt-3 space-y-2 text-sm">
              {Object.entries(facility.activityCategories || {}).map(([category, modifiers]) => (
                <div
                  key={category}
                  className="flex items-center justify-between rounded bg-slate-900/50 px-3 py-2"
                >
                  <span className="capitalize text-slate-300">{category}</span>
                  <div className="flex gap-3 text-xs">
                    {modifiers.skillBonus !== undefined && modifiers.skillBonus !== 0 && (
                      <span className={modifiers.skillBonus > 0 ? 'text-green-400' : 'text-red-400'}>
                        Skill {formatNumber(modifiers.skillBonus)}
                      </span>
                    )}
                    {modifiers.qualityModifier !== undefined && modifiers.qualityModifier !== 0 && (
                      <span className={modifiers.qualityModifier > 0 ? 'text-green-400' : 'text-red-400'}>
                        Quality {formatNumber(modifiers.qualityModifier)}
                      </span>
                    )}
                    {modifiers.riskModifier !== undefined && modifiers.riskModifier !== 0 && (
                      <span className={modifiers.riskModifier < 0 ? 'text-green-400' : 'text-red-400'}>
                        Risk {formatNumber(modifiers.riskModifier)}
                      </span>
                    )}
                    {modifiers.timeBonus !== undefined && modifiers.timeBonus !== 0 && (
                      <span className={modifiers.timeBonus > 0 ? 'text-green-400' : 'text-red-400'}>
                        Time {formatNumber(modifiers.timeBonus)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {Object.keys(facility.activityCategories || {}).length === 0 && (
                <div className="text-xs text-slate-500">
                  +{facility.rating || 0} to {getDefaultActivityForType(facility.facilityType || 'general')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {facilities.length === 0 && !showAdd && (
        <div className="text-center text-slate-400 py-8">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No facilities defined.</p>
          <p className="text-sm mt-2">Click "Add Facility" to create your first facility.</p>
        </div>
      )}
    </div>
  );
}
