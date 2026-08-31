import { describe, expect, it } from 'vitest';
import {
  createTile,
  createInitialGrid,
  createDefaultTerrainSet,
  findTileGridPos,
  getTileIdAt,
  getAdjacentTileIds,
  areTilesAdjacent,
  isDiagonalStep,
  getRevealedBounds,
  checkExpansionNeeded,
  expandMap,
  expandMapIfNeeded,
  checkPaintExpansionNeeded,
  expandMapIfNeededForPaint,
  createNewMap,
  resolveLocationTerrain,
} from '../mapUtils';
import {
  INITIAL_GRID_SIZE,
  INITIAL_CENTER,
  EXPANSION_BUFFER,
} from '../../constants/map';
import type { MapModel, TerrainModel } from '../../types/map';

describe('createTile', () => {
  it('returns a tile with a unique id and null terrain by default', () => {
    const t1 = createTile();
    const t2 = createTile();
    expect(t1.id).not.toBe(t2.id);
    expect(t1.terrainId).toBeNull();
    expect(t1.markerIds).toEqual([]);
    expect(t1.linkIds).toEqual([]);
  });

  it('assigns the given terrainId', () => {
    const t = createTile('terrain-plains');
    expect(t.terrainId).toBe('terrain-plains');
  });
});

describe('createInitialGrid', () => {
  it('builds a 9x9 grid with terrain only at the center', () => {
    const { grid, tilesById, revealedTileIds } =
      createInitialGrid('terrain-plains');

    expect(grid.length).toBe(INITIAL_GRID_SIZE);
    expect(grid[0].length).toBe(INITIAL_GRID_SIZE);

    const centerId = grid[INITIAL_CENTER][INITIAL_CENTER];
    expect(tilesById[centerId].terrainId).toBe('terrain-plains');
    expect(revealedTileIds.has(centerId)).toBe(true);
    expect(revealedTileIds.size).toBe(1);

    // All non-center tiles have null terrain
    for (let r = 0; r < INITIAL_GRID_SIZE; r++) {
      for (let c = 0; c < INITIAL_GRID_SIZE; c++) {
        if (r === INITIAL_CENTER && c === INITIAL_CENTER) continue;
        expect(tilesById[grid[r][c]].terrainId).toBeNull();
      }
    }
  });
});

describe('createDefaultTerrainSet', () => {
  it('returns the preset terrains keyed by id', () => {
    const set = createDefaultTerrainSet();
    expect(set['terrain-plains']).toBeDefined();
    expect(set['terrain-water']).toBeDefined();
    expect(set['terrain-road']).toBeDefined();
    expect(set['terrain-plains'].name).toBe('Plains');
  });
});

function buildMap(startTerrain = 'terrain-plains'): MapModel {
  return createNewMap({
    name: 'Test',
    scaleMilesPerTile: 12,
    startTerrainId: startTerrain,
  });
}

describe('findTileGridPos & getTileIdAt', () => {
  it('locates the center tile and returns null for missing ids', () => {
    const map = buildMap();
    const pos = findTileGridPos(map, map.grid[INITIAL_CENTER][INITIAL_CENTER]);
    expect(pos).toEqual({ row: INITIAL_CENTER, col: INITIAL_CENTER });
    expect(findTileGridPos(map, 'no-such-tile')).toBeNull();
  });

  it('getTileIdAt returns null out of bounds', () => {
    const map = buildMap();
    expect(getTileIdAt(map, -1, 0)).toBeNull();
    expect(getTileIdAt(map, 0, -1)).toBeNull();
    expect(getTileIdAt(map, map.rows, 0)).toBeNull();
    expect(getTileIdAt(map, 0, map.cols)).toBeNull();
    expect(getTileIdAt(map, INITIAL_CENTER, INITIAL_CENTER)).toBe(map.grid[INITIAL_CENTER][INITIAL_CENTER]);
  });
});

describe('adjacency helpers', () => {
  it('getAdjacentTileIds returns 8 neighbors for an interior tile', () => {
    const map = buildMap();
    const neighbors = getAdjacentTileIds(map, map.grid[INITIAL_CENTER][INITIAL_CENTER]);
    expect(neighbors.length).toBe(8);
  });

  it('getAdjacentTileIds returns 3 neighbors for a corner tile', () => {
    const map = buildMap();
    const corner = map.grid[0][0];
    expect(getAdjacentTileIds(map, corner).length).toBe(3);
  });

  it('getAdjacentTileIds returns [] for an unknown tile id', () => {
    const map = buildMap();
    expect(getAdjacentTileIds(map, 'nope')).toEqual([]);
  });

  it('areTilesAdjacent detects orthogonal and diagonal neighbors', () => {
    const map = buildMap();
    const center = map.grid[INITIAL_CENTER][INITIAL_CENTER];
    const right = map.grid[INITIAL_CENTER][INITIAL_CENTER + 1];
    const diag = map.grid[INITIAL_CENTER + 1][INITIAL_CENTER + 1];
    const far = map.grid[0][0];
    expect(areTilesAdjacent(map, center, right)).toBe(true);
    expect(areTilesAdjacent(map, center, diag)).toBe(true);
    expect(areTilesAdjacent(map, center, far)).toBe(false);
    expect(areTilesAdjacent(map, center, center)).toBe(false);
    expect(areTilesAdjacent(map, center, 'nope')).toBe(false);
  });

  it('isDiagonalStep distinguishes diagonal from orthogonal', () => {
    const map = buildMap();
    const center = map.grid[INITIAL_CENTER][INITIAL_CENTER];
    const right = map.grid[INITIAL_CENTER][INITIAL_CENTER + 1];
    const diag = map.grid[INITIAL_CENTER + 1][INITIAL_CENTER + 1];
    expect(isDiagonalStep(map, center, right)).toBe(false);
    expect(isDiagonalStep(map, center, diag)).toBe(true);
    expect(isDiagonalStep(map, center, 'nope')).toBe(false);
  });
});

