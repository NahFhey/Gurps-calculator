/**
 * Downtime Validation
 *
 * Validation functions for downtime task operations.
 * Enforces constraints like single assignment per slot.
 */

import type { DowntimeState } from '../../types/downtime';
import type { CreateTaskPayload } from './downtimeActions';
import { selectCharacterAssignmentForSlot } from './downtimeSelectors';
import { type ValidationResult, DOWNTIME_ERROR_CODES } from './downtimeErrors';

// Re-export for convenience
export type { ValidationResult } from './downtimeErrors';

// ============================================================================
// TASK CREATION VALIDATION
// ============================================================================

/**
 * Validates that a task can be created with the given payload.
 *
 * Constraints enforced:
 * - Leader cannot be assigned to another task in the same slot
 * - Helpers cannot be assigned to another task in the same slot
 *
 * From spec: "A character may not be: leader on one task and helper on another
 * in the same slot, helper on multiple tasks in the same slot, leader on
 * multiple tasks in the same slot"
 */
export function validateTaskCreation(
  state: DowntimeState,
  payload: CreateTaskPayload
): ValidationResult {
  // Check leader assignment
  const leaderAssignment = selectCharacterAssignmentForSlot(
    state,
    payload.leaderId,
    payload.dayKey,
    payload.slot
  );

  if (leaderAssignment) {
    return {
      valid: false,
      code: DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED,
      message: `${payload.leaderId} is already assigned to a task in this slot`,
      meta: {
        existingTaskId: leaderAssignment.taskId,
        existingRole: leaderAssignment.role,
      },
    };
  }

  // Check each helper assignment
  for (const helperId of payload.helperIds) {
    const helperAssignment = selectCharacterAssignmentForSlot(
      state,
      helperId,
      payload.dayKey,
      payload.slot
    );

    if (helperAssignment) {
      return {
        valid: false,
        code: DOWNTIME_ERROR_CODES.HELPER_ALREADY_ASSIGNED,
        message: `${helperId} is already assigned to a task in this slot`,
        meta: {
          characterId: helperId,
          existingTaskId: helperAssignment.taskId,
          existingRole: helperAssignment.role,
        },
      };
    }
  }

  return { valid: true };
}
