/**
 * Downtime Selectors
 *
 * Pure functions for querying downtime state.
 * These form the "read API" for all downtime UI components.
 */

import type {
  DowntimeState,
  DowntimeTask,
  DowntimeActivityType,
  TaskStatus,
  ActivityData,
  TaskLockKey,
} from '../../types/downtime';

// ============================================================================
// BASIC SELECTORS
// ============================================================================

/**
 * Get all tasks as an array, ordered by taskOrder.
 * Returns empty array for empty state.
 */
export function selectAllTasks(state: DowntimeState): DowntimeTask[] {
  return state.taskOrder
    .map((id) => state.tasksById[id])
    .filter((task): task is DowntimeTask => task !== undefined);
}

/**
 * Get a single task by ID.
 * Returns undefined if task doesn't exist.
 */
export function selectTaskById(
  state: DowntimeState,
  taskId: string
): DowntimeTask | undefined {
  return state.tasksById[taskId];
}

// ============================================================================
// SLOT-BASED SELECTORS
// ============================================================================

/**
 * Get all tasks for a specific day and slot.
 * Returns tasks in taskOrder sequence.
 */
export function selectTasksForSlot(
  state: DowntimeState,
  dayKey: number,
  slot: number
): DowntimeTask[] {
  return selectAllTasks(state).filter(
    (task) => task.dayKey === dayKey && task.slot === slot
  );
}

/**
 * Get pending tasks for a specific day and slot.
 */
export function selectPendingTasksForSlot(
  state: DowntimeState,
  dayKey: number,
  slot: number
): DowntimeTask[] {
  return selectTasksForSlot(state, dayKey, slot).filter(
    (task) => task.status === 'pending'
  );
}

/**
 * Get resolved tasks for a specific day and slot.
 */
export function selectResolvedTasksForSlot(
  state: DowntimeState,
  dayKey: number,
  slot: number
): DowntimeTask[] {
  return selectTasksForSlot(state, dayKey, slot).filter(
    (task) => task.status === 'resolved'
  );
}

/**
 * Get cancelled tasks for a specific day and slot.
 */
export function selectCancelledTasksForSlot(
  state: DowntimeState,
  dayKey: number,
  slot: number
): DowntimeTask[] {
  return selectTasksForSlot(state, dayKey, slot).filter(
    (task) => task.status === 'cancelled'
  );
}

/**
 * Get in-progress tasks for a specific day and slot.
 */
export function selectInProgressTasksForSlot(
  state: DowntimeState,
  dayKey: number,
  slot: number
): DowntimeTask[] {
  return selectTasksForSlot(state, dayKey, slot).filter(
    (task) => task.status === 'in_progress'
  );
}

// ============================================================================
// FILTER SELECTORS
// ============================================================================

/**
 * Get all tasks of a specific activity type.
 * Returns tasks in taskOrder sequence.
 */
export function selectTasksByActivityType(
  state: DowntimeState,
  activityType: DowntimeActivityType
): DowntimeTask[] {
  return selectAllTasks(state).filter(
    (task) => task.activityType === activityType
  );
}

/**
 * Get all tasks led by a specific character.
 * Returns tasks in taskOrder sequence.
 */
export function selectTasksByLeader(
  state: DowntimeState,
  leaderId: string
): DowntimeTask[] {
  return selectAllTasks(state).filter((task) => task.leaderId === leaderId);
}

/**
 * Get all tasks where a character is a helper.
 * Returns tasks in taskOrder sequence.
 */
export function selectTasksByHelper(
  state: DowntimeState,
  helperId: string
): DowntimeTask[] {
  return selectAllTasks(state).filter((task) =>
    task.helperIds.includes(helperId)
  );
}

/**
 * Get all tasks involving a character (as leader or helper).
 * Returns tasks in taskOrder sequence.
 */
export function selectTasksByCharacter(
  state: DowntimeState,
  characterId: string
): DowntimeTask[] {
  return selectAllTasks(state).filter(
    (task) =>
      task.leaderId === characterId || task.helperIds.includes(characterId)
  );
}

// ============================================================================
// STATUS SELECTORS
// ============================================================================

