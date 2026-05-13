import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  createTimeSlot,
  createTaskAssignment,
  createPendingDayLedger,
  getAssignedWorkersForSlot,
  isWorkerAssignedInSlot,
  validateWorkerAssignment,
  updateTaskAssignedWorkers,
  getTasksForSlot,
  canAdvanceSlot,
  advanceToNextSlot,
  addTaskSummaryToLedger,
  commitPendingDayLedger,
  getCurrentSlot,
  ensureDaySlotsExist,
} from '../dayPlanner';
import {
  SLOTS_PER_DAY,
  SLOT_NAMES,
  SLOT_STATUS,
  TASK_STATUS,
  LEDGER_STATUS,
} from '../../constants';

beforeEach(() => {
  let counter = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `uuid-${++counter}`,
  });
});

describe('createTimeSlot', () => {
  it('creates a slot with default planned status and correct name', () => {
    const slot = createTimeSlot(5, 1);
    expect(slot.dayKey).toBe(5);
    expect(slot.slotIndex).toBe(1);
    expect(slot.name).toBe(SLOT_NAMES[1]);
    expect(slot.status).toBe(SLOT_STATUS.Planned);
    expect(slot.assignedWorkerIds).toEqual([]);
    expect(slot.taskIds).toEqual([]);
    expect(slot.id).toMatch(/^uuid-/);
    expect(typeof slot.createdAt).toBe('string');
  });

  it('falls back to a generic name for out-of-range slot indices', () => {
    const slot = createTimeSlot(1, 99);
    expect(slot.name).toBe('Slot 99');
  });
});

describe('createTaskAssignment', () => {
  it('initializes a draft task with empty defaults', () => {
    const task = createTaskAssignment(2, 0, 0, 'Fishing');
    expect(task).toMatchObject({
      dayKey: 2,
      slotIndex: 0,
      orderIndex: 0,
      mode: 'Fishing',
      environmentId: null,
      method: null,
      leaderWorkerId: null,
      helperWorkerIds: [],
      assignedWorkerIds: [],
      selectedToolIds: [],
      selectedConsumableIds: [],
      resolutionState: TASK_STATUS.Draft,
      payload: null,
      inventoryDelta: [],
      notes: '',
      warnings: [],
    });
    expect(task.intent).toEqual({});
  });
});

describe('createPendingDayLedger', () => {
  it('starts open with empty deltas/summaries', () => {
    const ledger = createPendingDayLedger(7);
    expect(ledger.dayKey).toBe(7);
    expect(ledger.status).toBe(LEDGER_STATUS.Open);
    expect(ledger.pendingInventoryDelta).toEqual([]);
    expect(ledger.taskSummaries).toEqual([]);
  });
});

describe('getAssignedWorkersForSlot', () => {
  it('returns deduplicated worker ids across tasks in the slot', () => {
    const tasks = [
      { dayKey: 1, slotIndex: 0, assignedWorkerIds: ['a', 'b'] },
      { dayKey: 1, slotIndex: 0, assignedWorkerIds: ['b', 'c'] },
      { dayKey: 1, slotIndex: 1, assignedWorkerIds: ['d'] },
      { dayKey: 2, slotIndex: 0, assignedWorkerIds: ['e'] },
    ];
    const result = getAssignedWorkersForSlot(tasks, 1, 0);
    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array when no tasks match', () => {
    expect(getAssignedWorkersForSlot([], 1, 0)).toEqual([]);
  });
});

describe('isWorkerAssignedInSlot', () => {
  const tasks = [
    { dayKey: 1, slotIndex: 0, assignedWorkerIds: ['a'] },
    { dayKey: 1, slotIndex: 1, assignedWorkerIds: ['b'] },
  ];
  it('returns true if worker is assigned in slot', () => {
    expect(isWorkerAssignedInSlot(tasks, 1, 0, 'a')).toBe(true);
  });
  it('returns false if worker is in a different slot', () => {
    expect(isWorkerAssignedInSlot(tasks, 1, 0, 'b')).toBe(false);
  });
});

describe('validateWorkerAssignment', () => {
  const tasks = [
    { id: 't1', dayKey: 1, slotIndex: 0, assignedWorkerIds: ['a'] },
    { id: 't2', dayKey: 1, slotIndex: 0, assignedWorkerIds: ['b'] },
  ];

  it('rejects an already-assigned worker', () => {
    const result = validateWorkerAssignment(tasks, 1, 0, 'a');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/already assigned/);
  });

  it('accepts a free worker', () => {
    expect(validateWorkerAssignment(tasks, 1, 0, 'c')).toEqual({
      valid: true,
      error: null,
    });
  });

  it('excludes the specified task when editing', () => {
    const result = validateWorkerAssignment(tasks, 1, 0, 'a', 't1');
    expect(result.valid).toBe(true);
  });
});

