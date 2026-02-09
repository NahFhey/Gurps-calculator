import React, { useEffect } from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../state/campaignStore';
import { UnifiedShell } from '../UnifiedShell';
import type { DowntimeTask, FishingData, RestData } from '../../types/downtime';

const modules = [
  { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
];

// Helper to create a fishing task
function createFishingTask(
  id: string,
  leaderId: string,
  dayKey: number,
  slot: number,
  status: 'pending' | 'resolved' | 'cancelled' = 'pending'
): DowntimeTask {
  const now = Date.now();
  return {
    id,
    activityType: 'fishing',
    dayKey,
    slot,
    leaderId,
    helperIds: [],
    status,
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
  };
}

// Helper to create a rest task
function createRestTask(
  id: string,
  leaderId: string,
  dayKey: number,
  slot: number,
  status: 'pending' | 'resolved' | 'cancelled' = 'resolved'
): DowntimeTask {
  const now = Date.now();
  return {
    id,
    activityType: 'rest',
    dayKey,
    slot,
    leaderId,
    helperIds: [],
    status,
    activityData: {
      type: 'rest',
      restType: 'sleep',
      recoveryBonus: 0,
    } as RestData,
    createdAt: now,
    updatedAt: now,
  };
}

// Component to inject downtime state for testing
function InjectDowntimeState({
  tasks,
  day = 1,
  slot = 0,
}: {
  tasks: DowntimeTask[];
  day?: number;
  slot?: number;
}) {
  const { state, actions } = useCampaignStore();

  useEffect(() => {
    // We can't directly set downtime state through actions,
    // but we can use debug actions if available
    // For now, just set time
    actions.setTimeDay(day);
    actions.setDayPlannerSlot(slot);
  }, [actions, day, slot]);

  return null;
}

describe('UnifiedShell party sidebar downtime badges', () => {
  it('renders character list without downtime badges when no tasks exist', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    // Check that character rows are rendered
    const rinaRow = screen.getByTestId('party-character-char-rina');
    expect(rinaRow).toBeInTheDocument();

    // Check default state - no assignment
    expect(rinaRow).toHaveAttribute('data-assigned', 'false');
    expect(rinaRow).toHaveAttribute('data-fatigue', 'rested');
  });

  it('has data attributes for testing status integration', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const rinaRow = screen.getByTestId('party-character-char-rina');

    // Should have data attributes for testing
    expect(rinaRow).toHaveAttribute('data-fatigue');
    expect(rinaRow).toHaveAttribute('data-assigned');
  });

  it('renders character name within row', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const rinaRow = screen.getByTestId('party-character-char-rina');
    expect(within(rinaRow).getByText('Rina')).toBeInTheDocument();
  });

  it('shows HP and FP stats in character row', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const rinaRow = screen.getByTestId('party-character-char-rina');
    // Check for HP/FP display pattern
    expect(within(rinaRow).getByText(/HP.*\/.*FP/)).toBeInTheDocument();
  });
});

describe('CharacterStatusBadge integration', () => {
  it('badge component is imported and available', async () => {
    // Test that the badge component is properly imported
    const { CharacterStatusBadge } = await import(
      '../../components/downtime/views/CharacterStatusBadge'
    );
    expect(CharacterStatusBadge).toBeDefined();
  });

  it('badge renders assignment indicator correctly', async () => {
    const { CharacterStatusBadge } = await import(
      '../../components/downtime/views/CharacterStatusBadge'
    );
    const { render: renderComponent, screen: testScreen } = await import(
      '@testing-library/react'
    );

    renderComponent(
      <CharacterStatusBadge
        summary={{
          characterId: 'test-char',
          isAssigned: true,
          activityDisplayName: 'Fishing',
          role: 'leader',
          taskId: 'task-1',
          fatigueStatus: 'rested',
        }}
      />
    );

    expect(testScreen.getByTitle('Assigned to: Fishing')).toBeInTheDocument();
  });

  it('badge renders tired indicator correctly', async () => {
    const { CharacterStatusBadge } = await import(
      '../../components/downtime/views/CharacterStatusBadge'
    );
    const { render: renderComponent, screen: testScreen } = await import(
      '@testing-library/react'
    );

    renderComponent(
      <CharacterStatusBadge
        summary={{
          characterId: 'test-char',
          isAssigned: false,
          activityDisplayName: null,
          role: null,
          taskId: null,
          fatigueStatus: 'tired',
        }}
      />
    );

    expect(testScreen.getByTitle('Tired - needs rest')).toBeInTheDocument();
  });

  it('badge renders exhausted indicator correctly', async () => {
    const { CharacterStatusBadge } = await import(
      '../../components/downtime/views/CharacterStatusBadge'
    );
    const { render: renderComponent, screen: testScreen } = await import(
      '@testing-library/react'
    );

    renderComponent(
      <CharacterStatusBadge
        summary={{
          characterId: 'test-char',
          isAssigned: false,
          activityDisplayName: null,
          role: null,
          taskId: null,
          fatigueStatus: 'exhausted',
        }}
      />
    );

    expect(
      testScreen.getByTitle('Exhausted - worked without rest')
    ).toBeInTheDocument();
  });
});

describe('useAllCharacterSlotSummaries hook integration', () => {
  it('hook is properly exported and can be imported', async () => {
    const { useAllCharacterSlotSummaries } = await import(
      '../../hooks/useCharacterSlotSummary'
    );
    expect(useAllCharacterSlotSummaries).toBeDefined();
    expect(typeof useAllCharacterSlotSummaries).toBe('function');
  });

  it('hook returns a Map', async () => {
    const { useAllCharacterSlotSummaries } = await import(
      '../../hooks/useCharacterSlotSummary'
    );
    const { renderHook } = await import('@testing-library/react');
    const { CampaignStoreProvider: Provider } = await import(
      '../../state/campaignStore'
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider>{children}</Provider>
    );

    const { result } = renderHook(
      () => useAllCharacterSlotSummaries(['char-1', 'char-2']),
      { wrapper }
    );

    expect(result.current).toBeInstanceOf(Map);
  });
});
