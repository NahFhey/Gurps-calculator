import { describe, expect, it } from 'vitest';
import type { Character } from '../../../types/campaign';
import type { TravelGroup } from '../../../types/party';
import { createNewMap } from '../../../utils/mapUtils';
import { campaignReducer, createCampaignState, type CampaignState } from '../../campaignReducer';

/**
 * Phase 15a: currentLocationId is active-group-scoped. Switching the active
 * group (explicitly or implicitly when a drained group dissolves) re-derives
 * it from the new active group's position; a non-active group's arrival never
 * switches it.
 */
function build() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Scope', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  for (const tile of Object.values(map.tilesById)) tile.terrainId = 'terrain-plains';
  const wildTile = map.grid[4][2];
  const villageTile = map.grid[4][5];

  state.locations.locations['loc-village'] = {
    id: 'loc-village', name: 'Riverside', terrain: 'plains', modifiers: {} as never,
    createdAt: 0, modifiedAt: 0,
  } as never;
  state.locations.locations['loc-old'] = {
    id: 'loc-old', name: 'Old Camp', terrain: 'hills', modifiers: {} as never,
    createdAt: 0, modifiedAt: 0,
  } as never;
  state.locations.currentLocationId = 'loc-old';

  map.markersById['m-village'] = {
    id: 'm-village', tileId: villageTile, type: 'poi', label: 'Riverside',
    visibility: 'player', locationId: 'loc-village',
  } as never;
  map.tilesById[villageTile].markerIds = ['m-village'];

  const characters: Record<string, Character> = {
    a: { id: 'a', name: 'Ada', work: { skills: {} } } as never,
    b: { id: 'b', name: 'Brom', work: { skills: {} } } as never,
  };
  const g1: TravelGroup = {
    id: 'g1', name: 'Scouts', memberIds: ['a'], vehicleId: null,
    position: { mapId: map.id, tileId: wildTile },
  };
  const g2: TravelGroup = {
    id: 'g2', name: 'Traders', memberIds: ['b'], vehicleId: null,
    position: { mapId: map.id, tileId: villageTile },
  };
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  state.entities = {
    ...state.entities, characters,
    travelGroups: { g1, g2 }, vehicles: {}, vehicleTypes: {},
  };
  state.ui.activeTravelGroupId = 'g1';
  return { state, map, wildTile, villageTile };
}

const reduce = (s: CampaignState, action: Parameters<typeof campaignReducer>[1]) =>
  campaignReducer(s, action);

describe('active-group currentLocationId scoping (15a)', () => {
  it('switching the active group to one standing at a pinned location switches currentLocationId', () => {
    const { state } = build();
    const s = reduce(state, { type: 'party/setActiveGroup', payload: { groupId: 'g2' } });
    expect(s.ui.activeTravelGroupId).toBe('g2');
    expect(s.locations.currentLocationId).toBe('loc-village');
    expect(s.logs.entries.some(
      (entry) => entry.type === 'location.changed'
        && JSON.stringify(entry.payload).includes('Riverside')
    )).toBe(true);
  });

  it('switching to a group in wilderness keeps the location record but follows the tile terrain', () => {
    const { state } = build();
    // Make g2 active at the village first, then switch back to g1 in plains wilderness.
    let s = reduce(state, { type: 'party/setActiveGroup', payload: { groupId: 'g2' } });
    expect(s.locations.currentLocationId).toBe('loc-village');
    // Riverside starts as 'plains'; give it a stale terrain so the follow is observable.
    s = {
      ...s,
      locations: {
        ...s.locations,
        locations: {
          ...s.locations.locations,
          'loc-village': { ...s.locations.locations['loc-village'], terrain: 'hills' },
        },
      },
    };
    s = reduce(s, { type: 'party/setActiveGroup', payload: { groupId: 'g1' } });
    expect(s.ui.activeTravelGroupId).toBe('g1');
    // No pin at the wilderness tile: id unchanged, terrain follows the active tile.
    expect(s.locations.currentLocationId).toBe('loc-village');
    expect(s.locations.locations['loc-village'].terrain).toBe('plains');
  });

  it('re-selecting the already-active group changes nothing', () => {
    const { state } = build();
    const s = reduce(state, { type: 'party/setActiveGroup', payload: { groupId: 'g1' } });
    expect(s.locations.currentLocationId).toBe('loc-old');
    expect(s.logs.entries.some((entry) => entry.type === 'location.changed')).toBe(false);
  });

  it('implicit active reassignment (drained group dissolves) re-derives currentLocationId', () => {
    const { state, villageTile } = build();
    // Co-locate the groups at the village, make g1 active, then drain g1 into a new group.
    let s = reduce(state, { type: 'party/placeGroup', payload: { groupId: 'g1', mapId: state.maps.activeMapId!, tileId: villageTile } });
    // placeGroup of the active group already switches location; reset to simulate stale state.
    s = { ...s, locations: { ...s.locations, currentLocationId: 'loc-old' } };
    s = reduce(s, { type: 'party/createGroup', payload: { name: 'Vanguard', memberIds: ['a'], fromGroupId: 'g1' } });
    // g1 drained and dissolved; active moved to the new group standing at the village.
    expect(s.entities.travelGroups?.g1).toBeUndefined();
    expect(s.ui.activeTravelGroupId).not.toBe('g1');
    expect(s.locations.currentLocationId).toBe('loc-village');
  });

  it("a non-active group's arrival never switches currentLocationId", () => {
    const { state, wildTile, villageTile } = build();
    // Move g2 away then back to the village while g1 stays active.
    let s = reduce(state, { type: 'party/placeGroup', payload: { groupId: 'g2', mapId: state.maps.activeMapId!, tileId: wildTile } });
    s = reduce(s, { type: 'party/placeGroup', payload: { groupId: 'g2', mapId: state.maps.activeMapId!, tileId: villageTile } });
    expect(s.ui.activeTravelGroupId).toBe('g1');
    expect(s.locations.currentLocationId).toBe('loc-old');
  });
});