describe('updateTaskAssignedWorkers', () => {
  it('combines leader and helpers into assignedWorkerIds', () => {
    const task = {
      leaderWorkerId: 'leader',
      helperWorkerIds: ['h1', 'h2'],
    };
    const updated = updateTaskAssignedWorkers(task);
    expect(updated.assignedWorkerIds).toEqual(['leader', 'h1', 'h2']);
  });

  it('handles missing leader and empty helpers', () => {
    const task = { leaderWorkerId: null, helperWorkerIds: [] };
    expect(updateTaskAssignedWorkers(task).assignedWorkerIds).toEqual([]);
  });

  it('handles undefined helperWorkerIds', () => {
    const task = { leaderWorkerId: 'x' };
    expect(updateTaskAssignedWorkers(task).assignedWorkerIds).toEqual(['x']);
  });
});

describe('getTasksForSlot', () => {
  it('returns matching tasks sorted by orderIndex', () => {
    const tasks = [
      { id: 'b', dayKey: 1, slotIndex: 0, orderIndex: 2 },
      { id: 'a', dayKey: 1, slotIndex: 0, orderIndex: 0 },
      { id: 'x', dayKey: 1, slotIndex: 1, orderIndex: 0 },
      { id: 'c', dayKey: 1, slotIndex: 0, orderIndex: 1 },
    ];
    const result = getTasksForSlot(tasks, 1, 0);
    expect(result.map(t => t.id)).toEqual(['a', 'c', 'b']);
  });

  it('returns empty array if no tasks match', () => {
    expect(getTasksForSlot([], 0, 0)).toEqual([]);
  });
});

describe('canAdvanceSlot', () => {
  it('allows advancing when slot has no tasks', () => {
    const result = canAdvanceSlot([], 1, 0);
    expect(result.canAdvance).toBe(true);
    expect(result.reason).toMatch(/No tasks/);
  });

  it('allows advancing when all tasks completed', () => {
    const tasks = [
      { dayKey: 1, slotIndex: 0, orderIndex: 0, resolutionState: TASK_STATUS.Completed },
      { dayKey: 1, slotIndex: 0, orderIndex: 1, resolutionState: TASK_STATUS.Completed },
    ];
    expect(canAdvanceSlot(tasks, 1, 0).canAdvance).toBe(true);
  });

  it('blocks advancing with incomplete tasks and reports count', () => {
    const tasks = [
      { dayKey: 1, slotIndex: 0, orderIndex: 0, resolutionState: TASK_STATUS.Completed },
      { dayKey: 1, slotIndex: 0, orderIndex: 1, resolutionState: TASK_STATUS.Draft },
      { dayKey: 1, slotIndex: 0, orderIndex: 2, resolutionState: TASK_STATUS.Resolving },
    ];
    const result = canAdvanceSlot(tasks, 1, 0);
    expect(result.canAdvance).toBe(false);
    expect(result.reason).toMatch(/2 task/);
  });
});

describe('advanceToNextSlot', () => {
  it('advances within the same day', () => {
    expect(advanceToNextSlot(3, 0)).toEqual({
      nextDay: 3,
      nextSlot: 1,
      dayAdvanced: false,
    });
  });

  it('rolls over to the next day on the last slot', () => {
    expect(advanceToNextSlot(3, SLOTS_PER_DAY - 1)).toEqual({
      nextDay: 4,
      nextSlot: 0,
      dayAdvanced: true,
    });
  });
});

describe('addTaskSummaryToLedger', () => {
  it('appends a summary and merges inventory deltas', () => {
    const ledger = createPendingDayLedger(1);
    const task = {
      id: 'task-1',
      slotIndex: 0,
      mode: 'Fishing',
      environmentId: 'env-1',
      assignedWorkerIds: ['a'],
      inventoryDelta: [{ type: 'food', speciesName: 'Trout', foodType: 'Fish', units: 2 }],
      notes: 'good catch',
      warnings: [],
    };
    const updated = addTaskSummaryToLedger(ledger, task);
    expect(updated.taskSummaries).toHaveLength(1);
    expect(updated.taskSummaries[0]).toMatchObject({
      taskId: 'task-1',
      mode: 'Fishing',
      environment: 'env-1',
    });
    expect(updated.pendingInventoryDelta).toEqual(task.inventoryDelta);
    // Original ledger not mutated
    expect(ledger.taskSummaries).toEqual([]);
    expect(ledger.pendingInventoryDelta).toEqual([]);
  });
});

