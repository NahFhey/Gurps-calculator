import { describe, expect, it } from 'vitest';
import { createDefaultGCSData } from '../../types/characterSheet';
import type { Character } from '../../types/campaign';
import type { DowntimeState, DowntimeTask } from '../../types/downtime';
import type { MapModel, MapScale, TerrainModel, TileModel, TravelMode } from '../../types/map';
import { TRAVEL_BLOCKER_CODES } from '../../types/map';
import type { TravelGroup, Vehicle, VehicleTypeDef } from '../../types/party';
import { getRouteStats, validateTravelRoute, type TravelValidationInput } from '../mapTravelValidation';

function makeTerrain(id: string, passable = true): TerrainModel {
  return {
    id,
    name: id,
    color: '#fff',
    perMode: {
      foot: { passable, speedModifier: 1 },
      boat: { passable, speedModifier: 1 },
      airship: { passable, speedModifier: 1 },
    },
  };
}

function makeMap(scale: MapScale = 12, overrides: Record<string, string | null> = {}): MapModel {
  const terrain = makeTerrain('plains');
  const tilesById: Record<string, TileModel> = {};
  const grid = [Array.from({ length: 5 }, (_, col) => {
    const id = `t-0-${col}`;
    tilesById[id] = {
      id,
      terrainId: id in overrides ? overrides[id] : terrain.id,
      markerIds: [],
      linkIds: [],
    };
    return id;
  })];
  return {
    id: 'map-1',
    name: 'Test',
    climate: 'temperate',
    visionMode: 'lineOfSight',
    scaleMilesPerTile: scale,
    rows: 1,
    cols: 5,
    grid,
    tilesById,
    terrainById: { plains: terrain },
    markersById: {},
    linksById: {},
    revealedTileIds: new Set(),
    lastSelectedTerrainId: 'plains',
    lastPlacedTerrainId: 'plains',
  };
}

const emptyDowntime = (): DowntimeState => ({ tasksById: {}, taskOrder: [], pendingDayLedger: null });

function character(id: string, hp = 10): Character {
  const gcsData = createDefaultGCSData();
  gcsData.pools.HP.current = hp;
  gcsData.pools.HP.max = 10;
  return { id, name: `Name ${id}`, work: { skills: {} }, gcsData };
}

const group: TravelGroup = {
  id: 'g1',
  name: 'Party',
  memberIds: ['pc-1'],
  vehicleId: null,
  position: { mapId: 'map-1', tileId: 't-0-0' },
};
const vehicle: Vehicle = {
  id: 'v1', name: 'Scout', typeId: 'boat-type',
  position: { kind: 'tile', mapId: 'map-1', tileId: 't-0-0' },
  createdAt: 0, modifiedAt: 0,
};
const boatType: VehicleTypeDef = {
  id: 'boat-type', name: 'Boat', mode: 'boat', minCrew: 1, hangarSlots: 0,
};

function input(overrides: Partial<TravelValidationInput> = {}): TravelValidationInput {
  return {
    map: makeMap(),
    routeTileIds: ['t-0-0', 't-0-1'],
    mode: 'foot',
    group,
    characters: { 'pc-1': character('pc-1') },
    vehicle: null,
    vehicleType: null,
    day: 1,
    slot: 0,
    downtimeState: emptyDowntime(),
    isGmMode: false,
    ...overrides,
  };
}

function task(status: DowntimeTask['status'] = 'pending'): DowntimeTask {
  return {
    id: 'task-1', activityType: 'rest', dayKey: 1, slot: 0,
    leaderId: 'pc-1', helperIds: [], status,
    activityData: { type: 'rest', restType: 'sleep', recoveryBonus: 0 }, createdAt: 0, updatedAt: 0,
  };
}

