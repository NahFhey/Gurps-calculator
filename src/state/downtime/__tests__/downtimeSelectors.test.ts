import { describe, expect, it } from 'vitest';
import type {
  DowntimeState,
  DowntimeTask,
  DowntimeActivityType,
  FishingData,
  RestData,
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
  // Assignment selectors
  selectCharacterAssignmentForSlot,
  selectAssignedCharacterIdsForSlot,
  selectAvailableCharacterIdsForSlot,
  // Lock selectors
  generateTaskLockKey,
  selectExistingLockKeysForSlot,
  canCreateTaskForTarget,
  getTargetKeyFromActivityData,
  // Tool selectors
  selectReservedToolIdsForSlot,
  canUseTools,
  // Fatigue selectors
  selectCharacterFatigueStatus,
  selectCharacterFatigueMap,
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

// ============================================================================
// selectCharacterAssignmentForSlot TESTS
// ============================================================================

describe('selectCharacterAssignmentForSlot', () => {
  it('returns leader role correctly', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      helperIds: ['bob'],
      status: 'pending',
    });
    const state = createTestState([task]);

    const result = selectCharacterAssignmentForSlot(state, 'alice', 1, 0);

    expect(result).toEqual({ taskId: 't1', role: 'leader' });
  });

  it('returns helper role correctly', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      helperIds: ['bob', 'charlie'],
      status: 'pending',
    });
    const state = createTestState([task]);

    const result = selectCharacterAssignmentForSlot(state, 'bob', 1, 0);

    expect(result).toEqual({ taskId: 't1', role: 'helper' });
  });

  it('returns null when not assigned', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      helperIds: ['bob'],
      status: 'pending',
    });
    const state = createTestState([task]);

    const result = selectCharacterAssignmentForSlot(state, 'charlie', 1, 0);

    expect(result).toBeNull();
  });

  it('ignores cancelled tasks', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      helperIds: [],
      status: 'cancelled',
    });
    const state = createTestState([task]);

    const result = selectCharacterAssignmentForSlot(state, 'alice', 1, 0);

    expect(result).toBeNull();
  });
});

// ============================================================================
// selectAssignedCharacterIdsForSlot TESTS
// ============================================================================

describe('selectAssignedCharacterIdsForSlot', () => {
  it('includes both leaders and helpers', () => {
    const task1 = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      helperIds: ['bob'],
      status: 'pending',
    });
    const task2 = createTestTask({
      id: 't2',
      dayKey: 1,
      slot: 0,
      leaderId: 'charlie',
      helperIds: ['diana'],
      status: 'in_progress',
    });
    const state = createTestState([task1, task2]);

    const result = selectAssignedCharacterIdsForSlot(state, 1, 0);

    expect(result).toEqual(new Set(['alice', 'bob', 'charlie', 'diana']));
  });

  it('excludes characters from cancelled tasks', () => {
    const active = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      helperIds: [],
      status: 'pending',
    });
    const cancelled = createTestTask({
      id: 't2',
      dayKey: 1,
      slot: 0,
      leaderId: 'bob',
      helperIds: ['charlie'],
      status: 'cancelled',
    });
    const state = createTestState([active, cancelled]);

    const result = selectAssignedCharacterIdsForSlot(state, 1, 0);

    expect(result).toEqual(new Set(['alice']));
    expect(result.has('bob')).toBe(false);
    expect(result.has('charlie')).toBe(false);
  });

  it('returns empty set for empty slot', () => {
    const result = selectAssignedCharacterIdsForSlot(downtimeInitialState, 1, 0);
    expect(result.size).toBe(0);
  });
});

// ============================================================================
// selectAvailableCharacterIdsForSlot TESTS
// ============================================================================