/**
 * Get all tasks with a specific status.
 * Returns tasks in taskOrder sequence.
 */
export function selectTasksByStatus(
  state: DowntimeState,
  status: TaskStatus
): DowntimeTask[] {
  return selectAllTasks(state).filter((task) => task.status === status);
}

/**
 * Get all pending tasks.
 */
export function selectPendingTasks(state: DowntimeState): DowntimeTask[] {
  return selectTasksByStatus(state, 'pending');
}

/**
 * Get all resolved tasks.
 */
export function selectResolvedTasks(state: DowntimeState): DowntimeTask[] {
  return selectTasksByStatus(state, 'resolved');
}

/**
 * Get all cancelled tasks.
 */
export function selectCancelledTasks(state: DowntimeState): DowntimeTask[] {
  return selectTasksByStatus(state, 'cancelled');
}

/**
 * Get all in-progress tasks.
 */
export function selectInProgressTasks(state: DowntimeState): DowntimeTask[] {
  return selectTasksByStatus(state, 'in_progress');
}

// ============================================================================
// DAY-BASED SELECTORS
// ============================================================================

/**
 * Get all tasks for a specific day.
 * Returns tasks in taskOrder sequence.
 */
export function selectTasksForDay(
  state: DowntimeState,
  dayKey: number
): DowntimeTask[] {
  return selectAllTasks(state).filter((task) => task.dayKey === dayKey);
}

/**
 * Get count of tasks by status for a day.
 */
export function selectTaskCountsByStatusForDay(
  state: DowntimeState,
  dayKey: number
): Record<TaskStatus, number> {
  const tasks = selectTasksForDay(state, dayKey);
  return {
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    resolved: tasks.filter((t) => t.status === 'resolved').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
  };
}

// ============================================================================
// UTILITY SELECTORS
// ============================================================================

/**
 * Check if a slot has any unresolved tasks (pending or in_progress).
 */
export function selectSlotHasUnresolvedTasks(
  state: DowntimeState,
  dayKey: number,
  slot: number
): boolean {
  return selectTasksForSlot(state, dayKey, slot).some(
    (task) => task.status === 'pending' || task.status === 'in_progress'
  );
}

/**
 * Get the total task count.
 */
export function selectTaskCount(state: DowntimeState): number {
  return state.taskOrder.length;
}

// ============================================================================
// ASSIGNMENT SELECTORS
// ============================================================================

/**
 * Check if a character is assigned in a slot (as leader OR helper).
 * Only considers active tasks (pending, in_progress, resolved).
 * Returns the task ID and role, or null if not assigned.
 */
export function selectCharacterAssignmentForSlot(
  state: DowntimeState,
  characterId: string,
  dayKey: number,
  slot: number
): { taskId: string; role: 'leader' | 'helper' } | null {
  const tasks = selectTasksForSlot(state, dayKey, slot);

  for (const task of tasks) {
    // Skip cancelled tasks for assignment purposes
    if (task.status === 'cancelled') continue;

    if (task.leaderId === characterId) {
      return { taskId: task.id, role: 'leader' };
    }
    if (task.helperIds.includes(characterId)) {
      return { taskId: task.id, role: 'helper' };
    }
  }

  return null;
}

/**
 * Get all assigned character IDs for a slot.
 * Includes both leaders and helpers from non-cancelled tasks.
 */
export function selectAssignedCharacterIdsForSlot(
  state: DowntimeState,
  dayKey: number,
  slot: number
): Set<string> {
  const assigned = new Set<string>();
  const tasks = selectTasksForSlot(state, dayKey, slot);

  for (const task of tasks) {
    // Skip cancelled tasks
    if (task.status === 'cancelled') continue;

    assigned.add(task.leaderId);
    for (const helperId of task.helperIds) {
      assigned.add(helperId);
    }
  }

  return assigned;
}

/**
 * Get available (unassigned) characters for a slot.
 * Filters out characters already assigned to non-cancelled tasks.
 */
