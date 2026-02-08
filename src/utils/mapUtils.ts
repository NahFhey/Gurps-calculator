/**
 * Map Utility Functions
 *
 * Pure functions for map grid operations: creation, expansion,
 * tile lookup, adjacency, and revealed bounds.
 */

import type {
  MapModel,
  TileModel,
  TileId,
  TerrainId,
  TerrainModel,
  MapScale,
} from '../types/map';
import {
  INITIAL_GRID_SIZE,
  INITIAL_CENTER,
  EXPANSION_BUFFER,
  createPresetTerrains,
} from '../constants/map';

// ============================================================================
// TILE CREATION
// ============================================================================

/** Create a new tile with a unique ID */
export function createTile(terrainId: TerrainId | null = null): TileModel {
  return {
    id: crypto.randomUUID(),
    terrainId,
    markerIds: [],
    linkIds: [],
  };
}

// ============================================================================
// GRID CREATION
// ============================================================================

/**
 * Create the initial 9x9 grid for a new map.
 * Party starts at center (4,4). Only the center tile gets terrain assigned.
 */
export function createInitialGrid(startTerrainId: TerrainId): {
  grid: TileId[][];
  tilesById: Record<TileId, TileModel>;
  partyTileId: TileId;
  revealedTileIds: Set<TileId>;
} {
  const tilesById: Record<TileId, TileModel> = {};
  const grid: TileId[][] = [];

  for (let r = 0; r < INITIAL_GRID_SIZE; r++) {
    const row: TileId[] = [];
    for (let c = 0; c < INITIAL_GRID_SIZE; c++) {
      const isCenter = r === INITIAL_CENTER && c === INITIAL_CENTER;
      const tile = createTile(isCenter ? startTerrainId : null);
      tilesById[tile.id] = tile;
      row.push(tile.id);
    }
    grid.push(row);
  }

  const partyTileId = grid[INITIAL_CENTER][INITIAL_CENTER];
  const revealedTileIds = new Set<TileId>([partyTileId]);

  return { grid, tilesById, partyTileId, revealedTileIds };
}

/**
 * Create the default terrain definitions for a new map
 * (copies preset terrains so each map has its own editable set).
 */
export function createDefaultTerrainSet(): Record<TerrainId, TerrainModel> {
  const terrains = createPresetTerrains();
  const terrainById: Record<TerrainId, TerrainModel> = {};
  for (const t of terrains) {
    terrainById[t.id] = t;
  }
  return terrainById;
}

// ============================================================================
// GRID POSITION LOOKUP
// ============================================================================

/**
 * Find the grid position (row, col) of a tile by its ID.
 * Returns null if not found.
 */
export function findTileGridPos(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols'>,
  tileId: TileId
): { row: number; col: number } | null {
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (map.grid[r][c] === tileId) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

/**
 * Get the tile ID at a specific grid position.
 * Returns null if out of bounds.
 */
export function getTileIdAt(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols'>,
  row: number,
  col: number
): TileId | null {
  if (row < 0 || row >= map.rows || col < 0 || col >= map.cols) {
    return null;
  }
  return map.grid[row][col];
}

// ============================================================================
// ADJACENCY
// ============================================================================

/** 8-directional neighbor offsets (row, col) */
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
] as const;

/**
 * Get all 8-directional adjacent tile IDs for a given tile.
 */
export function getAdjacentTileIds(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols'>,
  tileId: TileId
): TileId[] {
  const pos = findTileGridPos(map, tileId);
  if (!pos) return [];

  const result: TileId[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const nr = pos.row + dr;
    const nc = pos.col + dc;
    const neighborId = getTileIdAt(map, nr, nc);
    if (neighborId) {
      result.push(neighborId);
    }
  }
  return result;
}

/**
 * Check if two tiles are adjacent (8-directional).
 */
export function areTilesAdjacent(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols'>,
  tileA: TileId,
  tileB: TileId
): boolean {
  const posA = findTileGridPos(map, tileA);
  const posB = findTileGridPos(map, tileB);
  if (!posA || !posB) return false;

  const dr = Math.abs(posA.row - posB.row);
  const dc = Math.abs(posA.col - posB.col);
  return dr <= 1 && dc <= 1 && (dr + dc > 0);
}

/**
 * Determine if a step between two adjacent tiles is diagonal.
 */
export function isDiagonalStep(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols'>,
  tileA: TileId,
  tileB: TileId
): boolean {
  const posA = findTileGridPos(map, tileA);
  const posB = findTileGridPos(map, tileB);
  if (!posA || !posB) return false;

  const dr = Math.abs(posA.row - posB.row);
  const dc = Math.abs(posA.col - posB.col);
  return dr === 1 && dc === 1;
}