describe('selectAvailableCharacterIdsForSlot', () => {
  it('excludes assigned characters', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      helperIds: ['bob'],
      status: 'pending',
    });
    const state = createTestState([task]);
    const allCharacters = ['alice', 'bob', 'charlie', 'diana'];

    const result = selectAvailableCharacterIdsForSlot(state, 1, 0, allCharacters);

    expect(result).toEqual(['charlie', 'diana']);
  });

  it('returns all characters when none assigned', () => {
    const allCharacters = ['alice', 'bob', 'charlie'];

    const result = selectAvailableCharacterIdsForSlot(
      downtimeInitialState,
      1,
      0,
      allCharacters
    );

    expect(result).toEqual(['alice', 'bob', 'charlie']);
  });
});

// ============================================================================
// generateTaskLockKey TESTS
// ============================================================================

describe('generateTaskLockKey', () => {
  it('produces correct format', () => {
    const result = generateTaskLockKey('fishing', 'char-1', 1, 0, 'species:trout');

    expect(result).toBe('fishing|char-1|1|0|species:trout');
  });

  it('handles different activity types', () => {
    const fishing = generateTaskLockKey('fishing', 'c1', 1, 0, 'species:salmon');
    const alchemy = generateTaskLockKey('alchemy', 'c1', 1, 0, 'recipe:potion');

    expect(fishing).toBe('fishing|c1|1|0|species:salmon');
    expect(alchemy).toBe('alchemy|c1|1|0|recipe:potion');
  });
});

// ============================================================================
// getTargetKeyFromActivityData TESTS
// ============================================================================

describe('getTargetKeyFromActivityData', () => {
  it('extracts fishing target key', () => {
    const activityData = {
      type: 'fishing' as const,
      speciesId: 'trout',
      spotId: 'river',
      toolIds: [],
      skillModifier: 0,
      targetYield: 1,
    };

    const result = getTargetKeyFromActivityData('fishing', activityData);

    expect(result).toBe('species:trout');
  });

  it('extracts foraging target key', () => {
    const activityData = {
      type: 'foraging' as const,
      biomeId: 'forest',
      nodeId: 'berry-bush',
      tableId: 'table-1',
      toolIds: [],
      skillModifier: 0,
    };

    const result = getTargetKeyFromActivityData('foraging', activityData);

    expect(result).toBe('node:berry-bush');
  });

  it('extracts alchemy target key', () => {
    const activityData = {
      type: 'alchemy' as const,
      recipeId: 'healing-potion',
      formulaId: 'f1',
      reagentIds: [],
      toolIds: [],
      batchSize: 1,
      aspectModifiers: {},
    };

    const result = getTargetKeyFromActivityData('alchemy', activityData);

    expect(result).toBe('recipe:healing-potion');
  });

  it('extracts crafting target key', () => {
    const activityData = {
      type: 'crafting' as const,
      projectId: 'sword-project',
      recipeId: 'r1',
      materialIds: [],
      toolIds: [],
      phase: 'craft' as const,
      progressCurrent: 0,
      progressRequired: 10,
    };

    const result = getTargetKeyFromActivityData('crafting', activityData);

    expect(result).toBe('project:sword-project');
  });

  it('extracts rest target key', () => {
    const activityData = {
      type: 'rest' as const,
      restType: 'sleep' as const,
      recoveryBonus: 0,
    };

    const result = getTargetKeyFromActivityData('rest', activityData);

    expect(result).toBe('rest:sleep');
  });
});

// ============================================================================
// selectExistingLockKeysForSlot TESTS
// ============================================================================

describe('selectExistingLockKeysForSlot', () => {
  it('includes pending tasks', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      status: 'pending',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: [],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    const result = selectExistingLockKeysForSlot(state, 1, 0);

    expect(result.has('fishing|alice|1|0|species:trout')).toBe(true);
  });

  it('includes resolved tasks', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      status: 'resolved',
      activityData: {
        type: 'fishing',
        speciesId: 'salmon',
        spotId: 'river',
        toolIds: [],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    const result = selectExistingLockKeysForSlot(state, 1, 0);

    expect(result.has('fishing|alice|1|0|species:salmon')).toBe(true);
  });

  it('includes CANCELLED tasks (critical!)', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      status: 'cancelled',
      activityData: {
        type: 'fishing',
        speciesId: 'bass',
        spotId: 'lake',
        toolIds: [],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    const result = selectExistingLockKeysForSlot(state, 1, 0);

    // CRITICAL: Cancelled tasks still hold their locks!
    expect(result.has('fishing|alice|1|0|species:bass')).toBe(true);
  });
});

