/**
 * Foraging Activity View
 *
 * Main view for the foraging downtime activity.
 * Displays pending and completed foraging tasks and allows
 * creation, resolution, and cancellation of tasks.
 */

import { useState, useCallback, useMemo } from 'react';
import { Leaf, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { ForagingTaskForm } from './ForagingTaskForm';
import { ForagingTaskCard } from './ForagingTaskCard';
import {
  selectTasksByActivityType,
  validateTaskCreation,
} from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import type { DowntimeTask, ForagingData, TaskResults } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';

// ============================================================================
// TYPES
// ============================================================================

interface ForagingActivityProps {
  /** Current day key for task scheduling */
  currentDayKey: number;
  /** Current time slot for task scheduling */
  currentSlot: number;
}

// ============================================================================
// FORAGING RESOLUTION
// ============================================================================

/**
 * Calculate foraging results based on task data.
 * Uses a simplified foraging mechanics calculation.
 */
function calculateForagingResults(
  task: DowntimeTask,
  nodeName: string,
  biomeName: string
): TaskResults {
  const data = task.activityData as ForagingData;

  // Simple roll simulation - in production this would use proper dice mechanics
  const baseRoll = Math.floor(Math.random() * 6) + 1;
  const modifiedRoll = baseRoll + data.skillModifier;

  // Determine success and yield
  const success = modifiedRoll >= 3;
  const yieldAmount = success ? Math.max(1, Math.floor((modifiedRoll - 2) / 2) + 1) : 0;

  if (success) {
    return {
      success: true,
      message: `Found ${yieldAmount} ${nodeName} in ${biomeName}!`,
      inventoryChanges: [
        {
          itemId: data.nodeId,
          quantity: yieldAmount,
          itemName: nodeName,
        },
      ],
      experienceGained: yieldAmount * 8,
    };
  }

  return {
    success: false,
    message: `Found nothing useful in ${biomeName}. The search continues...`,
    inventoryChanges: [],
    experienceGained: 3, // Small consolation XP
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ForagingActivity({ currentDayKey, currentSlot }: ForagingActivityProps) {
  const {
    state,
    characters,
    foragingBiomes,
    foragingNodes,
    gatheringTables,
    tools,
    createDowntimeTask,
    beginResolve,
    resolve,
    cancel,
  } = useDowntimeContext();

  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get foraging tasks for current slot
  const foragingTasks = useMemo(() => {
    return selectTasksByActivityType(state, 'foraging').filter(
      (t) => t.dayKey === currentDayKey && t.slot === currentSlot
    );
  }, [state, currentDayKey, currentSlot]);

  // Separate pending and completed tasks
  const pendingTasks = useMemo(
    () => foragingTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [foragingTasks]
  );

  const completedTasks = useMemo(
    () => foragingTasks.filter((t) => t.status === 'resolved' || t.status === 'cancelled'),
    [foragingTasks]
  );

  // Filter tools for foraging (show all tools for now)
  const foragingTools = useMemo(() => tools, [tools]);

  // Handle task creation
  const handleCreate = useCallback(
    (data: {
      leaderId: string;
      helperIds: string[];
      activityData: ForagingData;
    }) => {
      const payload: CreateTaskPayload = {
        activityType: 'foraging',
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
      // Get node and biome names for the result message
      const data = task.activityData as ForagingData;
      const node = foragingNodes.find((n) => n.id === data.nodeId);
      const biome = foragingBiomes.find((b) => b.id === data.biomeId);
      const nodeName = node?.name ?? 'materials';
      const biomeName = biome?.name ?? 'the area';

      // Begin resolution (mark as in_progress)
      beginResolve(task.id);

      // Calculate and apply results
      const results = calculateForagingResults(task, nodeName, biomeName);
      resolve(task.id, results);
    },
    [foragingNodes, foragingBiomes, beginResolve, resolve]
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
    <div className="foraging-activity" data-testid="foraging-activity">
      {/* Header */}
      <header className="activity-header flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold">Foraging</h3>
        </div>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
            data-testid="new-foraging-task-button"
          >
            <Plus className="w-4 h-4" />
            New Foraging Task
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
        <ForagingTaskForm
          characters={characters}
          biomes={foragingBiomes}
          nodes={foragingNodes}
          tables={gatheringTables}
          tools={foragingTools}
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
          <p className="text-gray-500 text-sm italic">No pending foraging tasks</p>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map((task) => (
              <ForagingTaskCard
                key={task.id}
                task={task}
                nodes={foragingNodes}
                biomes={foragingBiomes}
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
          <p className="text-gray-500 text-sm italic">No completed foraging tasks</p>
        ) : (
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <ForagingTaskCard
                key={task.id}
                task={task}
                nodes={foragingNodes}
                biomes={foragingBiomes}
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
