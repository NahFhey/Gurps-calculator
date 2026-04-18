import { useEffect } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../state/campaignStore';
import { downtimeInitialState } from '../../state/downtime/downtimeInitialState';
import type { DowntimeState, DowntimeTask, FishingData } from '../../types/downtime';
import { UnifiedShell } from '../UnifiedShell';

vi.mock('../../net/SyncProvider', () => ({
  useSyncContext: () => ({
    status: 'offline' as const,
    role: null,
    sessionInfo: null,
    playerCount: 0,
    displayName: null,
    playerList: [],
    hostGame: vi.fn(),
    joinGame: vi.fn(),
    disconnect: vi.fn(),
  }),
  SyncProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const modules = [
  { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> }
];

function EnableGmMode() {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.toggleGmMode();
  }, [actions]);
  return null;
}

function PauseActivities({ pausedIds = [] }: { pausedIds?: string[] }) {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.setPausedSessionIds(pausedIds);
  }, [actions, pausedIds]);
  return null;
}

function createDowntimeTask(overrides: Partial<DowntimeTask> = {}): DowntimeTask {
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
    } as FishingData,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createDowntimeState(tasks: DowntimeTask[]): DowntimeState {
  return {
    ...downtimeInitialState,
    tasksById: Object.fromEntries(tasks.map((task) => [task.id, task])),
    taskOrder: tasks.map((task) => task.id),
  };
}

function SetDowntime({ tasks = [] }: { tasks?: DowntimeTask[] }) {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.setDowntime(createDowntimeState(tasks));
  }, [actions, tasks]);
  return null;
}

describe('UnifiedShell time header', () => {
  it('hides advance time button when GM mode is disabled', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    // TimeControls compact uses 'advance-slot-compact' test ID
    expect(screen.queryByTestId('advance-slot-compact')).not.toBeInTheDocument();
  });

  it('advances time when GM mode is enabled', () => {
    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');
    // TimeDisplay shows Day number and slot label (Morning, Afternoon, Night)
    expect(timeDisplay).toHaveTextContent('Day');
    expect(timeDisplay).toHaveTextContent('1');
    expect(timeDisplay).toHaveTextContent('Morning');

    fireEvent.click(screen.getByTestId('advance-slot-compact'));

    // After advancing, slot changes to Afternoon
    expect(timeDisplay).toHaveTextContent('Afternoon');
  });

  it('disables advance button and prevents advance when paused sessions exist', () => {
    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <PauseActivities pausedIds={['paused-1']} />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');
    const advanceButton = screen.getByTestId('advance-slot-compact');

    // Button should be disabled due to paused activities
    expect(advanceButton).toBeDisabled();

    // Click should not advance time - still Morning
    fireEvent.click(advanceButton);
    expect(timeDisplay).toHaveTextContent('Morning');
  });

  it('disables time advancement when the current slot has unresolved downtime tasks', () => {
    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <SetDowntime tasks={[createDowntimeTask()]} />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');
    const advanceSlotButton = screen.getByTestId('advance-slot-compact');
    const advanceDayButton = screen.getByTestId('advance-day-compact');

    expect(advanceSlotButton).toBeDisabled();
    expect(advanceDayButton).toBeDisabled();
    expect(advanceSlotButton).toHaveAttribute('title', '1 task(s) must be resolved or cancelled');

    fireEvent.click(advanceSlotButton);
    fireEvent.click(advanceDayButton);

    expect(timeDisplay).toHaveTextContent('Morning');
  });

  it('advances time after paused sessions are cleared', () => {
    const { unmount } = render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <PauseActivities pausedIds={['paused-1']} />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');
    fireEvent.click(screen.getByTestId('advance-slot-compact'));

    // Time should not advance - still Morning
    expect(timeDisplay).toHaveTextContent('Morning');

    unmount();

    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <PauseActivities pausedIds={[]} />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('advance-slot-compact'));
    // After advancing without paused activities, slot changes to Afternoon
    expect(screen.getByTestId('time-display')).toHaveTextContent('Afternoon');
  });

  it('advances to the next morning when the GM uses the compact advance day control', () => {
    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');

    fireEvent.click(screen.getByTestId('advance-day-compact'));

    expect(timeDisplay).toHaveTextContent('Day');
    expect(timeDisplay).toHaveTextContent('2');
    expect(timeDisplay).toHaveTextContent('Morning');
  });
});
