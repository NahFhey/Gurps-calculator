import { describe, expect, it, beforeEach } from 'vitest';
import type {
  DowntimeState,
  DowntimeTask,
  FishingData,
  AlchemyData,
  CraftingData,
  RestData,
  TaskStatus,
} from '../../../types/downtime';
import { downtimeInitialState } from '../downtimeInitialState';
import { downtimeReducer } from '../downtimeReducer';
import { createTask, cancelTask, type CreateTaskPayload } from '../downtimeActions';
import {
  validateTaskCreation,
  validateLockOnCreate,
  validateToolExclusivity,
} from '../downtimeValidation';
import { DowntimeValidationError, DOWNTIME_ERROR_CODES } from '../downtimeErrors';

// ============================================================================
// TEST FACTORIES
// ============================================================================

let idCounter = 0;

/**
 * Creates fishing activity data for tests.
 */
function createFishingData(overrides?: Partial<FishingData>): FishingData {
  return {
    type: 'fishing',
    speciesId: 'species-trout',
    spotId: 'spot-river',
    toolIds: [],
    skillModifier: 0,
    targetYield: 5,
    ...overrides,
  };
}

/**
 * Creates alchemy activity data for tests.
 */
function createAlchemyData(overrides?: Partial<AlchemyData>): AlchemyData {
  return {
    type: 'alchemy',
    recipeId: 'recipe-healing-potion',
    formulaId: 'formula-basic',
    reagentIds: ['reagent-1'],
    batchSize: 1,
    toolIds: [],
    ...overrides,
  };
}

/**
 * Creates crafting activity data for tests.
 */
function createCraftingData(overrides?: Partial<CraftingData>): CraftingData {
  return {
    type: 'crafting',
    projectId: 'project-sword',
    recipeId: 'recipe-longsword',
    materialIds: ['material-1'],
    toolIds: [],
    phase: 'craft',
    progress: 0,
    ...overrides,
  };
}

/**
 * Creates rest activity data for tests.
 */
function createRestData(overrides?: Partial<RestData>): RestData {
  return {
    type: 'rest',
    restType: 'sleep',
    recoveryBonus: 0,
    ...overrides,
  };
}

/**
 * Creates a task payload for tests.
 */
function createTaskPayload(overrides?: Partial<CreateTaskPayload>): CreateTaskPayload {
  return {
    activityType: 'fishing',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    activityData: createFishingData(),
    ...overrides,
  };
}

interface TaskOptions {
  id?: string;
  leaderId?: string;
  helperIds?: string[];
  dayKey?: number;
  slot?: number;
  activityType?: 'fishing' | 'alchemy' | 'crafting' | 'rest';
  activityData?: FishingData | AlchemyData | CraftingData | RestData;
}

/**
 * Gets default activity data for a given activity type.
 */
function getDefaultActivityData(activityType: string) {
  switch (activityType) {
    case 'alchemy':
      return createAlchemyData();
    case 'crafting':
      return createCraftingData();
    case 'rest':
      return createRestData();
    default:
      return createFishingData();
  }
}

/**
 * Creates a pending task for tests.
 */
