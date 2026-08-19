import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SIGHT_RANGE_TILES, DEFAULT_TERRAIN_ELEVATION } from '../../constants/map';
import type { MapModel, TerrainId, TileId } from '../../types/map';
import { createNewMap } from '../mapUtils';
import {
  computeVisibleTiles,
  getEffectiveElevation,
  getSightRangeTiles,
  hasLineOfSight,
} from '../lineOfSight';

function makeMap(): MapModel {
  return createNewMap({
    name: 'LOS test',
    scaleMilesPerTile: 12,
    startTerrainId: 'terrain-plains',
  });
}

function tileAt(map: MapModel, row: number, col: number): TileId {
  return map.grid[row][col];
}

function setTerrain(map: MapModel, row: number, col: number, terrainId: TerrainId | null) {
  map.tilesById[tileAt(map, row, col)].terrainId = terrainId;
}

describe('line of sight', () => {
  let map: MapModel;

  beforeEach(() => {
    map = makeMap();
  });

  it('uses terrain elevation', () => {
    const tileId = tileAt(map, 4, 4);
    map.terrainById['terrain-plains'].elevation = 3;
    expect(getEffectiveElevation(map, tileId)).toBe(3);
  });

  it('prefers a per-tile override', () => {
    const tileId = tileAt(map, 4, 4);
    map.tilesById[tileId].elevationOverride = 7;
    expect(getEffectiveElevation(map, tileId)).toBe(7);
  });

  it('resolves null terrain and missing tiles to zero', () => {
    const tileId = tileAt(map, 4, 3);
    setTerrain(map, 4, 3, null);
    expect(getEffectiveElevation(map, tileId)).toBe(0);
    expect(getEffectiveElevation(map, 'not-a-tile')).toBe(0);
  });

  it('uses the default when a terrain omits elevation', () => {
    const tileId = tileAt(map, 4, 4);
    delete map.terrainById['terrain-plains'].elevation;
    expect(getEffectiveElevation(map, tileId)).toBe(DEFAULT_TERRAIN_ELEVATION);
  });

  it('always sees self and adjacent tiles', () => {
    const from = tileAt(map, 4, 4);
    const adjacent = tileAt(map, 5, 5);
    map.tilesById[adjacent].elevationOverride = 20;
    expect(hasLineOfSight(map, from, from)).toBe(true);
    expect(hasLineOfSight(map, from, adjacent)).toBe(true);
  });

  it('cuts visibility off by Chebyshev range', () => {
    map.sightRangeTiles = 1;
    const observer = tileAt(map, 4, 4);
    const visible = computeVisibleTiles(map, [observer]);
    expect(visible).toContain(tileAt(map, 5, 5));
    expect(visible).not.toContain(tileAt(map, 6, 4));
  });

  it('blocks plains-to-plains sight with an intermediate hill', () => {
    setTerrain(map, 4, 3, 'terrain-plains');
    setTerrain(map, 4, 4, 'terrain-hills');
    setTerrain(map, 4, 5, 'terrain-plains');
    expect(hasLineOfSight(map, tileAt(map, 4, 3), tileAt(map, 4, 5))).toBe(false);
  });

  it('lets a mountain observer see over that hill to plains', () => {
    setTerrain(map, 4, 3, 'terrain-mountains');
    setTerrain(map, 4, 4, 'terrain-hills');
    setTerrain(map, 4, 5, 'terrain-plains');
    expect(hasLineOfSight(map, tileAt(map, 4, 3), tileAt(map, 4, 5))).toBe(true);
  });

  it('does not let elevation-zero water block an elevation-zero corridor', () => {
    setTerrain(map, 4, 3, 'terrain-water');
    setTerrain(map, 4, 4, 'terrain-water');
    setTerrain(map, 4, 5, 'terrain-water');
    expect(hasLineOfSight(map, tileAt(map, 4, 3), tileAt(map, 4, 5))).toBe(true);
  });

  it('lets a per-tile override flip a blocked result', () => {
    setTerrain(map, 4, 3, 'terrain-plains');
    setTerrain(map, 4, 4, 'terrain-hills');
    setTerrain(map, 4, 5, 'terrain-plains');
    const middle = tileAt(map, 4, 4);
    expect(hasLineOfSight(map, tileAt(map, 4, 3), tileAt(map, 4, 5))).toBe(false);
    map.tilesById[middle].elevationOverride = 0;
    expect(hasLineOfSight(map, tileAt(map, 4, 3), tileAt(map, 4, 5))).toBe(true);
  });

  it('unions multiple observers', () => {
    map.sightRangeTiles = 1;
    const first = tileAt(map, 1, 1);
    const second = tileAt(map, 7, 7);
    const visible = computeVisibleTiles(map, [first, second]);
    expect(visible).toContain(tileAt(map, 1, 2));
    expect(visible).toContain(tileAt(map, 7, 6));
  });

  it('ignores observers that are not on the grid', () => {
    expect(computeVisibleTiles(map, ['outside'])).toEqual(new Set());
  });

  it('uses the default sight range and respects a map override', () => {
    expect(getSightRangeTiles(map)).toBe(DEFAULT_SIGHT_RANGE_TILES);
    map.sightRangeTiles = 3;
    expect(getSightRangeTiles(map)).toBe(3);
    const observer = tileAt(map, 4, 4);
    expect(computeVisibleTiles(map, [observer])).not.toContain(tileAt(map, 0, 0));
  });
});
