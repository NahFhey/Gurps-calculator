import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider, useLegacyAppState } from '../../state/campaignStore';
import { UnifiedShell } from '../UnifiedShell';
import type { ReactNode } from 'react';

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

function LegacyValueDisplay() {
  const legacyAppState = useLegacyAppState();
  return <div>Legacy Marker: {legacyAppState.marker as ReactNode}</div>;
}

describe('UnifiedShell legacy state bridge', () => {
  it('reflects legacy values passed into the store', () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <LegacyValueDisplay /> }
    ];

    const { unmount } = render(
      <CampaignStoreProvider initialLegacyAppState={{ marker: 'Alpha' }}>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    expect(screen.getByText('Legacy Marker: Alpha')).toBeInTheDocument();

    unmount();

    render(
      <CampaignStoreProvider initialLegacyAppState={{ marker: 'Beta' }}>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    expect(screen.getByText('Legacy Marker: Beta')).toBeInTheDocument();
  });
});
