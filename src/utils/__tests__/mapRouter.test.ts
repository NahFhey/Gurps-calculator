import { describe, expect, it } from 'vitest';
import { findRoute, computeRouteMiles, getReachableTiles } from '../mapRouter';
import type {
  MapModel,
  MapScale,
  TerrainModel,
  TileModel,
  TravelMode,
} from '../../types/map';

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

/**
 * Build a uniform rows×cols map with the given terrain assigned everywhere.
 * Tile IDs are `t-r-c`. Pass `holes` to force certain tiles to null terrain.
 */
function makeUniformMap(
  rows: number,
  cols: number,
  terrain: TerrainModel,
  opts: {
    scale?: MapScale;
    extraTerrains?: TerrainModel[];
    overrides?: Record<string, string | null>; // tileId -> terrainId|null
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

const FOOT: TravelMode = 'foot';

describe('findRoute', () => {
  it('returns trivial path of length 1 with 0 cost when start equals destination', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'));
    const result = findRoute(map, 't-1-1', 't-1-1', FOOT);
    expect(result.valid).toBe(true);
    expect(result.path).toEqual(['t-1-1']);
    expect(result.totalCost).toBe(0);
  });

  it('returns invalid result when start tile is missing from grid', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'));
    const result = findRoute(map, 'nope', 't-0-0', FOOT);
    expect(result.valid).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.totalCost).toBe(Infinity);
  });

  it('finds a straight orthogonal path with cost = scale per step', () => {
    const map = makeUniformMap(1, 4, makeTerrain('plains'), { scale: 12 });
    const result = findRoute(map, 't-0-0', 't-0-3', FOOT);
    expect(result.valid).toBe(true);
    expect(result.path).toEqual(['t-0-0', 't-0-1', 't-0-2', 't-0-3']);
    expect(result.totalCost).toBeCloseTo(36, 5); // 3 steps × 12 miles
  });

  it('prefers diagonal steps when reaching a diagonal destination', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'), { scale: 12 });
    const result = findRoute(map, 't-0-0', 't-2-2', FOOT);
    expect(result.valid).toBe(true);
    // 2 diagonal steps is cheaper than 4 orthogonal steps
    expect(result.path).toHaveLength(3);
    expect(result.totalCost).toBeCloseTo(2 * 12 * 1.414, 5);
  });

  it('routes around impassable terrain', () => {
    const wall = makeTerrain('wall', { passable: false });
    const map = makeUniformMap(3, 3, makeTerrain('plains'), {
      extraTerrains: [wall],
      overrides: { 't-1-1': 'wall' },
    });
    const result = findRoute(map, 't-1-0', 't-1-2', FOOT);
    expect(result.valid).toBe(true);
    expect(result.path).not.toContain('t-1-1');
  });

  it('returns invalid when no path exists', () => {
    const wall = makeTerrain('wall', { passable: false });
    // Box t-1-1 in entirely with walls on a 3x3
    const map = makeUniformMap(3, 3, wall, {
      extraTerrains: [makeTerrain('plains')],
      overrides: { 't-1-1': 'plains' },
    });
    const result = findRoute(map, 't-1-1', 't-0-0', FOOT);
    expect(result.valid).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.totalCost).toBe(Infinity);
  });

  it('skips null-terrain tiles by default and traverses them when allowNullTerrain is true', () => {
    const map = makeUniformMap(1, 3, makeTerrain('plains'), {
      overrides: { 't-0-1': null },
    });
    const blocked = findRoute(map, 't-0-0', 't-0-2', FOOT);
    expect(blocked.valid).toBe(false);

    const allowed = findRoute(map, 't-0-0', 't-0-2', FOOT, true);
    expect(allowed.valid).toBe(true);
    expect(allowed.path).toEqual(['t-0-0', 't-0-1', 't-0-2']);
  });

  it('respects mode-specific passability', () => {
    const water = makeTerrain('water');
    water.perMode.foot = { passable: false, speedModifier: 1 };
    water.perMode.boat = { passable: true, speedModifier: 1 };
    const map = makeUniformMap(1, 3, water, { scale: 50 });
    expect(findRoute(map, 't-0-0', 't-0-2', 'foot').valid).toBe(false);
    expect(findRoute(map, 't-0-0', 't-0-2', 'boat').valid).toBe(true);
  });

  it('factors speedModifier into step cost (higher speed = cheaper miles)', () => {
    const road = makeTerrain('road', { speed: 2 });
    const map = makeUniformMap(1, 3, road, { scale: 12 });
    const result = findRoute(map, 't-0-0', 't-0-2', FOOT);
    expect(result.valid).toBe(true);
    // 2 steps × (12 / 2) = 12 miles
    expect(result.totalCost).toBeCloseTo(12, 5);
  });
});