describe('getRevealedBounds', () => {
  it('returns the bounding box of revealed tiles', () => {
    const map = buildMap();
    const bounds = getRevealedBounds(map);
    expect(bounds).toEqual({
      minR: INITIAL_CENTER,
      maxR: INITIAL_CENTER,
      minC: INITIAL_CENTER,
      maxC: INITIAL_CENTER,
    });
  });

  it('returns zeros when nothing is revealed', () => {
    const map = buildMap();
    map.revealedTileIds = new Set();
    expect(getRevealedBounds(map)).toEqual({ minR: 0, maxR: 0, minC: 0, maxC: 0 });
  });
});

describe('checkExpansionNeeded & expandMap', () => {
  it('reports no expansion needed for a fresh centered map', () => {
    const map = buildMap();
    expect(checkExpansionNeeded(map)).toEqual({
      top: INITIAL_CENTER < EXPANSION_BUFFER ? EXPANSION_BUFFER - INITIAL_CENTER : 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('reports expansion needed when revealed reaches an edge', () => {
    const map = buildMap();
    map.revealedTileIds = new Set([map.grid[0][0]]);
    const sides = checkExpansionNeeded(map);
    expect(sides.top).toBe(EXPANSION_BUFFER);
    expect(sides.left).toBe(EXPANSION_BUFFER);
    expect(sides.bottom).toBe(0);
    expect(sides.right).toBe(0);
  });

  it('expandMap is a no-op when all sides are zero', () => {
    const map = buildMap();
    const result = expandMap(map, { top: 0, bottom: 0, left: 0, right: 0 });
    expect(result).toBe(map);
  });

  it('expandMap grows rows/cols and preserves existing tile ids', () => {
    const map = buildMap();
    const originalCenterId = map.grid[INITIAL_CENTER][INITIAL_CENTER];
    const result = expandMap(map, { top: 1, bottom: 2, left: 3, right: 0 });
    expect(result.rows).toBe(map.rows + 3);
    expect(result.cols).toBe(map.cols + 3);
    // Original party tile shifts to (center+1, center+3)
    expect(result.grid[INITIAL_CENTER + 1][INITIAL_CENTER + 3]).toBe(originalCenterId);
    // Existing tiles are kept in tilesById
    expect(result.tilesById[originalCenterId]).toBeDefined();
    // New tiles are added
    expect(Object.keys(result.tilesById).length).toBeGreaterThan(
      Object.keys(map.tilesById).length
    );
    // Original map untouched
    expect(map.rows).toBe(INITIAL_GRID_SIZE);
  });

  it('expandMapIfNeeded expands when revealed touches an edge', () => {
    const map = buildMap();
    map.revealedTileIds = new Set([map.grid[0][0]]);
    const result = expandMapIfNeeded(map);
    expect(result.rows).toBe(map.rows + EXPANSION_BUFFER);
    expect(result.cols).toBe(map.cols + EXPANSION_BUFFER);
  });

  it('expandMapIfNeeded is a no-op when buffer is satisfied', () => {
    const map = buildMap();
    const result = expandMapIfNeeded(map);
    expect(result).toBe(map);
  });
});

describe('paint-based expansion', () => {
  it('checkPaintExpansionNeeded ignores unpainted tiles', () => {
    const map = buildMap();
    // Only the center has a terrain; that's far from edges (center=4, buffer=2).
    expect(checkPaintExpansionNeeded(map)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('checkPaintExpansionNeeded returns zeros when nothing is painted', () => {
    const map = buildMap();
    // Unpaint the center
    map.tilesById[map.grid[INITIAL_CENTER][INITIAL_CENTER]].terrainId = null;
    expect(checkPaintExpansionNeeded(map)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('checkPaintExpansionNeeded triggers when paint is near edge', () => {
    const map = buildMap();
    map.tilesById[map.grid[0][0]].terrainId = 'terrain-plains';
    const sides = checkPaintExpansionNeeded(map);
    expect(sides.top).toBe(EXPANSION_BUFFER);
    expect(sides.left).toBe(EXPANSION_BUFFER);
  });

  it('expandMapIfNeededForPaint expands as needed', () => {
    const map = buildMap();
    map.tilesById[map.grid[0][0]].terrainId = 'terrain-plains';
    const result = expandMapIfNeededForPaint(map);
    expect(result.rows).toBeGreaterThan(map.rows);
  });
});

describe('createNewMap', () => {
  it('produces a fully-formed MapModel', () => {
    const map = createNewMap({
      name: 'World',
      description: 'desc',
      scaleMilesPerTile: 50,
      startTerrainId: 'terrain-water',
    });
    expect(map.rows).toBe(INITIAL_GRID_SIZE);
    expect(map.cols).toBe(INITIAL_GRID_SIZE);
    expect(map.scaleMilesPerTile).toBe(50);
    expect(map.name).toBe('World');
    expect(map.description).toBe('desc');
    expect(map.lastSelectedTerrainId).toBe('terrain-water');
    expect(map.lastPlacedTerrainId).toBe('terrain-water');
    expect(map.revealedTileIds.size).toBe(1);
    expect(map.revealedTileIds.has(map.grid[INITIAL_CENTER][INITIAL_CENTER])).toBe(true);
    expect(map.visionMode).toBe('lineOfSight');
    expect(Object.keys(map.terrainById).length).toBeGreaterThan(0);
  });
});

describe('resolveLocationTerrain', () => {
  it('returns "plains" when the tile has no terrain', () => {
    const map = buildMap();
    const blankId = map.grid[0][0];
    expect(resolveLocationTerrain(map, blankId)).toBe('plains');
  });

  it('returns "plains" for an unknown tile id', () => {
    const map = buildMap();
    expect(resolveLocationTerrain(map, 'nope')).toBe('plains');
  });

  it('uses locationTerrain for direct-mapped preset terrains', () => {
    const map = buildMap();
    // Plains preset has locationTerrain set; verify it propagates.
    const center = map.grid[INITIAL_CENTER][INITIAL_CENTER];
    const result = resolveLocationTerrain(map, center);
    // Plains preset maps to plains location terrain
    expect(result).toBe('plains');
  });

  it('falls back to "plains" for a custom terrain without locationTerrain', () => {
    const map = buildMap();
    const custom: TerrainModel = {
      id: 'custom-x',
      name: 'Mystery',
      color: '#fff',
      perMode: {
        foot: { passable: true, speedModifier: 1 },
        boat: { passable: false, speedModifier: 1 },
        airship: { passable: true, speedModifier: 1 },
      },
    };
    map.terrainById['custom-x'] = custom;
    const tileId = map.grid[0][0];
    map.tilesById[tileId].terrainId = 'custom-x';
    expect(resolveLocationTerrain(map, tileId)).toBe('plains');
  });

  it('water surrounded by water resolves to coastal', () => {
    const map = buildMap();
    // Paint a 3x3 patch of water
    for (let r = INITIAL_CENTER - 1; r <= INITIAL_CENTER + 1; r++) {
      for (let c = INITIAL_CENTER - 1; c <= INITIAL_CENTER + 1; c++) {
        map.tilesById[map.grid[r][c]].terrainId = 'terrain-water';
      }
    }
    expect(resolveLocationTerrain(map, map.grid[INITIAL_CENTER][INITIAL_CENTER])).toBe('coastal');
  });

  it('water with land on opposite sides resolves to river', () => {
    const map = buildMap();
    // Make the center water with water neighbors N and S (corridor), land E and W
    const c = INITIAL_CENTER;
    map.tilesById[map.grid[c][c]].terrainId = 'terrain-water';
    map.tilesById[map.grid[c - 1][c]].terrainId = 'terrain-water';
    map.tilesById[map.grid[c + 1][c]].terrainId = 'terrain-water';
    map.tilesById[map.grid[c][c - 1]].terrainId = 'terrain-plains';
    map.tilesById[map.grid[c][c + 1]].terrainId = 'terrain-plains';
    expect(resolveLocationTerrain(map, map.grid[c][c])).toBe('river');
  });

  it('road inherits location terrain from a non-road, non-water neighbor', () => {
    const map = buildMap();
    const c = INITIAL_CENTER;
    map.tilesById[map.grid[c][c]].terrainId = 'terrain-road';
    map.tilesById[map.grid[c][c + 1]].terrainId = 'terrain-forest';
    expect(resolveLocationTerrain(map, map.grid[c][c])).toBe('forest');
  });

  it('road with only road/water neighbors falls back to plains', () => {
    const map = buildMap();
    const c = INITIAL_CENTER;
    // Clear all neighbors and only put road/water nearby
    map.tilesById[map.grid[c][c]].terrainId = 'terrain-road';
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      map.tilesById[map.grid[c + dr][c + dc]].terrainId =
        dr === 0 && dc === 1 ? 'terrain-water' : 'terrain-road';
    }
    expect(resolveLocationTerrain(map, map.grid[c][c])).toBe('plains');
  });
});
