/**
 * Alchemy Activity View
 *
 * Main view for the alchemy downtime activity.
 * Displays active batches and work session tasks, allowing
 * creation, resolution, and cancellation of alchemy work blocks.
 *
 * This component integrates with the existing alchemy batch system
 * while providing task-bounded tracking for downtime management.
 */

import { useState, useCallback, useMemo } from 'react';
import { FlaskConical, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { AlchemyTaskForm } from './AlchemyTaskForm';
import { AlchemyTaskCard } from './AlchemyTaskCard';
import {
  selectTasksByActivityType,
  validateTaskCreation,
} from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import type { DowntimeTask, AlchemyData, TaskResults } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { AlchemyBatch } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface AlchemyActivityProps {
  /** Current day key for task scheduling */
  currentDayKey: number;
  /** Current time slot for task scheduling */
  currentSlot: number;
}

// ============================================================================
// ALCHEMY RESOLUTION
// ============================================================================

/**
 * Calculate alchemy work block results based on task data.
 * Uses simplified mechanics - in production would use alchemy.js utilities.
 */
function calculateAlchemyResults(
  task: DowntimeTask,
  batch: AlchemyBatch | undefined,
  formulaName: string
): TaskResults {
  const data = task.activityData as AlchemyData;

  if (!batch) {
    return {
      success: false,
      message: 'Batch not found - work session could not be completed.',
      inventoryChanges: [],
      experienceGained: 0,
    };
  }

  // Simple work block simulation
  // In production, this would use applyWorkBlockResult from alchemy.js
  const skillRoll = Math.floor(Math.random() * 16) + 3; // 3-18 range (3d6)
  const effectiveSkill = 12 + (data.aspectModifiers?.skill ?? 0);
  const margin = effectiveSkill - skillRoll;

  // Calculate progress and contamination
  const ppGained = margin >= 0 ? Math.max(1, Math.floor(margin / 2) + 1) : 0;
  const cpGained = margin < 0 ? 1 : 0;

  // Check if batch would complete
  const currentPP = (batch as any).PP ?? 0;
  const workRequired = (batch as any).WR ?? 10;
  const newPP = currentPP + ppGained;
  const wouldComplete = newPP >= workRequired;

  if (wouldComplete) {
    const quality = cpGained > 0 ? 'Minor Flaw' : 'Clean';
    return {
      success: true,
      message: `Batch complete! ${formulaName} finished with ${quality} quality. Produced ${data.batchSize} dose(s).`,
      inventoryChanges: [
        {
          itemId: data.formulaId,
          quantity: data.batchSize,
          itemName: formulaName,
        },
      ],
      experienceGained: 25 * data.batchSize,
    };
  }

  if (margin >= 0) {
    return {
      success: true,
      message: `Work block successful! Added ${ppGained} PP to ${formulaName}. Progress: ${newPP}/${workRequired}`,
      inventoryChanges: [],
      experienceGained: 10,
    };
  }

  return {
    success: false,
    message: `Work block had issues. ${formulaName} gained contamination. Progress: ${newPP}/${workRequired}, CP: ${(batch as any).CP ?? 0 + cpGained}`,
    inventoryChanges: [],
    experienceGained: 5,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AlchemyActivity({ currentDayKey, currentSlot }: AlchemyActivityProps) {
  const {
    state,
    characters,
    alchemyReagents,
    alchemyFormulas,
    alchemyBatches,
    alchemyLabs,
    tools,
    createDowntimeTask,
    beginResolve,
    resolve,
    cancel,
  } = useDowntimeContext();

  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get alchemy tasks for current slot
  const alchemyTasks = useMemo(
    () => selectTasksByActivityType(state, 'alchemy'),
    [state]
  );

  // Filter to pending and completed tasks
  const pendingTasks = useMemo(
    () => alchemyTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [alchemyTasks]
  );

  const completedTasks = useMemo(
    () => alchemyTasks.filter((t) => t.status === 'resolved' || t.status === 'cancelled'),
    [alchemyTasks]
  );

  // Get active batches (in brewing phase)
  const activeBatches = useMemo(
    () => alchemyBatches.filter((b) => b.status === 'brewing'),
    [alchemyBatches]
  );

  // Handle form submission
  const handleFormSubmit = useCallback(
    (data: { leaderId: string; helperIds: string[]; activityData: AlchemyData }) => {
      const payload: CreateTaskPayload = {
        activityType: 'alchemy',
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
      const data = task.activityData as AlchemyData;

      // Find the batch
      const batch = alchemyBatches.find((b) => b.id === data.formulaId);

      // Find the formula name
      const formula = alchemyFormulas.find((f) => f.id === data.recipeId);
      const formulaName = formula?.name ?? 'Unknown Potion';

      beginResolve(task.id);
      const results = calculateAlchemyResults(task, batch, formulaName);
      resolve(task.id, results);
    },
    [alchemyBatches, alchemyFormulas, beginResolve, resolve]
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

  return (
    <div className="alchemy-activity" data-testid="alchemy-activity">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical className="w-6 h-6 text-purple-600" />
        <h3 className="text-lg font-semibold">Alchemy</h3>
      </div>

      {/* Active Batches Summary */}
      {activeBatches.length > 0 && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg" data-testid="active-batches-summary">
          <h4 className="text-sm font-medium text-purple-800 mb-2">
            Active Batches ({activeBatches.length})
          </h4>
          <div className="space-y-1">
            {activeBatches.slice(0, 3).map((batch) => (
              <div key={batch.id} className="text-sm text-purple-700">
                {(batch as any).formulaName ?? batch.id} - {(batch as any).PP ?? 0}/{(batch as any).WR ?? '?'} PP
              </div>
            ))}
            {activeBatches.length > 3 && (
              <div className="text-xs text-purple-500">
                +{activeBatches.length - 3} more batches...
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
          className="mb-4 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          data-testid="new-alchemy-task-button"
          disabled={activeBatches.length === 0}
          title={activeBatches.length === 0 ? 'Start a batch in the Alchemy tab first' : undefined}
        >
          <Plus className="w-4 h-4" />
          New Work Session
        </button>
      ) : (
        <AlchemyTaskForm
          characters={characters}
          batches={activeBatches}
          formulas={alchemyFormulas}
          reagents={alchemyReagents}
          labs={alchemyLabs}
          tools={tools}
          state={state}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}

      {/* No Batches Message */}
      {activeBatches.length === 0 && !isCreating && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-sm text-gray-600">
            No active batches. Start a new batch in the Alchemy tab to begin brewing.
          </p>
        </div>
      )}

      {/* Pending Tasks */}
      <div className="mb-6" data-testid="pending-tasks-section">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Pending ({pendingTasks.length})
        </h4>
        {pendingTasks.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No pending alchemy tasks</p>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <AlchemyTaskCard
                key={task.id}
                task={task}
                batches={alchemyBatches}
                formulas={alchemyFormulas}
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
          <p className="text-sm text-gray-500 italic">No completed alchemy tasks</p>
        ) : (
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <AlchemyTaskCard
                key={task.id}
                task={task}
                batches={alchemyBatches}
                formulas={alchemyFormulas}
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
