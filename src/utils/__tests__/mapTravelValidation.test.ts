import { describe, expect, it } from 'vitest';
import { validateTravelRoute, getRouteStats } from '../mapTravelValidation';
import { TRAVEL_BLOCKER_CODES } from '../../types/map';
import type {
  MapModel,
  MapScale,
  TerrainModel,
  TileModel,
  TravelMode,
} from '../../types/map';
import type { DowntimeState, DowntimeTask } from '../../types/downtime';

function makeTerrain(
  id: string,
  opts: { passable?: boolean; speed?: number } = {}
): TerrainModel {
  const passable = opts.passable ?? true;
  const speedModifier = opts.speed ?? 1.0;
  const perMode: TerrainModel['perMode'] = {
    foot: { passable, speedModifier },
    boat: { passable, speedModifier },
    airship: { passable, speedModifier },
  };
  return { id, name: id, color: '#fff', perMode };
}

function makeUniformMap(
  rows: number,
  cols: number,
  terrain: TerrainModel,
  opts: {
    scale?: MapScale;
    extraTerrains?: TerrainModel[];
    overrides?: Record<string, string | null>;
  } = {}
): MapModel {
  const scale = opts.scale ?? 12;
  const tilesById: Record<string, TileModel> = {};
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const id = `t-${r}-${c}`;
      let terrainId: string | null = terrain.id;
      if (opts.overrides && id in opts.overrides) {
        terrainId = opts.overrides[id];
      }
      tilesById[id] = { id, terrainId, markerIds: [], linkIds: [] };
      row.push(id);
    }
    grid.push(row);
  }
  const terrainById: Record<string, TerrainModel> = { [terrain.id]: terrain };
  for (const t of opts.extraTerrains ?? []) terrainById[t.id] = t;
  return {
    id: 'map-1',
    name: 'test',
    visionMode: 'lineOfSight',
    scaleMilesPerTile: scale,
    rows,
    cols,
    grid,
    tilesById,
    terrainById,
    markersById: {},
    linksById: {},
    revealedTileIds: new Set(),
    partyTileId: null,
    lastSelectedTerrainId: terrain.id,
    lastPlacedTerrainId: terrain.id,
  };
}

function emptyDowntimeState(): DowntimeState {
  return { tasksById: {}, taskOrder: [], pendingDayLedger: null };
}

