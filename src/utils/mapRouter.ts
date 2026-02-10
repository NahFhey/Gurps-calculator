/**
 * mapRouter — A* pathfinding for map travel routes.
 *
 * Distance is measured in MILES, not time. Each tile step costs
 * `map.scaleMilesPerTile * distFactor / terrain.speedModifier` miles,
 * where distFactor is 1.0 for orthogonal and √2 for diagonal movement.
 *
 * The travel budget per slot is `mode.milesPerSlot` (e.g., foot=12, boat=50, airship=457).
 * This means a boat on a 12-mile map can cover ~4 tiles per slot,
 * giving it a meaningful range advantage over foot travel.
 */

import type { MapModel, TileId, TravelMode } from '../types/map';
import { findTileGridPos, getTileIdAt } from './mapUtils';
import { getTravelModeDefinition } from '../constants/map';

/** 8-directional neighbor offsets with distance multipliers */
const DIRECTIONS: [number, number, number][] = [
  [-1, 0, 1],     // N
  [1, 0, 1],      // S
  [0, -1, 1],     // W
  [0, 1, 1],      // E
  [-1, -1, 1.414], // NW
  [-1, 1, 1.414],  // NE
  [1, -1, 1.414],  // SW
  [1, 1, 1.414],   // SE
];

/** Result of a pathfinding operation */
export interface RouteResult {
  /** Ordered tile IDs from start to destination (inclusive) */
  path: TileId[];
  /** Total movement cost in miles (factoring diagonal distance and terrain modifiers) */
  totalCost: number;
  /** Whether a valid path was found */
  valid: boolean;
}

/**
 * Find the shortest path between two tiles using A* search.
 *
 * Cost is measured in miles: each step costs
 * `scaleMilesPerTile * distFactor / terrain.speedModifier`.
 *
 * @param map - The map to route on
 * @param startTileId - Starting tile ID
 * @param destTileId - Destination tile ID
 * @param mode - Travel mode (determines terrain passability)
 * @param allowNullTerrain - If true, null-terrain tiles are traversable (GM override)
 * @returns RouteResult with path, cost (miles), and validity
 */
export function findRoute(
  map: MapModel,
  startTileId: TileId,
  destTileId: TileId,
  mode: TravelMode,
  allowNullTerrain = false
): RouteResult {
  const startPos = findTileGridPos(map, startTileId);
  const destPos = findTileGridPos(map, destTileId);

  if (!startPos || !destPos) {
    return { path: [], totalCost: Infinity, valid: false };
  }

  // Same tile — trivial case
  if (startTileId === destTileId) {
    return { path: [startTileId], totalCost: 0, valid: true };
  }

  const scale = map.scaleMilesPerTile;

  // A* setup
  const openSet = new MinHeap<{ tileId: TileId; row: number; col: number }>();
  const gScore = new Map<TileId, number>();
  const fScore = new Map<TileId, number>();
  const cameFrom = new Map<TileId, TileId>();

  gScore.set(startTileId, 0);
  fScore.set(startTileId, heuristic(startPos.row, startPos.col, destPos.row, destPos.col) * scale);
  openSet.push(
    { tileId: startTileId, row: startPos.row, col: startPos.col },
    fScore.get(startTileId)!
  );

  while (openSet.size > 0) {
    const current = openSet.pop()!;

    if (current.tileId === destTileId) {
      // Reconstruct path
      const path = reconstructPath(cameFrom, destTileId);
      return { path, totalCost: gScore.get(destTileId)!, valid: true };
    }

    const currentG = gScore.get(current.tileId) ?? Infinity;

    for (const [dr, dc, distFactor] of DIRECTIONS) {
      const nr = current.row + dr;
      const nc = current.col + dc;
      const neighborId = getTileIdAt(map, nr, nc);
      if (!neighborId) continue;

      const neighborTile = map.tilesById[neighborId];
      if (!neighborTile) continue;

      // Check terrain passability
      if (neighborTile.terrainId === null) {
        if (!allowNullTerrain) continue;
      } else {
        const terrain = map.terrainById[neighborTile.terrainId];
        if (!terrain) continue;
        const modeProps = terrain.perMode[mode];
        if (!modeProps || !modeProps.passable) continue;
      }

      // Calculate step cost in miles
      const speedMod = getSpeedModifier(map, neighborId, mode);
      const stepMiles = (scale * distFactor) / speedMod;

      const tentativeG = currentG + stepMiles;
      const prevG = gScore.get(neighborId) ?? Infinity;

      if (tentativeG < prevG) {
        cameFrom.set(neighborId, current.tileId);
        gScore.set(neighborId, tentativeG);
        const f = tentativeG + heuristic(nr, nc, destPos.row, destPos.col) * scale;
        fScore.set(neighborId, f);
        openSet.push({ tileId: neighborId, row: nr, col: nc }, f);
      }
    }
  }

  // No path found
  return { path: [], totalCost: Infinity, valid: false };
}

