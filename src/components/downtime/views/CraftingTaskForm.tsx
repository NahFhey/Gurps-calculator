/**
 * Crafting Task Form
 *
 * Form component for creating new crafting tasks.
 * Handles worker selection, recipe selection, material selection,
 * quality target selection, and skill modifier display.
 *
 * SLOT-BOUNDED: Each crafting task completes within a single slot.
 * No multi-slot project persistence.
 */

import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import {
  selectAvailableCharacterIdsForSlot,
} from '../../../state/downtime';
import type { DowntimeState, CraftingData } from '../../../types/downtime';
import type {
  Character,
  Recipe,
  Material,
  Facility,
  GatheringTool,
} from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

/** Quality target options for crafting */
type QualityTarget = 'basic' | 'standard' | 'fine' | 'masterwork';

interface CraftingTaskFormProps {
  /** Available characters to assign */
  characters: Character[];
  /** Available recipes */
  recipes: Recipe[];
  /** Available materials */
  materials: Material[];
  /** Available workshops */
  workshops: Facility[];
  /** Available tools */
  tools: GatheringTool[];
  /** Current downtime state for validation */
  state: DowntimeState;
  /** Current day key */
  currentDayKey: number;
  /** Current time slot */
  currentSlot: number;
  /** Called when form is submitted with valid data */
  onSubmit: (data: {
    leaderId: string;
    helperIds: string[];
    activityData: CraftingData;
  }) => void;
  /** Called when form is cancelled */
  onCancel: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const QUALITY_OPTIONS: { value: QualityTarget; label: string; modifier: number }[] = [
  { value: 'basic', label: 'Basic', modifier: 2 },
  { value: 'standard', label: 'Standard', modifier: 0 },
  { value: 'fine', label: 'Fine', modifier: -2 },
  { value: 'masterwork', label: 'Masterwork', modifier: -4 },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function CraftingTaskForm({
  characters,
  recipes,
  materials: _materials,
  workshops,
  tools: _tools,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onCancel,
}: CraftingTaskFormProps) {
  // Form state
  const [leaderId, setLeaderId] = useState('');
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedWorkshopId, setSelectedWorkshopId] = useState(workshops[0]?.id ?? '');
  const [qualityTarget, setQualityTarget] = useState<QualityTarget>('standard');

  // Get available (unassigned) character IDs
  const allCharacterIds = useMemo(
    () => characters.map((c) => c.id),
    [characters]
  );

  const availableCharacterIds = useMemo(
    () =>
      selectAvailableCharacterIdsForSlot(
        state,
        currentDayKey,
        currentSlot,
        allCharacterIds
      ),
    [state, currentDayKey, currentSlot, allCharacterIds]
  );

  // Filter available characters for selection
  const availableCharacters = useMemo(
    () => characters.filter((c) => availableCharacterIds.includes(c.id)),
    [characters, availableCharacterIds]
  );

  // Filter available characters for helpers (excluding selected leader)
  const availableHelpers = useMemo(
    () => availableCharacters.filter((c) => c.id !== leaderId),
    [availableCharacters, leaderId]
  );

  // Get selected recipe details
  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId),
    [recipes, selectedRecipeId]
  );

  // Get selected workshop details
  const selectedWorkshop = useMemo(
    () => workshops.find((w) => w.id === selectedWorkshopId),
    [workshops, selectedWorkshopId]
  );

  // Calculate skill modifier based on workshop and helpers
  const skillModifier = useMemo(() => {
    let modifier = 0;

    // Add workshop bonus
    if (selectedWorkshop) {
      modifier += selectedWorkshop.rating ?? 0;
    }

    // Add helper bonus (+1 per helper, max +2)
    modifier += Math.min(helperIds.length, 2);

    return modifier;
  }, [selectedWorkshop, helperIds]);

  // Get quality modifier for display
  const qualityModifier = useMemo(() => {
    const opt = QUALITY_OPTIONS.find((o) => o.value === qualityTarget);
    return opt?.modifier ?? 0;
  }, [qualityTarget]);

  // Handle helper toggle
  const toggleHelper = (helperId: string) => {
    setHelperIds((prev) =>
      prev.includes(helperId)
        ? prev.filter((id) => id !== helperId)
        : [...prev, helperId]
    );
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!leaderId || !selectedRecipeId) {
      return; // Required fields not filled
    }

    const activityData: CraftingData = {
      type: 'crafting',
      recipeId: selectedRecipeId,
      materialInstanceIds: [], // Materials would be selected from inventory
      toolInstanceIds: selectedWorkshopId ? [selectedWorkshopId] : [],
      qualityTarget,
      skillModifier,
    };

    onSubmit({
      leaderId,
      helperIds,
      activityData,
    });
  };

  // Check if form is valid
  const isFormValid = leaderId && selectedRecipeId;

  return (
    <form
      onSubmit={handleSubmit}
      className="crafting-task-form bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4"
      data-testid="crafting-task-form"
    >
      {/* Form Header */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-gray-900">New Crafting Task</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close form"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Worker Selection */}
      <div className="form-group mb-4">
        <label htmlFor="leader-select" className="block text-sm font-medium text-gray-700 mb-1">
          Crafter <span className="text-red-500">*</span>
        </label>
        <select
          id="leader-select"
          value={leaderId}
          onChange={(e) => setLeaderId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
          required
          data-testid="leader-select"
        >
          <option value="">Select crafter...</option>
          {availableCharacters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {availableCharacters.length === 0 && (
          <p className="text-sm text-yellow-600 mt-1">
            All characters are already assigned to tasks in this slot
          </p>
        )}
      </div>

      {/* Helper Selection */}
      <div className="form-group mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Assistants (optional, max +2 bonus)
        </label>
        {availableHelpers.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No available helpers</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableHelpers.map((c) => (
              <label
                key={c.id}
                className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-colors ${
                  helperIds.includes(c.id)
                    ? 'bg-orange-100 border-orange-300'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={helperIds.includes(c.id)}
                  onChange={() => toggleHelper(c.id)}
                  className="sr-only"
                />
                <span className="text-sm">{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Recipe Selection */}
      <div className="form-group mb-4">
        <label htmlFor="recipe-select" className="block text-sm font-medium text-gray-700 mb-1">
          Recipe <span className="text-red-500">*</span>
        </label>
        <select
          id="recipe-select"
          value={selectedRecipeId}
          onChange={(e) => setSelectedRecipeId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
          required
          data-testid="recipe-select"
        >
          <option value="">Select recipe...</option>
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name} (Difficulty: {recipe.difficulty >= 0 ? '+' : ''}{recipe.difficulty})
            </option>
          ))}
        </select>
        {recipes.length === 0 && (
          <p className="text-sm text-yellow-600 mt-1">
            No recipes available. Add recipes to begin crafting.
          </p>
        )}
      </div>

      {/* Quality Target Selection */}
      <div className="form-group mb-4">
        <label htmlFor="quality-select" className="block text-sm font-medium text-gray-700 mb-1">
          Quality Target
        </label>
        <select
          id="quality-select"
          value={qualityTarget}
          onChange={(e) => setQualityTarget(e.target.value as QualityTarget)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
          data-testid="quality-select"
        >
          {QUALITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} ({opt.modifier >= 0 ? '+' : ''}{opt.modifier} to skill)
            </option>
          ))}
        </select>
      </div>

      {/* Workshop Selection */}
      <div className="form-group mb-4">
        <label htmlFor="workshop-select" className="block text-sm font-medium text-gray-700 mb-1">
          Workshop
        </label>
        <select
          id="workshop-select"
          value={selectedWorkshopId}
          onChange={(e) => setSelectedWorkshopId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
          data-testid="workshop-select"
        >
          <option value="">No workshop (0 bonus)</option>
          {workshops.map((workshop) => (
            <option key={workshop.id} value={workshop.id}>
              {workshop.name} (+{workshop.rating ?? 0})
            </option>
          ))}
        </select>
      </div>

      {/* Recipe Details (when selected) */}
      {selectedRecipe && (
        <div className="bg-orange-100 rounded p-3 mb-4" data-testid="recipe-details">
          <h5 className="text-sm font-medium text-orange-800 mb-2">Recipe Details</h5>
          <div className="text-sm text-orange-700 space-y-1">
            <p>
              <span className="font-medium">Name:</span> {selectedRecipe.name}
            </p>
            <p>
              <span className="font-medium">Skill:</span> {selectedRecipe.skill}
            </p>
            <p>
              <span className="font-medium">Difficulty:</span>{' '}
              {selectedRecipe.difficulty >= 0 ? '+' : ''}{selectedRecipe.difficulty}
            </p>
            {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
              <p>
                <span className="font-medium">Materials:</span>{' '}
                {selectedRecipe.ingredients.length} required
              </p>
            )}
            {selectedRecipe.effects && (
              <p>
                <span className="font-medium">Effects:</span> {selectedRecipe.effects}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Skill Modifier Summary */}
      <div className="bg-gray-100 rounded p-2 mb-4">
        <p className="text-sm text-gray-600">
          Total Skill Modifier:{' '}
          <span className={`font-medium ${skillModifier + qualityModifier >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {skillModifier + qualityModifier >= 0 ? '+' : ''}{skillModifier + qualityModifier}
          </span>
          <span className="text-xs text-gray-500 ml-2">
            (Workshop: +{selectedWorkshop?.rating ?? 0}, Helpers: +{Math.min(helperIds.length, 2)}, Quality: {qualityModifier >= 0 ? '+' : ''}{qualityModifier})
          </span>
        </p>
      </div>

      {/* Slot-Bounded Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-4">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> Crafting completes in a single slot. Success/failure is determined immediately. Materials are consumed regardless of outcome.
        </p>
      </div>

      {/* Form Actions */}
      <div className="form-actions flex gap-2">
        <button
          type="submit"
          disabled={!isFormValid}
          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          data-testid="submit-button"
        >
          Start Crafting
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          data-testid="cancel-button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
