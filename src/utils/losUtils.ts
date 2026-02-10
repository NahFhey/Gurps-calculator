/**
 * Line-of-Sight Utility Functions for Phase F
 *
 * Pure functions for LoS calculation, Bresenham line tracing, and
 * cover analysis on the tactical grid. Used by the attack workflow
 * to auto-inject cover penalties and determine target visibility.
 */

import type { GridPosition } from '../types/combatTracker';
import type { GridType, MapModel } from '../types/map';

// ============================================================================
// TYPES
// ============================================================================

/** Cover level along a LoS line. 0=none, 1=light, 2=heavy, 3=full block */
export type CoverLevel = 0 | 1 | 2 | 3;

/** Result of a line-of-sight check between two grid positions. */
export interface LoSResult {
  /** Whether the attacker can see the target */
  hasLoS: boolean;
  /** Highest cover level encountered along the line */
  coverLevel: CoverLevel;
  /** GURPS to-hit modifier for the cover level (0, -2, -4) */
  coverModifier: number;
  /** Positions of tiles that block or provide cover */
  blockedBy: GridPosition[];
  /** All tiles the LoS line passes through (for overlay, excluding endpoints) */
  lineTiles: GridPosition[];
}

/** Minimal map data needed for LoS calculation. */
export type LoSMapData = Pick<MapModel, 'grid' | 'rows' | 'cols' | 'tilesById' | 'terrainById'>;

// ============================================================================
// CONSTANTS
// ============================================================================

const COVER_MODIFIER: Record<CoverLevel, number> = {
  0: 0,    // No cover
  1: -2,   // Light cover
  2: -4,   // Heavy cover
  3: 0,    // Full block (no modifier — target is untargetable)
};

// ============================================================================
// BRESENHAM LINE
// ============================================================================

/**
 * Trace all grid cells between two points using a supercover Bresenham variant.
 * Returns cells the line passes through, EXCLUDING the start and end points.
 * Handles diagonal corner-crossing by including both adjacent cells.
 *
 * @param from - Start position (q=col, r=row)
 * @param to - End position (q=col, r=row)
 * @returns Array of grid positions the line passes through
 */
export function bresenhamLine(from: GridPosition, to: GridPosition): GridPosition[] {
  const result: GridPosition[] = [];

  let q0 = from.q;
  let r0 = from.r;
  const q1 = to.q;
  const r1 = to.r;

  const dq = Math.abs(q1 - q0);
  const dr = Math.abs(r1 - r0);
  const sq = q0 < q1 ? 1 : -1;
  const sr = r0 < r1 ? 1 : -1;

  let err = dq - dr;

  // Walk the line — exclude start and end points
  while (q0 !== q1 || r0 !== r1) {
    const e2 = 2 * err;

    // Supercover: when crossing a diagonal corner, add both adjacent cells
    if (e2 > -dr && e2 < dq) {
      // Pure diagonal step — add both orthogonal neighbors for supercover
      result.push({ q: q0 + sq, r: r0 });
      result.push({ q: q0, r: r0 + sr });
      err -= dr;
      err += dq;
      q0 += sq;
      r0 += sr;
    } else if (e2 > -dr) {
      // Horizontal step
      err -= dr;
      q0 += sq;
    } else {
      // Vertical step
      err += dq;
      r0 += sr;
    }

    // Don't include the final endpoint
    if (q0 === q1 && r0 === r1) break;

    result.push({ q: q0, r: r0 });
  }

  return result;
}

// ============================================================================
// LINE OF SIGHT
// ============================================================================

/**
 * Check line-of-sight and determine cover between two grid positions.
 *
 * Algorithm:
 * 1. Same tile or adjacent → clear LoS (no cover)
 * 2. Trace Bresenham line between positions
 * 3. For each tile along the line, check blocking and cover properties
 * 4. If any tile fully blocks LoS → hasLoS: false
 * 5. Otherwise → hasLoS: true, coverLevel = max cover along the path
 *
 * @param from - Attacker position
 * @param to - Target position
 * @param map - Map data (grid, tiles, terrain)
 * @param gridType - Grid geometry (square or hex)
 * @returns LoS result with cover level and modifier
 */