describe('commitPendingDayLedger', () => {
  it('adds new food and material entries when none match', () => {
    const ledger = {
      ...createPendingDayLedger(1),
      pendingInventoryDelta: [
        { type: 'food', speciesName: 'Trout', foodType: 'Fish', units: 3 },
        { type: 'material', name: 'Oak', materialType: 'Wood', units: 5 },
      ],
    };
    const { updatedFoods, updatedMaterials, committedLedger } =
      commitPendingDayLedger(ledger, [], []);
    expect(updatedFoods).toHaveLength(1);
    expect(updatedFoods[0]).toMatchObject({ name: 'Trout', quantity: 3, types: ['Fish'] });
    expect(updatedMaterials).toHaveLength(1);
    expect(updatedMaterials[0]).toMatchObject({ name: 'Oak', type: 'Wood', quantity: 5 });
    expect(committedLedger.status).toBe(LEDGER_STATUS.Committed);
    expect(typeof committedLedger.committedAt).toBe('string');
  });

  it('stacks quantity onto matching food and material entries', () => {
    const ledger = {
      ...createPendingDayLedger(1),
      pendingInventoryDelta: [
        { type: 'food', speciesName: 'Trout', foodType: 'Fish', units: 2 },
        { type: 'material', name: 'Oak', materialType: 'Wood', units: 4 },
      ],
    };
    const foods = [{ id: 'f1', name: 'Trout', quantity: 1, types: ['Fish'] }];
    const materials = [{ id: 'm1', name: 'Oak', type: 'Wood', quantity: 1 }];
    const result = commitPendingDayLedger(ledger, foods, materials);
    expect(result.updatedFoods).toHaveLength(1);
    expect(result.updatedFoods[0].quantity).toBe(3);
    expect(result.updatedMaterials).toHaveLength(1);
    expect(result.updatedMaterials[0].quantity).toBe(5);
  });

  it('does not mutate original input arrays', () => {
    const ledger = { ...createPendingDayLedger(1), pendingInventoryDelta: [] };
    const foods = [{ id: 'f1', name: 'X', quantity: 1, types: ['Fish'] }];
    const materials = [];
    commitPendingDayLedger(ledger, foods, materials);
    expect(foods).toHaveLength(1);
    expect(materials).toHaveLength(0);
  });

  it('ignores deltas with unknown types', () => {
    const ledger = {
      ...createPendingDayLedger(1),
      pendingInventoryDelta: [{ type: 'mystery', units: 1 }],
    };
    const result = commitPendingDayLedger(ledger, [], []);
    expect(result.updatedFoods).toEqual([]);
    expect(result.updatedMaterials).toEqual([]);
    expect(result.committedLedger.status).toBe(LEDGER_STATUS.Committed);
  });
});

describe('getCurrentSlot', () => {
  const slots = [
    { dayKey: 1, slotIndex: 0, name: 'Morning' },
    { dayKey: 1, slotIndex: 1, name: 'Afternoon' },
  ];
  it('returns the matching slot', () => {
    expect(getCurrentSlot(slots, 1, 1).name).toBe('Afternoon');
  });
  it('returns null if not found', () => {
    expect(getCurrentSlot(slots, 9, 0)).toBeNull();
  });
});

describe('ensureDaySlotsExist', () => {
  it('creates all SLOTS_PER_DAY slots when none exist for the day', () => {
    const result = ensureDaySlotsExist([], 1);
    expect(result).toHaveLength(SLOTS_PER_DAY);
    const indices = result.map(s => s.slotIndex).sort();
    expect(indices).toEqual([...Array(SLOTS_PER_DAY).keys()]);
    result.forEach(s => expect(s.dayKey).toBe(1));
  });

  it('returns the original array when all slots already exist', () => {
    const existing = [];
    for (let i = 0; i < SLOTS_PER_DAY; i++) {
      existing.push({ dayKey: 1, slotIndex: i, name: SLOT_NAMES[i] });
    }
    const result = ensureDaySlotsExist(existing, 1);
    expect(result).toBe(existing);
  });

  it('fills in missing slot indices without duplicating existing ones', () => {
    const existing = [{ dayKey: 1, slotIndex: 0, name: SLOT_NAMES[0] }];
    const result = ensureDaySlotsExist(existing, 1);
    expect(result).toHaveLength(SLOTS_PER_DAY);
    const day1Slots = result.filter(s => s.dayKey === 1);
    const indices = day1Slots.map(s => s.slotIndex).sort();
    expect(indices).toEqual([...Array(SLOTS_PER_DAY).keys()]);
  });

  it('preserves slots from other days', () => {
    const existing = [{ dayKey: 2, slotIndex: 0, name: SLOT_NAMES[0] }];
    const result = ensureDaySlotsExist(existing, 1);
    expect(result.filter(s => s.dayKey === 2)).toHaveLength(1);
    expect(result.filter(s => s.dayKey === 1)).toHaveLength(SLOTS_PER_DAY);
  });
});
