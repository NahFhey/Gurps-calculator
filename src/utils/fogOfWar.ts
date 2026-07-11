/**
 * fogOfWar.ts — Computes visible tiles for player fog-of-war.
 *
 * Uses BFS from character positions to find tiles within a vision radius.
 * The result is unioned with GM-revealed tiles to form the player's visible set.
 */

import { getAdjacentTileIds } from './mapUtils';
import type { MapModel, TileId } from '../types/map';

/** Default vision radius in tiles */
export const DEFAULT_VISION_RADIUS = 3;

/**
 * Compute tiles visible from a set of character positions via BFS.
 * Returns a Set of tileIds that the player can see.
 *
 * @param map      The map model (needs grid, rows, cols for adjacency)
 * @param positions Array of tileIds where the player's characters are located
 * @param radius   Vision radius in tiles (default 3)
 */
export function computePlayerVisibleTiles(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols'>,
  positions: TileId[],
  radius: number = DEFAULT_VISION_RADIUS
): Set<TileId> {
  const visible = new Set<TileId>();

  for (const startTileId of positions) {
    // BFS from this position
    const queue: Array<{ tileId: TileId; depth: number }> = [{ tileId: startTileId, depth: 0 }];
    const visited = new Set<TileId>();
    visited.add(startTileId);

    while (queue.length > 0) {
      const { tileId, depth } = queue.shift()!;
      visible.add(tileId);

      if (depth < radius) {
        const neighbors = getAdjacentTileIds(map, tileId);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push({ tileId: neighbor, depth: depth + 1 });
          }
        }
      }
    }
  }

  return visible;
}
