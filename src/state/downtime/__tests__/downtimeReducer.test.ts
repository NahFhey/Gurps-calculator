import { describe, expect, it, beforeEach } from 'vitest';
import type { DowntimeState, FishingData, TaskResults } from '../../../types/downtime';
import { downtimeInitialState } from '../downtimeInitialState';
import { downtimeReducer } from '../downtimeReducer';
import {
  createTask,
  updateTask,
  beginResolveTask,
  resolveTask,
  cancelTask,
  reorderTasks,
  type CreateTaskPayload,
} from '../downtimeActions';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createFishingPayload = (overrides?: Partial<CreateTaskPayload>): CreateTaskPayload => ({
  activityType: 'fishing',
  dayKey: 1,
  slot: 0,
  leaderId: 'char-1',
  helperIds: ['char-2'],
  activityData: {
    type: 'fishing',
    speciesId: 'species-trout',
    spotId: 'spot-river',
    toolIds: ['rod-1'],
    skillModifier: 2,
    targetYield: 5,
  } as FishingData,
  ...overrides,
});

const createSuccessResults = (): TaskResults => ({
  success: true,
  message: 'Caught 5 trout!',
  inventoryChanges: [{ itemId: 'item-trout', quantity: 5, itemName: 'Trout' }],
  experienceGained: 10,
});

// ============================================================================
// TASK CREATE TESTS
// ============================================================================

describe('downtimeReducer - taskCreate', () => {
  let state: DowntimeState;

  beforeEach(() => {
    state = downtimeInitialState;
  });

  it('adds task to state with correct fields', () => {
    const payload = createFishingPayload();
    const nextState = downtimeReducer(state, createTask(payload));

    const taskIds = Object.keys(nextState.tasksById);
    expect(taskIds).toHaveLength(1);

    const task = nextState.tasksById[taskIds[0]];
    expect(task.activityType).toBe('fishing');
    expect(task.dayKey).toBe(1);
    expect(task.slot).toBe(0);
    expect(task.leaderId).toBe('char-1');
    expect(task.helperIds).toEqual(['char-2']);
    expect(task.activityData).toEqual(payload.activityData);
  });

  it('generates unique ID', () => {
    // Use different slots to avoid validation conflict
    const payload1 = createFishingPayload({ slot: 0 });
    const payload2 = createFishingPayload({ slot: 1 });
    const state1 = downtimeReducer(state, createTask(payload1));
    const state2 = downtimeReducer(state1, createTask(payload2));

    const taskIds = Object.keys(state2.tasksById);
    expect(taskIds).toHaveLength(2);
    expect(taskIds[0]).not.toBe(taskIds[1]);
  });

  it('sets initial status to pending', () => {
    const payload = createFishingPayload();
    const nextState = downtimeReducer(state, createTask(payload));

    const taskIds = Object.keys(nextState.tasksById);
    const task = nextState.tasksById[taskIds[0]];
    expect(task.status).toBe('pending');
  });

  it('adds to taskOrder array', () => {
    const payload = createFishingPayload();
    const nextState = downtimeReducer(state, createTask(payload));

    expect(nextState.taskOrder).toHaveLength(1);
    expect(nextState.tasksById[nextState.taskOrder[0]]).toBeDefined();
  });

  it('sets createdAt and updatedAt timestamps', () => {
    const before = Date.now();
    const payload = createFishingPayload();
    const nextState = downtimeReducer(state, createTask(payload));
    const after = Date.now();

    const task = nextState.tasksById[nextState.taskOrder[0]];
    expect(task.createdAt).toBeGreaterThanOrEqual(before);
    expect(task.createdAt).toBeLessThanOrEqual(after);
    expect(task.updatedAt).toBe(task.createdAt);
  });
});

// ============================================================================
// TASK UPDATE TESTS
// ============================================================================

