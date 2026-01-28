import { describe, expect, it, beforeEach } from 'vitest';
import type { DowntimeState, DowntimeTask, FishingData } from '../../../types/downtime';
import { downtimeInitialState } from '../downtimeInitialState';
import { downtimeReducer } from '../downtimeReducer';
import { createTask, type CreateTaskPayload } from '../downtimeActions';
import { validateTaskCreation } from '../downtimeValidation';
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

/**
 * Creates a pending task for tests.
 */
function createPendingTask(options: {
  id?: string;
  leaderId?: string;
  helperIds?: string[];
  dayKey?: number;
  slot?: number;
}): DowntimeTask {
  const id = options.id ?? `task-${++idCounter}`;
  const now = Date.now();

  return {
    id,
    activityType: 'fishing',
    dayKey: options.dayKey ?? 1,
    slot: options.slot ?? 0,
    leaderId: options.leaderId ?? 'char-1',
    helperIds: options.helperIds ?? [],
    status: 'pending',
    activityData: createFishingData(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates a cancelled task for tests.
 */
function createCancelledTask(options: {
  id?: string;
  leaderId?: string;
  helperIds?: string[];
  dayKey?: number;
  slot?: number;
}): DowntimeTask {
  return {
    ...createPendingTask(options),
    status: 'cancelled',
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

  it('allows task when only cancelled tasks exist in slot', () => {
    const state = createTestState([
      createCancelledTask({ leaderId: 'char-1', dayKey: 1, slot: 0 }),
    ]);

    const result = validateTaskCreation(state, createTaskPayload({
      activityType: 'fishing',
      dayKey: 1,
      slot: 0,
      leaderId: 'char-1', // Same as cancelled task
      helperIds: [],
    }));

    // Cancelled tasks don't count as assigned
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
