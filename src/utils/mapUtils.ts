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
  MapScaleValue,
  GridType,
  TravelMode,
} from '../types/map';
import type { TerrainType } from '../types/location';
import {
  INITIAL_GRID_SIZE,
  INITIAL_CENTER,
  EXPANSION_BUFFER,
  createPresetTerrains,
  createTacticalTerrainPresets,
  SCALE_TO_MODES,
  getTravelModeDefinition,
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

/**
 * Check how many rows/cols need to be added on each side
 * based on the bounding box of painted (non-null terrain) tiles.
 * Used to expand the map when the DM paints near the edge.
 */
export function checkPaintExpansionNeeded(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols' | 'tilesById'>
): { top: number; bottom: number; left: number; right: number } {
  let minR = Infinity;
  let maxR = -Infinity;
  let minC = Infinity;
  let maxC = -Infinity;

  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const tileId = map.grid[r][c];
      const tile = map.tilesById[tileId];
      if (tile && tile.terrainId !== null) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }

  if (minR === Infinity) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  return {
    top: Math.max(0, EXPANSION_BUFFER - minR),
    bottom: Math.max(0, EXPANSION_BUFFER - (map.rows - 1 - maxR)),
    left: Math.max(0, EXPANSION_BUFFER - minC),
    right: Math.max(0, EXPANSION_BUFFER - (map.cols - 1 - maxC)),
  };
}

/**
 * Expand the map if painted tiles are near the edge.
 * Returns the same map if no expansion is needed.
 */
export function expandMapIfNeededForPaint(map: MapModel): MapModel {
  const sides = checkPaintExpansionNeeded(map);
  return expandMap(map, sides);
}

/**
 * Get tile IDs visible to the party but not yet explored.
 * Vision radius = ceil(milesPerSlot / scaleMilesPerTile) + 2 tiles
 * using Chebyshev distance (8-directional).
 *
 * When activeMode is provided (e.g., during travel wizard), uses that mode's
 * milesPerSlot for the radius. Otherwise defaults to the slowest available mode.
 *
 * Returns only tiles that are NOT in revealedTileIds (i.e., visible but unexplored).
 */
