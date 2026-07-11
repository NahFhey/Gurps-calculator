import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider } from '../../state/campaignStore';
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
  { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
];

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
