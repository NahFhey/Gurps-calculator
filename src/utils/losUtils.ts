/**
 * Line-of-Sight utilities for combat map integration.
 *
 * Stub implementation — full LOS calculation is planned for Phase 14 (Map System).
 */

import type { MapModel, TileId } from '../types/map';

export interface LOSResult {
  blocked: boolean;
  path: TileId[];
}

/**
 * Calculate line-of-sight between two tiles on a map.
 * Returns the path of tiles between actor and target, and whether LOS is blocked.
 *
 * Currently returns a simple unblocked path (no terrain obstruction checks).
 */
export function getLineOfSight(
  _map: MapModel,
  actorTileId: TileId,
  targetTileId: TileId
): LOSResult {
  // Stub: return direct path without obstruction checking
  return {
    blocked: false,
    path: [actorTileId, targetTileId],
  };
}
