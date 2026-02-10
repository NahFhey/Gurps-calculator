/**
 * Range Utility Functions for Phase E: Range and Modifiers
 *
 * Pure functions for grid distance calculation and GURPS Speed/Range
 * table lookup. Used by the attack workflow to auto-inject range
 * penalties when both attacker and target have grid positions.
 */

import type { GridPosition } from '../types/combatTracker';
import type { GridType } from '../types/map';

/**
 * GURPS Speed/Range table (B550).
 * Each entry: [maxRange, modifier].
 * For a given range, find the first entry where range <= maxRange.
 */
const SPEED_RANGE_TABLE: readonly [number, number][] = [
  [2, 0],
  [3, -1],
  [5, -2],
  [7, -3],
  [10, -4],
  [15, -5],
  [20, -6],
  [30, -7],
  [50, -8],
  [70, -9],
  [100, -10],
  [150, -11],
  [200, -12],
  [300, -13],
  [500, -14],
  [700, -15],
  [1000, -16],
  [1500, -17],
  [2000, -18],
  [3000, -19],
  [5000, -20],
];

/**
 * Calculate grid distance between two positions.
 *
 * For square grids: Chebyshev distance (max of |Δq|, |Δr|).
 * This correctly models 8-directional movement where diagonals cost 1.
 *
 * For hex grids: axial distance (future).
 *
 * @param a - First position (q=col, r=row)
 * @param b - Second position (q=col, r=row)
 * @param gridType - Grid geometry ('square' or 'hex')
 * @returns Distance in grid tiles (= yards for tactical maps at 1 yd/tile)
 */
export function gridDistance(
  a: GridPosition,
  b: GridPosition,
  gridType: GridType = 'square'
): number {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);

  if (gridType === 'hex') {
    // Axial hex distance
    return Math.max(dq, dr, Math.abs(dq - dr));
  }

  // Square grid: Chebyshev distance
  return Math.max(dq, dr);
}

/**
 * Look up the GURPS Speed/Range penalty for a given range in yards.
 *
 * @param rangeYards - Distance in yards (must be >= 0)
 * @returns Modifier value (0 or negative)
 */
export function speedRangeModifier(rangeYards: number): number {
  if (rangeYards <= 0) return 0;

  for (const [maxRange, modifier] of SPEED_RANGE_TABLE) {
    if (rangeYards <= maxRange) {
      return modifier;
    }
  }

  // Beyond table: cap at -20
  return -20;
}

/**
 * Build the range modifier label string.
 * E.g., "Range: 5 yds (-2)"
 *
 * @param rangeYards - Distance in yards
 * @param modifier - The speed/range modifier value
 * @returns Formatted label string
 */
export function rangeModifierLabel(rangeYards: number, modifier: number): string {
  return `Range: ${rangeYards} yd${rangeYards !== 1 ? 's' : ''} (${modifier >= 0 ? '+' : ''}${modifier})`;
}

/**
 * Check if two positions are adjacent (melee range) on a square grid.
 * Adjacent = Chebyshev distance <= 1 (8-directional neighbors or same tile).
 *
 * @param a - First position
 * @param b - Second position
 * @param gridType - Grid geometry
 * @returns true if positions are adjacent (within 1 tile)
 */
export function isAdjacentPosition(
  a: GridPosition,
  b: GridPosition,
  gridType: GridType = 'square'
): boolean {
  return gridDistance(a, b, gridType) <= 1;
}