function createPendingTask(options: TaskOptions = {}): DowntimeTask {
  const id = options.id ?? `task-${++idCounter}`;
  const now = Date.now();
  const activityType = options.activityType ?? 'fishing';
  const activityData = options.activityData ?? getDefaultActivityData(activityType);

  return {
    id,
    activityType,
    dayKey: options.dayKey ?? 1,
    slot: options.slot ?? 0,
    leaderId: options.leaderId ?? 'char-1',
    helperIds: options.helperIds ?? [],
    status: 'pending',
    activityData,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates a cancelled task for tests.
 */
function createCancelledTask(options: TaskOptions = {}): DowntimeTask {
  return {
    ...createPendingTask(options),
    status: 'cancelled',
  };
}

/**
 * Creates an in_progress task for tests.
 */
function createInProgressTask(options: TaskOptions = {}): DowntimeTask {
  return {
    ...createPendingTask(options),
    status: 'in_progress',
  };
}

/**
 * Creates a task with a specific status for tests.
 */
function createTaskWithStatus(status: TaskStatus, options: TaskOptions = {}): DowntimeTask {
  return {
    ...createPendingTask(options),
    status,
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
// validateTaskCreation - SINGLE ASSIGNMENT TESTS
// ============================================================================

describe('validateTaskCreation - single assignment', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('allows task when leader is unassigned', () => {
    const state = createTestState([]);
    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
    }));

    expect(result.valid).toBe(true);
    expect(result.code).toBeUndefined();
    expect(result.message).toBeUndefined();
  });

  it('rejects when leader is already a leader', () => {
    const state = createTestState([
      createPendingTask({ leaderId: 'char-1', dayKey: 1, slot: 0 }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
    }));

    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED);
    expect(result.message).toContain('char-1');
    expect(result.meta?.existingRole).toBe('leader');
  });

  it('rejects when leader is already a helper', () => {
    const state = createTestState([
      createPendingTask({ leaderId: 'other-char', helperIds: ['char-1'], dayKey: 1, slot: 0 }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
    }));

    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED);
    expect(result.message).toContain('char-1');
    expect(result.meta?.existingRole).toBe('helper');
  });

  it('rejects when any helper is already assigned as leader', () => {
    const state = createTestState([
      createPendingTask({ leaderId: 'char-2', dayKey: 1, slot: 0 }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: ['char-2', 'char-3'],
    }));

    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.HELPER_ALREADY_ASSIGNED);
    expect(result.meta?.characterId).toBe('char-2');
    expect(result.meta?.existingRole).toBe('leader');
  });

  it('rejects when any helper is already assigned as helper', () => {
    const state = createTestState([
      createPendingTask({ leaderId: 'other-char', helperIds: ['char-3'], dayKey: 1, slot: 0 }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: ['char-2', 'char-3'],
    }));

    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.HELPER_ALREADY_ASSIGNED);
    expect(result.meta?.characterId).toBe('char-3');
    expect(result.meta?.existingRole).toBe('helper');
  });

  it('allows same character in different slots', () => {
    const state = createTestState([
      createPendingTask({ leaderId: 'char-1', dayKey: 1, slot: 0 }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 1, // Different slot
      leaderId: 'char-1',
      helperIds: [],
    }));

    expect(result.valid).toBe(true);
  });

  it('allows same character on different days', () => {
    const state = createTestState([
      createPendingTask({ leaderId: 'char-1', dayKey: 1, slot: 0 }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 2, // Different day
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
    }));

    expect(result.valid).toBe(true);
  });

  it('allows task when only cancelled tasks exist in slot (different target)', () => {
    const state = createTestState([
      createCancelledTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityData: createFishingData({ speciesId: 'trout' }),
      }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1', // Same as cancelled task
      helperIds: [],
      activityData: createFishingData({ speciesId: 'salmon' }), // Different target to avoid lock
    }));

    // Cancelled tasks don't count as assigned (but locks still apply, hence different target)
    expect(result.valid).toBe(true);
  });

  it('allows task with multiple helpers when all are unassigned', () => {
    const state = createTestState([]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: ['char-2', 'char-3', 'char-4'],
    }));

    expect(result.valid).toBe(true);
  });

  it('validates first conflicting helper only (fails fast)', () => {
    const state = createTestState([
      createPendingTask({ id: 'task-a', leaderId: 'char-2', dayKey: 1, slot: 0 }),
      createPendingTask({ id: 'task-b', leaderId: 'char-3', dayKey: 1, slot: 0 }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: ['char-2', 'char-3'], // Both assigned, but should fail on first
    }));

    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.HELPER_ALREADY_ASSIGNED);
    expect(result.meta?.characterId).toBe('char-2');
  });
});

// ============================================================================
// downtimeReducer - ASSIGNMENT VALIDATION TESTS
// ============================================================================