export function selectAvailableCharacterIdsForSlot(
  state: DowntimeState,
  dayKey: number,
  slot: number,
  allCharacterIds: string[]
): string[] {
  const assigned = selectAssignedCharacterIdsForSlot(state, dayKey, slot);
  return allCharacterIds.filter((id) => !assigned.has(id));
}

// ============================================================================
// TARGET KEY HELPERS
// ============================================================================

/**
 * Extract the target key from activity data.
 * Target keys uniquely identify the resource being worked on.
 */
export function getTargetKeyFromActivityData(
  activityType: DowntimeActivityType,
  activityData: ActivityData
): string {
  switch (activityType) {
    case 'fishing':
      return `species:${(activityData as { speciesId: string }).speciesId}`;
    case 'foraging':
      return `node:${(activityData as { nodeId: string }).nodeId}`;
    case 'alchemy':
      return `recipe:${(activityData as { recipeId: string }).recipeId}`;
    case 'crafting':
      return `project:${(activityData as { projectId: string }).projectId}`;
    case 'rest':
      return `rest:${(activityData as { restType: string }).restType}`;
    default:
      return 'unknown';
  }
}

// ============================================================================
// LOCK SELECTORS
// ============================================================================

/**
 * Generate a lock key for task deduplication.
 * Format: activityType|characterId|dayKey|slot|targetKey
 */
export function generateTaskLockKey(
  activityType: DowntimeActivityType,
  characterId: string,
  dayKey: number,
  slot: number,
  targetKey: string
): TaskLockKey {
  return `${activityType}|${characterId}|${dayKey}|${slot}|${targetKey}` as TaskLockKey;
}

/**
 * Get all existing lock keys for a slot.
 * IMPORTANT: Includes cancelled tasks! Locks persist even after cancellation
 * to prevent re-creating the same task.
 */
export function selectExistingLockKeysForSlot(
  state: DowntimeState,
  dayKey: number,
  slot: number
): Set<TaskLockKey> {
  const lockKeys = new Set<TaskLockKey>();
  const tasks = selectTasksForSlot(state, dayKey, slot);

  for (const task of tasks) {
    // Include ALL tasks including cancelled (locks persist!)
    const targetKey = getTargetKeyFromActivityData(
      task.activityType,
      task.activityData
    );
    const lockKey = generateTaskLockKey(
      task.activityType,
      task.leaderId,
      dayKey,
      slot,
      targetKey
    );
    lockKeys.add(lockKey);
  }

  return lockKeys;
}

/**
 * Check if a new task can be created (no lock conflict).
 * Returns true if no existing task has the same lock key.
 */
export function canCreateTaskForTarget(
  state: DowntimeState,
  characterId: string,
  activityType: DowntimeActivityType,
  targetKey: string,
  dayKey: number,
  slot: number
): boolean {
  const existingLocks = selectExistingLockKeysForSlot(state, dayKey, slot);
  const proposedLockKey = generateTaskLockKey(
    activityType,
    characterId,
    dayKey,
    slot,
    targetKey
  );
  return !existingLocks.has(proposedLockKey);
}

// ============================================================================
// TOOL RESERVATION SELECTORS
// ============================================================================

/**
 * Get all reserved tool IDs for a slot.
 * NOTE: Cancelled tasks FREE their tools (unlike locks which persist).
 * Only pending and in_progress tasks hold tool reservations.
 */
export function selectReservedToolIdsForSlot(
  state: DowntimeState,
  dayKey: number,
  slot: number
): Set<string> {
  const reservedTools = new Set<string>();
  const tasks = selectTasksForSlot(state, dayKey, slot);

  for (const task of tasks) {
    // Only pending and in_progress tasks reserve tools
    // Cancelled and resolved tasks free their tools
    if (task.status !== 'pending' && task.status !== 'in_progress') {
      continue;
    }

    // Extract toolIds from activity data
    const activityData = task.activityData as { toolIds?: string[] };
    if (activityData.toolIds) {
      for (const toolId of activityData.toolIds) {
        reservedTools.add(toolId);
      }
    }
  }

  return reservedTools;
}

/**
 * Check if specific tools are available for use in a slot.
 * Returns true if none of the tools are reserved.
 */
