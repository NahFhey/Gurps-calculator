/**
 * Fishing Activity View
 *
 * Main view for the fishing downtime activity.
 * Displays pending and completed fishing tasks and allows
 * creation, resolution, and cancellation of tasks.
 */

import { useState, useCallback, useMemo } from 'react';
import { Fish, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { FishingTaskForm } from './FishingTaskForm';
import { FishingTaskCard } from './FishingTaskCard';
import {
  selectTasksByActivityType,
  validateTaskCreation,
} from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import type { DowntimeTask, FishingData, TaskResults } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';

// ============================================================================
// TYPES
// ============================================================================

interface FishingActivityProps {
  /** Current day key for task scheduling */
  currentDayKey: number;
  /** Current time slot for task scheduling */
  currentSlot: number;
}

// ============================================================================
// FISHING RESOLUTION
// ============================================================================

/**
 * Calculate fishing results based on task data.
 * Uses a simplified fishing mechanics calculation.
 */
function calculateFishingResults(
  task: DowntimeTask,
  speciesName: string
): TaskResults {
  const data = task.activityData as FishingData;

  // Simple roll simulation - in production this would use proper dice mechanics
  const baseRoll = Math.floor(Math.random() * 6) + 1;
  const modifiedRoll = baseRoll + data.skillModifier;

  // Determine success and yield
  const success = modifiedRoll >= 3;
  const yieldAmount = success ? Math.max(1, data.targetYield + Math.floor((modifiedRoll - 3) / 2)) : 0;

  if (success) {
    return {
      success: true,
      message: `Caught ${yieldAmount} ${speciesName}!`,
      inventoryChanges: [
        {
          itemId: data.speciesId,
          quantity: yieldAmount,
          itemName: speciesName,
        },
      ],
      experienceGained: yieldAmount * 10,
    };
  }

  return {
    success: false,
    message: 'The fish got away. Better luck next time!',
    inventoryChanges: [],
    experienceGained: 5, // Small consolation XP
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FishingActivity({ currentDayKey, currentSlot }: FishingActivityProps) {
  const {
    state,
    characters,
    fishingSpots,
    fishSpecies,
    tools,
    createDowntimeTask,
    beginResolve,
    resolve,
    cancel,
  } = useDowntimeContext();

  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get fishing tasks for current slot
  const fishingTasks = useMemo(() => {
    return selectTasksByActivityType(state, 'fishing').filter(
      (t) => t.dayKey === currentDayKey && t.slot === currentSlot
    );
  }, [state, currentDayKey, currentSlot]);

  // Separate pending and completed tasks
  const pendingTasks = useMemo(
    () => fishingTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [fishingTasks]
  );

  const completedTasks = useMemo(
    () => fishingTasks.filter((t) => t.status === 'resolved' || t.status === 'cancelled'),
    [fishingTasks]
  );

  // Filter tools for fishing (show all tools for now - can add category filtering later)
  const fishingTools = useMemo(() => tools, [tools]);

  // Handle task creation
  const handleCreate = useCallback(
    (data: {
      leaderId: string;
      helperIds: string[];
      activityData: FishingData;
    }) => {
      const payload: CreateTaskPayload = {
        activityType: 'fishing',
        dayKey: currentDayKey,
        slot: currentSlot,
        ...data,
      };

      // Pre-validate before attempting to create
      const validation = validateTaskCreation(state, payload);
      if (!validation.valid) {
        setValidationError(validation.message ?? 'Validation failed');
        return;
      }

      try {
        createDowntimeTask(payload);
        setIsCreating(false);
        setValidationError(null);
      } catch (error) {
        if (error instanceof DowntimeValidationError) {
          setValidationError(error.message);
        } else {
          setValidationError('Failed to create task');
        }
      }
    },
    [state, currentDayKey, currentSlot, createDowntimeTask]
  );

  // Handle task resolution
  const handleResolve = useCallback(
    (task: DowntimeTask) => {
      // Get species name for the result message
      const data = task.activityData as FishingData;
      const species = fishSpecies.find((s) => s.id === data.speciesId);
      const speciesName = species?.name ?? 'fish';

      // Begin resolution (mark as in_progress)
      beginResolve(task.id);

      // Calculate and apply results
      const results = calculateFishingResults(task, speciesName);
      resolve(task.id, results);
    },
    [fishSpecies, beginResolve, resolve]
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

  return (
    <div className="fishing-activity" data-testid="fishing-activity">
      {/* Header */}
      <header className="activity-header flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Fish className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Fishing</h3>
        </div>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
            data-testid="new-fishing-task-button"
          >
            <Plus className="w-4 h-4" />
            New Fishing Task
          </button>
        )}
      </header>

      {/* Validation Error */}
      {validationError && (
        <div
          className="flex items-center gap-2 bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded mb-4"
          role="alert"
          data-testid="validation-error"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="ml-auto text-red-700 hover:text-red-900"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Creation Form */}
      {isCreating && (
        <FishingTaskForm
          characters={characters}
          spots={fishingSpots}
          species={fishSpecies}
          tools={fishingTools}
          state={state}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
          onSubmit={handleCreate}
          onCancel={handleFormCancel}
        />
      )}

      {/* Pending Tasks */}
      <section className="pending-tasks mb-6" data-testid="pending-tasks-section">
        <h4 className="font-medium mb-2 text-gray-700">
          Pending ({pendingTasks.length})
        </h4>
        {pendingTasks.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No pending fishing tasks</p>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map((task) => (
              <FishingTaskCard
                key={task.id}
                task={task}
                species={fishSpecies}
                spots={fishingSpots}
                characters={characters}
                onResolve={() => handleResolve(task)}
                onCancel={() => handleCancel(task.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Completed Tasks */}
      <section className="completed-tasks" data-testid="completed-tasks-section">
        <h4 className="font-medium mb-2 text-gray-700">
          Completed ({completedTasks.length})
        </h4>
        {completedTasks.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No completed fishing tasks</p>
        ) : (
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <FishingTaskCard
                key={task.id}
                task={task}
                species={fishSpecies}
                spots={fishingSpots}
                characters={characters}
                readonly
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
