import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useCharacterSlotSummary,
  useAllCharacterSlotSummaries,
} from '../useCharacterSlotSummary';
import { downtimeInitialState } from '../../state/downtime/downtimeInitialState';
import type {
  DowntimeState,
  DowntimeTask,
  FishingData,
} from '../../types/downtime';

interface MockCampaignStoreValue {
  state: {
    downtime?: DowntimeState;
    time?: {
      day: number;
      slot: number;
    };
  };
  actions: Record<string, never>;
}

const useCampaignStoreMock = vi.hoisted(
  () => vi.fn<() => MockCampaignStoreValue>(),
);

vi.mock('../../state/campaignStore', () => ({
  useCampaignStore: useCampaignStoreMock,
}));

function makeStore(
  state: MockCampaignStoreValue['state'],
): MockCampaignStoreValue {
  return {
    state,
    actions: {},
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
    activityData: {
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
    } satisfies FishingData,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('useCharacterSlotSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when downtime state is undefined', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({
      downtime: undefined,
      time: { day: 1, slot: 0 },
    }));

    const { result } = renderHook(() => useCharacterSlotSummary('char-1'));

    expect(result.current).toBeNull();
  });

  it('returns summary when downtime state exists', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({
      downtime: downtimeInitialState,
      time: { day: 1, slot: 0 },
    }));

    const { result } = renderHook(() => useCharacterSlotSummary('char-1'));

    expect(result.current).not.toBeNull();
    expect(result.current?.characterId).toBe('char-1');
    expect(result.current?.isAssigned).toBe(false);
    expect(result.current?.fatigueStatus).toBe('rested');
  });

  it('returns assigned status when character has task', () => {
    const task = createTestTask({
      id: 'task-1',
      leaderId: 'char-1',
      dayKey: 1,
      slot: 0,
    });

    useCampaignStoreMock.mockReturnValue(makeStore({
      downtime: {
        ...downtimeInitialState,
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      },
      time: { day: 1, slot: 0 },
    }));

    const { result } = renderHook(() => useCharacterSlotSummary('char-1'));

    expect(result.current?.isAssigned).toBe(true);
    expect(result.current?.activityDisplayName).toBe('Fishing');
    expect(result.current?.role).toBe('leader');
  });

  it('defaults to day 1 slot 0 when time is undefined', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({
      downtime: downtimeInitialState,
      time: undefined,
    }));

    const { result } = renderHook(() => useCharacterSlotSummary('char-1'));

    // Should still work with defaults
    expect(result.current).not.toBeNull();
    expect(result.current?.characterId).toBe('char-1');
  });
});

describe('useAllCharacterSlotSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty map when downtime state is undefined', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({
      downtime: undefined,
      time: { day: 1, slot: 0 },
    }));

    const { result } = renderHook(() =>
      useAllCharacterSlotSummaries(['char-1', 'char-2'])
    );

    expect(result.current.size).toBe(0);
  });

  it('returns map with all character summaries', () => {
    useCampaignStoreMock.mockReturnValue(makeStore({
      downtime: downtimeInitialState,
      time: { day: 1, slot: 0 },
    }));

    const { result } = renderHook(() =>
      useAllCharacterSlotSummaries(['char-1', 'char-2', 'char-3'])
    );

    expect(result.current.size).toBe(3);
    expect(result.current.has('char-1')).toBe(true);
    expect(result.current.has('char-2')).toBe(true);
    expect(result.current.has('char-3')).toBe(true);
  });

  it('correctly maps different character statuses', () => {
    const task = createTestTask({
      id: 'task-1',
      leaderId: 'char-1',
      helperIds: ['char-2'],
      dayKey: 1,
      slot: 0,
    });

    useCampaignStoreMock.mockReturnValue(makeStore({
      downtime: {
        ...downtimeInitialState,
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      },
      time: { day: 1, slot: 0 },
    }));

    const { result } = renderHook(() =>
      useAllCharacterSlotSummaries(['char-1', 'char-2', 'char-3'])
    );

    // char-1 is leader
    expect(result.current.get('char-1')?.isAssigned).toBe(true);
    expect(result.current.get('char-1')?.role).toBe('leader');

    // char-2 is helper
    expect(result.current.get('char-2')?.isAssigned).toBe(true);
    expect(result.current.get('char-2')?.role).toBe('helper');

    // char-3 is not assigned
    expect(result.current.get('char-3')?.isAssigned).toBe(false);
  });
});
