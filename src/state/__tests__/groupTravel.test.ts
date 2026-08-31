import { describe, expect, it } from 'vitest';
import { createNewMap } from '../../utils/mapUtils';
import { resolveGroupPosition, resolveVehiclePosition } from '../../utils/partyPosition';
import { campaignReducer, createCampaignState } from '../campaignReducer';
import type { CampaignState } from '../campaignReducer';
import type { Vehicle } from '../../types/party';

function fixture() {
  const state = createCampaignState();
  const map = createNewMap({
    name: 'Route', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains',
  });
  const origin = map.grid[4][4];
  const destination = map.grid[4][5];
  state.maps.mapsById = { [map.id]: map };
  state.maps.activeMapId = map.id;
  return { state, map, origin, destination };
}

function travel(state: CampaignState, mapId: string, origin: string, destination: string, groupId: string) {
  return campaignReducer(state, {
    type: 'map/executeTravel',
    payload: {
      mapId, routeTileIds: [origin, destination], destinationTileId: destination,
      mode: 'foot', gmOverride: false, groupId,
    },
  });
}

const ship = (id: string, mapId: string, tileId: string): Vehicle => ({
  id, name: id, typeId: 'vt-skyship',
  position: { kind: 'tile', mapId, tileId }, createdAt: 0, modifiedAt: 0,
});

describe('group travel execution', () => {
  it('moves a foot group position', () => {
    const { state, map, origin, destination } = fixture();
    state.entities.travelGroups = {
      walkers: { id: 'walkers', name: 'Walkers', memberIds: [], vehicleId: null, position: { mapId: map.id, tileId: origin } },
    };
    const next = travel(state, map.id, origin, destination, 'walkers');
    expect(next.entities.travelGroups?.walkers.position).toEqual({ mapId: map.id, tileId: destination });
  });

  it('moves the vehicle so every group aboard follows', () => {
    const { state, map, origin, destination } = fixture();
    state.entities.vehicles = { vessel: ship('vessel', map.id, origin) };
    state.entities.travelGroups = {
      bridge: { id: 'bridge', name: 'Bridge', memberIds: [], vehicleId: 'vessel', position: null },
      cabin: { id: 'cabin', name: 'Cabin', memberIds: [], vehicleId: 'vessel', position: null },
    };
    const next = travel(state, map.id, origin, destination, 'bridge');
    expect(next.entities.vehicles?.vessel.position)
      .toEqual({ kind: 'tile', mapId: map.id, tileId: destination });
    expect(resolveGroupPosition(next, next.entities.travelGroups!.cabin))
      .toEqual({ mapId: map.id, tileId: destination });
  });

  it('carries a docked lancer without rewriting its docked position', () => {
    const { state, map, origin, destination } = fixture();
    const carrier = ship('carrier', map.id, origin);
    const lancer = ship('lancer', map.id, origin);
    lancer.position = { kind: 'docked', carrierId: carrier.id };
    state.entities.vehicles = { carrier, lancer };
    state.entities.travelGroups = {
      crew: { id: 'crew', name: 'Crew', memberIds: [], vehicleId: carrier.id, position: null },
    };
    const next = travel(state, map.id, origin, destination, 'crew');
    expect(next.entities.vehicles?.lancer.position).toEqual({ kind: 'docked', carrierId: carrier.id });
    expect(resolveVehiclePosition(next.entities.vehicles!, lancer.id))
      .toEqual({ mapId: map.id, tileId: destination });
  });

  it('advances exactly one slot and records the pre-travel checkpoint', () => {
    const { state, map, origin, destination } = fixture();
    state.entities.travelGroups = {
      walkers: { id: 'walkers', name: 'Walkers', memberIds: [], vehicleId: null, position: { mapId: map.id, tileId: origin } },
    };
    const next = travel(state, map.id, origin, destination, 'walkers');
    expect(next.time.slot).toBe(1);
    expect(next.checkpoints.entries).toHaveLength(1);
    expect(next.checkpoints.entries[0].snapshot.entities.travelGroups?.walkers.position)
      .toEqual({ mapId: map.id, tileId: origin });
  });

  it('does not move, checkpoint, reveal, or advance time for an unresolvable group', () => {
    const { state, map, origin, destination } = fixture();
    state.entities.travelGroups = {
      lost: { id: 'lost', name: 'Lost', memberIds: [], vehicleId: null, position: { mapId: map.id, tileId: 'missing' } },
    };
    const revealed = new Set(map.revealedTileIds);
    const next = travel(state, map.id, origin, destination, 'lost');
    expect(next).toBe(state);
    expect(next.maps.mapsById[map.id].revealedTileIds).toEqual(revealed);
    expect(next.time.slot).toBe(0);
    expect(next.checkpoints.entries).toHaveLength(0);
  });
});
