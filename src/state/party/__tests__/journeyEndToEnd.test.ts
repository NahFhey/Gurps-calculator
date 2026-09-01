import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../types/campaign';
import { createDefaultGCSData } from '../../../types/characterSheet';
import type { Journey, TravelGroup } from '../../../types/party';
import { createNewMap } from '../../../utils/mapUtils';
import { campaignReducer, createCampaignState, type CampaignState } from '../../campaignReducer';

function build() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'E2E', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  for (const tile of Object.values(map.tilesById)) tile.terrainId = 'terrain-plains';
  // Route: 4 eastward tiles = 3 steps x 12 mi; foot budget 12 mi/slot => 3 moving slots.
  const route = [map.grid[4][2], map.grid[4][3], map.grid[4][4], map.grid[4][5]];
  const dest = route[route.length - 1];
  // Hidden location marker at destination
  state.locations.locations['loc-1'] = {
    id: 'loc-1', name: 'Hidden Vale', terrain: 'plains', modifiers: {} as never,
    createdAt: 0, modifiedAt: 0,
  } as never;
  map.markersById['m1'] = {
    id: 'm1', tileId: dest, type: 'poi', label: 'Vale', visibility: 'gm', locationId: 'loc-1',
  } as never;
  map.tilesById[dest].markerIds = ['m1'];
  const characters: Record<string, Character> = {
    a: { id: 'a', name: 'Ada', work: { skills: {} } } as never,
  };
  const journey: Journey = {
    id: 'j1', mapId: map.id, routeTileIds: [...route], destinationTileId: dest,
    mode: 'foot', navigatorId: null, gmNavigationSkill: 18, forcedMarch: false,
    legProgressMiles: 0, milesTraveled: 0, status: 'active', gmOverride: false,
    startedAt: { day: 1, slot: 0 },
  };
  const group: TravelGroup = {
    id: 'g', name: 'Party', memberIds: ['a'], vehicleId: null,
    position: { mapId: map.id, tileId: route[0] }, journey,
  };
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  state.entities = { ...state.entities, characters, travelGroups: { g: group }, vehicles: {}, vehicleTypes: {} };
  state.downtime = { tasksById: {}, taskOrder: [], pendingDayLedger: null };
  state.ui.activeTravelGroupId = 'g';
  return { state, map, route, dest };
}

const tick = (s: CampaignState) => campaignReducer(s, { type: 'advanceTime' });

describe('journey end-to-end: multi-day arc', () => {
  afterEach(() => vi.restoreAllMocks());

  it('camps at night, rolls the day, arrives on day 2, discovers the hidden location', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, route, dest } = build();
    // Slot 0: move to route[1]
    let s = tick(state);
    expect(s.entities.travelGroups?.g.position?.tileId).toBe(route[1]);
    expect(s.time).toMatchObject({ day: 1, slot: 1 });
    // Slot 1: move to route[2]
    s = tick(s);
    expect(s.entities.travelGroups?.g.position?.tileId).toBe(route[2]);
    // Slot 2 (night): camp, no movement; day rolls to 2
    s = tick(s);
    expect(s.entities.travelGroups?.g.position?.tileId).toBe(route[2]);
    expect(s.time).toMatchObject({ day: 2, slot: 0 });
    expect(s.logs.entries.some((e) => e.type === 'travel.camp')).toBe(true);
    // Day 2 slot 0: final leg, arrival + discovery
    s = tick(s);
    expect(s.entities.travelGroups?.g.position?.tileId).toBe(dest);
    expect(s.entities.travelGroups?.g.journey).toBeNull();
    const marker = s.maps.mapsById[state.maps.activeMapId!].markersById['m1'];
    expect(marker.visibility).toBe('player');
    expect(marker.discoveredAt).toEqual({ day: 2, slot: 0 });
    expect(s.locations.currentLocationId).toBe('loc-1');
    expect(s.logs.entries.some((e) => e.type === 'travel.arrived')).toBe(true);
    // Travel tasks exist for each moving slot, none for camp
    const travelTasks = Object.values(s.downtime.tasksById).filter((t) => t.activityType === 'travel');
    expect(travelTasks).toHaveLength(3);
  });

  it('checkpoint restore mid-journey brings the journey and position back', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, route } = build();
    const afterOne = tick(state); // checkpoint 'Before time advance' captured pre-tick
    const afterTwo = tick(afterOne);
    expect(afterTwo.entities.travelGroups?.g.position?.tileId).toBe(route[2]);
    const checkpointId = afterTwo.checkpoints.entries[1].id; // snapshot before first tick
    const restored = campaignReducer(afterTwo, { type: 'restoreCheckpoint', payload: checkpointId });
    expect(restored.entities.travelGroups?.g.position?.tileId).toBe(route[0]);
    expect(restored.entities.travelGroups?.g.journey).toMatchObject({
      status: 'active', routeTileIds: route, milesTraveled: 0,
    });
    expect(Object.keys(restored.downtime.tasksById)).toHaveLength(0);
  });
});

describe('journey end-to-end: events and provisioning (C2)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('forced encounter pauses the journey, arms the intent, and gates resume on combat', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, map } = build();
    state.entities.encounterTemplates = {
      amb: { id: 'amb', name: 'Ambush', participants: [], createdAt: 0, updatedAt: 0 },
    };
    state.entities.travelEventTables = {
      t1: {
        id: 't1', name: 'Only Trouble',
        entries: [{ id: 'e1', kind: 'encounter', weight: 1, name: 'Ambush!', description: 'x', encounterTemplateId: 'amb' }],
      },
    };
    state.entities.travelEventTableSets = {
      s1: { id: 's1', name: 'Trouble Set', byTerrain: {}, fallbackTableId: 't1' },
    };
    map.travelEventTableSetId = 's1';
    const s = tick(state);
    expect(s.entities.travelGroups?.g.journey).toMatchObject({
      status: 'paused', pauseReason: 'encounter', pendingEncounterTemplateId: 'amb',
    });
    expect(s.ui.pendingIntent).toEqual({ kind: 'encounter', templateId: 'amb', groupId: 'g' });
    const withCombat: CampaignState = {
      ...s,
      combat: { ...s.combat, activeSession: { id: 'combat' } as CampaignState['combat']['activeSession'] },
    };
    const blocked = campaignReducer(withCombat, { type: 'party/resumeJourney', payload: { groupId: 'g' } });
    expect(blocked.entities.travelGroups?.g.journey?.status).toBe('paused');
    const resumed = campaignReducer(s, { type: 'party/resumeJourney', payload: { groupId: 'g' } });
    expect(resumed.entities.travelGroups?.g.journey).toMatchObject({ status: 'active' });
    expect(resumed.entities.travelGroups?.g.journey?.pendingEncounterTemplateId).toBeUndefined();
  });

  it('an unfed travel day costs 1 FP + debt; a recorded meal clears the debt', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state } = build();
    state.entities.characters.a.gcsData = createDefaultGCSData();
    const startFP = state.entities.characters.a.gcsData.pools.FP.current;
    let s = state;
    for (let i = 0; i < 3; i += 1) s = tick(s);
    expect(s.time.day).toBe(2);
    expect(s.entities.characters.a.gcsData?.pools.FP.current).toBe(startFP - 1);
    expect(s.entities.starvationFpDebt?.a).toBe(1);
    const fed = campaignReducer(s, { type: 'party/recordMeal', payload: { groupId: 'g', day: 2 } });
    expect(fed.entities.starvationFpDebt?.a).toBe(0);
    expect(fed.entities.groupMeals?.g).toBe(2);
  });
});