// ============================================================================
// canCreateTaskForTarget TESTS
// ============================================================================

describe('canCreateTaskForTarget', () => {
  it('returns true when no conflict', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: [],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    // Different character, same target - allowed
    const result = canCreateTaskForTarget(
      state,
      'bob',
      'fishing',
      'species:trout',
      1,
      0
    );

    expect(result).toBe(true);
  });

  it('returns false when lock exists', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: [],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    // Same character, same activity, same target - blocked
    const result = canCreateTaskForTarget(
      state,
      'alice',
      'fishing',
      'species:trout',
      1,
      0
    );

    expect(result).toBe(false);
  });

  it('returns false when cancelled task holds lock', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      leaderId: 'alice',
      status: 'cancelled',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: [],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    // Even cancelled tasks block re-creation!
    const result = canCreateTaskForTarget(
      state,
      'alice',
      'fishing',
      'species:trout',
      1,
      0
    );

    expect(result).toBe(false);
  });
});

// ============================================================================
// selectReservedToolIdsForSlot TESTS
// ============================================================================

describe('selectReservedToolIdsForSlot', () => {
  it('includes tools from pending tasks', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      status: 'pending',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: ['rod-1', 'net-1'],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    const result = selectReservedToolIdsForSlot(state, 1, 0);

    expect(result).toEqual(new Set(['rod-1', 'net-1']));
  });

  it('includes tools from in_progress tasks', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      status: 'in_progress',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: ['rod-2'],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    const result = selectReservedToolIdsForSlot(state, 1, 0);

    expect(result).toEqual(new Set(['rod-2']));
  });

  it('EXCLUDES tools from cancelled tasks', () => {
    const cancelled = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      status: 'cancelled',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: ['rod-cancelled'],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const pending = createTestTask({
      id: 't2',
      dayKey: 1,
      slot: 0,
      status: 'pending',
      activityData: {
        type: 'fishing',
        speciesId: 'salmon',
        spotId: 'river',
        toolIds: ['rod-active'],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([cancelled, pending]);

    const result = selectReservedToolIdsForSlot(state, 1, 0);

    // Cancelled task's tools are freed!
    expect(result.has('rod-cancelled')).toBe(false);
    expect(result.has('rod-active')).toBe(true);
  });

  it('EXCLUDES tools from resolved tasks', () => {
    const resolved = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      status: 'resolved',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: ['rod-done'],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([resolved]);

    const result = selectReservedToolIdsForSlot(state, 1, 0);

    expect(result.has('rod-done')).toBe(false);
  });

  it('returns empty set for empty slot', () => {
    const result = selectReservedToolIdsForSlot(downtimeInitialState, 1, 0);
    expect(result.size).toBe(0);
  });
});

// ============================================================================
// canUseTools TESTS
// ============================================================================

describe('canUseTools', () => {
  it('returns true when all tools available', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      status: 'pending',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: ['rod-1'],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    // Different tools - available
    const result = canUseTools(state, ['rod-2', 'net-1'], 1, 0);

    expect(result).toBe(true);
  });

  it('returns false when any tool reserved', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      status: 'pending',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: ['rod-1', 'net-1'],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    // One tool conflicts
    const result = canUseTools(state, ['rod-2', 'rod-1'], 1, 0);

    expect(result).toBe(false);
  });

  it('returns true for empty tool list', () => {
    const task = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      status: 'pending',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: ['rod-1'],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([task]);

    const result = canUseTools(state, [], 1, 0);

    expect(result).toBe(true);
  });

  it('returns true when tools freed by cancelled task', () => {
    const cancelled = createTestTask({
      id: 't1',
      dayKey: 1,
      slot: 0,
      status: 'cancelled',
      activityData: {
        type: 'fishing',
        speciesId: 'trout',
        spotId: 'river',
        toolIds: ['rod-freed'],
        skillModifier: 0,
        targetYield: 1,
      },
    });
    const state = createTestState([cancelled]);

    // Tool was freed by cancellation
    const result = canUseTools(state, ['rod-freed'], 1, 0);

    expect(result).toBe(true);
  });
});

