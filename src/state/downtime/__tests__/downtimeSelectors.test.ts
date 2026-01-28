import { describe, expect, it } from 'vitest';
import type {
  DowntimeState,
  DowntimeTask,
  FishingData,
  TaskStatus,
  DowntimeActivityType,
} from '../../../types/downtime';
import { downtimeInitialState } from '../downtimeInitialState';
import {
  selectAllTasks,
  selectTaskById,
  selectTasksForSlot,
  selectPendingTasksForSlot,
  selectResolvedTasksForSlot,
  selectCancelledTasksForSlot,
  selectTasksByActivityType,
  selectTasksByLeader,
  selectTasksByHelper,
  selectTasksByCharacter,
  selectTasksByStatus,
  selectTasksForDay,
  selectTaskCount,
  selectSlotHasUnresolvedTasks,
} from '../downtimeSelectors';

// ============================================================================
// TEST FACTORIES
// ============================================================================

let idCounter = 0;

/**
 * Creates a test task with sensible defaults.
 */
function createTestTask(overrides: Partial<DowntimeTask> = {}): DowntimeTask {
  const id = overrides.id ?? `task-${++idCounter}`;
  const now = Date.now();

  return {
    id,
    activityType: 'fishing',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    status: 'pending',
    activityData: {
      type: 'fishing',
      speciesId: 'species-1',
      spotId: 'spot-1',
      toolIds: [],
      skillModifier: 0,
      targetYield: 1,
    } as FishingData,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a test state from an array of tasks.
 */
function createTestState(tasks: DowntimeTask[]): DowntimeState {
  const tasksById: Record<string, DowntimeTask> = {};
  const taskOrder: string[] = [];

  for (const task of tasks) {
    tasksById[task.id] = task;
    taskOrder.push(task.id);
  }

  return {
    tasksById,
    taskOrder,
    pendingDayLedger: null,
  };
}

// ============================================================================
// selectAllTasks TESTS
// ============================================================================

describe('selectAllTasks', () => {
  it('returns empty array for empty state', () => {
    const result = selectAllTasks(downtimeInitialState);
    expect(result).toEqual([]);
  });

  it('returns tasks in taskOrder sequence', () => {
    const task1 = createTestTask({ id: 'task-a' });
    const task2 = createTestTask({ id: 'task-b' });
    const task3 = createTestTask({ id: 'task-c' });

    // Create state with specific order
    const state: DowntimeState = {
      tasksById: {
        'task-a': task1,
        'task-b': task2,
        'task-c': task3,
      },
      taskOrder: ['task-c', 'task-a', 'task-b'], // Different order than object keys
      pendingDayLedger: null,
    };

    const result = selectAllTasks(state);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('task-c');
    expect(result[1].id).toBe('task-a');
    expect(result[2].id).toBe('task-b');
  });

  it('filters out undefined tasks if taskOrder has stale IDs', () => {
    const task1 = createTestTask({ id: 'task-exists' });

    const state: DowntimeState = {
      tasksById: {
        'task-exists': task1,
      },
      taskOrder: ['task-exists', 'task-deleted'], // 'task-deleted' is stale
      pendingDayLedger: null,
    };

    const result = selectAllTasks(state);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('task-exists');
  });
});

// ============================================================================
// selectTaskById TESTS
// ============================================================================

describe('selectTaskById', () => {
  it('returns task when exists', () => {
    const task = createTestTask({ id: 'task-123' });
    const state = createTestState([task]);

    const result = selectTaskById(state, 'task-123');

    expect(result).toBe(task);
  });

  it('returns undefined when not found', () => {
    const state = createTestState([]);

    const result = selectTaskById(state, 'non-existent');

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// selectTasksForSlot TESTS
// ============================================================================

describe('selectTasksForSlot', () => {
  it('filters correctly by dayKey and slot', () => {
    const task1 = createTestTask({ id: 't1', dayKey: 1, slot: 0 });
    const task2 = createTestTask({ id: 't2', dayKey: 1, slot: 1 });
    const task3 = createTestTask({ id: 't3', dayKey: 2, slot: 0 });
    const task4 = createTestTask({ id: 't4', dayKey: 1, slot: 0 });

    const state = createTestState([task1, task2, task3, task4]);

    const result = selectTasksForSlot(state, 1, 0);

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t1', 't4']);
  });

  it('returns empty array when no matches', () => {
    const task = createTestTask({ dayKey: 1, slot: 0 });
    const state = createTestState([task]);

    const result = selectTasksForSlot(state, 5, 2);

    expect(result).toEqual([]);
  });

  it('returns empty array for empty state', () => {
    const result = selectTasksForSlot(downtimeInitialState, 1, 0);
    expect(result).toEqual([]);
  });
});

// ============================================================================
// selectPendingTasksForSlot TESTS
// ============================================================================

describe('selectPendingTasksForSlot', () => {
  it('only returns pending status', () => {
    const pending = createTestTask({ id: 't1', dayKey: 1, slot: 0, status: 'pending' });
    const resolved = createTestTask({ id: 't2', dayKey: 1, slot: 0, status: 'resolved' });
    const cancelled = createTestTask({ id: 't3', dayKey: 1, slot: 0, status: 'cancelled' });
    const inProgress = createTestTask({ id: 't4', dayKey: 1, slot: 0, status: 'in_progress' });

    const state = createTestState([pending, resolved, cancelled, inProgress]);

    const result = selectPendingTasksForSlot(state, 1, 0);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
    expect(result[0].status).toBe('pending');
  });
});

// ============================================================================
// selectResolvedTasksForSlot TESTS
// ============================================================================

describe('selectResolvedTasksForSlot', () => {
  it('only returns resolved status', () => {
    const pending = createTestTask({ id: 't1', dayKey: 1, slot: 0, status: 'pending' });
    const resolved = createTestTask({ id: 't2', dayKey: 1, slot: 0, status: 'resolved' });
    const cancelled = createTestTask({ id: 't3', dayKey: 1, slot: 0, status: 'cancelled' });

    const state = createTestState([pending, resolved, cancelled]);

    const result = selectResolvedTasksForSlot(state, 1, 0);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
    expect(result[0].status).toBe('resolved');
  });
});

// ============================================================================
// selectCancelledTasksForSlot TESTS
// ============================================================================

describe('selectCancelledTasksForSlot', () => {
  it('only returns cancelled status', () => {
    const pending = createTestTask({ id: 't1', dayKey: 1, slot: 0, status: 'pending' });
    const resolved = createTestTask({ id: 't2', dayKey: 1, slot: 0, status: 'resolved' });
    const cancelled = createTestTask({ id: 't3', dayKey: 1, slot: 0, status: 'cancelled' });

    const state = createTestState([pending, resolved, cancelled]);

    const result = selectCancelledTasksForSlot(state, 1, 0);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t3');
    expect(result[0].status).toBe('cancelled');
  });
});

// ============================================================================
// selectTasksByActivityType TESTS
// ============================================================================

describe('selectTasksByActivityType', () => {
  it('filters by activity type', () => {
    const fishing1 = createTestTask({ id: 't1', activityType: 'fishing' });
    const foraging = createTestTask({
      id: 't2',
      activityType: 'foraging',
      activityData: {
        type: 'foraging',
        biomeId: 'forest',
        nodeId: 'node-1',
        tableId: 'table-1',
        toolIds: [],
        skillModifier: 0,
      },
    });
    const fishing2 = createTestTask({ id: 't3', activityType: 'fishing' });

    const state = createTestState([fishing1, foraging, fishing2]);

    const result = selectTasksByActivityType(state, 'fishing');

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('returns empty array when no matches', () => {
    const fishing = createTestTask({ activityType: 'fishing' });
    const state = createTestState([fishing]);

    const result = selectTasksByActivityType(state, 'alchemy');

    expect(result).toEqual([]);
  });
});

// ============================================================================
// selectTasksByLeader TESTS
// ============================================================================

describe('selectTasksByLeader', () => {
  it('filters by leader ID', () => {
    const task1 = createTestTask({ id: 't1', leaderId: 'alice' });
    const task2 = createTestTask({ id: 't2', leaderId: 'bob' });
    const task3 = createTestTask({ id: 't3', leaderId: 'alice' });

    const state = createTestState([task1, task2, task3]);

    const result = selectTasksByLeader(state, 'alice');

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('returns empty array when no matches', () => {
    const task = createTestTask({ leaderId: 'alice' });
    const state = createTestState([task]);

    const result = selectTasksByLeader(state, 'charlie');

    expect(result).toEqual([]);
  });
});

// ============================================================================
// selectTasksByHelper TESTS
// ============================================================================

describe('selectTasksByHelper', () => {
  it('filters by helper ID', () => {
    const task1 = createTestTask({ id: 't1', helperIds: ['helper-1', 'helper-2'] });
    const task2 = createTestTask({ id: 't2', helperIds: ['helper-3'] });
    const task3 = createTestTask({ id: 't3', helperIds: ['helper-1'] });

    const state = createTestState([task1, task2, task3]);

    const result = selectTasksByHelper(state, 'helper-1');

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t1', 't3']);
  });
});

// ============================================================================
// selectTasksByCharacter TESTS
// ============================================================================

describe('selectTasksByCharacter', () => {
  it('finds tasks where character is leader', () => {
    const task1 = createTestTask({ id: 't1', leaderId: 'alice', helperIds: [] });
    const task2 = createTestTask({ id: 't2', leaderId: 'bob', helperIds: [] });

    const state = createTestState([task1, task2]);

    const result = selectTasksByCharacter(state, 'alice');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('finds tasks where character is helper', () => {
    const task1 = createTestTask({ id: 't1', leaderId: 'bob', helperIds: ['alice'] });
    const task2 = createTestTask({ id: 't2', leaderId: 'bob', helperIds: [] });

    const state = createTestState([task1, task2]);

    const result = selectTasksByCharacter(state, 'alice');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('finds tasks where character is both leader and helper elsewhere', () => {
    const task1 = createTestTask({ id: 't1', leaderId: 'alice', helperIds: [] });
    const task2 = createTestTask({ id: 't2', leaderId: 'bob', helperIds: ['alice'] });
    const task3 = createTestTask({ id: 't3', leaderId: 'charlie', helperIds: [] });

    const state = createTestState([task1, task2, task3]);

    const result = selectTasksByCharacter(state, 'alice');

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t1', 't2']);
  });
});

// ============================================================================
// selectTasksByStatus TESTS
// ============================================================================

describe('selectTasksByStatus', () => {
  it('filters by status', () => {
    const pending1 = createTestTask({ id: 't1', status: 'pending' });
    const resolved = createTestTask({ id: 't2', status: 'resolved' });
    const pending2 = createTestTask({ id: 't3', status: 'pending' });

    const state = createTestState([pending1, resolved, pending2]);

    const result = selectTasksByStatus(state, 'pending');

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t1', 't3']);
  });
});

// ============================================================================
// selectTasksForDay TESTS
// ============================================================================

describe('selectTasksForDay', () => {
  it('filters by dayKey', () => {
    const day1task1 = createTestTask({ id: 't1', dayKey: 1 });
    const day2task = createTestTask({ id: 't2', dayKey: 2 });
    const day1task2 = createTestTask({ id: 't3', dayKey: 1 });

    const state = createTestState([day1task1, day2task, day1task2]);

    const result = selectTasksForDay(state, 1);

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t1', 't3']);
  });
});

// ============================================================================
// selectTaskCount TESTS
// ============================================================================

describe('selectTaskCount', () => {
  it('returns 0 for empty state', () => {
    expect(selectTaskCount(downtimeInitialState)).toBe(0);
  });

  it('returns correct count', () => {
    const state = createTestState([
      createTestTask({ id: 't1' }),
      createTestTask({ id: 't2' }),
      createTestTask({ id: 't3' }),
    ]);

    expect(selectTaskCount(state)).toBe(3);
  });
});

// ============================================================================
// selectSlotHasUnresolvedTasks TESTS
// ============================================================================

describe('selectSlotHasUnresolvedTasks', () => {
  it('returns true if slot has pending tasks', () => {
    const pending = createTestTask({ dayKey: 1, slot: 0, status: 'pending' });
    const state = createTestState([pending]);

    expect(selectSlotHasUnresolvedTasks(state, 1, 0)).toBe(true);
  });

  it('returns true if slot has in_progress tasks', () => {
    const inProgress = createTestTask({ dayKey: 1, slot: 0, status: 'in_progress' });
    const state = createTestState([inProgress]);

    expect(selectSlotHasUnresolvedTasks(state, 1, 0)).toBe(true);
  });

  it('returns false if slot only has resolved tasks', () => {
    const resolved = createTestTask({ dayKey: 1, slot: 0, status: 'resolved' });
    const state = createTestState([resolved]);

    expect(selectSlotHasUnresolvedTasks(state, 1, 0)).toBe(false);
  });

  it('returns false if slot only has cancelled tasks', () => {
    const cancelled = createTestTask({ dayKey: 1, slot: 0, status: 'cancelled' });
    const state = createTestState([cancelled]);

    expect(selectSlotHasUnresolvedTasks(state, 1, 0)).toBe(false);
  });

  it('returns false for empty slot', () => {
    expect(selectSlotHasUnresolvedTasks(downtimeInitialState, 1, 0)).toBe(false);
  });
});
