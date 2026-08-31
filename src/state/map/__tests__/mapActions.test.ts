import { describe, expect, it } from 'vitest';
import {
  MAP_CREATE,
  MAP_DELETE,
  MAP_UPDATE,
  MAP_SET_ACTIVE,
  MAP_SET_TILE_TERRAIN,
  MAP_STAMP_TERRAIN,
  MAP_ADD_TERRAIN,
  MAP_UPDATE_TERRAIN,
  MAP_REMOVE_TERRAIN,
  MAP_ADD_MARKER,
  MAP_UPDATE_MARKER,
  MAP_REMOVE_MARKER,
  MAP_ADD_LINK,
  MAP_REMOVE_LINK,
  MAP_REVEAL_TILES,
  MAP_SET_PARTY_TILE,
  MAP_EXECUTE_TRAVEL,
  MAP_SET_PENDING_TERRAIN,
  MAP_CLEAR_PENDING_TERRAIN,
  isMapAction,
  type MapAction,
} from '../mapActions';
import type {
  TerrainModel,
  MarkerModel,
  LinkModel,
} from '../../../types/map';

const mockTerrain = (overrides?: Partial<TerrainModel>): TerrainModel =>
  ({
    id: 'terrain-1',
    name: 'Plains',
    color: '#4ade80',
    perMode: {
      foot: { passable: true, speedModifier: 1 },
      boat: { passable: false, speedModifier: 0 },
      airship: { passable: true, speedModifier: 1 },
    },
    ...overrides,
  }) as TerrainModel;

const mockMarker = (overrides?: Partial<MarkerModel>): MarkerModel =>
  ({
    id: 'marker-1',
    tileId: 'tile-1',
    type: 'note',
    label: 'A marker',
    visibility: 'gm',
    ...overrides,
  }) as MarkerModel;

const mockLink = (overrides?: Partial<LinkModel>): LinkModel =>
  ({
    id: 'link-1',
    fromMapId: 'map-1',
    fromTileId: 'tile-1',
    toMapId: 'map-2',
    toTileId: 'tile-2',
    ...overrides,
  }) as LinkModel;