/**
 * Compute the total distance (in miles) for a given route.
 *
 * Each tile step costs:
 *   scaleMilesPerTile * distFactor / terrain.speedModifier
 * where distFactor is 1.0 for orthogonal, √2 for diagonal.
 */
export function computeRouteMiles(
  map: MapModel,
  routeTileIds: TileId[],
  mode: TravelMode
): number {
  if (routeTileIds.length <= 1) return 0;

  const scale = map.scaleMilesPerTile;
  let totalMiles = 0;

  for (let i = 1; i < routeTileIds.length; i++) {
    const prevId = routeTileIds[i - 1];
    const currId = routeTileIds[i];

    const prevPos = findTileGridPos(map, prevId);
    const currPos = findTileGridPos(map, currId);
    if (!prevPos || !currPos) continue;

    const dr = Math.abs(currPos.row - prevPos.row);
    const dc = Math.abs(currPos.col - prevPos.col);
    const distFactor = (dr === 1 && dc === 1) ? 1.414 : 1.0;

    const speedMod = getSpeedModifier(map, currId, mode);
    const stepMiles = (scale * distFactor) / speedMod;
    totalMiles += stepMiles;
  }

  return totalMiles;
}

/**
 * Get reachable tile IDs from a starting tile within one slot's travel budget.
 * Budget = mode.milesPerSlot (miles).
 * Uses Dijkstra's algorithm to find all tiles within budget.
 */
export function getReachableTiles(
  map: MapModel,
  startTileId: TileId,
  mode: TravelMode,
  allowNullTerrain = false
): Set<TileId> {
  const modeDef = getTravelModeDefinition(mode);
  const budget = modeDef.milesPerSlot;
  const scale = map.scaleMilesPerTile;

  const startPos = findTileGridPos(map, startTileId);
  if (!startPos) return new Set();

  const reachable = new Set<TileId>();
  const cost = new Map<TileId, number>();
  const queue = new MinHeap<{ tileId: TileId; row: number; col: number }>();

  cost.set(startTileId, 0);
  queue.push({ tileId: startTileId, row: startPos.row, col: startPos.col }, 0);

  while (queue.size > 0) {
    const current = queue.pop()!;
    const currentCost = cost.get(current.tileId) ?? Infinity;

    if (reachable.has(current.tileId)) continue;
    reachable.add(current.tileId);

    for (const [dr, dc, distFactor] of DIRECTIONS) {
      const nr = current.row + dr;
      const nc = current.col + dc;
      const neighborId = getTileIdAt(map, nr, nc);
      if (!neighborId || reachable.has(neighborId)) continue;

      const neighborTile = map.tilesById[neighborId];
      if (!neighborTile) continue;

      // Check passability
      if (neighborTile.terrainId === null) {
        if (!allowNullTerrain) continue;
      } else {
        const terrain = map.terrainById[neighborTile.terrainId];
        if (!terrain) continue;
        const modeProps = terrain.perMode[mode];
        if (!modeProps || !modeProps.passable) continue;
      }

      const speedMod = getSpeedModifier(map, neighborId, mode);
      const stepMiles = (scale * distFactor) / speedMod;
      const totalCost = currentCost + stepMiles;

      if (totalCost <= budget) {
        const prevCost = cost.get(neighborId) ?? Infinity;
        if (totalCost < prevCost) {
          cost.set(neighborId, totalCost);
          queue.push({ tileId: neighborId, row: nr, col: nc }, totalCost);
        }
      }
    }
  }

  return reachable;
}