// ============================================================================
// REVEALED BOUNDS & EXPANSION
// ============================================================================

/**
 * Compute the bounding box of revealed tiles in grid coordinates.
 */
export function getRevealedBounds(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols' | 'revealedTileIds'>
): { minR: number; maxR: number; minC: number; maxC: number } {
  let minR = Infinity;
  let maxR = -Infinity;
  let minC = Infinity;
  let maxC = -Infinity;

  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (map.revealedTileIds.has(map.grid[r][c])) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }

  if (minR === Infinity) {
    // No revealed tiles — shouldn't happen in practice
    return { minR: 0, maxR: 0, minC: 0, maxC: 0 };
  }

  return { minR, maxR, minC, maxC };
}

/**
 * Check how many rows/cols need to be added on each side
 * to maintain the expansion buffer.
 */
export function checkExpansionNeeded(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols' | 'revealedTileIds'>
): { top: number; bottom: number; left: number; right: number } {
  const { minR, maxR, minC, maxC } = getRevealedBounds(map);

  return {
    top: Math.max(0, EXPANSION_BUFFER - minR),
    bottom: Math.max(0, EXPANSION_BUFFER - (map.rows - 1 - maxR)),
    left: Math.max(0, EXPANSION_BUFFER - minC),
    right: Math.max(0, EXPANSION_BUFFER - (map.cols - 1 - maxC)),
  };
}

/**
 * Expand the map grid by adding rows/cols on specified sides.
 * Returns a new MapModel with expanded grid. Tile IDs remain stable.
 *
 * This is a pure function — does not mutate the input.
 */
export function expandMap(
  map: MapModel,
  sides: { top: number; bottom: number; left: number; right: number }
): MapModel {
  const { top, bottom, left, right } = sides;
  if (top === 0 && bottom === 0 && left === 0 && right === 0) {
    return map;
  }

  const newRows = map.rows + top + bottom;
  const newCols = map.cols + left + right;
  const newTilesById = { ...map.tilesById };
  const newGrid: TileId[][] = [];

  // Add top rows
  for (let r = 0; r < top; r++) {
    const row: TileId[] = [];
    for (let c = 0; c < newCols; c++) {
      const tile = createTile(null);
      newTilesById[tile.id] = tile;
      row.push(tile.id);
    }
    newGrid.push(row);
  }

  // Existing rows (with left/right padding)
  for (let r = 0; r < map.rows; r++) {
    const row: TileId[] = [];

    // Left padding
    for (let c = 0; c < left; c++) {
      const tile = createTile(null);
      newTilesById[tile.id] = tile;
      row.push(tile.id);
    }

    // Existing tiles
    for (let c = 0; c < map.cols; c++) {
      row.push(map.grid[r][c]);
    }

    // Right padding
    for (let c = 0; c < right; c++) {
      const tile = createTile(null);
      newTilesById[tile.id] = tile;
      row.push(tile.id);
    }

    newGrid.push(row);
  }

  // Add bottom rows
  for (let r = 0; r < bottom; r++) {
    const row: TileId[] = [];
    for (let c = 0; c < newCols; c++) {
      const tile = createTile(null);
      newTilesById[tile.id] = tile;
      row.push(tile.id);
    }
    newGrid.push(row);
  }

  return {
    ...map,
    rows: newRows,
    cols: newCols,
    grid: newGrid,
    tilesById: newTilesById,
  };
}

/**
 * Expand the map if needed to maintain the allocation buffer.
 * Returns the same map if no expansion is needed.
 */
export function expandMapIfNeeded(map: MapModel): MapModel {
  const sides = checkExpansionNeeded(map);
  return expandMap(map, sides);
}

// ============================================================================
// MAP CREATION HELPER
// ============================================================================

/**
 * Create a complete new MapModel with all defaults.
 */
export function createNewMap(params: {
  name: string;
  description?: string;
  scaleMilesPerTile: MapScale;
  startTerrainId: TerrainId;
}): MapModel {
  const terrainById = createDefaultTerrainSet();
  const { grid, tilesById, partyTileId, revealedTileIds } = createInitialGrid(
    params.startTerrainId
  );

  return {
    id: crypto.randomUUID(),
    name: params.name,
    description: params.description,
    scaleMilesPerTile: params.scaleMilesPerTile,
    rows: INITIAL_GRID_SIZE,
    cols: INITIAL_GRID_SIZE,
    grid,
    tilesById,
    terrainById,
    markersById: {},
    linksById: {},
    revealedTileIds,
    partyTileId,
    lastSelectedTerrainId: params.startTerrainId,
    lastPlacedTerrainId: params.startTerrainId,
  };
}