describe('mapActions', () => {
  describe('action type constants', () => {
    it('exposes stable string literals', () => {
      expect(MAP_CREATE).toBe('map/createMap');
      expect(MAP_DELETE).toBe('map/deleteMap');
      expect(MAP_UPDATE).toBe('map/updateMap');
      expect(MAP_SET_ACTIVE).toBe('map/setActiveMap');
      expect(MAP_SET_TILE_TERRAIN).toBe('map/setTileTerrain');
      expect(MAP_STAMP_TERRAIN).toBe('map/stampTerrain');
      expect(MAP_ADD_TERRAIN).toBe('map/addTerrain');
      expect(MAP_UPDATE_TERRAIN).toBe('map/updateTerrain');
      expect(MAP_REMOVE_TERRAIN).toBe('map/removeTerrain');
      expect(MAP_ADD_MARKER).toBe('map/addMarker');
      expect(MAP_UPDATE_MARKER).toBe('map/updateMarker');
      expect(MAP_REMOVE_MARKER).toBe('map/removeMarker');
      expect(MAP_ADD_LINK).toBe('map/addLink');
      expect(MAP_REMOVE_LINK).toBe('map/removeLink');
      expect(MAP_REVEAL_TILES).toBe('map/revealTiles');
      expect(MAP_SET_PARTY_TILE).toBe('map/setPartyTile');
      expect(MAP_EXECUTE_TRAVEL).toBe('map/executeTravel');
      expect(MAP_SET_PENDING_TERRAIN).toBe('map/setPendingTerrain');
      expect(MAP_CLEAR_PENDING_TERRAIN).toBe('map/clearPendingTerrain');
    });

    it('constants are all unique', () => {
      const values = [
        MAP_CREATE,
        MAP_DELETE,
        MAP_UPDATE,
        MAP_SET_ACTIVE,
        MAP_SET_TILE_TERRAIN,
        MAP_STAMP_TERRAIN,
        MAP_ADD_TERRAIN,
        MAP_UPDATE_TERRAIN,
        MAP_REMOVE_TERRAIN,
        MAP_ADD_MARKER,
        MAP_UPDATE_MARKER,
        MAP_REMOVE_MARKER,
        MAP_ADD_LINK,
        MAP_REMOVE_LINK,
        MAP_REVEAL_TILES,
        MAP_SET_PARTY_TILE,
        MAP_EXECUTE_TRAVEL,
        MAP_SET_PENDING_TERRAIN,
        MAP_CLEAR_PENDING_TERRAIN,
      ];
      expect(new Set(values).size).toBe(values.length);
    });

    it('all constants are namespaced under "map/"', () => {
      const values = [
        MAP_CREATE,
        MAP_DELETE,
        MAP_UPDATE,
        MAP_SET_ACTIVE,
        MAP_SET_TILE_TERRAIN,
        MAP_STAMP_TERRAIN,
        MAP_ADD_TERRAIN,
        MAP_UPDATE_TERRAIN,
        MAP_REMOVE_TERRAIN,
        MAP_ADD_MARKER,
        MAP_UPDATE_MARKER,
        MAP_REMOVE_MARKER,
        MAP_ADD_LINK,
        MAP_REMOVE_LINK,
        MAP_REVEAL_TILES,
        MAP_SET_PARTY_TILE,
        MAP_EXECUTE_TRAVEL,
        MAP_SET_PENDING_TERRAIN,
        MAP_CLEAR_PENDING_TERRAIN,
      ];
      for (const value of values) {
        expect(value.startsWith('map/')).toBe(true);
      }
    });
  });

  describe('isMapAction', () => {
    it('returns true for map CRUD actions', () => {
      const actions: MapAction[] = [
        {
          type: MAP_CREATE,
          payload: { name: 'Eldoria', scaleMilesPerTile: 12, startTerrainId: 'terrain-1' },
        },
        { type: MAP_DELETE, payload: 'map-1' },
        { type: MAP_UPDATE, payload: { mapId: 'map-1', changes: { name: 'Renamed' } } },
        { type: MAP_SET_ACTIVE, payload: 'map-1' },
        { type: MAP_SET_ACTIVE, payload: null },
      ];
      for (const action of actions) {
        expect(isMapAction(action)).toBe(true);
      }
    });

    it('returns true for terrain actions', () => {
      const actions: MapAction[] = [
        {
          type: MAP_SET_TILE_TERRAIN,
          payload: { mapId: 'map-1', tileId: 'tile-1', terrainId: 'terrain-1' },
        },
        {
          type: MAP_STAMP_TERRAIN,
          payload: { mapId: 'map-1', tileIds: ['tile-1', 'tile-2'], terrainId: 'terrain-1' },
        },
        { type: MAP_ADD_TERRAIN, payload: { mapId: 'map-1', terrain: mockTerrain() } },
        {
          type: MAP_UPDATE_TERRAIN,
          payload: { mapId: 'map-1', terrainId: 'terrain-1', changes: { name: 'Hills' } },
        },
        {
          type: MAP_REMOVE_TERRAIN,
          payload: { mapId: 'map-1', terrainId: 'terrain-1' },
        },
      ];
      for (const action of actions) {
        expect(isMapAction(action)).toBe(true);
      }
    });

    it('returns true for marker actions', () => {
      const actions: MapAction[] = [
        { type: MAP_ADD_MARKER, payload: { mapId: 'map-1', marker: mockMarker() } },
        {
          type: MAP_UPDATE_MARKER,
          payload: { mapId: 'map-1', markerId: 'marker-1', changes: { label: 'Updated' } },
        },
        {
          type: MAP_REMOVE_MARKER,
          payload: { mapId: 'map-1', markerId: 'marker-1' },
        },
      ];
      for (const action of actions) {
        expect(isMapAction(action)).toBe(true);
      }
    });

    it('returns true for link actions', () => {
      const actions: MapAction[] = [
        { type: MAP_ADD_LINK, payload: { link: mockLink() } },
        { type: MAP_REMOVE_LINK, payload: { mapId: 'map-1', linkId: 'link-1' } },
      ];
      for (const action of actions) {
        expect(isMapAction(action)).toBe(true);
      }
    });

    it('returns true for reveal/position actions', () => {
      const actions: MapAction[] = [
        { type: MAP_REVEAL_TILES, payload: { mapId: 'map-1', tileIds: ['tile-1'] } },
        { type: MAP_SET_PARTY_TILE, payload: { mapId: 'map-1', tileId: 'tile-1' } },
        { type: MAP_SET_PARTY_TILE, payload: { mapId: 'map-1', tileId: null } },
      ];
      for (const action of actions) {
        expect(isMapAction(action)).toBe(true);
      }
    });

    it('returns true for travel execution actions', () => {
      const actions: MapAction[] = [
        {
          type: MAP_EXECUTE_TRAVEL,
          payload: {
            mapId: 'map-1',
            routeTileIds: ['tile-1', 'tile-2'],
            destinationTileId: 'tile-2',
            mode: 'foot',
            gmOverride: false,
          },
        },
      ];
      for (const action of actions) {
        expect(isMapAction(action)).toBe(true);
      }
    });

    it('returns true for pending terrain actions', () => {
      const actions: MapAction[] = [
        { type: MAP_SET_PENDING_TERRAIN, payload: ['tile-1', 'tile-2'] },
        { type: MAP_CLEAR_PENDING_TERRAIN },
      ];
      for (const action of actions) {
        expect(isMapAction(action)).toBe(true);
      }
    });

    it('returns false for unrelated action types', () => {
      expect(isMapAction({ type: 'addCharacter' })).toBe(false);
      expect(isMapAction({ type: 'startCombat' })).toBe(false);
      expect(isMapAction({ type: 'addCraft' })).toBe(false);
      expect(isMapAction({ type: 'addMaterial' })).toBe(false);
      expect(isMapAction({ type: 'addGatheringSpecies' })).toBe(false);
    });

    it('returns false for empty string type', () => {
      expect(isMapAction({ type: '' })).toBe(false);
    });

    it('returns false for substrings or near-misses', () => {
      expect(isMapAction({ type: 'map' })).toBe(false);
      expect(isMapAction({ type: 'Map' })).toBe(false);
      expect(isMapAction({ type: 'map/' })).toBe(false);
      expect(isMapAction({ type: 'createMap' })).toBe(false);
      expect(isMapAction({ type: 'map/unknownAction' })).toBe(false);
      expect(isMapAction({ type: 'MAP/createMap' })).toBe(false);
    });

    it('narrows the action type for TypeScript consumers', () => {
      const unknownAction: { type: string; payload?: unknown } = {
        type: MAP_EXECUTE_TRAVEL,
      };
      if (isMapAction(unknownAction)) {
        expect(unknownAction.type).toBe(MAP_EXECUTE_TRAVEL);
      } else {
        throw new Error('expected type guard to accept MAP_EXECUTE_TRAVEL');
      }
    });
  });
});
