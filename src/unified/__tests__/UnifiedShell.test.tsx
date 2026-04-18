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

describe('UnifiedShell module routing', () => {
  it('shows Rules content after clicking Rules', async () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'rules', label: 'Rules', content: <div>Rules Module</div> }
    ];

    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('rail-module-rules'));

    // The module content is rendered, check for the module's content
    expect(await screen.findByText('Rules Module')).toBeInTheDocument();
  });

  it('shows Inventory content after clicking Inventory', async () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'rules', label: 'Rules', content: <div>Rules Module</div> }
    ];

    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    // First click Rules to open the module pane, then switch to Inventory
    fireEvent.click(screen.getByTestId('rail-module-rules'));
    await screen.findByText('Rules Module');
    fireEvent.click(screen.getByTestId('rail-module-inventory'));

    // The module content is rendered, check for the module's content
    expect(await screen.findByText('Inventory Module')).toBeInTheDocument();
  });
});