export function getLineOfSight(
  from: GridPosition,
  to: GridPosition,
  map: LoSMapData,
  gridType: GridType = 'square'
): LoSResult {
  const clearResult: LoSResult = {
    hasLoS: true,
    coverLevel: 0,
    coverModifier: 0,
    blockedBy: [],
    lineTiles: [],
  };

  // Same tile — always clear LoS
  if (from.q === to.q && from.r === to.r) {
    return clearResult;
  }

  // Adjacent tiles (Chebyshev distance 1 for square, axial for hex) — always clear LoS
  const dq = Math.abs(from.q - to.q);
  const dr = Math.abs(from.r - to.r);
  const dist = gridType === 'hex'
    ? Math.max(dq, dr, Math.abs(dq - dr))
    : Math.max(dq, dr);

  if (dist <= 1) {
    return clearResult;
  }

  // Trace the line
  const lineTiles = bresenhamLine(from, to);

  let maxCoverLevel: CoverLevel = 0;
  const blockedBy: GridPosition[] = [];

  for (const pos of lineTiles) {
    // Bounds check
    if (pos.r < 0 || pos.r >= map.rows || pos.q < 0 || pos.q >= map.cols) continue;

    const tileId = map.grid[pos.r]?.[pos.q];
    if (!tileId) continue;

    const tile = map.tilesById[tileId];
    if (!tile) continue;

    // Check tile-level blocking override
    if (tile.isBlocking) {
      return {
        hasLoS: false,
        coverLevel: 3,
        coverModifier: 0,
        blockedBy: [...blockedBy, pos],
        lineTiles,
      };
    }

    // Check terrain-level blocking and cover
    if (tile.terrainId) {
      const terrain = map.terrainById[tile.terrainId];
      if (terrain?.tactical) {
        if (terrain.tactical.blocksLoS) {
          return {
            hasLoS: false,
            coverLevel: 3,
            coverModifier: 0,
            blockedBy: [...blockedBy, pos],
            lineTiles,
          };
        }

        const tileCover = (terrain.tactical.coverLevel ?? 0) as CoverLevel;
        if (tileCover > 0) {
          blockedBy.push(pos);
          if (tileCover > maxCoverLevel) {
            maxCoverLevel = tileCover;
          }
        }
      }
    }
  }

  return {
    hasLoS: true,
    coverLevel: maxCoverLevel,
    coverModifier: COVER_MODIFIER[maxCoverLevel],
    blockedBy,
    lineTiles,
  };
}

// ============================================================================
// LABEL HELPERS
// ============================================================================

/**
 * Get the GURPS to-hit modifier for a cover level.
 * @param coverLevel - 0=none, 1=light, 2=heavy
 * @returns Modifier value (0, -2, -4)
 */
export function getCoverModifierValue(coverLevel: CoverLevel): number {
  return COVER_MODIFIER[coverLevel];
}

/**
 * Build a human-readable label for a cover modifier.
 * @param coverLevel - Cover level (1=light, 2=heavy)
 * @returns Label string, e.g., "Light Cover (-2)"
 */
export function coverModifierLabel(coverLevel: CoverLevel): string {
  switch (coverLevel) {
    case 1: return 'Light Cover (-2)';
    case 2: return 'Heavy Cover (-4)';
    case 3: return 'Full Cover (blocked)';
    default: return 'No Cover';
  }
}

/**
 * Compute LoS results for all targets from a single attacker position.
 * Useful for pre-computing LoS for the target dropdown.
 *
 * @param from - Attacker position
 * @param targets - Array of { instanceId, position } objects
 * @param map - Map data
 * @param gridType - Grid geometry
 * @returns Map of instanceId → LoSResult
 */
export function getLoSForTargets(
  from: GridPosition,
  targets: { instanceId: string; position?: GridPosition }[],
  map: LoSMapData,
  gridType: GridType = 'square'
): Map<string, LoSResult> {
  const results = new Map<string, LoSResult>();

  for (const target of targets) {
    if (!target.position) continue;
    results.set(target.instanceId, getLineOfSight(from, target.position, map, gridType));
  }

  return results;
}