// ============================================================================
// TACTICAL COMBAT PATHFINDING
// ============================================================================

/**
 * Get the movement cost for stepping onto a tile in tactical (combat) mode.
 * Uses terrain.tactical properties instead of overland perMode.
 *
 * @param map - The tactical map
 * @param tileId - Tile being stepped onto
 * @param distFactor - 1.0 for orthogonal, 1.414 for diagonal
 * @returns Cost in yards (Infinity if impassable)
 */
function getTacticalStepCost(map: MapModel, tileId: TileId, distFactor: number): number {
  const tile = map.tilesById[tileId];
  if (!tile || tile.terrainId === null) return distFactor; // null terrain = normal cost
  const terrain = map.terrainById[tile.terrainId];
  if (!terrain?.tactical) return distFactor; // no tactical data = normal cost
  if (terrain.tactical.blocksMovement) return Infinity;
  const movementCost = terrain.tactical.movementCost;
  if (movementCost === Infinity) return Infinity;
  return distFactor * movementCost;
}

/**
 * Find the shortest path between two tiles on a tactical (combat-scale) map.
 * Uses A* with terrain.tactical costs instead of overland TravelMode costs.
 *
 * Cost is measured in yards: each step costs distFactor * terrain.tactical.movementCost.
 *
 * @param map - The tactical map
 * @param startTileId - Starting tile ID
 * @param destTileId - Destination tile ID
 * @returns RouteResult with path, cost (yards), and validity
 */
export function findTacticalRoute(
  map: MapModel,
  startTileId: TileId,
  destTileId: TileId
): RouteResult {
  const startPos = findTileGridPos(map, startTileId);
  const destPos = findTileGridPos(map, destTileId);

  if (!startPos || !destPos) {
    return { path: [], totalCost: Infinity, valid: false };
  }

  if (startTileId === destTileId) {
    return { path: [startTileId], totalCost: 0, valid: true };
  }

  const openSet = new MinHeap<{ tileId: TileId; row: number; col: number }>();
  const gScore = new Map<TileId, number>();
  const fScore = new Map<TileId, number>();
  const cameFrom = new Map<TileId, TileId>();

  gScore.set(startTileId, 0);
  fScore.set(startTileId, heuristic(startPos.row, startPos.col, destPos.row, destPos.col));
  openSet.push(
    { tileId: startTileId, row: startPos.row, col: startPos.col },
    fScore.get(startTileId)!
  );

  while (openSet.size > 0) {
    const current = openSet.pop()!;

    if (current.tileId === destTileId) {
      const path = reconstructPath(cameFrom, destTileId);
      return { path, totalCost: gScore.get(destTileId)!, valid: true };
    }

    const currentG = gScore.get(current.tileId) ?? Infinity;

    for (const [dr, dc, distFactor] of DIRECTIONS) {
      const nr = current.row + dr;
      const nc = current.col + dc;
      const neighborId = getTileIdAt(map, nr, nc);
      if (!neighborId) continue;

      const stepCost = getTacticalStepCost(map, neighborId, distFactor);
      if (stepCost === Infinity) continue;

      const tentativeG = currentG + stepCost;
      const prevG = gScore.get(neighborId) ?? Infinity;

      if (tentativeG < prevG) {
        cameFrom.set(neighborId, current.tileId);
        gScore.set(neighborId, tentativeG);
        const f = tentativeG + heuristic(nr, nc, destPos.row, destPos.col);
        fScore.set(neighborId, f);
        openSet.push({ tileId: neighborId, row: nr, col: nc }, f);
      }
    }
  }

  return { path: [], totalCost: Infinity, valid: false };
}