function makeTask(overrides: Partial<DowntimeTask> = {}): DowntimeTask {
  return {
    id: 'task-1',
    activityType: 'rest',
    dayKey: 1,
    slot: 0,
    leaderId: 'pc-1',
    helperIds: [],
    status: 'pending',
    activityData: { type: 'rest' } as DowntimeTask['activityData'],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function addTask(state: DowntimeState, task: DowntimeTask): DowntimeState {
  return {
    ...state,
    tasksById: { ...state.tasksById, [task.id]: task },
    taskOrder: [...state.taskOrder, task.id],
  };
}

const FOOT: TravelMode = 'foot';
const BOAT: TravelMode = 'boat';
const AIRSHIP: TravelMode = 'airship';

describe('validateTravelRoute', () => {
  it('returns no blockers for a valid foot route on a 12-mi map', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'));
    // 2-tile route = 12 mi which matches the foot mode's 12 mi/slot budget.
    const blockers = validateTravelRoute(
      map,
      ['t-0-0', 't-0-1'],
      FOOT,
      ['pc-1'],
      1,
      0,
      emptyDowntimeState(),
      false
    );
    expect(blockers).toEqual([]);
  });

  it('flags MODE_INCOMPATIBLE when the mode is not allowed at the map scale', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'), { scale: 457 });
    const blockers = validateTravelRoute(
      map,
      ['t-0-0'],
      FOOT,
      ['pc-1'],
      1,
      0,
      emptyDowntimeState(),
      false
    );
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.MODE_INCOMPATIBLE)).toBe(true);
  });

  it('flags PARTY_IN_DOWNTIME when members are assigned to a non-cancelled task this slot', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'));
    const dt = addTask(emptyDowntimeState(), makeTask({ leaderId: 'pc-1', dayKey: 1, slot: 0 }));
    const blockers = validateTravelRoute(
      map,
      ['t-0-0'],
      FOOT,
      ['pc-1', 'pc-2'],
      1,
      0,
      dt,
      false
    );
    const busy = blockers.find((b) => b.code === TRAVEL_BLOCKER_CODES.PARTY_IN_DOWNTIME);
    expect(busy).toBeDefined();
    expect(busy?.details).toEqual(['pc-1']);
  });

  it('ignores cancelled tasks for the downtime check', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'));
    const dt = addTask(
      emptyDowntimeState(),
      makeTask({ leaderId: 'pc-1', status: 'cancelled' })
    );
    const blockers = validateTravelRoute(
      map,
      ['t-0-0'],
      FOOT,
      ['pc-1'],
      1,
      0,
      dt,
      false
    );
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.PARTY_IN_DOWNTIME)).toBe(false);
  });

  it('flags INSUFFICIENT_PERSONNEL when the mode requires more crew than available', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'));
    // boat requires 1 pilot + 4 crew = 5 people
    const blockers = validateTravelRoute(
      map,
      ['t-0-0'],
      BOAT,
      ['pc-1', 'pc-2'],
      1,
      0,
      emptyDowntimeState(),
      false
    );
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.INSUFFICIENT_PERSONNEL)).toBe(true);
  });

  it('flags NULL_TERRAIN_ON_ROUTE for player mode but not for GM mode', () => {
    const plains = makeTerrain('plains');
    const map = makeUniformMap(3, 3, plains, { overrides: { 't-0-1': null } });
    const route = ['t-0-0', 't-0-1', 't-0-2'];
    const playerBlockers = validateTravelRoute(
      map,
      route,
      FOOT,
      ['pc-1'],
      1,
      0,
      emptyDowntimeState(),
      false
    );
    expect(playerBlockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.NULL_TERRAIN_ON_ROUTE)).toBe(true);

    const gmBlockers = validateTravelRoute(
      map,
      route,
      FOOT,
      ['pc-1'],
      1,
      0,
      emptyDowntimeState(),
      true
    );
    expect(gmBlockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.NULL_TERRAIN_ON_ROUTE)).toBe(false);
  });

  it('flags IMPASSABLE_TERRAIN when a tile is not passable for the mode', () => {
    const plains = makeTerrain('plains');
    const wall = makeTerrain('wall', { passable: false });
    const map = makeUniformMap(3, 3, plains, {
      extraTerrains: [wall],
      overrides: { 't-0-1': wall.id },
    });
    const blockers = validateTravelRoute(
      map,
      ['t-0-0', 't-0-1', 't-0-2'],
      FOOT,
      ['pc-1'],
      1,
      0,
      emptyDowntimeState(),
      false
    );
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.IMPASSABLE_TERRAIN)).toBe(true);
  });

  it('flags EXCEEDS_TIME_BUDGET when route miles exceed the mode budget', () => {
    // 12-mi tiles, foot budget = 12 mi/slot. A 3-tile straight route is ~24 mi.
    const map = makeUniformMap(1, 5, makeTerrain('plains'));
    const blockers = validateTravelRoute(
      map,
      ['t-0-0', 't-0-1', 't-0-2'],
      FOOT,
      ['pc-1'],
      1,
      0,
      emptyDowntimeState(),
      false
    );
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.EXCEEDS_TIME_BUDGET)).toBe(true);
  });

  it('weather modifier widens the budget enough to clear EXCEEDS_TIME_BUDGET', () => {
    // airship budget = 457 mi/slot; positive weather should always pass for a 2-tile route on 12-mi map
    const map = makeUniformMap(1, 3, makeTerrain('plains'));
    const blockers = validateTravelRoute(
      map,
      ['t-0-0', 't-0-1'],
      AIRSHIP,
      ['pc-1', 'pc-2', 'pc-3', 'pc-4', 'pc-5'],
      1,
      0,
      emptyDowntimeState(),
      false,
      2
    );
    expect(blockers.some((b) => b.code === TRAVEL_BLOCKER_CODES.EXCEEDS_TIME_BUDGET)).toBe(false);
  });

  it('returns empty array when only one tile is in the route (no movement)', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'));
    const blockers = validateTravelRoute(
      map,
      ['t-1-1'],
      FOOT,
      ['pc-1'],
      1,
      0,
      emptyDowntimeState(),
      false
    );
    // Single tile: no budget check (needs >1), no impassable issue, no null terrain → valid.
    expect(blockers).toEqual([]);
  });
});

describe('getRouteStats', () => {
  it('returns zero miles for a single-tile route and reports it as within budget', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'));
    const stats = getRouteStats(map, ['t-1-1'], FOOT);
    expect(stats.tileCount).toBe(1);
    expect(stats.totalMiles).toBe(0);
    expect(stats.withinBudget).toBe(true);
  });

  it('computes a terrain breakdown sorted by count descending', () => {
    const plains = makeTerrain('plains');
    const forest = makeTerrain('forest');
    const map = makeUniformMap(1, 5, plains, {
      extraTerrains: [forest],
      overrides: { 't-0-2': forest.id, 't-0-3': forest.id },
    });
    const stats = getRouteStats(map, ['t-0-0', 't-0-1', 't-0-2', 't-0-3', 't-0-4'], FOOT);
    expect(stats.terrainBreakdown[0].count).toBeGreaterThanOrEqual(stats.terrainBreakdown[1].count);
    expect(stats.tileCount).toBe(5);
  });

  it('flags routes that exceed the foot budget on a 12-mi map', () => {
    const map = makeUniformMap(1, 5, makeTerrain('plains'));
    const stats = getRouteStats(map, ['t-0-0', 't-0-1', 't-0-2', 't-0-3'], FOOT);
    expect(stats.withinBudget).toBe(false);
    expect(stats.totalMiles).toBeGreaterThan(stats.budgetMiles);
  });

  it('labels tiles with null terrain as Unassigned in the breakdown', () => {
    const plains = makeTerrain('plains');
    const map = makeUniformMap(1, 3, plains, { overrides: { 't-0-1': null } });
    const stats = getRouteStats(map, ['t-0-0', 't-0-1', 't-0-2'], FOOT);
    const unassigned = stats.terrainBreakdown.find((t) => t.name === 'Unassigned');
    expect(unassigned).toBeDefined();
    expect(unassigned?.count).toBe(1);
  });
});
