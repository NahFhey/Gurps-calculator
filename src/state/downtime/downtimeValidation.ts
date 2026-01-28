/**
 * Downtime Validation
 *
 * Validation functions for downtime task operations.
 * Enforces constraints like single assignment per slot.
 */

import type { DowntimeState } from '../../types/downtime';
import type { CreateTaskPayload } from './downtimeActions';
import {
  selectCharacterAssignmentForSlot,
  canCreateTaskForTarget,
  getTargetKeyFromActivityData,
} from './downtimeSelectors';
import { type ValidationResult, DOWNTIME_ERROR_CODES } from './downtimeErrors';

// Re-export for convenience
export type { ValidationResult } from './downtimeErrors';

// ============================================================================
// ASSIGNMENT VALIDATION
// ============================================================================

/**
 * Validates character assignment constraints.
 *
 * From spec: "A character may not be: leader on one task and helper on another
 * in the same slot, helper on multiple tasks in the same slot, leader on
 * multiple tasks in the same slot"
 */
export function validateAssignment(
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

// ============================================================================
// LOCK-ON-CREATE VALIDATION
// ============================================================================

/**
 * Validates lock-on-create constraint.
 *
 * From spec: "If a character creates a task for (activityType, targetKey) in
 * (dayKey, slot), they cannot create another task with the same (activityType,
 * targetKey) in that same (dayKey, slot) even if they cancel it."
 *
 * Lock persists through all task statuses including cancelled.
 */
export function validateLockOnCreate(
  state: DowntimeState,
  payload: CreateTaskPayload
): ValidationResult {
  const targetKey = getTargetKeyFromActivityData(
    payload.activityType,
    payload.activityData
  );

  const canCreate = canCreateTaskForTarget(
    state,
    payload.leaderId,
    payload.activityType,
    targetKey,
    payload.dayKey,
    payload.slot
  );

  if (!canCreate) {
    return {
      valid: false,
      code: DOWNTIME_ERROR_CODES.LOCK_CONFLICT,
      message: `Cannot create another ${payload.activityType} task for this target in the same slot`,
      meta: {
        activityType: payload.activityType,
        targetKey,
        characterId: payload.leaderId,
        dayKey: payload.dayKey,
        slot: payload.slot,
      },
    };
  }

  return { valid: true };
}

// ============================================================================
// COMBINED TASK CREATION VALIDATION
// ============================================================================

/**
 * Validates that a task can be created with the given payload.
 *
 * Runs all validation checks in order:
 * 1. Assignment validation (single assignment per slot)
 * 2. Lock-on-create validation (no duplicate targets)
 */
export function validateTaskCreation(
  state: DowntimeState,
  payload: CreateTaskPayload
): ValidationResult {
  // Check assignment constraints first
  const assignmentResult = validateAssignment(state, payload);
  if (!assignmentResult.valid) {
    return assignmentResult;
  }

  // Check lock-on-create constraint
  const lockResult = validateLockOnCreate(state, payload);
  if (!lockResult.valid) {
    return lockResult;
  }

  return { valid: true };
}