describe('validateTravelRoute', () => {
  it('returns no blockers for a valid foot route', () => {
    expect(validateTravelRoute(input())).toEqual([]);
  });

  it('flags MODE_INCOMPATIBLE for foot travel at world scale', () => {
    const blockers = validateTravelRoute(input({ map: makeMap(457) }));
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.MODE_INCOMPATIBLE)).toBe(true);
  });

  it('checks downtime only for the traveling group', () => {
    const busy = task();
    const downtimeState = {
      ...emptyDowntime(), tasksById: { [busy.id]: busy }, taskOrder: [busy.id],
    };
    const blockers = validateTravelRoute(input({ downtimeState }));
    expect(blockers.find((b) => b.code === TRAVEL_BLOCKER_CODES.PARTY_IN_DOWNTIME)?.details)
      .toEqual(['Name pc-1']);

    const otherGroup = { ...group, memberIds: ['pc-2'] };
    expect(validateTravelRoute(input({
      group: otherGroup,
      characters: { 'pc-1': character('pc-1'), 'pc-2': character('pc-2') },
      downtimeState,
    })).some((b) => b.code === TRAVEL_BLOCKER_CODES.PARTY_IN_DOWNTIME)).toBe(false);
  });

  it('ignores cancelled downtime tasks', () => {
    const cancelled = task('cancelled');
    const downtimeState = {
      ...emptyDowntime(), tasksById: { [cancelled.id]: cancelled }, taskOrder: [cancelled.id],
    };
    expect(validateTravelRoute(input({ downtimeState }))
      .some((b) => b.code === TRAVEL_BLOCKER_CODES.PARTY_IN_DOWNTIME)).toBe(false);
  });

  it('blocks an on-foot group when every member is incapacitated and names them', () => {
    const blockers = validateTravelRoute(input({ characters: { 'pc-1': character('pc-1', 0) } }));
    const blocker = blockers.find((b) => b.code === TRAVEL_BLOCKER_CODES.PARTY_INCAPACITATED);
    expect(blocker?.message).toContain('Name pc-1');
  });

  it('allows an on-foot group when one member remains able-bodied', () => {
    const two = { ...group, memberIds: ['pc-1', 'pc-2'] };
    const blockers = validateTravelRoute(input({
      group: two,
      characters: { 'pc-1': character('pc-1', 0), 'pc-2': character('pc-2') },
    }));
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.PARTY_INCAPACITATED)).toBe(false);
  });

  it('flags INSUFFICIENT_CREW when able and free crew are below minCrew', () => {
    const type = { ...boatType, minCrew: 2 };
    const blockers = validateTravelRoute(input({
      mode: 'boat', vehicle, vehicleType: type,
      group: { ...group, vehicleId: vehicle.id },
    }));
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.INSUFFICIENT_CREW)).toBe(true);
  });

  it('does not count incapacitated members as vehicle crew', () => {
    const two = { ...group, memberIds: ['pc-1', 'pc-2'], vehicleId: vehicle.id };
    const blockers = validateTravelRoute(input({
      mode: 'boat', group: two, vehicle, vehicleType: { ...boatType, minCrew: 2 },
      characters: { 'pc-1': character('pc-1'), 'pc-2': character('pc-2', 0) },
    }));
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.INSUFFICIENT_CREW)).toBe(true);
  });

  it('flags VEHICLE_MODE_INCOMPATIBLE for the wrong map scale', () => {
    const blockers = validateTravelRoute(input({
      map: makeMap(457), mode: 'boat', vehicle, vehicleType: boatType,
      group: { ...group, vehicleId: vehicle.id },
    }));
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.VEHICLE_MODE_INCOMPATIBLE)).toBe(true);
  });

  it('flags null terrain for players but permits the GM override', () => {
    const map = makeMap(12, { 't-0-1': null });
    expect(validateTravelRoute(input({ map }))
      .some((b) => b.code === TRAVEL_BLOCKER_CODES.NULL_TERRAIN_ON_ROUTE)).toBe(true);
    expect(validateTravelRoute(input({ map, isGmMode: true }))
      .some((b) => b.code === TRAVEL_BLOCKER_CODES.NULL_TERRAIN_ON_ROUTE)).toBe(false);
  });

  it('flags impassable terrain', () => {
    const map = makeMap();
    map.terrainById.wall = makeTerrain('wall', false);
    map.tilesById['t-0-1'].terrainId = 'wall';
    expect(validateTravelRoute(input({ map }))
      .some((b) => b.code === TRAVEL_BLOCKER_CODES.IMPASSABLE_TERRAIN)).toBe(true);
  });

  it('flags routes beyond the foot budget', () => {
    expect(validateTravelRoute(input({ routeTileIds: ['t-0-0', 't-0-1', 't-0-2'] }))
      .some((b) => b.code === TRAVEL_BLOCKER_CODES.EXCEEDS_TIME_BUDGET)).toBe(true);
  });

  it('uses vehicle speed instead of the mode budget', () => {
    const slow = { ...boatType, speedMilesPerSlot: 12 };
    const fast = { ...boatType, speedMilesPerSlot: 100 };
    const shared = {
      mode: 'boat' as TravelMode,
      routeTileIds: ['t-0-0', 't-0-1', 't-0-2'],
      group: { ...group, vehicleId: vehicle.id }, vehicle,
    };
    expect(validateTravelRoute(input({ ...shared, vehicleType: slow }))
      .some((b) => b.code === TRAVEL_BLOCKER_CODES.EXCEEDS_TIME_BUDGET)).toBe(true);
    expect(validateTravelRoute(input({ ...shared, vehicleType: fast }))
      .some((b) => b.code === TRAVEL_BLOCKER_CODES.EXCEEDS_TIME_BUDGET)).toBe(false);
  });
});

describe('getRouteStats', () => {
  it('reports a single tile as zero miles within budget', () => {
    const stats = getRouteStats(makeMap(), ['t-0-0'], 'foot');
    expect(stats).toMatchObject({ tileCount: 1, totalMiles: 0, withinBudget: true });
  });

  it('sorts terrain counts and labels unassigned tiles', () => {
    const map = makeMap(12, { 't-0-1': null });
    const stats = getRouteStats(map, ['t-0-0', 't-0-1', 't-0-2'], 'foot');
    expect(stats.terrainBreakdown[0].count).toBeGreaterThanOrEqual(stats.terrainBreakdown[1].count);
    expect(stats.terrainBreakdown).toContainEqual({ name: 'Unassigned', count: 1 });
  });

  it('uses a vehicle type speed override in displayed stats', () => {
    const stats = getRouteStats(makeMap(), ['t-0-0', 't-0-1'], 'boat', 0, vehicle, {
      ...boatType, speedMilesPerSlot: 77,
    });
    expect(stats.budgetMiles).toBe(77);
  });
});