describe('downtimeReducer - assignment validation', () => {
  let initialState: DowntimeState;

  beforeEach(() => {
    idCounter = 0;
    initialState = downtimeInitialState;
  });

  it('creates task when validation passes', () => {
    const payload = createTaskPayload({
      leaderId: 'char-1',
      dayKey: 1,
      slot: 0,
    });

    const nextState = downtimeReducer(initialState, createTask(payload));

    expect(Object.keys(nextState.tasksById)).toHaveLength(1);
  });

  it('throws DowntimeValidationError when leader already assigned', () => {
    // Create first task
    const state1 = downtimeReducer(initialState, createTask(createTaskPayload({
      leaderId: 'char-1',
      dayKey: 1,
      slot: 0,
    })));

    // Try to create second task with same leader in same slot
    expect(() => {
      downtimeReducer(state1, createTask(createTaskPayload({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
      })));
    }).toThrow(DowntimeValidationError);
  });

  it('throws DowntimeValidationError when helper already assigned', () => {
    // Create first task with char-2 as leader
    const state1 = downtimeReducer(initialState, createTask(createTaskPayload({
      leaderId: 'char-2',
      dayKey: 1,
      slot: 0,
    })));

    // Try to create second task with char-2 as helper
    expect(() => {
      downtimeReducer(state1, createTask(createTaskPayload({
        leaderId: 'char-1',
        helperIds: ['char-2'],
        dayKey: 1,
        slot: 0,
      })));
    }).toThrow(DowntimeValidationError);
  });

  it('error contains correct code and metadata', () => {
    // Create first task
    const state1 = downtimeReducer(initialState, createTask(createTaskPayload({
      leaderId: 'char-1',
      dayKey: 1,
      slot: 0,
    })));

    try {
      downtimeReducer(state1, createTask(createTaskPayload({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
      })));
      // Should not reach here
      expect.fail('Expected DowntimeValidationError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DowntimeValidationError);
      if (error instanceof DowntimeValidationError) {
        expect(error.code).toBe(DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED);
        expect(error.meta?.existingRole).toBe('leader');
        expect(error.meta?.existingTaskId).toBeDefined();
      }
    }
  });

  it('allows task in different slot despite same character', () => {
    // Create first task
    const state1 = downtimeReducer(initialState, createTask(createTaskPayload({
      leaderId: 'char-1',
      dayKey: 1,
      slot: 0,
    })));

    // Create second task with same leader but different slot
    const state2 = downtimeReducer(state1, createTask(createTaskPayload({
      leaderId: 'char-1',
      dayKey: 1,
      slot: 1,
    })));

    expect(Object.keys(state2.tasksById)).toHaveLength(2);
  });

  it('allows task on different day despite same character and slot', () => {
    // Create first task
    const state1 = downtimeReducer(initialState, createTask(createTaskPayload({
      leaderId: 'char-1',
      dayKey: 1,
      slot: 0,
    })));

    // Create second task with same leader but different day
    const state2 = downtimeReducer(state1, createTask(createTaskPayload({
      leaderId: 'char-1',
      dayKey: 2,
      slot: 0,
    })));

    expect(Object.keys(state2.tasksById)).toHaveLength(2);
  });

  it('does not mutate state when validation fails', () => {
    // Create first task
    const state1 = downtimeReducer(initialState, createTask(createTaskPayload({
      leaderId: 'char-1',
      dayKey: 1,
      slot: 0,
    })));

    const originalTaskCount = Object.keys(state1.tasksById).length;
    const originalTaskOrder = [...state1.taskOrder];

    // Try to create invalid task
    try {
      downtimeReducer(state1, createTask(createTaskPayload({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
      })));
    } catch {
      // Expected
    }

    // State should be unchanged
    expect(Object.keys(state1.tasksById)).toHaveLength(originalTaskCount);
    expect(state1.taskOrder).toEqual(originalTaskOrder);
  });
});

// ============================================================================
// DowntimeValidationError - CLASS TESTS
// ============================================================================

describe('DowntimeValidationError', () => {
  it('constructs with validation result', () => {
    const result = {
      valid: false,
      code: 'TEST_CODE',
      message: 'Test error message',
      meta: { foo: 'bar' },
    };

    const error = new DowntimeValidationError(result);

    expect(error.name).toBe('DowntimeValidationError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('Test error message');
    expect(error.meta).toEqual({ foo: 'bar' });
  });

  it('uses default message when not provided', () => {
    const result = {
      valid: false,
      code: 'TEST_CODE',
    };

    const error = new DowntimeValidationError(result);

    expect(error.message).toBe('Downtime validation failed');
  });

  it('uses UNKNOWN_ERROR code when not provided', () => {
    const result = {
      valid: false,
      message: 'Some error',
    };

    const error = new DowntimeValidationError(result);

    expect(error.code).toBe(DOWNTIME_ERROR_CODES.UNKNOWN_ERROR);
  });

  it('is instanceof Error', () => {
    const error = new DowntimeValidationError({ valid: false });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DowntimeValidationError);
  });
});

// ============================================================================
// validateLockOnCreate - LOCK VALIDATION TESTS
// ============================================================================

describe('validateLockOnCreate', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('allows first task for a target', () => {
    const state = createTestState([]);
    const result = validateLockOnCreate(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }),
    }));

    expect(result.valid).toBe(true);
  });

  it('blocks second task for same target by same character (pending)', () => {
    const existingTask = createPendingTask({
      leaderId: 'char-1',
      dayKey: 1,
      slot: 0,
      activityType: 'fishing',
      activityData: createFishingData({ speciesId: 'trout' }),
    });
    const state = createTestState([existingTask]);

    const result = validateLockOnCreate(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }),
    }));

    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.LOCK_CONFLICT);
  });

  it('blocks task for same target after cancellation (lock persists)', () => {
    // Create a pending task then cancel it via reducer
    const initialState = downtimeInitialState;
    const state1 = downtimeReducer(initialState, createTask(createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }),
    })));

    // Get the created task ID
    const taskId = state1.taskOrder[0];

    // Cancel the task
    const stateWithCancel = downtimeReducer(state1, cancelTask(taskId));

    // Verify task is cancelled
    expect(stateWithCancel.tasksById[taskId].status).toBe('cancelled');

    // Try to create another task for same target - should fail due to lock
    const result = validateLockOnCreate(stateWithCancel, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }),
    }));

    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.LOCK_CONFLICT);
  });

  it('allows different character to target same thing', () => {
    const state = createTestState([
      createPendingTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ speciesId: 'trout' }),
      }),
    ]);

    const result = validateLockOnCreate(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-2', // Different character
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }),
    }));

    expect(result.valid).toBe(true);
  });

  it('allows same character to target different thing', () => {
    const state = createTestState([
      createCancelledTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ speciesId: 'trout' }),
      }),
    ]);

    const result = validateLockOnCreate(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ speciesId: 'salmon' }), // Different target
    }));

    expect(result.valid).toBe(true);
  });

  it('allows same target in different slot', () => {
    const state = createTestState([
      createCancelledTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ speciesId: 'trout' }),
      }),
    ]);

    const result = validateLockOnCreate(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 1, // Different slot
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }),
    }));

    expect(result.valid).toBe(true);
  });

  it('allows same target on different day', () => {
    const state = createTestState([
      createCancelledTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ speciesId: 'trout' }),
      }),
    ]);

    const result = validateLockOnCreate(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 2, // Different day
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }),
    }));

    expect(result.valid).toBe(true);
  });

  it('lock persists through all task statuses', () => {
    const statuses: TaskStatus[] = ['pending', 'in_progress', 'resolved', 'cancelled'];

    for (const status of statuses) {
      const state = createTestState([
        createTaskWithStatus(status, {
          leaderId: 'char-1',
          dayKey: 1,
          slot: 0,
          activityType: 'alchemy',
          activityData: createAlchemyData({ recipeId: 'potion1' }),
        }),
      ]);

      const result = validateLockOnCreate(state, createTaskPayload({
        activityType: 'alchemy',
        dayKey: 1,
        slot: 0,
        leaderId: 'char-1',
        helperIds: [],
        activityData: createAlchemyData({ recipeId: 'potion1' }),
      }));

      expect(result.valid).toBe(false);
      expect(result.code).toBe(DOWNTIME_ERROR_CODES.LOCK_CONFLICT);
    }
  });

  it('includes metadata in lock conflict error', () => {
    const state = createTestState([
      createPendingTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ speciesId: 'trout' }),
      }),
    ]);

    const result = validateLockOnCreate(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }),
    }));

    expect(result.valid).toBe(false);
    expect(result.meta?.activityType).toBe('fishing');
    expect(result.meta?.targetKey).toBe('species:trout');
    expect(result.meta?.characterId).toBe('char-1');
    expect(result.meta?.dayKey).toBe(1);
    expect(result.meta?.slot).toBe(0);
  });
});

