/**
 * Crafting Activity View
 *
 * Main view for the crafting downtime activity.
 * Displays crafting tasks allowing creation, resolution, and cancellation.
 *
 * SLOT-BOUNDED: All crafting tasks complete within a single slot.
 * - Each task is independent (no multi-slot projects)
 * - Single roll determines success/failure
 * - Materials consumed on resolution (success or failure)
 * - Item produced only on success
 */

import { useState, useCallback, useMemo } from 'react';
import { Hammer, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { CraftingTaskForm } from './CraftingTaskForm';
import { CraftingTaskCard } from './CraftingTaskCard';
import {
  selectTasksByActivityType,
  validateTaskCreation,
} from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import type { DowntimeTask, CraftingData, TaskResults } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { Recipe } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface CraftingActivityProps {
  /** Current day key for task scheduling */
  currentDayKey: number;
  /** Current time slot for task scheduling */
  currentSlot: number;
}

// ============================================================================
// CRAFTING RESOLUTION
// ============================================================================

/**
 * Calculate crafting results based on task data.
 * Single-roll resolution - success or failure determined immediately.
 * Materials always consumed; item only produced on success.
 */
function calculateCraftingResults(
  task: DowntimeTask,
  recipe: Recipe | undefined
): TaskResults {
  const data = task.activityData as CraftingData;

  if (!recipe) {
    return {
      success: false,
      message: 'Recipe not found - crafting attempt failed.',
      inventoryChanges: [],
      experienceGained: 0,
    };
  }

  // Simulate skill roll (3d6)
  const skillRoll = Math.floor(Math.random() * 16) + 3; // 3-18 range
  const baseSkill = 12; // Default skill level
  const effectiveSkill = baseSkill + data.skillModifier;

  // Quality modifiers affect difficulty
  const qualityPenalties: Record<string, number> = {
    basic: 2,      // +2 to skill (easier)
    standard: 0,   // No modifier
    fine: -2,      // -2 to skill (harder)
    masterwork: -4 // -4 to skill (very hard)
  };
  const qualityPenalty = qualityPenalties[data.qualityTarget] ?? 0;
  const finalSkill = effectiveSkill + qualityPenalty;

  const margin = finalSkill - skillRoll;

  // Build inventory changes - always consume materials
  const inventoryChanges = recipe.ingredients.map((ing) => ({
    itemId: ing.id,
    quantity: -ing.amount,
    itemName: `Material (${ing.id})`,
  }));

  if (margin >= 0) {
    // Success - add produced item
    const qualityLabel = data.qualityTarget.charAt(0).toUpperCase() + data.qualityTarget.slice(1);
    inventoryChanges.push({
      itemId: recipe.id,
      quantity: 1,
      itemName: `${qualityLabel} ${recipe.name}`,
    });

    // XP based on quality
    const xpByQuality: Record<string, number> = {
      basic: 10,
      standard: 20,
      fine: 35,
      masterwork: 50,
    };

    return {
      success: true,
      message: `Successfully crafted ${qualityLabel} ${recipe.name}! (Rolled ${skillRoll} vs ${finalSkill})`,
      inventoryChanges,
      experienceGained: xpByQuality[data.qualityTarget] ?? 20,
    };
  }

  // Failure - materials consumed but no item produced
  return {
    success: false,
    message: `Crafting failed! Materials consumed. (Rolled ${skillRoll} vs ${finalSkill})`,
    inventoryChanges,
    experienceGained: 5, // Small XP for attempting
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CraftingActivity({ currentDayKey, currentSlot }: CraftingActivityProps) {
  const {
    state,
    characters,
    craftingRecipes,
    craftingMaterials,
    craftingWorkshops,
    tools,
    createDowntimeTask,
    beginResolve,
    resolve,
    cancel,
  } = useDowntimeContext();

  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get crafting tasks
  const craftingTasks = useMemo(
    () => selectTasksByActivityType(state, 'crafting'),
    [state]
  );

  // Filter to pending and completed tasks
  const pendingTasks = useMemo(
    () => craftingTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [craftingTasks]
  );

  const completedTasks = useMemo(
    () => craftingTasks.filter((t) => t.status === 'resolved' || t.status === 'cancelled'),
    [craftingTasks]
  );

  // Handle form submission
  const handleFormSubmit = useCallback(
    (data: { leaderId: string; helperIds: string[]; activityData: CraftingData }) => {
      const payload: CreateTaskPayload = {
        activityType: 'crafting',
        dayKey: currentDayKey,
        slot: currentSlot,
        leaderId: data.leaderId,
        helperIds: data.helperIds,
        activityData: data.activityData,
      };

      // Validate before creating
      try {
        validateTaskCreation(state, payload);
        createDowntimeTask(payload);
        setIsCreating(false);
        setValidationError(null);
      } catch (error) {
        if (error instanceof DowntimeValidationError) {
          setValidationError(error.message);
        } else {
          setValidationError('An unexpected error occurred');
        }
      }
    },
    [state, currentDayKey, currentSlot, createDowntimeTask]
  );

  // Handle task resolution
  const handleResolve = useCallback(
    (task: DowntimeTask) => {
      const data = task.activityData as CraftingData;

      // Find the recipe
      const recipe = craftingRecipes.find((r) => r.id === data.recipeId);

      beginResolve(task.id);
      const results = calculateCraftingResults(task, recipe);
      resolve(task.id, results);
    },
    [craftingRecipes, beginResolve, resolve]
  );

  // Handle task cancellation
  const handleCancel = useCallback(
    (taskId: string) => {
      cancel(taskId);
    },
    [cancel]
  );

  // Handle form cancel
  const handleFormCancel = useCallback(() => {
    setIsCreating(false);
    setValidationError(null);
  }, []);

  // Dismiss validation error
  const dismissError = useCallback(() => {
    setValidationError(null);
  }, []);

  // Check if crafting is available (need recipes)
  const canCraft = craftingRecipes.length > 0;

  return (
    <div className="crafting-activity" data-testid="crafting-activity">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Hammer className="w-6 h-6 text-orange-600" />
        <h3 className="text-lg font-semibold">Crafting</h3>
      </div>

      {/* Available Recipes Summary */}
      {craftingRecipes.length > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg" data-testid="recipes-summary">
          <h4 className="text-sm font-medium text-orange-800 mb-2">
            Available Recipes ({craftingRecipes.length})
          </h4>
          <div className="space-y-1">
            {craftingRecipes.slice(0, 3).map((recipe) => (
              <div key={recipe.id} className="text-sm text-orange-700">
                {recipe.name} - Difficulty {recipe.difficulty >= 0 ? '+' : ''}{recipe.difficulty}
              </div>
            ))}
            {craftingRecipes.length > 3 && (
              <div className="text-xs text-orange-500">
                +{craftingRecipes.length - 3} more recipes...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Error */}
      {validationError && (
        <div
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
          data-testid="validation-error"
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{validationError}</p>
          </div>
          <button
            type="button"
            onClick={dismissError}
            className="text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
            data-testid="dismiss-error-button"
          >
            ×
          </button>
        </div>
      )}

      {/* New Task Button or Form */}
      {!isCreating ? (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="mb-4 flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          data-testid="new-crafting-task-button"
          disabled={!canCraft}
          title={!canCraft ? 'No recipes available' : undefined}
        >
          <Plus className="w-4 h-4" />
          New Crafting Task
        </button>
      ) : (
        <CraftingTaskForm
          characters={characters}
          recipes={craftingRecipes}
          materials={craftingMaterials}
          workshops={craftingWorkshops}
          tools={tools}
          state={state}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}

      {/* No Recipes Message */}
      {!canCraft && !isCreating && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-sm text-gray-600">
            No crafting recipes available. Add recipes to begin crafting.
          </p>
        </div>
      )}

      {/* Pending Tasks */}
      <div className="mb-6" data-testid="pending-tasks-section">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Pending ({pendingTasks.length})
        </h4>
        {pendingTasks.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No pending crafting tasks</p>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <CraftingTaskCard
                key={task.id}
                task={task}
                recipes={craftingRecipes}
                materials={craftingMaterials}
                characters={characters}
                onResolve={() => handleResolve(task)}
                onCancel={() => handleCancel(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Tasks */}
      <div data-testid="completed-tasks-section">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Completed ({completedTasks.length})
        </h4>
        {completedTasks.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No completed crafting tasks</p>
        ) : (
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <CraftingTaskCard
                key={task.id}
                task={task}
                recipes={craftingRecipes}
                materials={craftingMaterials}
                characters={characters}
                readonly
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
