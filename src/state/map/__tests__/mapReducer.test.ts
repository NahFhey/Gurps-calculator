import { describe, expect, it, beforeEach } from 'vitest';
import { produce, enableMapSet } from 'immer';
import { handleMapAction } from '../mapReducer';
import {
  MAP_CREATE,
  MAP_DELETE,
  MAP_UPDATE,
  MAP_SET_ACTIVE,
  MAP_SET_TILE_TERRAIN,
  MAP_STAMP_TERRAIN,
  MAP_SET_TILE_ELEVATION,
  MAP_ADD_TERRAIN,
  MAP_UPDATE_TERRAIN,
  MAP_REMOVE_TERRAIN,
  MAP_ADD_MARKER,
  MAP_UPDATE_MARKER,
  MAP_REMOVE_MARKER,
  MAP_ADD_LINK,
  MAP_REMOVE_LINK,
  MAP_REVEAL_TILES,
  MAP_SET_PENDING_TERRAIN,
  MAP_CLEAR_PENDING_TERRAIN,
  type MapAction,
} from '../mapActions';
import { createCampaignState, type CampaignState } from '../../campaignReducer';
import type {
  MapModel,
  MapState,
  TerrainModel,
  MarkerModel,
  LinkModel,
  TileModel,
} from '../../../types/map';
import { initialMapState } from '../../../types/map';
import { createNewMap } from '../../../utils/mapUtils';

// Immer needs MapSet plugin enabled for Set<TileId> in MapModel.revealedTileIds.
enableMapSet();

const terrain = (id: string, overrides: Partial<TerrainModel> = {}): TerrainModel => ({
  id,
  name: `terrain-${id}`,
  color: '#abcdef',
  perMode: {
    foot: { passable: true, speedModifier: 1 },
    boat: { passable: false, speedModifier: 1 },
    airship: { passable: true, speedModifier: 1 },
  },
  ...overrides,
});

const marker = (id: string, tileId: string, overrides: Partial<MarkerModel> = {}): MarkerModel => ({
  id,
  tileId,
  type: 'note',
  label: `marker-${id}`,
  visibility: 'gm',
  ...overrides,
});

const link = (
  id: string,
  fromMapId: string,
  fromTileId: string,
  toMapId: string,
  toTileId: string,
  overrides: Partial<LinkModel> = {}
): LinkModel => ({
  id,
  fromMapId,
  fromTileId,
  toMapId,
  toTileId,
  ...overrides,
});

function makeMinimalMap(id: string, terrainId = 't-plains'): MapModel {
  const tileA: TileModel = { id: `${id}-a`, terrainId, markerIds: [], linkIds: [] };
  const tileB: TileModel = { id: `${id}-b`, terrainId: null, markerIds: [], linkIds: [] };
  const tileC: TileModel = { id: `${id}-c`, terrainId, markerIds: [], linkIds: [] };
  return {
    id,
    name: `map-${id}`,
    climate: 'temperate',
    visionMode: 'lineOfSight',
    scaleMilesPerTile: 12,
    rows: 1,
    cols: 3,
    grid: [[tileA.id, tileB.id, tileC.id]],
    tilesById: {
      [tileA.id]: tileA,
      [tileB.id]: tileB,
      [tileC.id]: tileC,
    },
    terrainById: { [terrainId]: terrain(terrainId) },
    markersById: {},
    linksById: {},
    revealedTileIds: new Set<string>([tileA.id]),
    lastSelectedTerrainId: terrainId,
    lastPlacedTerrainId: terrainId,
  };
}

function makeState(maps: MapState = initialMapState): CampaignState {
  const state = createCampaignState();
  state.maps = { ...maps, mapsById: { ...maps.mapsById } };
  return state;
}

function applyAction(state: CampaignState, action: MapAction): CampaignState {
  return produce(state, draft => {
    handleMapAction(draft, action);
  });
}