// ============================================================================
// validateTaskCreation - COMBINED VALIDATION TESTS
// ============================================================================

describe('validateTaskCreation - combined validation', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('runs assignment check before lock check', () => {
    // Create a state where both assignment AND lock would fail
    // The assignment check should fail first
    const state = createTestState([
      createPendingTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ speciesId: 'trout' }),
      }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1', // Same leader - assignment conflict
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }), // Same target - lock conflict
    }));

    // Should fail on assignment first, not lock
    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED);
  });

  it('checks lock when assignment passes', () => {
    // cancelled task - assignment passes (cancelled doesn't block assignment)
    // but lock still fails (lock persists through cancellation)
    const state = createTestState([
      createCancelledTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ speciesId: 'trout' }),
      }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ speciesId: 'trout' }),
    }));

    // Assignment passes (cancelled), but lock fails
    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.LOCK_CONFLICT);
  });
});

// ============================================================================
// downtimeReducer - LOCK VALIDATION TESTS
// ============================================================================

describe('downtimeReducer - lock validation', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('throws DowntimeValidationError on lock conflict after cancellation', () => {
    // Create task
    const state1 = downtimeReducer(downtimeInitialState, createTask(createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      activityData: createFishingData({ speciesId: 'trout' }),
    })));

    // Cancel it
    const taskId = state1.taskOrder[0];
    const state2 = downtimeReducer(state1, cancelTask(taskId));

    // Try to recreate same task - should throw
    expect(() => {
      downtimeReducer(state2, createTask(createTaskPayload({
        activityType: 'fishing',
        dayKey: 1,
        slot: 0,
        leaderId: 'char-1',
        activityData: createFishingData({ speciesId: 'trout' }),
      })));
    }).toThrow(DowntimeValidationError);
  });

  it('allows different target after cancellation', () => {
    // Create task
    const state1 = downtimeReducer(downtimeInitialState, createTask(createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      activityData: createFishingData({ speciesId: 'trout' }),
    })));

    // Cancel it
    const taskId = state1.taskOrder[0];
    const state2 = downtimeReducer(state1, cancelTask(taskId));

    // Create different target - should succeed
    const state3 = downtimeReducer(state2, createTask(createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      activityData: createFishingData({ speciesId: 'salmon' }), // Different target
    })));

    expect(Object.keys(state3.tasksById)).toHaveLength(2);
  });
});

