import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState, type CampaignState } from '../campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import type { MarkerVisibility } from '../../types/map';

function fixture(visibility: MarkerVisibility = 'gm') {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Places', scaleMilesPerTile: 12, startTerrainId: 'plains' });
  const origin = map.grid[4][4];
  const destination = map.grid[4][5];
  state.maps = { ...state.maps, activeMapId: map.id, mapsById: { [map.id]: map } };
  state.entities.travelGroups = {
    active: { id: 'active', name: 'Active', memberIds: [], vehicleId: null, position: { mapId: map.id, tileId: origin } },
    scouts: { id: 'scouts', name: 'Scouts', memberIds: [], vehicleId: null, position: { mapId: map.id, tileId: origin } },
  };
  state.ui.activeTravelGroupId = 'active';
  state.locations.locations = {
    camp: { id: 'camp', name: 'Camp', climate: 'temperate', terrain: 'plains', modifiers: { gathering: 0, hunting: 0, foraging: 0, travel: 0 }, createdAt: 1, modifiedAt: 1 },
    town: { id: 'town', name: 'Ravenport', climate: 'oceanic', terrain: 'urban', modifiers: { gathering: 0, hunting: 0, foraging: 0, travel: 0 }, createdAt: 1, modifiedAt: 1 },
  };
  state.locations.currentLocationId = 'camp';
  map.markersById.town = { id: 'town', tileId: destination, type: 'location', label: 'Ravenport', visibility, locationId: 'town' };
  map.tilesById[destination].markerIds.push('town');
  return { state, map, origin, destination };
}

function arrive(state: CampaignState, mapId: string, destination: string, groupId = 'active') {
  return campaignReducer(state, {
    type: 'party/placeGroup',
    payload: { groupId, mapId, tileId: destination },
  });
}

describe('location arrival cross-slice behavior', () => {
  it('switches the active group current location at a linked destination', () => {
    const { state, map, destination } = fixture();
    expect(arrive(state, map.id, destination).locations.currentLocationId).toBe('town');
  });

  it('logs the named arrival', () => {
    const { state, map, destination } = fixture();
    const result = arrive(state, map.id, destination);
    expect(result.logs.entries.find((entry) => entry.type === 'location.changed')?.payload.message).toBe('Party arrived at Ravenport');
  });

  it('discovers a GM location pin at the current time', () => {
    const { state, map, destination } = fixture();
    const result = arrive(state, map.id, destination);
    expect(result.maps.mapsById[map.id].markersById.town).toMatchObject({ visibility: 'player', discoveredAt: { day: 1, slot: 0 } });
  });

  it('uses the current day and slot', () => {
    const { state, map, destination } = fixture();
    state.time.day = 8;
    state.time.slot = state.time.slotsPerDay - 1;
    expect(arrive(state, map.id, destination).maps.mapsById[map.id].markersById.town.discoveredAt).toEqual({ day: 8, slot: 2 });
  });

  it('logs discovery with an explicit filterable day', () => {
    const { state, map, destination } = fixture();
    const result = arrive(state, map.id, destination);
    const log = result.logs.entries.find((entry) => entry.type === 'location.discovered');
    expect(log).toMatchObject({ day: 1, payload: { message: 'Discovered Ravenport' } });
  });

  it('leaves an already-player marker discovery metadata untouched', () => {
    const { state, map, destination } = fixture('player');
    const result = arrive(state, map.id, destination);
    expect(result.maps.mapsById[map.id].markersById.town.discoveredAt).toBeUndefined();
    expect(result.logs.entries.some((entry) => entry.type === 'location.discovered')).toBe(false);
  });

  it('does not discover a plain GM marker on the same tile', () => {
    const { state, map, destination } = fixture();
    map.markersById.note = { id: 'note', tileId: destination, type: 'note', label: 'Secret', visibility: 'gm' };
    const result = arrive(state, map.id, destination);
    expect(result.maps.mapsById[map.id].markersById.note).toMatchObject({ visibility: 'gm' });
    expect(result.maps.mapsById[map.id].markersById.note.discoveredAt).toBeUndefined();
  });

  it('discovers for a non-active group without changing campaign current location', () => {
    const { state, map, destination } = fixture();
    const result = arrive(state, map.id, destination, 'scouts');
    expect(result.locations.currentLocationId).toBe('camp');
    expect(result.maps.mapsById[map.id].markersById.town.visibility).toBe('player');
    expect(result.logs.entries.some((entry) => entry.type === 'location.changed')).toBe(false);
  });

  it('applies the same active-group switch during manual placement', () => {
    const { state, map, destination } = fixture();
    const result = campaignReducer(state, { type: 'party/placeGroup', payload: { groupId: 'active', mapId: map.id, tileId: destination } });
    expect(result.locations.currentLocationId).toBe('town');
    expect(result.maps.mapsById[map.id].markersById.town.visibility).toBe('player');
  });

  it('retains wilderness terrain synchronization on an unlinked tile', () => {
    const { state, map, destination } = fixture();
    delete map.markersById.town;
    map.tilesById[destination].markerIds = [];
    map.tilesById[destination].terrainId = 'terrain-forest';
    const result = arrive(state, map.id, destination);
    expect(result.locations.currentLocationId).toBe('camp');
    expect(result.locations.locations.camp.terrain).toBe('forest');
    expect(result.logs.entries.some((entry) => entry.type === 'terrain.changed')).toBe(true);
  });
});
