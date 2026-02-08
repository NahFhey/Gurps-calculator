/**
 * Auto-Resolved Task Utility
 *
 * Creates and immediately resolves a DowntimeTask to mark a character
 * as unavailable for the current time slot. Used by activities that
 * operate outside the standard task creation UI (Analysis, Processing,
 * BatchesView work blocks, Crafting shifts).
 */

import type React from 'react';
import type { DowntimeState, DowntimeActivityType, ActivityData, TaskResults } from '../types/downtime';
import type { DowntimeAction } from '../state/downtime/downtimeActions';
import {
  selectCharacterAssignmentForSlot,
} from '../state/downtime/downtimeSelectors';
import {
  createTask,
  resolveTask,
} from '../state/downtime/downtimeActions';
import { generateTaskId } from '../state/downtime/downtimeReducer';

interface AutoResolveParams {
  activityType: DowntimeActivityType;
  dayKey: number;
  slot: number;
  leaderId: string;
  activityData: ActivityData;
  resultMessage: string;
}

interface AutoResolveSuccess {
  success: true;
  taskId: string;
}

interface AutoResolveFailure {
  success: false;
  error: string;
}

export type AutoResolveResult = AutoResolveSuccess | AutoResolveFailure;

/**
 * Checks if a character is available for the current slot, then creates
 * and immediately resolves a DowntimeTask to mark them as unavailable.
 *
 * Returns success with the taskId, or failure with an error message.
 */
export function createAndResolveTask(
  state: DowntimeState,
  dispatch: React.Dispatch<DowntimeAction>,
  params: AutoResolveParams
): AutoResolveResult {
  const { activityType, dayKey, slot, leaderId, activityData, resultMessage } = params;

  // Check if character is already assigned
  const existing = selectCharacterAssignmentForSlot(state, leaderId, dayKey, slot);
  if (existing) {
    return {
      success: false,
      error: 'This character is already busy this time slot.',
    };
  }

  // Pre-generate task ID so we can resolve immediately
  const taskId = generateTaskId();

  // Create the task
  dispatch(createTask({
    id: taskId,
    activityType,
    dayKey,
    slot,
    leaderId,
    helperIds: [],
    activityData,
  }));

  // Immediately resolve it
  const results: TaskResults = {
    success: true,
    message: resultMessage,
  };
  dispatch(resolveTask(taskId, results));

  return { success: true, taskId };
}