// ============================================================================
// validateToolExclusivity - TOOL VALIDATION TESTS
// ============================================================================

describe('validateToolExclusivity', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('allows task when all tools are available', () => {
    const state = createTestState([]);
    const result = validateToolExclusivity(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ toolIds: ['rod-1', 'net-1'] }),
    }));

    expect(result.valid).toBe(true);
  });

  it('blocks task when tool is reserved by pending task', () => {
    const state = createTestState([
      createPendingTask({
        leaderId: 'char-2',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ toolIds: ['rod-1'], speciesId: 'bass' }),
      }),
    ]);

    const result = validateToolExclusivity(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ toolIds: ['rod-1'], speciesId: 'trout' }), // Same tool
    }));

    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.TOOL_CONFLICT);
    expect(result.meta?.conflictingToolIds).toContain('rod-1');
  });

  it('blocks task when tool is reserved by in_progress task', () => {
    const state = createTestState([
      createInProgressTask({
        leaderId: 'char-2',
        dayKey: 1,
        slot: 0,
        activityType: 'alchemy',
        activityData: createAlchemyData({ toolIds: ['alembic-1'], recipeId: 'potion-a' }),
      }),
    ]);

    const result = validateToolExclusivity(state, createTaskPayload({
      activityType: 'alchemy',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createAlchemyData({ toolIds: ['alembic-1'], recipeId: 'potion-b' }),
    }));

    expect(result.valid).toBe(false);
    expect(result.code).toBe(DOWNTIME_ERROR_CODES.TOOL_CONFLICT);
  });

  it('allows task when tool was freed by cancelled task', () => {
    const state = createTestState([
      createCancelledTask({
        leaderId: 'char-2',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ toolIds: ['rod-1'], speciesId: 'bass' }),
      }),
    ]);

    const result = validateToolExclusivity(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ toolIds: ['rod-1'], speciesId: 'trout' }),
    }));

    expect(result.valid).toBe(true);
  });

  it('allows same tool in different slot', () => {
    const state = createTestState([
      createPendingTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityType: 'crafting',
        activityData: createCraftingData({ toolIds: ['hammer-1'], projectId: 'project-a' }),
      }),
    ]);

    const result = validateToolExclusivity(state, createTaskPayload({
      activityType: 'crafting',
      dayKey: 1,
      slot: 1, // Different slot
      leaderId: 'char-2',
      helperIds: [],
      activityData: createCraftingData({ toolIds: ['hammer-1'], projectId: 'project-b' }),
    }));

    expect(result.valid).toBe(true);
  });

  it('allows same tool on different day', () => {
    const state = createTestState([
      createPendingTask({
        leaderId: 'char-1',
        dayKey: 1,
        slot: 0,
        activityType: 'crafting',
        activityData: createCraftingData({ toolIds: ['hammer-1'], projectId: 'project-a' }),
      }),
    ]);

    const result = validateToolExclusivity(state, createTaskPayload({
      activityType: 'crafting',
      dayKey: 2, // Different day
      slot: 0,
      leaderId: 'char-2',
      helperIds: [],
      activityData: createCraftingData({ toolIds: ['hammer-1'], projectId: 'project-b' }),
    }));

    expect(result.valid).toBe(true);
  });

  it('reports all conflicting tools', () => {
    const state = createTestState([
      createPendingTask({
        leaderId: 'char-2',
        dayKey: 1,
        slot: 0,
        activityType: 'alchemy',
        activityData: createAlchemyData({
          toolIds: ['alembic-1', 'mortar-1'],
          recipeId: 'potion-a',
        }),
      }),
    ]);

    const result = validateToolExclusivity(state, createTaskPayload({
      activityType: 'alchemy',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createAlchemyData({
        toolIds: ['alembic-1', 'mortar-1', 'flask-1'],
        recipeId: 'potion-b',
      }),
    }));

    expect(result.valid).toBe(false);
    expect(result.meta?.conflictingToolIds).toHaveLength(2);
    expect(result.meta?.conflictingToolIds).toContain('alembic-1');
    expect(result.meta?.conflictingToolIds).toContain('mortar-1');
  });

  it('allows task with no tools', () => {
    const state = createTestState([]);
    const result = validateToolExclusivity(state, createTaskPayload({
      activityType: 'rest',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createRestData(),
    }));

    expect(result.valid).toBe(true);
  });

  it('allows task when using different tools than reserved', () => {
    const state = createTestState([
      createPendingTask({
        leaderId: 'char-2',
        dayKey: 1,
        slot: 0,
        activityType: 'fishing',
        activityData: createFishingData({ toolIds: ['rod-1'], speciesId: 'bass' }),
      }),
    ]);

    const result = validateToolExclusivity(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      helperIds: [],
      activityData: createFishingData({ toolIds: ['rod-2'], speciesId: 'trout' }), // Different tool
    }));

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// downtimeReducer - TOOL VALIDATION TESTS
// ============================================================================

