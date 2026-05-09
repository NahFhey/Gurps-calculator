import { describe, expect, it, vi } from 'vitest';
import { createAndResolveTask } from '../createAutoResolvedTask';
import type { DowntimeState, ActivityData, DowntimeTask } from '../../types/downtime';
import type { DowntimeAction } from '../../state/downtime/downtimeActions';
import {
  DOWNTIME_TASK_CREATE,
  DOWNTIME_TASK_RESOLVE,
} from '../../state/downtime/downtimeActions';

const emptyState: DowntimeState = {
  tasksById: {},
  taskOrder: [],
  pendingDayLedger: null,
};

const sampleActivityData: ActivityData = {
  type: 'crafting',
  recipeId: 'recipe-1',
  materialInstanceIds: [],
  toolInstanceIds: [],
  qualityTarget: 'standard',
  skillModifier: 0,
};

function buildTask(overrides: Partial<DowntimeTask>): DowntimeTask {
  const now = Date.now();
  return {
    id: 'task-existing',
    activityType: 'crafting',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    status: 'pending',
    activityData: sampleActivityData,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('createAndResolveTask', () => {
  it('dispatches create then resolve and returns the new taskId on the happy path', () => {
    const dispatch = vi.fn<(action: DowntimeAction) => void>();

    const result = createAndResolveTask(emptyState, dispatch, {
      activityType: 'crafting',
      dayKey: 2,
      slot: 1,
      leaderId: 'char-1',
      activityData: sampleActivityData,
      resultMessage: 'Auto-resolved crafting shift',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(typeof result.taskId).toBe('string');
    expect(result.taskId.length).toBeGreaterThan(0);

    expect(dispatch).toHaveBeenCalledTimes(2);

    const createCall = dispatch.mock.calls[0][0];
    expect(createCall.type).toBe(DOWNTIME_TASK_CREATE);
    if (createCall.type !== DOWNTIME_TASK_CREATE) return;
    expect(createCall.payload.id).toBe(result.taskId);
    expect(createCall.payload.leaderId).toBe('char-1');
    expect(createCall.payload.dayKey).toBe(2);
    expect(createCall.payload.slot).toBe(1);
    expect(createCall.payload.helperIds).toEqual([]);

    const resolveCall = dispatch.mock.calls[1][0];
    expect(resolveCall.type).toBe(DOWNTIME_TASK_RESOLVE);
    if (resolveCall.type !== DOWNTIME_TASK_RESOLVE) return;
    expect(resolveCall.payload.taskId).toBe(result.taskId);
    expect(resolveCall.payload.results).toEqual({
      success: true,
      message: 'Auto-resolved crafting shift',
    });
  });

  it('returns failure without dispatching when the character is already busy as leader', () => {
    const dispatch = vi.fn<(action: DowntimeAction) => void>();
    const state: DowntimeState = {
      tasksById: {
        'task-existing': buildTask({
          id: 'task-existing',
          leaderId: 'char-1',
          dayKey: 5,
          slot: 2,
        }),
      },
      taskOrder: ['task-existing'],
      pendingDayLedger: null,
    };

    const result = createAndResolveTask(state, dispatch, {
      activityType: 'alchemy',
      dayKey: 5,
      slot: 2,
      leaderId: 'char-1',
      activityData: sampleActivityData,
      resultMessage: 'Should not run',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/already busy/i);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('treats helper assignments as conflicting too', () => {
    const dispatch = vi.fn<(action: DowntimeAction) => void>();
    const state: DowntimeState = {
      tasksById: {
        'task-existing': buildTask({
          leaderId: 'char-leader',
          helperIds: ['char-1'],
          dayKey: 3,
          slot: 0,
        }),
      },
      taskOrder: ['task-existing'],
      pendingDayLedger: null,
    };

    const result = createAndResolveTask(state, dispatch, {
      activityType: 'crafting',
      dayKey: 3,
      slot: 0,
      leaderId: 'char-1',
      activityData: sampleActivityData,
      resultMessage: 'Should not run',
    });

    expect(result.success).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('ignores cancelled tasks when checking for slot availability', () => {
    const dispatch = vi.fn<(action: DowntimeAction) => void>();
    const state: DowntimeState = {
      tasksById: {
        'task-cancelled': buildTask({
          id: 'task-cancelled',
          leaderId: 'char-1',
          dayKey: 7,
          slot: 1,
          status: 'cancelled',
        }),
      },
      taskOrder: ['task-cancelled'],
      pendingDayLedger: null,
    };

    const result = createAndResolveTask(state, dispatch, {
      activityType: 'crafting',
      dayKey: 7,
      slot: 1,
      leaderId: 'char-1',
      activityData: sampleActivityData,
      resultMessage: 'Should run',
    });

    expect(result.success).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