export function getVisibleTileIds(map: MapModel, activeMode?: TravelMode): Set<TileId> {
  if (!map.partyTileId) return new Set();
  // Tactical maps do not use overland vision radius
  if (map.scaleUnit === 'yards') return new Set();

  const partyPos = findTileGridPos(map, map.partyTileId);
  if (!partyPos) return new Set();

  // Compute vision radius: use active mode if provided, otherwise slowest mode
  let milesForVision: number;
  if (activeMode) {
    milesForVision = getTravelModeDefinition(activeMode).milesPerSlot;
  } else {
    const modes = SCALE_TO_MODES[map.scaleMilesPerTile as MapScale];
    milesForVision = Math.min(
      ...modes.map((m) => getTravelModeDefinition(m).milesPerSlot)
    );
  }
  const visionRadiusTiles = Math.ceil(milesForVision / map.scaleMilesPerTile) + 2;

  const visible = new Set<TileId>();
  for (let r = partyPos.row - visionRadiusTiles; r <= partyPos.row + visionRadiusTiles; r++) {
    for (let c = partyPos.col - visionRadiusTiles; c <= partyPos.col + visionRadiusTiles; c++) {
      const tileId = getTileIdAt(map, r, c);
      if (tileId && !map.revealedTileIds.has(tileId)) {
        visible.add(tileId);
      }
    }
  }

  return visible;
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

/**
 * Create a tactical-scale MapModel for combat encounters.
 * Uses tactical terrain presets and a scale of 1 yard per tile.
 * Tactical maps are saved permanently and can be reused across combats.
 */
export function createTacticalMap(params: {
  name: string;
  description?: string;
  rows?: number;
  cols?: number;
  startTerrainId?: TerrainId;
  gridType?: GridType;
}): MapModel {
  const gridRows = params.rows ?? 20;
  const gridCols = params.cols ?? 20;
  const startTerrainId = params.startTerrainId ?? 'tactical-open';
  const gridType = params.gridType ?? 'square';

  // Build tactical terrain set
  const tacticalTerrains = createTacticalTerrainPresets();
  const terrainById: Record<TerrainId, TerrainModel> = {};
  for (const t of tacticalTerrains) {
    terrainById[t.id] = t;
  }

  // Build grid
  const tilesById: Record<TileId, TileModel> = {};
  const grid: TileId[][] = [];
  const centerR = Math.floor(gridRows / 2);
  const centerC = Math.floor(gridCols / 2);

  for (let r = 0; r < gridRows; r++) {
    const row: TileId[] = [];
    for (let c = 0; c < gridCols; c++) {
      const isCenter = r === centerR && c === centerC;
      const tile = createTile(isCenter ? startTerrainId : null);
      tilesById[tile.id] = tile;
      row.push(tile.id);
    }
    grid.push(row);
  }

  const partyTileId = grid[centerR][centerC];

  return {
    id: crypto.randomUUID(),
    name: params.name,
    description: params.description,
    scaleMilesPerTile: 1 as MapScaleValue,
    scaleUnit: 'yards',
    gridType,
    rows: gridRows,
    cols: gridCols,
    grid,
    tilesById,
    terrainById,
    markersById: {},
    linksById: {},
    revealedTileIds: new Set<TileId>([partyTileId]),
    partyTileId,
    lastSelectedTerrainId: startTerrainId,
    lastPlacedTerrainId: startTerrainId,
  };
}

// ============================================================================
// LOCATION TERRAIN RESOLUTION
// ============================================================================

/** Opposite-side pairs for river detection (indices into DIRECTIONS array).
 *  DIRECTIONS order: NW(0) N(1) NE(2) W(3) E(4) SW(5) S(6) SE(7) */
const OPPOSITE_PAIRS: [number, number][] = [
  [1, 6],  // N <-> S
  [3, 4],  // W <-> E
  [0, 7],  // NW <-> SE
  [2, 5],  // NE <-> SW
];

/**
 * Resolve the location terrain type for the weather system based on a map tile.
 *
 * - Preset terrains with `locationTerrain` use that value directly.
 * - Water tiles use adjacency analysis: all-water = coastal, corridor = river, else coastal.
 * - Road tiles inherit from nearest non-road neighbor, defaulting to plains.
 * - Custom terrains use `locationTerrain` if set, otherwise default to plains.
 */
export function resolveLocationTerrain(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols' | 'tilesById' | 'terrainById'>,
  tileId: TileId
): TerrainType {
  const tile = map.tilesById[tileId];
  if (!tile || !tile.terrainId) return 'plains';

  const terrain = map.terrainById[tile.terrainId];
  if (!terrain) return 'plains';

  // Water: context-dependent
  if (terrain.id === 'terrain-water' || terrain.name === 'Water') {
    return resolveWaterTerrain(map, tileId);
  }

  // Road: inherit from neighbors
  if (terrain.id === 'terrain-road' || terrain.name === 'Road') {
    return resolveRoadTerrain(map, tileId);
  }

  // Direct mapping via locationTerrain field
  if (terrain.locationTerrain) {
    return terrain.locationTerrain as TerrainType;
  }

  // Fallback for custom terrains without locationTerrain
  return 'plains';
}

/**
 * Determine water context from adjacent tiles.
 * - All neighbors water -> coastal (open ocean)
 * - Water on opposite sides with land between -> river
 * - Mixed -> coastal
 */
function resolveWaterTerrain(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols' | 'tilesById' | 'terrainById'>,
  tileId: TileId
): TerrainType {
  const adjacentIds = getAdjacentTileIds(map, tileId);
  if (adjacentIds.length === 0) return 'coastal';

  const neighborTerrains = adjacentIds.map((id) => {
    const t = map.tilesById[id];
    if (!t || !t.terrainId) return null;
    return map.terrainById[t.terrainId] ?? null;
  });

  const isWater = (t: TerrainModel | null): boolean =>
    t !== null && (t.id === 'terrain-water' || t.name === 'Water');

  const waterCount = neighborTerrains.filter(isWater).length;

  // All neighbors are water -> open ocean -> coastal
  if (waterCount === adjacentIds.length) return 'coastal';

  // Check for river pattern: water on opposite sides with non-water between.
  // Get the 8-direction neighbor info in order to check opposite pairs.
  const pos = findTileGridPos(map, tileId);
  if (pos) {
    const dirNeighbors = DIRECTIONS.map(([dr, dc]) => {
      const nr = pos.row + dr;
      const nc = pos.col + dc;
      const nId = getTileIdAt(map, nr, nc);
      if (!nId) return null;
      const t = map.tilesById[nId];
      if (!t || !t.terrainId) return null;
      return map.terrainById[t.terrainId] ?? null;
    });

    // River: at least one pair of opposite directions both have non-water,
    // while there are exactly 2-3 water neighbors forming a corridor.
    if (waterCount >= 2 && waterCount <= 3) {
      for (const [a, b] of OPPOSITE_PAIRS) {
        const terrainA = dirNeighbors[a];
        const terrainB = dirNeighbors[b];
        if (terrainA && terrainB && !isWater(terrainA) && !isWater(terrainB)) {
          return 'river';
        }
      }
    }
  }

  return 'coastal';
}

/**
 * Road tiles inherit location terrain from the nearest non-road neighbor.
 * Falls back to plains if all neighbors are roads or unassigned.
 */
function resolveRoadTerrain(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols' | 'tilesById' | 'terrainById'>,
  tileId: TileId
): TerrainType {
  const adjacentIds = getAdjacentTileIds(map, tileId);

  for (const adjId of adjacentIds) {
    const adjTile = map.tilesById[adjId];
    if (!adjTile || !adjTile.terrainId) continue;
    const adjTerrain = map.terrainById[adjTile.terrainId];
    if (!adjTerrain) continue;
    // Skip other roads
    if (adjTerrain.id === 'terrain-road' || adjTerrain.name === 'Road') continue;
    // Skip water (road next to water shouldn't inherit coastal)
    if (adjTerrain.id === 'terrain-water' || adjTerrain.name === 'Water') continue;

    // Use this neighbor's location terrain
    if (adjTerrain.locationTerrain) {
      return adjTerrain.locationTerrain as TerrainType;
    }
  }

  return 'plains';
}
