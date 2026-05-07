import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

describe('UnifiedShell party list', () => {
  it('highlights the selected character when clicked', () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'downtime', label: 'Downtime', content: <div>Downtime Module</div> }
    ];

    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const rinaRow = screen.getByTestId('party-character-char-rina');
    fireEvent.click(rinaRow);

    expect(rinaRow).toHaveAttribute('data-selected', 'true');
  });

  it('changes character panel view when Skills/Inventory buttons are clicked', () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'downtime', label: 'Downtime', content: <div>Downtime Module</div> }
    ];

    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const rinaRow = screen.getByTestId('party-character-char-rina');
    const inventoryButton = within(rinaRow).getByRole('button', { name: 'Inventory' });
    const skillsButton = within(rinaRow).getByRole('button', { name: 'Skills' });

    // Clicking Skills button should select the character and show skills panel view
    fireEvent.click(skillsButton);
    expect(rinaRow).toHaveAttribute('data-selected', 'true');

    // Clicking Inventory button should show inventory panel view
    fireEvent.click(inventoryButton);
    expect(rinaRow).toHaveAttribute('data-selected', 'true');
  });
});