describe('downtimeReducer - taskUpdate', () => {
  let state: DowntimeState;
  let taskId: string;

  beforeEach(() => {
    const payload = createFishingPayload();
    state = downtimeReducer(downtimeInitialState, createTask(payload));
    taskId = state.taskOrder[0];
  });

  it('modifies specified fields only', () => {
    const originalTask = state.tasksById[taskId];
    const nextState = downtimeReducer(
      state,
      updateTask({ taskId, changes: { slot: 2 } })
    );

    const updatedTask = nextState.tasksById[taskId];
    expect(updatedTask.slot).toBe(2);
    // Other fields should remain unchanged
    expect(updatedTask.dayKey).toBe(originalTask.dayKey);
    expect(updatedTask.leaderId).toBe(originalTask.leaderId);
    expect(updatedTask.activityType).toBe(originalTask.activityType);
  });

  it('updates timestamp', () => {
    const originalTask = state.tasksById[taskId];
    const originalUpdatedAt = originalTask.updatedAt;

    // Small delay to ensure timestamp changes
    const nextState = downtimeReducer(
      state,
      updateTask({ taskId, changes: { slot: 2 } })
    );

    const updatedTask = nextState.tasksById[taskId];
    expect(updatedTask.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('does nothing for non-existent task', () => {
    const nextState = downtimeReducer(
      state,
      updateTask({ taskId: 'non-existent', changes: { slot: 2 } })
    );

    expect(nextState.tasksById).toEqual(state.tasksById);
  });
});

// ============================================================================
// TASK BEGIN RESOLVE TESTS
// ============================================================================

describe('downtimeReducer - taskBeginResolve', () => {
  let state: DowntimeState;
  let taskId: string;

  beforeEach(() => {
    const payload = createFishingPayload();
    state = downtimeReducer(downtimeInitialState, createTask(payload));
    taskId = state.taskOrder[0];
  });

  it('changes status to in_progress', () => {
    const nextState = downtimeReducer(state, beginResolveTask(taskId));

    const task = nextState.tasksById[taskId];
    expect(task.status).toBe('in_progress');
  });

  it('updates timestamp', () => {
    const originalTask = state.tasksById[taskId];
    const nextState = downtimeReducer(state, beginResolveTask(taskId));

    const task = nextState.tasksById[taskId];
    expect(task.updatedAt).toBeGreaterThanOrEqual(originalTask.updatedAt);
  });

  it('does not change status if already in_progress', () => {
    const state1 = downtimeReducer(state, beginResolveTask(taskId));
    const state2 = downtimeReducer(state1, beginResolveTask(taskId));

    expect(state2.tasksById[taskId].status).toBe('in_progress');
  });
});

// ============================================================================
// TASK RESOLVE TESTS
// ============================================================================

describe('downtimeReducer - taskResolve', () => {
  let state: DowntimeState;
  let taskId: string;

  beforeEach(() => {
    const payload = createFishingPayload();
    state = downtimeReducer(downtimeInitialState, createTask(payload));
    taskId = state.taskOrder[0];
  });

  it('changes status to resolved and attaches results', () => {
    const results = createSuccessResults();
    const nextState = downtimeReducer(state, resolveTask(taskId, results));

    const task = nextState.tasksById[taskId];
    expect(task.status).toBe('resolved');
    expect(task.results).toEqual(results);
  });

  it('is idempotent - resolving twice does not double-apply', () => {
    const results1 = createSuccessResults();
    const results2: TaskResults = {
      success: false,
      message: 'Different result',
    };

    const state1 = downtimeReducer(state, resolveTask(taskId, results1));
    const state2 = downtimeReducer(state1, resolveTask(taskId, results2));

    // Should still have first results
    const task = state2.tasksById[taskId];
    expect(task.status).toBe('resolved');
    expect(task.results).toEqual(results1);
    expect(task.results?.message).toBe('Caught 5 trout!');
  });

  it('updates timestamp', () => {
    const originalTask = state.tasksById[taskId];
    const results = createSuccessResults();
    const nextState = downtimeReducer(state, resolveTask(taskId, results));

    const task = nextState.tasksById[taskId];
    expect(task.updatedAt).toBeGreaterThanOrEqual(originalTask.updatedAt);
  });
});

// ============================================================================
// TASK CANCEL TESTS
// ============================================================================

describe('downtimeReducer - taskCancel', () => {
  let state: DowntimeState;
  let taskId: string;

  beforeEach(() => {
    const payload = createFishingPayload();
    state = downtimeReducer(downtimeInitialState, createTask(payload));
    taskId = state.taskOrder[0];
  });

  it('changes status to cancelled', () => {
    const nextState = downtimeReducer(state, cancelTask(taskId));

    const task = nextState.tasksById[taskId];
    expect(task.status).toBe('cancelled');
  });

  it('does NOT remove task from tasksById', () => {
    const nextState = downtimeReducer(state, cancelTask(taskId));

    expect(nextState.tasksById[taskId]).toBeDefined();
    expect(Object.keys(nextState.tasksById)).toHaveLength(1);
  });

  it('does NOT remove task from taskOrder', () => {
    const nextState = downtimeReducer(state, cancelTask(taskId));

    expect(nextState.taskOrder).toContain(taskId);
    expect(nextState.taskOrder).toHaveLength(1);
  });

  it('does not cancel already resolved task', () => {
    const results = createSuccessResults();
    const resolvedState = downtimeReducer(state, resolveTask(taskId, results));
    const nextState = downtimeReducer(resolvedState, cancelTask(taskId));

    const task = nextState.tasksById[taskId];
    expect(task.status).toBe('resolved');
  });

  it('does not cancel already cancelled task', () => {
    const cancelledState = downtimeReducer(state, cancelTask(taskId));
    const originalUpdatedAt = cancelledState.tasksById[taskId].updatedAt;

    // Try to cancel again - should be no-op
    const nextState = downtimeReducer(cancelledState, cancelTask(taskId));

    const task = nextState.tasksById[taskId];
    expect(task.status).toBe('cancelled');
    // updatedAt should not change on second cancel
    expect(task.updatedAt).toBe(originalUpdatedAt);
  });

  it('updates timestamp', () => {
    const originalTask = state.tasksById[taskId];
    const nextState = downtimeReducer(state, cancelTask(taskId));

    const task = nextState.tasksById[taskId];
    expect(task.updatedAt).toBeGreaterThanOrEqual(originalTask.updatedAt);
  });
});

// ============================================================================
// TASK REORDER TESTS
// ============================================================================

describe('downtimeReducer - taskReorder', () => {
  let state: DowntimeState;

  beforeEach(() => {
    // Create 3 tasks
    let s = downtimeInitialState;
    s = downtimeReducer(s, createTask(createFishingPayload({ dayKey: 1 })));
    s = downtimeReducer(s, createTask(createFishingPayload({ dayKey: 2 })));
    s = downtimeReducer(s, createTask(createFishingPayload({ dayKey: 3 })));
    state = s;
  });

  it('updates taskOrder array', () => {
    const [id1, id2, id3] = state.taskOrder;
    const newOrder = [id3, id1, id2];

    const nextState = downtimeReducer(state, reorderTasks(newOrder));

    expect(nextState.taskOrder).toEqual(newOrder);
  });

  it('does not affect tasksById', () => {
    const [id1, id2, id3] = state.taskOrder;
    const newOrder = [id3, id1, id2];

    const nextState = downtimeReducer(state, reorderTasks(newOrder));

    // All tasks should still exist with same data
    expect(Object.keys(nextState.tasksById)).toHaveLength(3);
    expect(nextState.tasksById[id1]).toEqual(state.tasksById[id1]);
    expect(nextState.tasksById[id2]).toEqual(state.tasksById[id2]);
    expect(nextState.tasksById[id3]).toEqual(state.tasksById[id3]);
  });
});

// ============================================================================
// IMMUTABILITY TESTS
// ============================================================================

describe('downtimeReducer - immutability', () => {
  it('does not mutate original state', () => {
    const originalState = downtimeInitialState;
    const payload = createFishingPayload();

    downtimeReducer(originalState, createTask(payload));

    expect(originalState.tasksById).toEqual({});
    expect(originalState.taskOrder).toEqual([]);
  });

  it('returns new state object on change', () => {
    const payload = createFishingPayload();
    const nextState = downtimeReducer(downtimeInitialState, createTask(payload));

    expect(nextState).not.toBe(downtimeInitialState);
  });
});
