import type { MapModel, TileId } from '../types/map';
import {
  DEFAULT_SIGHT_RANGE_TILES,
  DEFAULT_TERRAIN_ELEVATION,
} from '../constants/map';
import { findTileGridPos, getTileIdAt } from './mapUtils';

type ElevationMap = Pick<MapModel, 'tilesById' | 'terrainById'>;
type GridMap = Pick<MapModel, 'grid' | 'rows' | 'cols' | 'tilesById' | 'terrainById'>;

export function getEffectiveElevation(map: ElevationMap, tileId: TileId): number {
  const tile = map.tilesById[tileId];
  if (!tile) return 0;
  if (tile.elevationOverride !== undefined) return tile.elevationOverride;
  if (tile.terrainId === null) return 0;
  const terrain = map.terrainById[tile.terrainId];
  return terrain?.elevation ?? (terrain ? DEFAULT_TERRAIN_ELEVATION : 0);
}

/** Return each integer cell on a Bresenham line, including both endpoints. */
function bresenhamCells(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  let col = fromCol;
  let row = fromRow;
  const deltaCol = Math.abs(toCol - fromCol);
  const deltaRow = Math.abs(toRow - fromRow);
  const stepCol = fromCol < toCol ? 1 : -1;
  const stepRow = fromRow < toRow ? 1 : -1;
  let error = deltaCol - deltaRow;

  while (true) {
    cells.push({ row, col });
    if (row === toRow && col === toCol) break;
    const doubledError = error * 2;
    if (doubledError > -deltaRow) {
      error -= deltaRow;
      col += stepCol;
    }
    if (doubledError < deltaCol) {
      error += deltaCol;
      row += stepRow;
    }
  }
  return cells;
}

interface GridPos {
  row: number;
  col: number;
}

/** Position-based LOS core so callers with known positions skip the grid scan. */
function hasLineOfSightFromPos(
  map: GridMap,
  from: GridPos,
  fromTileId: TileId,
  to: GridPos,
  toTileId: TileId
): boolean {
  const deltaRow = Math.abs(to.row - from.row);
  const deltaCol = Math.abs(to.col - from.col);
  const steps = Math.max(deltaRow, deltaCol);
  if (steps <= 1) return true;

  const eyeHeight = getEffectiveElevation(map, fromTileId) + 1;
  const targetHeight = getEffectiveElevation(map, toTileId) + 1;
  const cells = bresenhamCells(from.row, from.col, to.row, to.col);

  for (let index = 1; index < cells.length - 1; index += 1) {
    const cell = cells[index];
    const tileId = getTileIdAt(map, cell.row, cell.col);
    if (!tileId) continue;
    const t = index / steps;
    const rayHeight = eyeHeight + (targetHeight - eyeHeight) * t;
    if (getEffectiveElevation(map, tileId) >= rayHeight - 1e-9) return false;
  }
  return true;
}

export function hasLineOfSight(
  map: GridMap,
  fromTileId: TileId,
  toTileId: TileId
): boolean {
  if (fromTileId === toTileId) return true;
  const from = findTileGridPos(map, fromTileId);
  const to = findTileGridPos(map, toTileId);
  if (!from || !to) return false;
  return hasLineOfSightFromPos(map, from, fromTileId, to, toTileId);
}

export function getSightRangeTiles(map: Pick<MapModel, 'sightRangeTiles'>): number {
  return map.sightRangeTiles ?? DEFAULT_SIGHT_RANGE_TILES;
}

export function computeVisibleTiles(
  map: GridMap & Pick<MapModel, 'sightRangeTiles'>,
  observerTileIds: TileId[]
): Set<TileId> {
  const visible = new Set<TileId>();
  const range = getSightRangeTiles(map);

  for (const observerId of observerTileIds) {
    const observer = findTileGridPos(map, observerId);
    if (!observer) continue;
    const minRow = Math.max(0, observer.row - range);
    const maxRow = Math.min(map.rows - 1, observer.row + range);
    const minCol = Math.max(0, observer.col - range);
    const maxCol = Math.min(map.cols - 1, observer.col + range);
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const tileId = map.grid[row][col];
        if (
          !visible.has(tileId)
          && hasLineOfSightFromPos(map, observer, observerId, { row, col }, tileId)
        ) {
          visible.add(tileId);
        }
      }
    }
  }
  return visible;
}
