import { describe, expect, it } from 'vitest';
import { computePlayerVisibleTiles, DEFAULT_VISION_RADIUS } from '../fogOfWar';
import type { MapModel, TileId } from '../../types/map';

/**
 * Build a minimal map fixture with predictable tile IDs of the form `r{row}c{col}`.
 * fogOfWar only reads `grid`, `rows`, `cols` (via Pick), so the rest of MapModel is unneeded.
 */
function buildGrid(rows: number, cols: number): Pick<MapModel, 'grid' | 'rows' | 'cols'> {
  const grid: TileId[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: TileId[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(`r${r}c${c}`);
    }
    grid.push(row);
  }
  return { grid, rows, cols };
}

describe('DEFAULT_VISION_RADIUS', () => {
  it('is 3 tiles', () => {
    expect(DEFAULT_VISION_RADIUS).toBe(3);
  });
});

describe('computePlayerVisibleTiles', () => {
  it('returns an empty set when there are no character positions', () => {
    const map = buildGrid(5, 5);
    const visible = computePlayerVisibleTiles(map, [], 3);
    expect(visible.size).toBe(0);
  });

  it('returns only the start tile when radius is 0', () => {
    const map = buildGrid(5, 5);
    const visible = computePlayerVisibleTiles(map, ['r2c2'], 0);
    expect(visible.size).toBe(1);
    expect(visible.has('r2c2')).toBe(true);
  });

  it('includes the 8 adjacent tiles plus the center at radius 1', () => {
    const map = buildGrid(5, 5);
    const visible = computePlayerVisibleTiles(map, ['r2c2'], 1);
    // 8-directional: 3x3 block around the center
    const expected = [
      'r1c1', 'r1c2', 'r1c3',
      'r2c1', 'r2c2', 'r2c3',
      'r3c1', 'r3c2', 'r3c3',
    ];
    expect(visible.size).toBe(expected.length);
    for (const id of expected) {
      expect(visible.has(id)).toBe(true);
    }
  });

  it('uses the default vision radius of 3 when omitted', () => {
    const map = buildGrid(9, 9);
    const visibleDefault = computePlayerVisibleTiles(map, ['r4c4']);
    const visibleExplicit = computePlayerVisibleTiles(map, ['r4c4'], DEFAULT_VISION_RADIUS);
    expect(visibleDefault.size).toBe(visibleExplicit.size);
    // 8-directional radius 3 expands to a 7x7 block on an open grid
    expect(visibleDefault.size).toBe(49);
  });

  it('clips visibility against the grid edge without throwing', () => {
    const map = buildGrid(5, 5);
    // Corner with radius 1 should reveal only the 2x2 corner block
    const visible = computePlayerVisibleTiles(map, ['r0c0'], 1);
    expect(visible.size).toBe(4);
    expect(visible.has('r0c0')).toBe(true);
    expect(visible.has('r0c1')).toBe(true);
    expect(visible.has('r1c0')).toBe(true);
    expect(visible.has('r1c1')).toBe(true);
  });

  it('unions visibility from multiple character positions', () => {
    const map = buildGrid(5, 9);
    const visible = computePlayerVisibleTiles(map, ['r2c0', 'r2c8'], 1);
    // Each character contributes a 3x3 (or clipped) block; the two blocks do not overlap.
    expect(visible.has('r2c0')).toBe(true);
    expect(visible.has('r2c8')).toBe(true);
    expect(visible.has('r1c1')).toBe(true);
    expect(visible.has('r3c7')).toBe(true);
    // Tiles between the two characters remain hidden
    expect(visible.has('r2c4')).toBe(false);
  });

  it('returns an empty set when the start position is not on the grid', () => {
    const map = buildGrid(5, 5);
    const visible = computePlayerVisibleTiles(map, ['nonexistent-tile'], 3);
    // The start tile itself is added before the adjacency lookup fails, so only it appears.
    expect(visible.size).toBe(1);
    expect(visible.has('nonexistent-tile')).toBe(true);
  });
});