describe('mapReducer', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = makeState();
  });

  describe('MAP_CREATE / MAP_DELETE / MAP_UPDATE / MAP_SET_ACTIVE', () => {
    it('MAP_CREATE inserts a new map and sets it active when none was active', () => {
      const next = applyAction(state, {
        type: MAP_CREATE,
        payload: { name: 'World', climate: 'temperate', scaleMilesPerTile: 12, startTerrainId: 'plains' },
      });
      const ids = Object.keys(next.maps.mapsById);
      expect(ids).toHaveLength(1);
      expect(next.maps.activeMapId).toBe(ids[0]);
      expect(next.maps.mapsById[ids[0]].name).toBe('World');
    });

    it('MAP_CREATE leaves activeMapId alone when one is already active', () => {
      state.maps.activeMapId = 'pre-existing';
      const next = applyAction(state, {
        type: MAP_CREATE,
        payload: { name: 'Second', climate: 'temperate', scaleMilesPerTile: 50, startTerrainId: 'plains' },
      });
      expect(next.maps.activeMapId).toBe('pre-existing');
    });

    it('MAP_DELETE removes the map and selects another as active', () => {
      const m1 = makeMinimalMap('m1');
      const m2 = makeMinimalMap('m2');
      state.maps.mapsById = { m1, m2 };
      state.maps.activeMapId = 'm1';
      const next = applyAction(state, { type: MAP_DELETE, payload: 'm1' });
      expect(next.maps.mapsById['m1']).toBeUndefined();
      expect(next.maps.activeMapId).toBe('m2');
    });

    it('MAP_DELETE sets activeMapId to null when no maps remain', () => {
      const m1 = makeMinimalMap('m1');
      state.maps.mapsById = { m1 };
      state.maps.activeMapId = 'm1';
      const next = applyAction(state, { type: MAP_DELETE, payload: 'm1' });
      expect(next.maps.activeMapId).toBeNull();
    });

    it('MAP_DELETE removes cross-map links pointing at the deleted map', () => {
      const m1 = makeMinimalMap('m1');
      const m2 = makeMinimalMap('m2');
      const xlink = link('lnk-1', 'm2', 'm2-a', 'm1', 'm1-a');
      m2.linksById[xlink.id] = xlink;
      m2.tilesById['m2-a'].linkIds.push(xlink.id);
      state.maps.mapsById = { m1, m2 };
      state.maps.activeMapId = 'm1';
      const next = applyAction(state, { type: MAP_DELETE, payload: 'm1' });
      expect(next.maps.mapsById['m2'].linksById[xlink.id]).toBeUndefined();
      expect(next.maps.mapsById['m2'].tilesById['m2-a'].linkIds).not.toContain(xlink.id);
    });

    it('MAP_UPDATE merges name and description', () => {
      const m1 = makeMinimalMap('m1');
      state.maps.mapsById = { m1 };
      const next = applyAction(state, {
        type: MAP_UPDATE,
        payload: { mapId: 'm1', changes: { name: 'New Name', description: 'desc' } },
      });
      expect(next.maps.mapsById['m1'].name).toBe('New Name');
      expect(next.maps.mapsById['m1'].description).toBe('desc');
    });

    it('MAP_UPDATE applies vision settings and clamps the integer sight range', () => {
      state.maps.mapsById = { m1: makeMinimalMap('m1') };
      const next = applyAction(state, {
        type: MAP_UPDATE,
        payload: { mapId: 'm1', changes: { visionMode: 'open', sightRangeTiles: 40.7 } },
      });
      expect(next.maps.mapsById.m1.visionMode).toBe('open');
      expect(next.maps.mapsById.m1.sightRangeTiles).toBe(30);
      const lower = applyAction(next, {
        type: MAP_UPDATE,
        payload: { mapId: 'm1', changes: { sightRangeTiles: -4 } },
      });
      expect(lower.maps.mapsById.m1.sightRangeTiles).toBe(1);
    });

    it('MAP_UPDATE applies map climate and weather table settings', () => {
      state.maps.mapsById = { m1: makeMinimalMap('m1') };
      const next = applyAction(state, {
        type: MAP_UPDATE,
        payload: { mapId: 'm1', changes: { climate: 'arid', weatherTableId: 'weather-1' } },
      });
      expect(next.maps.mapsById.m1.climate).toBe('arid');
      expect(next.maps.mapsById.m1.weatherTableId).toBe('weather-1');
    });

    it('MAP_UPDATE is a no-op when mapId does not exist', () => {
      const next = applyAction(state, {
        type: MAP_UPDATE,
        payload: { mapId: 'nope', changes: { name: 'x' } },
      });
      expect(next.maps.mapsById['nope']).toBeUndefined();
    });

    it('MAP_SET_ACTIVE updates the active map id', () => {
      const next = applyAction(state, { type: MAP_SET_ACTIVE, payload: 'm-x' });
      expect(next.maps.activeMapId).toBe('m-x');
    });
  });

  describe('terrain editing', () => {
    beforeEach(() => {
      state.maps.mapsById = { m1: makeMinimalMap('m1') };
      state.maps.activeMapId = 'm1';
    });

    it('MAP_SET_TILE_TERRAIN updates the tile terrain and lastPlacedTerrainId', () => {
      const next = applyAction(state, {
        type: MAP_SET_TILE_TERRAIN,
        payload: { mapId: 'm1', tileId: 'm1-b', terrainId: 't-new' },
      });
      expect(next.maps.mapsById['m1'].tilesById['m1-b'].terrainId).toBe('t-new');
      expect(next.maps.mapsById['m1'].lastPlacedTerrainId).toBe('t-new');
      expect(next.maps.mapsById['m1'].tilesById['m1-b'].elevationOverride).toBeUndefined();
    });

    it('MAP_SET_TILE_TERRAIN paints a clamped elevation override when provided', () => {
      const next = applyAction(state, {
        type: MAP_SET_TILE_TERRAIN,
        payload: { mapId: 'm1', tileId: 'm1-b', terrainId: 't-new', elevationOverride: 25.6 },
      });
      expect(next.maps.mapsById['m1'].tilesById['m1-b'].elevationOverride).toBe(20);
      const repaint = applyAction(next, {
        type: MAP_SET_TILE_TERRAIN,
        payload: { mapId: 'm1', tileId: 'm1-b', terrainId: 't-plains' },
      });
      // Painting without an elevation leaves the existing override alone
      expect(repaint.maps.mapsById['m1'].tilesById['m1-b'].elevationOverride).toBe(20);
    });

    it('MAP_SET_TILE_TERRAIN is a no-op for unknown map', () => {
      const next = applyAction(state, {
        type: MAP_SET_TILE_TERRAIN,
        payload: { mapId: 'nope', tileId: 't', terrainId: 'x' },
      });
      expect(next.maps.mapsById['nope']).toBeUndefined();
    });

    it('MAP_STAMP_TERRAIN updates several tiles and lastPlacedTerrainId', () => {
      const next = applyAction(state, {
        type: MAP_STAMP_TERRAIN,
        payload: { mapId: 'm1', tileIds: ['m1-a', 'm1-c'], terrainId: 't-stamp' },
      });
      expect(next.maps.mapsById['m1'].tilesById['m1-a'].terrainId).toBe('t-stamp');
      expect(next.maps.mapsById['m1'].tilesById['m1-c'].terrainId).toBe('t-stamp');
      expect(next.maps.mapsById['m1'].lastPlacedTerrainId).toBe('t-stamp');
    });

    it('MAP_STAMP_TERRAIN applies a clamped elevation override when given one', () => {
      const next = applyAction(state, {
        type: MAP_STAMP_TERRAIN,
        payload: { mapId: 'm1', tileIds: ['m1-a', 'm1-c'], terrainId: 't-stamp', elevationOverride: 23.8 },
      });
      expect(next.maps.mapsById['m1'].tilesById['m1-a'].elevationOverride).toBe(20);
      expect(next.maps.mapsById['m1'].tilesById['m1-c'].elevationOverride).toBe(20);
      expect(next.maps.mapsById['m1'].tilesById['m1-a'].terrainId).toBe('t-stamp');
    });

    it('MAP_STAMP_TERRAIN leaves elevation overrides alone when omitted', () => {
      const withElevation = applyAction(state, {
        type: MAP_SET_TILE_ELEVATION,
        payload: { mapId: 'm1', tileIds: ['m1-a'], elevation: 3 },
      });
      const next = applyAction(withElevation, {
        type: MAP_STAMP_TERRAIN,
        payload: { mapId: 'm1', tileIds: ['m1-a'], terrainId: 't-stamp' },
      });
      expect(next.maps.mapsById['m1'].tilesById['m1-a'].elevationOverride).toBe(3);
    });

    it('MAP_STAMP_TERRAIN ignores unknown tile ids', () => {
      const next = applyAction(state, {
        type: MAP_STAMP_TERRAIN,
        payload: { mapId: 'm1', tileIds: ['ghost'], terrainId: 't-stamp' },
      });
      expect(next.maps.mapsById['m1'].lastPlacedTerrainId).toBe('t-stamp');
    });

    it('MAP_SET_TILE_ELEVATION sets and clamps one tile', () => {
      const next = applyAction(state, {
        type: MAP_SET_TILE_ELEVATION,
        payload: { mapId: 'm1', tileIds: ['m1-a'], elevation: 23.8 },
      });
      expect(next.maps.mapsById.m1.tilesById['m1-a'].elevationOverride).toBe(20);
    });

    it('MAP_SET_TILE_ELEVATION updates many tiles and clears overrides', () => {
      const set = applyAction(state, {
        type: MAP_SET_TILE_ELEVATION,
        payload: { mapId: 'm1', tileIds: ['m1-a', 'm1-c'], elevation: 3.4 },
      });
      expect(set.maps.mapsById.m1.tilesById['m1-a'].elevationOverride).toBe(3);
      expect(set.maps.mapsById.m1.tilesById['m1-c'].elevationOverride).toBe(3);
      const cleared = applyAction(set, {
        type: MAP_SET_TILE_ELEVATION,
        payload: { mapId: 'm1', tileIds: ['m1-a', 'm1-c'], elevation: null },
      });
      expect(cleared.maps.mapsById.m1.tilesById['m1-a'].elevationOverride).toBeUndefined();
      expect(cleared.maps.mapsById.m1.tilesById['m1-c'].elevationOverride).toBeUndefined();
    });
  });

  describe('terrain definitions', () => {
    beforeEach(() => {
      state.maps.mapsById = { m1: makeMinimalMap('m1') };
    });

    it('MAP_ADD_TERRAIN adds a new terrain definition', () => {
      const t = terrain('t-new');
      const next = applyAction(state, { type: MAP_ADD_TERRAIN, payload: { mapId: 'm1', terrain: t } });
      expect(next.maps.mapsById['m1'].terrainById['t-new']).toEqual(t);
    });

    it('MAP_UPDATE_TERRAIN merges partial changes', () => {
      const next = applyAction(state, {
        type: MAP_UPDATE_TERRAIN,
        payload: { mapId: 'm1', terrainId: 't-plains', changes: { name: 'Renamed' } },
      });
      expect(next.maps.mapsById['m1'].terrainById['t-plains'].name).toBe('Renamed');
    });

    it('MAP_UPDATE_TERRAIN is a no-op for unknown terrain', () => {
      const next = applyAction(state, {
        type: MAP_UPDATE_TERRAIN,
        payload: { mapId: 'm1', terrainId: 'ghost', changes: { name: 'x' } },
      });
      expect(next.maps.mapsById['m1'].terrainById['ghost']).toBeUndefined();
    });

    it('MAP_REMOVE_TERRAIN deletes the terrain and clears it from tiles that used it', () => {
      const next = applyAction(state, {
        type: MAP_REMOVE_TERRAIN,
        payload: { mapId: 'm1', terrainId: 't-plains' },
      });
      expect(next.maps.mapsById['m1'].terrainById['t-plains']).toBeUndefined();
      expect(next.maps.mapsById['m1'].tilesById['m1-a'].terrainId).toBeNull();
      expect(next.maps.mapsById['m1'].tilesById['m1-c'].terrainId).toBeNull();
    });
  });

  describe('markers', () => {
    beforeEach(() => {
      state.maps.mapsById = { m1: makeMinimalMap('m1') };
    });

    it('MAP_ADD_MARKER inserts and back-references the tile', () => {
      const mk = marker('mk1', 'm1-a');
      const next = applyAction(state, { type: MAP_ADD_MARKER, payload: { mapId: 'm1', marker: mk } });
      expect(next.maps.mapsById['m1'].markersById['mk1']).toEqual(mk);
      expect(next.maps.mapsById['m1'].tilesById['m1-a'].markerIds).toContain('mk1');
    });

    it('MAP_ADD_MARKER does not double-register on the same tile', () => {
      const mk = marker('mk1', 'm1-a');
      state.maps.mapsById['m1'].tilesById['m1-a'].markerIds.push('mk1');
      const next = applyAction(state, { type: MAP_ADD_MARKER, payload: { mapId: 'm1', marker: mk } });
      const count = next.maps.mapsById['m1'].tilesById['m1-a'].markerIds.filter(id => id === 'mk1').length;
      expect(count).toBe(1);
    });

    it('MAP_UPDATE_MARKER applies partial changes', () => {
      state.maps.mapsById['m1'].markersById['mk1'] = marker('mk1', 'm1-a');
      const next = applyAction(state, {
        type: MAP_UPDATE_MARKER,
        payload: { mapId: 'm1', markerId: 'mk1', changes: { label: 'Renamed' } },
      });
      expect(next.maps.mapsById['m1'].markersById['mk1'].label).toBe('Renamed');
    });

    it('MAP_REMOVE_MARKER removes the marker and its tile back-reference', () => {
      const mk = marker('mk1', 'm1-a');
      state.maps.mapsById['m1'].markersById['mk1'] = mk;
      state.maps.mapsById['m1'].tilesById['m1-a'].markerIds.push('mk1');
      const next = applyAction(state, {
        type: MAP_REMOVE_MARKER,
        payload: { mapId: 'm1', markerId: 'mk1' },
      });
      expect(next.maps.mapsById['m1'].markersById['mk1']).toBeUndefined();
      expect(next.maps.mapsById['m1'].tilesById['m1-a'].markerIds).not.toContain('mk1');
    });

    it('MAP_REMOVE_MARKER is a no-op for unknown markerId', () => {
      const before = state.maps.mapsById['m1'];
      const next = applyAction(state, {
        type: MAP_REMOVE_MARKER,
        payload: { mapId: 'm1', markerId: 'ghost' },
      });
      expect(next.maps.mapsById['m1'].markersById).toEqual(before.markersById);
    });
  });

  describe('links', () => {
    beforeEach(() => {
      state.maps.mapsById = { m1: makeMinimalMap('m1'), m2: makeMinimalMap('m2') };
    });

    it('MAP_ADD_LINK inserts on source map and back-references the source tile', () => {
      const l = link('l1', 'm1', 'm1-a', 'm2', 'm2-a');
      const next = applyAction(state, { type: MAP_ADD_LINK, payload: { link: l } });
      expect(next.maps.mapsById['m1'].linksById['l1']).toEqual(l);
      expect(next.maps.mapsById['m1'].tilesById['m1-a'].linkIds).toContain('l1');
    });

    it('MAP_ADD_LINK is a no-op for unknown source map', () => {
      const l = link('l1', 'ghost', 'x', 'm2', 'm2-a');
      const next = applyAction(state, { type: MAP_ADD_LINK, payload: { link: l } });
      expect(next.maps.mapsById['ghost']).toBeUndefined();
    });

    it('MAP_REMOVE_LINK removes the link and tile back-reference', () => {
      const l = link('l1', 'm1', 'm1-a', 'm2', 'm2-a');
      state.maps.mapsById['m1'].linksById['l1'] = l;
      state.maps.mapsById['m1'].tilesById['m1-a'].linkIds.push('l1');
      const next = applyAction(state, {
        type: MAP_REMOVE_LINK,
        payload: { mapId: 'm1', linkId: 'l1' },
      });
      expect(next.maps.mapsById['m1'].linksById['l1']).toBeUndefined();
      expect(next.maps.mapsById['m1'].tilesById['m1-a'].linkIds).not.toContain('l1');
    });
  });

  describe('reveal & party', () => {
    beforeEach(() => {
      state.maps.mapsById = { m1: makeMinimalMap('m1'), m2: makeMinimalMap('m2') };
    });

    it('MAP_REVEAL_TILES adds tile ids to the reveal set', () => {
      const next = applyAction(state, {
        type: MAP_REVEAL_TILES,
        payload: { mapId: 'm1', tileIds: ['m1-b', 'm1-c'] },
      });
      expect(next.maps.mapsById['m1'].revealedTileIds.has('m1-b')).toBe(true);
      expect(next.maps.mapsById['m1'].revealedTileIds.has('m1-c')).toBe(true);
    });

    it('MAP_REVEAL_TILES is a no-op for unknown map', () => {
      const next = applyAction(state, {
        type: MAP_REVEAL_TILES,
        payload: { mapId: 'ghost', tileIds: ['x'] },
      });
      expect(next.maps.mapsById['ghost']).toBeUndefined();
    });

  });

  describe('pending terrain assignment', () => {
    it('MAP_SET_PENDING_TERRAIN assigns the list', () => {
      const next = applyAction(state, { type: MAP_SET_PENDING_TERRAIN, payload: ['t1', 't2'] });
      expect(next.maps.pendingTerrainAssignment).toEqual(['t1', 't2']);
    });

    it('MAP_CLEAR_PENDING_TERRAIN nulls the list', () => {
      state.maps.pendingTerrainAssignment = ['t1'];
      const next = applyAction(state, { type: MAP_CLEAR_PENDING_TERRAIN });
      expect(next.maps.pendingTerrainAssignment).toBeNull();
    });
  });

  describe('createNewMap integration', () => {
    it('MAP_CREATE produces a map with default terrains and a revealed center tile', () => {
      const next = applyAction(state, {
        type: MAP_CREATE,
        payload: { name: 'Created', climate: 'temperate', scaleMilesPerTile: 50, startTerrainId: 'plains' },
      });
      const id = Object.keys(next.maps.mapsById)[0];
      const m = next.maps.mapsById[id];
      expect(m.scaleMilesPerTile).toBe(50);
      expect(m.revealedTileIds.has(m.grid[4][4])).toBe(true);
    });

    // Smoke test that createNewMap stays compatible with the reducer's shape expectations.
    it('createNewMap output can be assigned directly into state', () => {
      const fresh = createNewMap({ name: 'Direct', scaleMilesPerTile: 12, startTerrainId: 'plains' });
      expect(fresh.terrainById).toBeDefined();
      expect(Object.keys(fresh.tilesById).length).toBeGreaterThan(0);
    });
  });
});