export function canUseTools(
  state: DowntimeState,
  toolIds: string[],
  dayKey: number,
  slot: number
): boolean {
  if (toolIds.length === 0) return true;

  const reserved = selectReservedToolIdsForSlot(state, dayKey, slot);
  return !toolIds.some((toolId) => reserved.has(toolId));
}

// ============================================================================
// FATIGUE SELECTORS
// ============================================================================

/**
 * Fatigue status for a character.
 * - rested: Character has not worked since last rest
 * - tired: Character has worked once since last rest
 * - exhausted: Character worked while already tired
 */
export type FatigueStatus = 'rested' | 'tired' | 'exhausted';

/**
 * Check if a character worked in a specific slot (resolved non-rest task).
 * A character "works" if they participated in a resolved task that is not rest,
 * either as a leader or as a helper.
 */
function didCharacterWorkInSlot(
  state: DowntimeState,
  characterId: string,
  dayKey: number,
  slot: number
): boolean {
  const resolvedTasks = selectResolvedTasksForSlot(state, dayKey, slot);

  for (const task of resolvedTasks) {
    // Skip rest tasks - they don't count as work
    if (task.activityType === 'rest') continue;

    // Check if character is leader or helper
    if (task.leaderId === characterId || task.helperIds.includes(characterId)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a character rested in a specific slot.
 * Rest is either explicit (resolved rest task) or implicit (no resolved non-rest task).
 */
function didCharacterRestInSlot(
  state: DowntimeState,
  characterId: string,
  dayKey: number,
  slot: number
): boolean {
  const resolvedTasks = selectResolvedTasksForSlot(state, dayKey, slot);

  // Check for explicit rest task
  for (const task of resolvedTasks) {
    if (task.activityType === 'rest') {
      if (
        task.leaderId === characterId ||
        task.helperIds.includes(characterId)
      ) {
        return true;
      }
    }
  }

  // Implicit rest: no non-rest work in this slot
  return !didCharacterWorkInSlot(state, characterId, dayKey, slot);
}

/**
 * Get fatigue status for a character at a specific point in time.
 *
 * Algorithm:
 * 1. Start from slot 0 of the day
 * 2. Track: lastAction = 'rested'
 * 3. For each completed slot up to (but not including) currentSlot:
 *    a. If worked this slot:
 *       - If lastAction was 'tired' → return 'exhausted'
 *       - Else → lastAction = 'tired'
 *    b. If rested this slot:
 *       - lastAction = 'rested'
 * 4. Return lastAction (either 'rested' or 'tired')
 *
 * Note: currentSlot is exclusive - we only look at completed slots before it.
 */
export function selectCharacterFatigueStatus(
  state: DowntimeState,
  characterId: string,
  dayKey: number,
  currentSlot: number
): FatigueStatus {
  let lastAction: FatigueStatus = 'rested';

  // Iterate through all slots from 0 up to (but not including) currentSlot
  for (let slot = 0; slot < currentSlot; slot++) {
    const worked = didCharacterWorkInSlot(state, characterId, dayKey, slot);
    const rested = didCharacterRestInSlot(state, characterId, dayKey, slot);

    if (worked) {
      if (lastAction === 'tired') {
        // Working while tired → exhausted
        lastAction = 'exhausted';
      } else {
        // Working while rested (or even exhausted) → tired
        lastAction = 'tired';
      }
    } else if (rested) {
      // Resting (explicit or implicit) → rested
      lastAction = 'rested';
    }
  }

  return lastAction;
}

/**
 * Get all characters with their fatigue status for display.
 * Returns a Map for efficient lookup by character ID.
 */
export function selectCharacterFatigueMap(
  state: DowntimeState,
  dayKey: number,
  currentSlot: number,
  allCharacterIds: string[]
): Map<string, FatigueStatus> {
  const fatigueMap = new Map<string, FatigueStatus>();

  for (const characterId of allCharacterIds) {
    const status = selectCharacterFatigueStatus(
      state,
      characterId,
      dayKey,
      currentSlot
    );
    fatigueMap.set(characterId, status);
  }

  return fatigueMap;
}
