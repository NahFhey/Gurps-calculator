/**
 * Downtime Validation
 *
 * Validation functions for downtime task operations.
 * Enforces constraints like single assignment per slot.
 */

import type { DowntimeState, ActivityData } from '../../types/downtime';
import type { CreateTaskPayload } from './downtimeActions';
import {
  selectCharacterAssignmentForSlot,
  canCreateTaskForTarget,
  getTargetKeyFromActivityData,
  selectReservedToolIdsForSlot,
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
// TOOL EXCLUSIVITY VALIDATION
// ============================================================================

/**
 * Extracts tool IDs from activity data.
 * Different activity types store tools in different structures.
 */
export function getToolIdsFromActivityData(activityData: ActivityData): string[] {
  switch (activityData.type) {
    case 'fishing':
      return activityData.toolIds;
    case 'foraging':
      return activityData.toolIds;
    case 'alchemy':
      return activityData.toolIds ?? [];
    case 'crafting':
      return activityData.toolIds;
    case 'rest':
      return []; // Rest uses no tools
    default:
      return [];
  }
}

/**
 * Validates tool exclusivity constraint.
 *
 * From spec: "A single tool instance (by toolId) may not be used by more than
 * one task in the same (dayKey, slot). Cancelled tasks FREE their tools."
 *
 * Only pending and in_progress tasks reserve tools.
 */
export function validateToolExclusivity(
  state: DowntimeState,
  payload: CreateTaskPayload
): ValidationResult {
  const toolIds = getToolIdsFromActivityData(payload.activityData);

  // No tools = no conflict possible
  if (toolIds.length === 0) {
    return { valid: true };
  }

  const reservedTools = selectReservedToolIdsForSlot(
    state,
    payload.dayKey,
    payload.slot
  );

  const conflictingTools = toolIds.filter((id) => reservedTools.has(id));

  if (conflictingTools.length > 0) {
    return {
      valid: false,
      code: DOWNTIME_ERROR_CODES.TOOL_CONFLICT,
      message: `Tool(s) already in use: ${conflictingTools.join(', ')}`,
      meta: {
        conflictingToolIds: conflictingTools,
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
 * 3. Tool exclusivity validation (no shared tools)
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

  // Check tool exclusivity
  const toolResult = validateToolExclusivity(state, payload);
  if (!toolResult.valid) {
    return toolResult;
  }

  return { valid: true };
}
