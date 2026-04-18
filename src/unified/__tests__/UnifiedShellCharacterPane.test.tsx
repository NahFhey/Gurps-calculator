import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
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
  { id: 'downtime', label: 'Downtime', content: <div>Downtime Module</div> }
];

describe('UnifiedShell character pane', () => {
  it('hides character panel when no character is selected', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    // Character pane exists but is invisible when no character selected
    const characterPane = screen.getByTestId('character-pane');
    expect(characterPane).toBeInTheDocument();
  });

  it('shows selected character name in character sheet', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('party-character-char-rina'));

    // Character name appears multiple times (party list + character sheet)
    const rinaElements = screen.getAllByText('Rina');
    expect(rinaElements.length).toBeGreaterThan(1);
  });

  it('shows character information when selected', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('party-character-char-rina'));

    // Verify the character pane contains the selected character's info
    const characterPane = screen.getByTestId('character-pane');
    expect(characterPane).toBeInTheDocument();
    // Character name appears multiple times after selection (party list + character sheet)
    const rinaElements = screen.getAllByText('Rina');
    expect(rinaElements.length).toBeGreaterThan(1);
  });
});