describe('computeRouteMiles', () => {
  it('returns 0 for empty or single-tile routes', () => {
    const map = makeUniformMap(2, 2, makeTerrain('plains'));
    expect(computeRouteMiles(map, [], FOOT)).toBe(0);
    expect(computeRouteMiles(map, ['t-0-0'], FOOT)).toBe(0);
  });

  it('sums orthogonal steps using scale', () => {
    const map = makeUniformMap(1, 4, makeTerrain('plains'), { scale: 12 });
    expect(
      computeRouteMiles(map, ['t-0-0', 't-0-1', 't-0-2', 't-0-3'], FOOT)
    ).toBeCloseTo(36, 5);
  });

  it('applies diagonal factor (~1.414) when both row and col change by 1', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'), { scale: 12 });
    expect(computeRouteMiles(map, ['t-0-0', 't-1-1'], FOOT)).toBeCloseTo(
      12 * 1.414,
      5
    );
  });

  it('skips steps with unknown tile ids without throwing', () => {
    const map = makeUniformMap(2, 2, makeTerrain('plains'));
    expect(() =>
      computeRouteMiles(map, ['t-0-0', 'missing', 't-1-1'], FOOT)
    ).not.toThrow();
  });

  it('uses speedModifier of the destination tile of each step', () => {
    const road = makeTerrain('road', { speed: 2 });
    const map = makeUniformMap(1, 2, road, { scale: 12 });
    expect(computeRouteMiles(map, ['t-0-0', 't-0-1'], FOOT)).toBeCloseTo(6, 5);
  });
});

describe('getReachableTiles', () => {
  it('returns just the start tile when the start has no grid position', () => {
    const map = makeUniformMap(2, 2, makeTerrain('plains'));
    const result = getReachableTiles(map, 'nope', FOOT);
    expect(result.size).toBe(0);
  });

  it('includes the start tile in the reachable set', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'));
    const reachable = getReachableTiles(map, 't-1-1', FOOT);
    expect(reachable.has('t-1-1')).toBe(true);
  });

  it('respects the per-mode mile budget (foot = 12 miles per slot)', () => {
    // Scale 12 means each orthogonal step costs 12 miles — exactly the foot budget.
    // So the reachable set should be the start plus its 8 neighbors only.
    const map = makeUniformMap(5, 5, makeTerrain('plains'), { scale: 12 });
    const reachable = getReachableTiles(map, 't-2-2', FOOT);
    expect(reachable.has('t-2-2')).toBe(true);
    expect(reachable.has('t-2-3')).toBe(true); // 12 miles, within budget
    expect(reachable.has('t-2-4')).toBe(false); // 24 miles, over budget
  });

  it('excludes impassable terrain from reachable tiles', () => {
    const wall = makeTerrain('wall', { passable: false });
    const map = makeUniformMap(3, 3, makeTerrain('plains'), {
      scale: 12,
      extraTerrains: [wall],
      overrides: { 't-1-2': 'wall' },
    });
    const reachable = getReachableTiles(map, 't-1-1', FOOT);
    expect(reachable.has('t-1-2')).toBe(false);
  });

  it('excludes null-terrain tiles unless allowNullTerrain is true', () => {
    const map = makeUniformMap(3, 3, makeTerrain('plains'), {
      scale: 12,
      overrides: { 't-1-2': null },
    });
    expect(getReachableTiles(map, 't-1-1', FOOT).has('t-1-2')).toBe(false);
    expect(getReachableTiles(map, 't-1-1', FOOT, true).has('t-1-2')).toBe(true);
  });
});
