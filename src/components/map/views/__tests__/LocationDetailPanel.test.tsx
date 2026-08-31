import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../../state/campaignStore';
import { createCampaignState, type CampaignState } from '../../../../state/campaignReducer';
import type { LocationPin } from '../../../../state/selectors';
import { LocationDetailPanel } from '../LocationDetailPanel';

const pin: LocationPin = {
  locationId: 'town', mapId: 'map', tileId: 'tile', markerId: 'pin', visibility: 'gm',
};

function makeState(gmMode: boolean): CampaignState {
  const state = createCampaignState();
  state.ui.gmModeEnabled = gmMode;
  state.locations.locations.town = {
    id: 'town', name: 'Ravenport', description: 'A busy harbor', gmNotes: 'Smugglers below the quay',
    climate: 'oceanic', terrain: 'urban', modifiers: { gathering: 0, hunting: 0, foraging: 0, travel: 0 }, createdAt: 1, modifiedAt: 1,
  };
  state.entities.facilities.forge = { id: 'forge', name: 'Dock Forge', facilityType: 'workshop', rating: 2, attachment: { kind: 'location', locationId: 'town' } };
  state.entities.kitchens.inn = { id: 'inn', name: 'Inn Kitchen', rating: 1, description: '', attachment: { kind: 'location', locationId: 'town' } };
  state.entities.contacts = {
    npc: { id: 'npc', name: 'Mara', kind: 'person', modifier: 2, history: [], createdAt: 1, updatedAt: 1, locationId: 'town' },
  };
  state.maps.mapsById.map = {
    id: 'map', name: 'Map', climate: 'temperate', visionMode: 'open', scaleMilesPerTile: 12,
    rows: 1, cols: 1, grid: [['tile']], tilesById: { tile: { id: 'tile', terrainId: null, markerIds: ['pin'], linkIds: [] } },
    terrainById: {}, markersById: { pin: { id: 'pin', tileId: 'tile', type: 'location', label: 'Ravenport', visibility: 'gm', locationId: 'town' } },
    linksById: {}, revealedTileIds: new Set(), lastSelectedTerrainId: '', lastPlacedTerrainId: '',
  };
  return state;
}

function Probe({ onState }: { onState: (state: CampaignState) => void }) {
  onState(useCampaignStore().state);
  return null;
}

function renderPanel(gmMode: boolean, pinOverride: Partial<LocationPin> = {}) {
  let latest = makeState(gmMode);
  render(
    <CampaignStoreProvider initialCampaignState={latest}>
      <LocationDetailPanel locationId="town" pin={{ ...pin, ...pinOverride }} onClose={() => undefined} />
      <Probe onState={(state) => { latest = state; }} />
    </CampaignStoreProvider>
  );
  return () => latest;
}

describe('LocationDetailPanel', () => {
  it('renders the location name, terrain, climate, and description', () => {
    renderPanel(false);
    expect(screen.getByText('Ravenport')).toBeInTheDocument();
    expect(screen.getByText(/Urban.*Oceanic/)).toBeInTheDocument();
    expect(screen.getByText('A busy harbor')).toBeInTheDocument();
  });

  it('hides GM notes in player mode', () => {
    renderPanel(false);
    expect(screen.queryByText('Smugglers below the quay')).not.toBeInTheDocument();
  });

  it('shows GM notes and controls in GM mode', () => {
    renderPanel(true);
    expect(screen.getByText('Smugglers below the quay')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hidden' })).toBeInTheDocument();
  });

  it('renders attached facilities and present contacts', () => {
    renderPanel(true);
    expect(screen.getByText(/Dock Forge/)).toBeInTheDocument();
    expect(screen.getByText(/Inn Kitchen/)).toBeInTheDocument();
    expect(screen.getByText('Mara')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders discovered and undiscovered journal lines', () => {
    const { unmount } = render(<CampaignStoreProvider initialCampaignState={makeState(false)}><LocationDetailPanel locationId="town" pin={pin} onClose={() => undefined} /></CampaignStoreProvider>);
    expect(screen.getByText('Undiscovered')).toBeInTheDocument();
    unmount();
    render(<CampaignStoreProvider initialCampaignState={makeState(false)}><LocationDetailPanel locationId="town" pin={{ ...pin, discoveredAt: { day: 12, slot: 1 } }} onClose={() => undefined} /></CampaignStoreProvider>);
    expect(screen.getByText('Discovered day 12')).toBeInTheDocument();
  });

  it('manual reveal updates visibility and stamps discovery once', () => {
    const getState = renderPanel(true);
    fireEvent.click(screen.getByRole('button', { name: 'Hidden' }));
    expect(getState().maps.mapsById.map.markersById.pin).toMatchObject({ visibility: 'player', discoveredAt: { day: 1, slot: 0 } });
  });
});
