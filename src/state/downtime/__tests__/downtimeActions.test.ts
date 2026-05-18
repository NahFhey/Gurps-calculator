import { describe, expect, it } from 'vitest';
import {
  DOWNTIME_TASK_CREATE,
  DOWNTIME_TASK_UPDATE,
  DOWNTIME_TASK_BEGIN_RESOLVE,
  DOWNTIME_TASK_RESOLVE,
  DOWNTIME_TASK_CANCEL,
  DOWNTIME_TASK_REORDER,
  createTask,
  updateTask,
  beginResolveTask,
  resolveTask,
  cancelTask,
  reorderTasks,
  type CreateTaskPayload,
} from '../downtimeActions';
import type { ActivityData, TaskResults } from '../../../types/downtime';

const mockActivityData = (): ActivityData =>
  ({ kind: 'crafting' } as unknown as ActivityData);

const mockTaskResults = (): TaskResults =>
  ({ success: true } as unknown as TaskResults);

const mockCreatePayload = (overrides?: Partial<CreateTaskPayload>): CreateTaskPayload => ({
  activityType: 'crafting',
  dayKey: 1,
  slot: 0,
  leaderId: 'char-1',
  helperIds: [],
  activityData: mockActivityData(),
  ...overrides,
});

describe('downtimeActions', () => {
  describe('action type constants', () => {
    it('exposes stable string literals', () => {
      expect(DOWNTIME_TASK_CREATE).toBe('downtime/taskCreate');
      expect(DOWNTIME_TASK_UPDATE).toBe('downtime/taskUpdate');
      expect(DOWNTIME_TASK_BEGIN_RESOLVE).toBe('downtime/taskBeginResolve');
      expect(DOWNTIME_TASK_RESOLVE).toBe('downtime/taskResolve');
      expect(DOWNTIME_TASK_CANCEL).toBe('downtime/taskCancel');
      expect(DOWNTIME_TASK_REORDER).toBe('downtime/taskReorder');
    });

    it('constants are all unique', () => {
      const values = [
        DOWNTIME_TASK_CREATE,
        DOWNTIME_TASK_UPDATE,
        DOWNTIME_TASK_BEGIN_RESOLVE,
        DOWNTIME_TASK_RESOLVE,
        DOWNTIME_TASK_CANCEL,
        DOWNTIME_TASK_REORDER,
      ];
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('createTask', () => {
    it('returns a DOWNTIME_TASK_CREATE action with the given payload', () => {
      const payload = mockCreatePayload();
      const action = createTask(payload);
      expect(action.type).toBe(DOWNTIME_TASK_CREATE);
      expect(action.payload).toBe(payload);
    });

    it('preserves an optional pre-generated id', () => {
      const payload = mockCreatePayload({ id: 'task-xyz' });
      const action = createTask(payload);
      if (action.type !== DOWNTIME_TASK_CREATE) throw new Error('wrong type');
      expect(action.payload.id).toBe('task-xyz');
    });

    it('preserves helper ids and slot/day info', () => {
      const payload = mockCreatePayload({
        helperIds: ['h-1', 'h-2'],
        dayKey: 5,
        slot: 2,
      });
      const action = createTask(payload);
      if (action.type !== DOWNTIME_TASK_CREATE) throw new Error('wrong type');
      expect(action.payload.helperIds).toEqual(['h-1', 'h-2']);
      expect(action.payload.dayKey).toBe(5);
      expect(action.payload.slot).toBe(2);
    });
  });

  describe('updateTask', () => {
    it('returns a DOWNTIME_TASK_UPDATE action with taskId and changes', () => {
      const action = updateTask({
        taskId: 'task-1',
        changes: { leaderId: 'char-2' },
      });
      expect(action.type).toBe(DOWNTIME_TASK_UPDATE);
      if (action.type !== DOWNTIME_TASK_UPDATE) throw new Error('wrong type');
      expect(action.payload.taskId).toBe('task-1');
      expect(action.payload.changes).toEqual({ leaderId: 'char-2' });
    });

    it('accepts an empty changes object', () => {
      const action = updateTask({ taskId: 'task-1', changes: {} });
      if (action.type !== DOWNTIME_TASK_UPDATE) throw new Error('wrong type');
      expect(action.payload.changes).toEqual({});
    });
  });

  describe('beginResolveTask', () => {
    it('returns a DOWNTIME_TASK_BEGIN_RESOLVE action with the task id', () => {
      const action = beginResolveTask('task-7');
      expect(action.type).toBe(DOWNTIME_TASK_BEGIN_RESOLVE);
      if (action.type !== DOWNTIME_TASK_BEGIN_RESOLVE) throw new Error('wrong type');
      expect(action.payload).toEqual({ taskId: 'task-7' });
    });
  });

  describe('resolveTask', () => {
    it('returns a DOWNTIME_TASK_RESOLVE action with taskId and results', () => {
      const results = mockTaskResults();
      const action = resolveTask('task-3', results);
      expect(action.type).toBe(DOWNTIME_TASK_RESOLVE);
      if (action.type !== DOWNTIME_TASK_RESOLVE) throw new Error('wrong type');
      expect(action.payload.taskId).toBe('task-3');
      expect(action.payload.results).toBe(results);
    });
  });

  describe('cancelTask', () => {
    it('returns a DOWNTIME_TASK_CANCEL action with the task id', () => {
      const action = cancelTask('task-9');
      expect(action.type).toBe(DOWNTIME_TASK_CANCEL);
      if (action.type !== DOWNTIME_TASK_CANCEL) throw new Error('wrong type');
      expect(action.payload).toEqual({ taskId: 'task-9' });
    });
  });

  describe('reorderTasks', () => {
    it('returns a DOWNTIME_TASK_REORDER action with the given task id list', () => {
      const ids = ['a', 'b', 'c'];
      const action = reorderTasks(ids);
      expect(action.type).toBe(DOWNTIME_TASK_REORDER);
      if (action.type !== DOWNTIME_TASK_REORDER) throw new Error('wrong type');
      expect(action.payload.taskIds).toBe(ids);
    });

    it('accepts an empty array', () => {
      const action = reorderTasks([]);
      if (action.type !== DOWNTIME_TASK_REORDER) throw new Error('wrong type');
      expect(action.payload.taskIds).toEqual([]);
    });
  });
});
