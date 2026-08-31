/**
 * Tests for image layer and structure layer actions.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { produce, enableMapSet } from 'immer';
import { handleMapAction } from '../mapReducer';
import {
  MAP_ADD_IMAGE_LAYER,
  MAP_UPDATE_IMAGE_LAYER,
  MAP_REMOVE_IMAGE_LAYER,
  MAP_ADD_STRUCTURE_LAYER,
  MAP_UPDATE_STRUCTURE_LAYER,
  MAP_REMOVE_STRUCTURE_LAYER,
  MAP_SET_STRUCTURE_CELLS,
  MAP_REMOVE_TERRAIN,
  type MapAction,
} from '../mapActions';
import type { CampaignState } from '../../campaignReducer';
import type {
  MapImageLayer,
  MapModel,
  StructureLayer,
  TerrainModel,
  TileModel,
} from '../../../types/map';
import { initialMapState } from '../../../types/map';

enableMapSet();

const terrain = (id: string): TerrainModel => ({
  id,
  name: `terrain-${id}`,
  color: '#abcdef',
  perMode: {
    foot: { passable: true, speedModifier: 1 },
    boat: { passable: false, speedModifier: 1 },
    airship: { passable: true, speedModifier: 1 },
  },
});

function makeMap(id: string): MapModel {
  const tileA: TileModel = { id: `${id}-a`, terrainId: 't-plains', markerIds: [], linkIds: [] };
  const tileB: TileModel = { id: `${id}-b`, terrainId: null, markerIds: [], linkIds: [] };
  return {
    id,
    name: `map-${id}`,
    climate: 'temperate',
    visionMode: 'open',
    scaleMilesPerTile: 12,
    rows: 1,
    cols: 2,
    grid: [[tileA.id, tileB.id]],
    tilesById: { [tileA.id]: tileA, [tileB.id]: tileB },
    terrainById: { 't-plains': terrain('t-plains'), 't-stone': terrain('t-stone') },
    markersById: {},
    linksById: {},
    revealedTileIds: new Set<string>(),
    lastSelectedTerrainId: 't-plains',
    lastPlacedTerrainId: 't-plains',
  };
}

const imageLayer = (id: string, overrides: Partial<MapImageLayer> = {}): MapImageLayer => ({
  id,
  name: `image-${id}`,
  src: 'data:image/png;base64,xyz',
  placement: 'underlay',
  opacity: 1,
  visible: true,
  gmOnly: false,
  x: 0,
  y: 0,
  width: 10,
  height: 8,
  elevation: 0,
  ...overrides,
});

const structureLayer = (id: string, overrides: Partial<StructureLayer> = {}): StructureLayer => ({
  id,
  name: `layer-${id}`,
  baseElevation: 1,
  heightLevels: 1,
  cells: {},
  visible: true,
  ...overrides,
});

function applyAction(state: CampaignState, action: MapAction): CampaignState {
  return produce(state, (draft) => {
    handleMapAction(draft, action);
  });
}

describe('map layer actions', () => {
  let state: CampaignState;

  beforeEach(() => {
    const map = makeMap('m1');
    state = {
      maps: { ...initialMapState, mapsById: { m1: map }, activeMapId: 'm1' },
    } as unknown as CampaignState;
  });

  describe('image layers', () => {
    it('adds an image layer to a map without any', () => {
      const next = applyAction(state, {
        type: MAP_ADD_IMAGE_LAYER,
        payload: { mapId: 'm1', layer: imageLayer('img1') },
      });
      expect(next.maps.mapsById.m1.imageLayers).toHaveLength(1);
      expect(next.maps.mapsById.m1.imageLayers?.[0].id).toBe('img1');
    });

    it('updates an image layer and clamps opacity and elevation', () => {
      let next = applyAction(state, {
        type: MAP_ADD_IMAGE_LAYER,
        payload: { mapId: 'm1', layer: imageLayer('img1') },
      });
      next = applyAction(next, {
        type: MAP_UPDATE_IMAGE_LAYER,
        payload: { mapId: 'm1', layerId: 'img1', changes: { opacity: 2.5, elevation: -3, name: 'Keep' } },
      });
      const layer = next.maps.mapsById.m1.imageLayers?.[0];
      expect(layer?.opacity).toBe(1);
      expect(layer?.elevation).toBe(0);
      expect(layer?.name).toBe('Keep');
    });

    it('removes an image layer by id', () => {
      let next = applyAction(state, {
        type: MAP_ADD_IMAGE_LAYER,
        payload: { mapId: 'm1', layer: imageLayer('img1') },
      });
      next = applyAction(next, {
        type: MAP_ADD_IMAGE_LAYER,
        payload: { mapId: 'm1', layer: imageLayer('img2') },
      });
      next = applyAction(next, {
        type: MAP_REMOVE_IMAGE_LAYER,
        payload: { mapId: 'm1', layerId: 'img1' },
      });
      expect(next.maps.mapsById.m1.imageLayers?.map((l) => l.id)).toEqual(['img2']);
    });

    it('ignores updates for unknown maps and layers', () => {
      const next = applyAction(state, {
        type: MAP_UPDATE_IMAGE_LAYER,
        payload: { mapId: 'm1', layerId: 'missing', changes: { opacity: 0.5 } },
      });
      expect(next.maps.mapsById.m1.imageLayers).toBeUndefined();
    });
  });

  describe('structure layers', () => {
    it('adds structure layers sorted by base elevation', () => {
      let next = applyAction(state, {
        type: MAP_ADD_STRUCTURE_LAYER,
        payload: { mapId: 'm1', layer: structureLayer('s-high', { baseElevation: 4 }) },
      });
      next = applyAction(next, {
        type: MAP_ADD_STRUCTURE_LAYER,
        payload: { mapId: 'm1', layer: structureLayer('s-low', { baseElevation: 1 }) },
      });
      expect(next.maps.mapsById.m1.structureLayers?.map((l) => l.id)).toEqual(['s-low', 's-high']);
    });

    it('updates a layer, clamps values, and re-sorts', () => {
      let next = applyAction(state, {
        type: MAP_ADD_STRUCTURE_LAYER,
        payload: { mapId: 'm1', layer: structureLayer('s1', { baseElevation: 1 }) },
      });
      next = applyAction(next, {
        type: MAP_ADD_STRUCTURE_LAYER,
        payload: { mapId: 'm1', layer: structureLayer('s2', { baseElevation: 2 }) },
      });
      next = applyAction(next, {
        type: MAP_UPDATE_STRUCTURE_LAYER,
        payload: { mapId: 'm1', layerId: 's1', changes: { baseElevation: 6, heightLevels: 0 } },
      });
      const layers = next.maps.mapsById.m1.structureLayers ?? [];
      expect(layers.map((l) => l.id)).toEqual(['s2', 's1']);
      expect(layers[1].baseElevation).toBe(6);
      expect(layers[1].heightLevels).toBe(1);
    });

    it('paints and erases cells, skipping unknown tiles and terrains', () => {
      let next = applyAction(state, {
        type: MAP_ADD_STRUCTURE_LAYER,
        payload: { mapId: 'm1', layer: structureLayer('s1') },
      });
      next = applyAction(next, {
        type: MAP_SET_STRUCTURE_CELLS,
        payload: { mapId: 'm1', layerId: 's1', tileIds: ['m1-a', 'm1-b', 'nope'], terrainId: 't-stone' },
      });
      expect(next.maps.mapsById.m1.structureLayers?.[0].cells).toEqual({
        'm1-a': 't-stone',
        'm1-b': 't-stone',
      });

      // Unknown terrain: no-op
      next = applyAction(next, {
        type: MAP_SET_STRUCTURE_CELLS,
        payload: { mapId: 'm1', layerId: 's1', tileIds: ['m1-a'], terrainId: 't-missing' },
      });
      expect(next.maps.mapsById.m1.structureLayers?.[0].cells['m1-a']).toBe('t-stone');

      // Erase
      next = applyAction(next, {
        type: MAP_SET_STRUCTURE_CELLS,
        payload: { mapId: 'm1', layerId: 's1', tileIds: ['m1-a'], terrainId: null },
      });
      expect(next.maps.mapsById.m1.structureLayers?.[0].cells).toEqual({ 'm1-b': 't-stone' });
    });

    it('removes a structure layer by id', () => {
      let next = applyAction(state, {
        type: MAP_ADD_STRUCTURE_LAYER,
        payload: { mapId: 'm1', layer: structureLayer('s1') },
      });
      next = applyAction(next, {
        type: MAP_REMOVE_STRUCTURE_LAYER,
        payload: { mapId: 'm1', layerId: 's1' },
      });
      expect(next.maps.mapsById.m1.structureLayers).toEqual([]);
    });

    it('clears structure cells when their terrain is removed', () => {
      let next = applyAction(state, {
        type: MAP_ADD_STRUCTURE_LAYER,
        payload: { mapId: 'm1', layer: structureLayer('s1') },
      });
      next = applyAction(next, {
        type: MAP_SET_STRUCTURE_CELLS,
        payload: { mapId: 'm1', layerId: 's1', tileIds: ['m1-a'], terrainId: 't-stone' },
      });
      next = applyAction(next, {
        type: MAP_SET_STRUCTURE_CELLS,
        payload: { mapId: 'm1', layerId: 's1', tileIds: ['m1-b'], terrainId: 't-plains' },
      });
      next = applyAction(next, {
        type: MAP_REMOVE_TERRAIN,
        payload: { mapId: 'm1', terrainId: 't-stone' },
      });
      expect(next.maps.mapsById.m1.structureLayers?.[0].cells).toEqual({ 'm1-b': 't-plains' });
    });
  });
});
