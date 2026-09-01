import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNewMap } from '../../utils/mapUtils';
import { resolveGroupPosition } from '../../utils/partyPosition';
import { campaignReducer, createCampaignState } from '../campaignReducer';
import type { CampaignState } from '../campaignReducer';
import type { Vehicle } from '../../types/party';

function fixture() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Route', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  const origin = map.grid[4][4];
  const destination = map.grid[4][5];
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  state.entities = {
    ...state.entities,
    characters: { ...state.entities.characters, crew: { id: 'crew', name: 'Crew', work: { skills: {} } } },
  };
  return { state, map, origin, destination };
}

function armAndTick(state: CampaignState, mapId: string, origin: string, destination: string, groupId: string) {
  const armed = campaignReducer(state, {
    type: 'party/armJourney',
    payload: { groupId, journey: {
      mapId, routeTileIds: [origin, destination], destinationTileId: destination,
      mode: state.entities.travelGroups?.[groupId].vehicleId ? 'airship' : 'foot',
      navigatorId: null, gmNavigationSkill: 18, forcedMarch: true, gmOverride: false,
    } },
  });
  return campaignReducer(armed, { type: 'advanceTime' });
}

const ship = (id: string, mapId: string, tileId: string): Vehicle => ({
  id, name: id, typeId: 'vehicle-airship',
  position: { kind: 'tile', mapId, tileId }, createdAt: 0, modifiedAt: 0,
});

describe('group journey movement', () => {
  afterEach(() => vi.restoreAllMocks());

  it('moves a foot group through the tick', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, map, origin, destination } = fixture();
    state.entities.travelGroups = {
      walkers: { id: 'walkers', name: 'Walkers', memberIds: ['crew'], vehicleId: null, position: { mapId: map.id, tileId: origin } },
    };
    const next = armAndTick(state, map.id, origin, destination, 'walkers');
    expect(next.entities.travelGroups?.walkers.position).toEqual({ mapId: map.id, tileId: destination });
  });

  it('moves the vehicle so every group aboard follows', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, map, origin, destination } = fixture();
    state.entities.vehicles = { vessel: ship('vessel', map.id, origin) };
    state.entities.vehicleTypes = {
      'vehicle-airship': { id: 'vehicle-airship', name: 'Airship', mode: 'airship', minCrew: 1, hangarSlots: 1, speedMilesPerSlot: 457 },
    };
    state.entities.travelGroups = {
      bridge: { id: 'bridge', name: 'Bridge', memberIds: ['crew'], vehicleId: 'vessel', position: null },
      cabin: { id: 'cabin', name: 'Cabin', memberIds: [], vehicleId: 'vessel', position: null },
    };
    const next = armAndTick(state, map.id, origin, destination, 'bridge');
    expect(next.entities.vehicles?.vessel.position).toEqual({ kind: 'tile', mapId: map.id, tileId: destination });
    expect(resolveGroupPosition(next, next.entities.travelGroups!.cabin)).toEqual({ mapId: map.id, tileId: destination });
  });

  it('records one pre-advance checkpoint', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, map, origin, destination } = fixture();
    state.entities.travelGroups = {
      walkers: { id: 'walkers', name: 'Walkers', memberIds: ['crew'], vehicleId: null, position: { mapId: map.id, tileId: origin } },
    };
    const next = armAndTick(state, map.id, origin, destination, 'walkers');
    expect(next.time.slot).toBe(1);
    expect(next.checkpoints.entries[0].label).toBe('Before time advance');
    expect(next.checkpoints.entries[0].snapshot.entities.travelGroups?.walkers.position)
      .toEqual({ mapId: map.id, tileId: origin });
  });
});
