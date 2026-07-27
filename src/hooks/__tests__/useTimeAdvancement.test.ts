import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimeAdvancement } from '../useTimeAdvancement';
import { downtimeInitialState } from '../../state/downtime/downtimeInitialState';
import type {
  DowntimeState,
  DowntimeTask,
  FishingData,
} from '../../types/downtime';

// Mock the campaign store
interface MockCampaignState {
  downtime?: DowntimeState;
  time?: {
    day: number;
    slot: number;
  };
}

interface MockCampaignStoreValue {
  state: MockCampaignState;
  actions: Record<string, never>;
}

const useCampaignStoreMock = vi.hoisted(
  () => vi.fn<() => MockCampaignStoreValue>(),
);

vi.mock('../../state/campaignStore', () => ({
  useCampaignStore: useCampaignStoreMock,
}));

function makeCampaignStore(
  state: MockCampaignState,
): MockCampaignStoreValue {
  return {
    state,
    actions: {},
  };
}

function makeFishingData(
  overrides: Partial<FishingData> = {},
): FishingData {
  return {
    type: 'fishing',
    method: 'Line',
    speciesId: 'species-1',
    isRandomCatch: false,
    spotId: 'spot-1',
    toolIds: [],
    baitId: null,
    retryAttempt: 0,
    skillModifier: 0,
    targetYield: 1,
    ...overrides,
  };
}

function createTestTask(overrides: Partial<DowntimeTask> = {}): DowntimeTask {
  const now = Date.now();
  return {
    id: 'task-1',
    activityType: 'fishing',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    status: 'pending',
    activityData: makeFishingData(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('useTimeAdvancement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows advancement when downtime state is undefined', () => {
    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: undefined,
        time: { day: 1, slot: 0 },
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    expect(result.current.advancementCheck.canAdvance).toBe(true);
    expect(result.current.advancementCheck.blockingTaskIds).toHaveLength(0);
  });

  it('allows advancement when no tasks exist', () => {
    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: downtimeInitialState,
        time: { day: 1, slot: 0 },
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    expect(result.current.advancementCheck.canAdvance).toBe(true);
    expect(result.current.advancementCheck.blockingTaskIds).toHaveLength(0);
  });

  it('blocks advancement when pending task exists', () => {
    const task = createTestTask({
      id: 'task-1',
      status: 'pending',
      dayKey: 1,
      slot: 0,
    });

    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: {
          ...downtimeInitialState,
          tasksById: { 'task-1': task },
          taskOrder: ['task-1'],
        },
        time: { day: 1, slot: 0 },
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    expect(result.current.advancementCheck.canAdvance).toBe(false);
    expect(result.current.advancementCheck.blockingTaskIds).toContain('task-1');
  });

  it('blocks advancement when in_progress task exists', () => {
    const task = createTestTask({
      id: 'task-1',
      status: 'in_progress',
      dayKey: 1,
      slot: 0,
    });

    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: {
          ...downtimeInitialState,
          tasksById: { 'task-1': task },
          taskOrder: ['task-1'],
        },
        time: { day: 1, slot: 0 },
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    expect(result.current.advancementCheck.canAdvance).toBe(false);
    expect(result.current.advancementCheck.blockingTaskIds).toContain('task-1');
  });

  it('allows advancement when all tasks are resolved', () => {
    const task = createTestTask({
      id: 'task-1',
      status: 'resolved',
      dayKey: 1,
      slot: 0,
    });

    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: {
          ...downtimeInitialState,
          tasksById: { 'task-1': task },
          taskOrder: ['task-1'],
        },
        time: { day: 1, slot: 0 },
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    expect(result.current.advancementCheck.canAdvance).toBe(true);
    expect(result.current.advancementCheck.blockingTaskIds).toHaveLength(0);
  });

  it('allows advancement when all tasks are cancelled', () => {
    const task = createTestTask({
      id: 'task-1',
      status: 'cancelled',
      dayKey: 1,
      slot: 0,
    });

    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: {
          ...downtimeInitialState,
          tasksById: { 'task-1': task },
          taskOrder: ['task-1'],
        },
        time: { day: 1, slot: 0 },
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    expect(result.current.advancementCheck.canAdvance).toBe(true);
    expect(result.current.advancementCheck.blockingTaskIds).toHaveLength(0);
  });

  it('calls onJumpToTasks when jumpToBlockingTasks is called', () => {
    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: downtimeInitialState,
        time: { day: 1, slot: 0 },
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    act(() => {
      result.current.jumpToBlockingTasks();
    });

    expect(onJumpToTasks).toHaveBeenCalledOnce();
  });

  it('defaults to day 1 slot 0 when time is undefined', () => {
    const task = createTestTask({
      id: 'task-1',
      status: 'pending',
      dayKey: 1,
      slot: 0,
    });

    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: {
          ...downtimeInitialState,
          tasksById: { 'task-1': task },
          taskOrder: ['task-1'],
        },
        time: undefined,
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    // Should use defaults and find the blocking task at day 1, slot 0
    expect(result.current.advancementCheck.canAdvance).toBe(false);
    expect(result.current.advancementCheck.blockingTaskIds).toContain('task-1');
  });

  it('only checks current slot from state', () => {
    // Task in slot 1, but current slot is 0
    const task = createTestTask({
      id: 'task-1',
      status: 'pending',
      dayKey: 1,
      slot: 1,
    });

    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: {
          ...downtimeInitialState,
          tasksById: { 'task-1': task },
          taskOrder: ['task-1'],
        },
        time: { day: 1, slot: 0 },
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    // Slot 0 is clear, so advancement should be allowed
    expect(result.current.advancementCheck.canAdvance).toBe(true);
  });

  it('provides reason message when blocked', () => {
    const task = createTestTask({
      id: 'task-1',
      status: 'pending',
      dayKey: 1,
      slot: 0,
    });

    useCampaignStoreMock.mockReturnValue(
      makeCampaignStore({
        downtime: {
          ...downtimeInitialState,
          tasksById: { 'task-1': task },
          taskOrder: ['task-1'],
        },
        time: { day: 1, slot: 0 },
      }),
    );

    const onJumpToTasks = vi.fn();
    const { result } = renderHook(() => useTimeAdvancement(onJumpToTasks));

    expect(result.current.advancementCheck.reason).toBeDefined();
    expect(result.current.advancementCheck.reason).toContain('task');
  });
});