/**
 * Get all tiles reachable within a movement budget on a tactical map.
 * Uses Dijkstra's algorithm with terrain.tactical costs.
 *
 * @param map - The tactical map
 * @param startTileId - Starting tile ID
 * @param budgetYards - Maximum movement in yards
 * @param occupiedTileIds - Tiles occupied by other combatants (excluded from result, but traversable)
 * @returns Set of reachable tile IDs (including start tile)
 */
export function getTacticalReachableTiles(
  map: MapModel,
  startTileId: TileId,
  budgetYards: number,
  occupiedTileIds?: Set<TileId>
): Set<TileId> {
  const startPos = findTileGridPos(map, startTileId);
  if (!startPos) return new Set();

  const reachable = new Set<TileId>();
  const cost = new Map<TileId, number>();
  const queue = new MinHeap<{ tileId: TileId; row: number; col: number }>();

  cost.set(startTileId, 0);
  queue.push({ tileId: startTileId, row: startPos.row, col: startPos.col }, 0);

  while (queue.size > 0) {
    const current = queue.pop()!;
    const currentCost = cost.get(current.tileId) ?? Infinity;

    if (reachable.has(current.tileId)) continue;
    reachable.add(current.tileId);

    for (const [dr, dc, distFactor] of DIRECTIONS) {
      const nr = current.row + dr;
      const nc = current.col + dc;
      const neighborId = getTileIdAt(map, nr, nc);
      if (!neighborId || reachable.has(neighborId)) continue;

      const stepCost = getTacticalStepCost(map, neighborId, distFactor);
      if (stepCost === Infinity) continue;

      const totalCost = currentCost + stepCost;

      if (totalCost <= budgetYards) {
        const prevCost = cost.get(neighborId) ?? Infinity;
        if (totalCost < prevCost) {
          cost.set(neighborId, totalCost);
          queue.push({ tileId: neighborId, row: nr, col: nc }, totalCost);
        }
      }
    }
  }

  // Remove occupied tiles from result (can't end movement there) but keep start tile
  if (occupiedTileIds) {
    for (const tileId of occupiedTileIds) {
      if (tileId !== startTileId) {
        reachable.delete(tileId);
      }
    }
  }

  return reachable;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Octile distance heuristic for A* (admissible for 8-directional movement) */
function heuristic(r1: number, c1: number, r2: number, c2: number): number {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return Math.max(dr, dc) + (1.414 - 1) * Math.min(dr, dc);
}

/** Get the speed modifier for a tile given a travel mode */
function getSpeedModifier(map: MapModel, tileId: TileId, mode: TravelMode): number {
  const tile = map.tilesById[tileId];
  if (!tile || !tile.terrainId) return 1.0; // null terrain = normal speed
  const terrain = map.terrainById[tile.terrainId];
  if (!terrain || !terrain.perMode) return 1.0;
  return terrain.perMode[mode]?.speedModifier || 1.0;
}

/** Reconstruct path from A* cameFrom map */
function reconstructPath(cameFrom: Map<TileId, TileId>, current: TileId): TileId[] {
  const path: TileId[] = [current];
  let node = current;
  while (cameFrom.has(node)) {
    node = cameFrom.get(node)!;
    path.unshift(node);
  }
  return path;
}

// ============================================================================
// MIN HEAP (Priority Queue)
// ============================================================================

/** Simple min-heap for A* open set */
class MinHeap<T> {
  private heap: { item: T; priority: number }[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top.item;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.heap[idx].priority >= this.heap[parent].priority) break;
      [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const len = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < len && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < len && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}
