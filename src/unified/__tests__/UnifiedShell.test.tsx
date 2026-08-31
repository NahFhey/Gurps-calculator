import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider } from '../../state/campaignStore';
import { campaignReducer, createCampaignState } from '../../state/campaignReducer';
import { serializeCampaignState, hydrateCampaignState } from '../../persistence/campaignStorage';
import { createPresetTerrains } from '../../constants/map';
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

  it('keeps the active module open across a reload and a re-click on its rail button', async () => {
    // Regression: a GM created a map (active module 'map'), reloaded, and clicking
    // the Map rail button blanked the pane and persisted ui.activeModule = ''.
    // Simulate the pre-reload session: enable GM mode, create a map, open the map module.
    let state = createCampaignState();
    state = campaignReducer(state, { type: 'setGmMode', payload: true });
    state = campaignReducer(state, {
      type: 'map/createMap',
      payload: { name: 'Test Map', scaleMilesPerTile: 12, startTerrainId: createPresetTerrains()[0].id },
    });
    state = campaignReducer(state, { type: 'setActiveModule', payload: 'map' });

    // Simulate the reload: serialize -> JSON round-trip -> hydrate, as the boot flow does.
    const reloaded = hydrateCampaignState(JSON.parse(JSON.stringify(serializeCampaignState(state))));
    expect(reloaded.ui.activeModule).toBe('map');
    expect(Object.keys(reloaded.maps.mapsById)).toHaveLength(1);

    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'map', label: 'Map', content: <div>Map Module</div> }
    ];

    render(
      <CampaignStoreProvider initialCampaignState={reloaded}>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    // The hydrated active module renders without any clicks.
    expect(await screen.findByText('Map Module')).toBeInTheDocument();

    // Clicking the already-active module keeps it open instead of toggling it off.
    fireEvent.click(screen.getByTestId('rail-module-map'));
    expect(screen.getByText('Map Module')).toBeInTheDocument();
  });
});