// ============================================================================
// FATIGUE TEST FACTORIES
// ============================================================================

/**
 * Options for creating fatigue test tasks.
 */
interface FatigueTaskOptions {
  leaderId: string;
  helperIds?: string[];
  dayKey: number;
  slot: number;
  activityType: DowntimeActivityType;
}

/**
 * Creates a resolved task for fatigue testing.
 */
function createResolvedTask(options: FatigueTaskOptions): DowntimeTask {
  const {
    leaderId,
    helperIds = [],
    dayKey,
    slot,
    activityType,
  } = options;
  const now = Date.now();

  const activityData =
    activityType === 'rest'
      ? ({
          type: 'rest',
          restType: 'sleep',
          recoveryBonus: 0,
        } as RestData)
      : ({
          type: 'fishing',
          speciesId: 'species-1',
          spotId: 'spot-1',
          toolIds: [],
          skillModifier: 0,
          targetYield: 1,
        } as FishingData);

  return {
    id: `resolved-${++idCounter}`,
    activityType,
    dayKey,
    slot,
    leaderId,
    helperIds,
    status: 'resolved',
    activityData,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates a pending task for fatigue testing.
 */
function createPendingTask(options: FatigueTaskOptions): DowntimeTask {
  const {
    leaderId,
    helperIds = [],
    dayKey,
    slot,
    activityType,
  } = options;
  const now = Date.now();

  const activityData =
    activityType === 'rest'
      ? ({
          type: 'rest',
          restType: 'sleep',
          recoveryBonus: 0,
        } as RestData)
      : ({
          type: 'fishing',
          speciesId: 'species-1',
          spotId: 'spot-1',
          toolIds: [],
          skillModifier: 0,
          targetYield: 1,
        } as FishingData);

  return {
    id: `pending-${++idCounter}`,
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
}

/**
 * Creates a cancelled task for fatigue testing.
 */
function createCancelledTask(options: FatigueTaskOptions): DowntimeTask {
  const {
    leaderId,
    helperIds = [],
    dayKey,
    slot,
    activityType,
  } = options;
  const now = Date.now();

  const activityData =
    activityType === 'rest'
      ? ({
          type: 'rest',
          restType: 'sleep',
          recoveryBonus: 0,
        } as RestData)
      : ({
          type: 'fishing',
          speciesId: 'species-1',
          spotId: 'spot-1',
          toolIds: [],
          skillModifier: 0,
          targetYield: 1,
        } as FishingData);

  return {
    id: `cancelled-${++idCounter}`,
    activityType,
    dayKey,
    slot,
    leaderId,
    helperIds,
    status: 'cancelled',
    activityData,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// FATIGUE DERIVATION TESTS
// ============================================================================

describe('Fatigue derivation', () => {
  describe('selectCharacterFatigueStatus', () => {
    it('returns rested when character has no tasks', () => {
      const state = createTestState([]);
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 0)).toBe('rested');
    });

    it('returns tired after working one slot', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
      ]);
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 1)).toBe('tired');
    });

    it('returns rested after working then resting', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
        // No task in slot 1 = implicit rest
      ]);
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 2)).toBe('rested');
    });

    it('returns exhausted when working while tired', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 1,
          activityType: 'fishing',
        }),
      ]);
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 2)).toBe(
        'exhausted'
      );
    });

    it('explicit rest task clears tired status', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 1,
          activityType: 'rest',
        }),
      ]);
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 2)).toBe('rested');
    });

    it('helper also gets tired from work', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          helperIds: ['char2'],
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
      ]);
      expect(selectCharacterFatigueStatus(state, 'char2', 1, 1)).toBe('tired');
    });

    it('pending tasks do not affect fatigue', () => {
      const state = createTestState([
        createPendingTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
      ]);
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 1)).toBe('rested');
    });

    it('cancelled tasks do not affect fatigue', () => {
      const state = createTestState([
        createCancelledTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
      ]);
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 1)).toBe('rested');
    });

    it('can recover from exhaustion after resting', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 1,
          activityType: 'fishing',
        }),
        // slot 2 = implicit rest (no task)
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 3,
          activityType: 'fishing',
        }),
      ]);
      // At slot 2, they were exhausted
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 2)).toBe(
        'exhausted'
      );
      // At slot 3, after resting in slot 2, they should be rested
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 3)).toBe('rested');
      // At slot 4, after working in slot 3, they should be tired
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 4)).toBe('tired');
    });

    it('only considers resolved tasks for the specified day', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 2,
          slot: 0,
          activityType: 'fishing',
        }),
      ]);
      // Day 1, slot 1: should be tired from day 1 work
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 1)).toBe('tired');
      // Day 2, slot 0: should be rested (no work on day 2 before slot 0)
      expect(selectCharacterFatigueStatus(state, 'char1', 2, 0)).toBe('rested');
      // Day 2, slot 1: should be tired from day 2 work
      expect(selectCharacterFatigueStatus(state, 'char1', 2, 1)).toBe('tired');
    });

    it('handles different activity types correctly', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'crafting',
        }),
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 1,
          activityType: 'alchemy',
        }),
      ]);
      // Both crafting and alchemy are work activities
      expect(selectCharacterFatigueStatus(state, 'char1', 1, 2)).toBe(
        'exhausted'
      );
    });
  });

  describe('selectCharacterFatigueMap', () => {
    it('returns map with all character IDs', () => {
      const state = createTestState([]);
      const map = selectCharacterFatigueMap(state, 1, 0, [
        'char1',
        'char2',
        'char3',
      ]);
      expect(map.size).toBe(3);
    });

    it('correctly identifies mixed fatigue states', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 1,
          activityType: 'fishing',
        }),
        createResolvedTask({
          leaderId: 'char2',
          dayKey: 1,
          slot: 0,
          activityType: 'crafting',
        }),
        createResolvedTask({
          leaderId: 'char2',
          dayKey: 1,
          slot: 1,
          activityType: 'crafting',
        }),
      ]);
      const map = selectCharacterFatigueMap(state, 1, 2, [
        'char1',
        'char2',
        'char3',
      ]);
      // char1: worked slot 0 & 1 → exhausted
      expect(map.get('char1')).toBe('exhausted');
      // char2: worked slot 0 & 1 → exhausted
      expect(map.get('char2')).toBe('exhausted');
      // char3: no work → rested
      expect(map.get('char3')).toBe('rested');
    });

    it('correctly identifies tired state at slot 1', () => {
      const state = createTestState([
        createResolvedTask({
          leaderId: 'char1',
          dayKey: 1,
          slot: 0,
          activityType: 'fishing',
        }),
      ]);
      const map = selectCharacterFatigueMap(state, 1, 1, ['char1', 'char2']);
      // char1: worked slot 0 → tired
      expect(map.get('char1')).toBe('tired');
      // char2: no work → rested
      expect(map.get('char2')).toBe('rested');
    });

    it('returns empty map for empty character list', () => {
      const state = createTestState([]);
      const map = selectCharacterFatigueMap(state, 1, 0, []);
      expect(map.size).toBe(0);
    });
  });
});
