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
