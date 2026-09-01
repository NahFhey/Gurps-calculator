/**
 * Downtime Reducer
 *
 * Handles state mutations for downtime task operations using Immer.
 */

import { produce } from 'immer';
import type { DowntimeState, DowntimeTask } from '../../types/downtime';
import {
  type DowntimeAction,
  DOWNTIME_TASK_CREATE,
  DOWNTIME_TASK_UPDATE,
  DOWNTIME_TASK_BEGIN_RESOLVE,
  DOWNTIME_TASK_RESOLVE,
  DOWNTIME_TASK_CANCEL,
  DOWNTIME_TASK_REORDER,
  DOWNTIME_STATE_REPLACE,
} from './downtimeActions';
import { validateTaskCreation } from './downtimeValidation';
import { DowntimeValidationError } from './downtimeErrors';

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generates a unique ID for a new task.
 * Uses the same pattern as the rest of the codebase.
 */
export function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ============================================================================
// REDUCER
// ============================================================================

/**
 * Downtime reducer for managing task state.
 * All mutations are performed immutably via Immer's draft.
 */
export function downtimeReducer(
  state: DowntimeState,
  action: DowntimeAction
): DowntimeState {
  return produce(state, (draft) => {
    switch (action.type) {
      case DOWNTIME_STATE_REPLACE:
        return action.payload;
      case DOWNTIME_TASK_CREATE: {
        // Validate assignment constraints before creating task
        const validation = validateTaskCreation(state, action.payload);
        if (!validation.valid) {
          throw new DowntimeValidationError(validation);
        }

        const { activityType, dayKey, slot, leaderId, helperIds, activityData } = action.payload;
        const now = Date.now();
        const id = action.payload.id ?? generateTaskId();

        const newTask: DowntimeTask = {
          id,
          activityType,
          dayKey,
          slot,
          leaderId,
          helperIds,
          status: 'pending',
          activityData,
          createdAt: now,
          updatedAt: now,
        };

        draft.tasksById[id] = newTask;
        draft.taskOrder.push(id);
        return;
      }

      case DOWNTIME_TASK_UPDATE: {
        const { taskId, changes } = action.payload;
        const task = draft.tasksById[taskId];

        if (task) {
          // Apply changes to the task
          Object.assign(task, changes);
          // Always update the timestamp
          task.updatedAt = Date.now();
        }
        return;
      }

      case DOWNTIME_TASK_BEGIN_RESOLVE: {
        const { taskId } = action.payload;
        const task = draft.tasksById[taskId];

        if (task && task.status === 'pending') {
          task.status = 'in_progress';
          task.updatedAt = Date.now();
        }
        return;
      }

      case DOWNTIME_TASK_RESOLVE: {
        const { taskId, results } = action.payload;
        const task = draft.tasksById[taskId];

        // Idempotent: only resolve if not already resolved
        if (task && task.status !== 'resolved') {
          task.status = 'resolved';
          task.results = results;
          task.updatedAt = Date.now();
        }
        return;
      }

      case DOWNTIME_TASK_CANCEL: {
        const { taskId } = action.payload;
        const task = draft.tasksById[taskId];

        // Only cancel if not already resolved or cancelled
        if (task && task.status !== 'resolved' && task.status !== 'cancelled') {
          task.status = 'cancelled';
          task.updatedAt = Date.now();
        }
        // Note: We do NOT remove the task - it stays as a tombstone
        return;
      }

      case DOWNTIME_TASK_REORDER: {
        const { taskIds } = action.payload;
        draft.taskOrder = taskIds;
        return;
      }

      default:
        return;
    }
  });
}
