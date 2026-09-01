import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultGCSData } from '../../../types/characterSheet';
import type { Character } from '../../../types/campaign';
import type { Journey, TravelGroup } from '../../../types/party';
import { createNewMap } from '../../../utils/mapUtils';
import { selectCharacterFatigueStatus } from '../../downtime/downtimeSelectors';
import { campaignReducer, createCampaignState, type CampaignState } from '../../campaignReducer';

function makeJourney(mapId: string, routeTileIds: string[], overrides: Partial<Journey> = {}): Journey {
  return {
    id: 'journey-1', mapId, routeTileIds, destinationTileId: routeTileIds[routeTileIds.length - 1],
    mode: 'foot', navigatorId: null, gmNavigationSkill: 18, forcedMarch: false,
    legProgressMiles: 0, milesTraveled: 0, status: 'active', gmOverride: false,
    startedAt: { day: 1, slot: 0 }, ...overrides,
  };
}

function fixture() {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Engine', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  for (const tile of Object.values(map.tilesById)) tile.terrainId = 'terrain-plains';
  const start = map.grid[4][4];
  const east = map.grid[4][5];
  const farEast = map.grid[4][6];
  const characters: Record<string, Character> = {
    a: { id: 'a', name: 'Ada', work: { skills: {} } },
    b: { id: 'b', name: 'Borin', work: { skills: {} } },
  };
  const group: TravelGroup = {
    id: 'g', name: 'Travelers', memberIds: ['a', 'b'], vehicleId: null,
    position: { mapId: map.id, tileId: start }, journey: makeJourney(map.id, [start, east]),
  };
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  state.entities = { ...state.entities, characters, travelGroups: { g: group }, vehicles: {}, vehicleTypes: {} };
  state.downtime = { tasksById: {}, taskOrder: [], pendingDayLedger: null };
  state.ui.activeTravelGroupId = 'g';
  return { state, map, start, east, farEast };
}

function tick(state: CampaignState): CampaignState {
  return campaignReducer(state, { type: 'advanceTime' });
}