describe('downtimeReducer - tool validation', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  it('throws DowntimeValidationError on tool conflict', () => {
    // Create task with tool
    const state1 = downtimeReducer(downtimeInitialState, createTask(createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      activityData: createFishingData({ toolIds: ['rod-1'], speciesId: 'trout' }),
    })));

    // Try to create second task with same tool
    expect(() => {
      downtimeReducer(state1, createTask(createTaskPayload({
        activityType: 'fishing',
        dayKey: 1,
        slot: 0,
        leaderId: 'char-2',
        activityData: createFishingData({ toolIds: ['rod-1'], speciesId: 'bass' }),
      })));
    }).toThrow(DowntimeValidationError);
  });

  it('allows tool reuse after cancellation', () => {
    // Create task with tool
    const state1 = downtimeReducer(downtimeInitialState, createTask(createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1',
      activityData: createFishingData({ toolIds: ['rod-1'], speciesId: 'trout' }),
    })));

    // Cancel it
    const taskId = state1.taskOrder[0];
    const state2 = downtimeReducer(state1, cancelTask(taskId));

    // Create second task with same tool (different target to avoid lock)
    const state3 = downtimeReducer(state2, createTask(createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-2',
      activityData: createFishingData({ toolIds: ['rod-1'], speciesId: 'bass' }),
    })));

    expect(Object.keys(state3.tasksById)).toHaveLength(2);
  });
});
