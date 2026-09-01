/**
 * Downtime Validation
 *
 * Validation functions for downtime task operations.
 * Enforces constraints like single assignment per slot.
 */

import type { DowntimeState, ActivityData } from '../../types/downtime';
import type { CreateTaskPayload } from './downtimeActions';
import type { Character } from '../../types/campaign';
import {
  selectCharacterAssignmentForSlot,
  canCreateTaskForTarget,
  getTargetKeyFromActivityData,
  selectReservedToolIdsForSlot,
  isCharacterIncapacitated,
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
  // Check for self-assignment (leader cannot also be a helper)
  if (payload.helperIds.includes(payload.leaderId)) {
    return {
      valid: false,
      code: DOWNTIME_ERROR_CODES.HELPER_ALREADY_ASSIGNED,
      message: `${payload.leaderId} cannot be both leader and helper on the same task`,
      meta: {
        characterId: payload.leaderId,
        existingRole: 'leader',
      },
    };
  }

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
      return activityData.toolIds ?? [];
    case 'foraging':
      return activityData.toolIds ?? [];
    case 'mining':
      return activityData.toolIds ?? [];
    case 'alchemy':
      return activityData.toolIds ?? [];
    case 'crafting':
      // CraftingData uses toolInstanceIds instead of toolIds
      return activityData.toolInstanceIds ?? [];
    case 'rest':
      return []; // Rest uses no tools
    case 'trading':
      return [];
    case 'study':
      return [];
    case 'social':
    case 'travel':
      return [];
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

/**
 * Validates tool reservations created inside a batch of task payloads.
 *
 * Each payload is compared only with earlier payloads scheduled for the same
 * day and slot. The returned array is index-aligned with `payloads`, which
 * lets forms attach an error to the character row that caused the conflict.
 * Existing committed reservations remain the responsibility of
 * `validateTaskCreation`.
 */
export function validateBatchToolExclusivity(
  payloads: CreateTaskPayload[]
): ValidationResult[] {
  const toolsBySlot = new Map<string, Set<string>>();

  return payloads.map((payload, payloadIndex) => {
    const slotKey = `${payload.dayKey}:${payload.slot}`;
    const earlierTools = toolsBySlot.get(slotKey) ?? new Set<string>();
    const toolIds = getToolIdsFromActivityData(payload.activityData);
    const conflictingToolIds = toolIds.filter((toolId) => earlierTools.has(toolId));

    for (const toolId of toolIds) {
      earlierTools.add(toolId);
    }
    toolsBySlot.set(slotKey, earlierTools);

    if (conflictingToolIds.length === 0) {
      return { valid: true };
    }

    return {
      valid: false,
      code: DOWNTIME_ERROR_CODES.TOOL_CONFLICT,
      message: `Tool(s) already selected by an earlier batch row: ${conflictingToolIds.join(', ')}`,
      meta: {
        conflictingToolIds,
        dayKey: payload.dayKey,
        slot: payload.slot,
        payloadIndex,
      },
    };
  });
}

// ============================================================================
// COMBINED TASK CREATION VALIDATION
// ============================================================================

/**
 * Validates that a task can be created with the given payload.
 *
 * Runs all validation checks in order:
 * 1. Incapacitation validation (with the rest-patient exception)
 * 2. Assignment validation (single assignment per slot)
 * 3. Lock-on-create validation (no duplicate targets)
 * 4. Tool exclusivity validation (no shared tools)
 */
export function validateTaskCreation(
  state: DowntimeState,
  payload: CreateTaskPayload,
  characters: readonly Character[] = []
): ValidationResult {
  const characterById = new Map(characters.map(character => [character.id, character]));
  const incapacitationMessage = (character: Character): string => (
    character.status?.dead === true
      ? `${character.name} is dead`
      : `${character.name} is unconscious`
  );

  const leader = characterById.get(payload.leaderId);
  if (payload.activityType !== 'rest' && leader && isCharacterIncapacitated(leader)) {
    return {
      valid: false,
      code: DOWNTIME_ERROR_CODES.CHARACTER_INCAPACITATED,
      message: incapacitationMessage(leader),
      meta: { characterId: leader.id, role: 'leader' },
    };
  }

  for (const helperId of payload.helperIds) {
    const helper = characterById.get(helperId);
    if (helper && isCharacterIncapacitated(helper)) {
      return {
        valid: false,
        code: DOWNTIME_ERROR_CODES.CHARACTER_INCAPACITATED,
        message: incapacitationMessage(helper),
        meta: { characterId: helper.id, role: 'helper' },
      };
    }
  }

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