describe('journey engine', () => {
  afterEach(() => vi.restoreAllMocks());

  it('moves on a successful tick, arrives, and creates a resolved travel task', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, map, east } = fixture();
    const next = tick(state);
    expect(next.entities.travelGroups?.g.position).toEqual({ mapId: map.id, tileId: east });
    expect(next.entities.travelGroups?.g.journey).toBeNull();
    expect(next.downtime.tasksById['task-travel-journey-1-1-0']).toMatchObject({
      activityType: 'travel', status: 'resolved', leaderId: 'a', helperIds: ['b'],
      activityData: { type: 'travel', milesMoved: 12, drifted: false },
    });
  });

  it('stamps travel work into the elapsed slot before advancing time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state } = fixture();
    const next = tick(state);
    expect(next.time.slot).toBe(1);
    expect(next.downtime.tasksById['task-travel-journey-1-1-0']).toMatchObject({ dayKey: 1, slot: 0 });
    expect(selectCharacterFatigueStatus(next.downtime, 'a', 1, 1)).toBe('tired');
  });

  it('auto-camps in a night slot without movement or a task', () => {
    const { state, start } = fixture();
    state.time.slot = 2;
    const next = tick(state);
    expect(next.entities.travelGroups?.g.position?.tileId).toBe(start);
    expect(next.downtime.taskOrder).toEqual([]);
    expect(next.logs.entries.some((entry) => entry.type === 'travel.camp')).toBe(true);
  });

  it('forced march moves during a night slot', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, east } = fixture();
    state.time.slot = 2;
    state.entities.travelGroups!.g.journey!.forcedMarch = true;
    const next = tick(state);
    expect(next.entities.travelGroups?.g.position?.tileId).toBe(east);
    expect(next.downtime.taskOrder).toHaveLength(1);
  });

  it('carries partial progress when an expensive tile takes two slots', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, map, start, east } = fixture();
    map.terrainById['terrain-plains'].perMode.foot.speedModifier = 0.5;
    const first = tick(state);
    expect(first.entities.travelGroups?.g.position?.tileId).toBe(start);
    expect(first.entities.travelGroups?.g.journey).toMatchObject({ legProgressMiles: 12, milesTraveled: 12 });
    const second = tick(first);
    expect(second.entities.travelGroups?.g.position?.tileId).toBe(east);
    expect(second.entities.travelGroups?.g.journey).toBeNull();
  });

  it('pauses a vehicle journey when free able crew are below minimum', () => {
    const { state, map, start, east } = fixture();
    state.entities.vehicles = { v: { id: 'v', name: 'Boat', typeId: 'boat', position: { kind: 'tile', mapId: map.id, tileId: start }, createdAt: 0, modifiedAt: 0 } };
    state.entities.vehicleTypes = { boat: { id: 'boat', name: 'Boat', mode: 'boat', speedMilesPerSlot: 50, minCrew: 3, hangarSlots: 0 } };
    const group = state.entities.travelGroups!.g;
    group.vehicleId = 'v';
    group.position = null;
    group.journey = makeJourney(map.id, [start, east], { mode: 'boat' });
    const next = tick(state);
    expect(next.entities.travelGroups?.g.journey).toMatchObject({ status: 'paused', pauseReason: 'crewBelowMinimum' });
    expect(next.downtime.taskOrder).toEqual([]);
  });

  it('pauses foot travel when every member is incapacitated', () => {
    const { state } = fixture();
    for (const character of Object.values(state.entities.characters)) {
      character.gcsData = createDefaultGCSData();
      character.gcsData.pools.HP.current = -100;
    }
    const next = tick(state);
    expect(next.entities.travelGroups?.g.journey).toMatchObject({ status: 'paused', pauseReason: 'crewBelowMinimum' });
  });

  it('never double-books an already assigned foot traveler', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state } = fixture();
    state.downtime.tasksById.busy = {
      id: 'busy', activityType: 'rest', dayKey: 1, slot: 0, leaderId: 'a', helperIds: [], status: 'pending',
      activityData: { type: 'rest', restType: 'sleep', recoveryBonus: 0 }, createdAt: 0, updatedAt: 0,
    };
    state.downtime.taskOrder.push('busy');
    const next = tick(state);
    expect(next.downtime.tasksById['task-travel-journey-1-1-0']).toMatchObject({ leaderId: 'b', helperIds: [] });
  });

  it('drifts laterally on failure, resets leg progress, and reroutes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { state, east } = fixture();
    state.entities.travelGroups!.g.journey!.gmNavigationSkill = 2;
    state.entities.travelGroups!.g.journey!.legProgressMiles = 4;
    const next = tick(state);
    const group = next.entities.travelGroups!.g;
    expect(group.position?.tileId).not.toBe(east);
    expect(group.journey?.legProgressMiles).toBe(0);
    expect(next.downtime.tasksById['task-travel-journey-1-1-0'].activityData)
      .toMatchObject({ type: 'travel', milesMoved: 0, drifted: true });
    expect(next.logs.entries.some((entry) => entry.type === 'travel.drifted')).toBe(true);
  });

  it('stays put legally when drift has no eligible candidate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { state, map, start, east } = fixture();
    state.entities.travelGroups!.g.journey!.gmNavigationSkill = 2;
    for (const tileId of map.grid.flat()) {
      if (tileId !== start && tileId !== east) map.tilesById[tileId].terrainId = 'wall';
    }
    map.terrainById.wall = {
      id: 'wall', name: 'Wall', color: '#000', elevation: 1,
      perMode: { foot: { passable: false, speedModifier: 1 }, boat: { passable: false, speedModifier: 1 }, airship: { passable: false, speedModifier: 1 } },
    };
    const next = tick(state);
    expect(next.entities.travelGroups?.g.position?.tileId).toBe(start);
    expect(next.logs.entries.find((entry) => entry.type === 'travel.drifted')?.payload.message)
      .toContain('0 tile(s)');
  });

  it('pauses with noRoute when a failed navigation cannot route to the destination', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { state } = fixture();
    const journey = state.entities.travelGroups!.g.journey!;
    journey.gmNavigationSkill = 2;
    journey.destinationTileId = 'missing-destination';
    const next = tick(state);
    expect(next.entities.travelGroups?.g.journey).toMatchObject({ status: 'paused', pauseReason: 'noRoute' });
  });

  it('processes group ids deterministically when crew is already assigned', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { state, map, start, east } = fixture();
    state.entities.travelGroups = {
      b: { id: 'b', name: 'B', memberIds: ['a'], vehicleId: null, position: { mapId: map.id, tileId: start }, journey: makeJourney(map.id, [start, east], { id: 'jb' }) },
      a: { id: 'a', name: 'A', memberIds: ['a'], vehicleId: null, position: { mapId: map.id, tileId: start }, journey: makeJourney(map.id, [start, east], { id: 'ja' }) },
    };
    const next = tick(state);
    expect(next.downtime.taskOrder).toEqual(['task-travel-ja-1-0']);
  });
});
