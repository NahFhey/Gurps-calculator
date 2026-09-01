/**
 * Map Reducer
 *
 * Handles state mutations for map-related operations using Immer draft.
 * This reducer operates on the maps slice of the campaign state.
 */

import type { Draft } from 'immer';
import type { CampaignState } from '../campaignReducer';
import {
  type MapAction,
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
  MAP_ADD_IMAGE_LAYER,
  MAP_UPDATE_IMAGE_LAYER,
  MAP_REMOVE_IMAGE_LAYER,
  MAP_ADD_STRUCTURE_LAYER,
  MAP_UPDATE_STRUCTURE_LAYER,
  MAP_REMOVE_STRUCTURE_LAYER,
  MAP_SET_STRUCTURE_CELLS,
  MAP_REVEAL_TILES,
  MAP_SET_PENDING_TERRAIN,
  MAP_CLEAR_PENDING_TERRAIN,
} from './mapActions';
import {
  createNewMap,
  expandMapIfNeeded,
  expandMapIfNeededForPaint,
} from '../../utils/mapUtils';
import { MAX_ELEVATION } from '../../constants/map';

/**
 * Process map actions on the campaign state draft.
 * Called from the main campaignReducer within the Immer produce() call.
 */
export function handleMapAction(
  draft: Draft<CampaignState>,
  action: MapAction
): void {
  const maps = draft.maps;

  switch (action.type) {
    // ========================================================================
    // MAP CRUD
    // ========================================================================

    case MAP_CREATE: {
      const newMap = createNewMap(action.payload);
      maps.mapsById[newMap.id] = newMap;
      // Set as active if first map
      if (!maps.activeMapId) {
        maps.activeMapId = newMap.id;
      }
      return;
    }

    case MAP_DELETE: {
      const mapId = action.payload;
      delete maps.mapsById[mapId];

      // Clean up links pointing to deleted map from other maps
      for (const otherMap of Object.values(maps.mapsById)) {
        const linksToRemove: string[] = [];
        for (const [linkId, link] of Object.entries(otherMap.linksById)) {
          if (link.toMapId === mapId) {
            linksToRemove.push(linkId);
          }
        }
        for (const linkId of linksToRemove) {
          // Remove link from tile's linkIds
          const link = otherMap.linksById[linkId];
          if (link) {
            const tile = otherMap.tilesById[link.fromTileId];
            if (tile) {
              tile.linkIds = tile.linkIds.filter((id) => id !== linkId);
            }
          }
          delete otherMap.linksById[linkId];
        }
      }

      // Update active map
      if (maps.activeMapId === mapId) {
        const remaining = Object.keys(maps.mapsById);
        maps.activeMapId = remaining.length > 0 ? remaining[0] : null;
      }
      return;
    }

    case MAP_UPDATE: {
      const { mapId, changes } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        if (changes.name !== undefined) map.name = changes.name;
        if (changes.description !== undefined) map.description = changes.description;
        if (changes.visionMode !== undefined) map.visionMode = changes.visionMode;
        if (changes.climate !== undefined) map.climate = changes.climate;
        if (changes.weatherTableId !== undefined) map.weatherTableId = changes.weatherTableId;
        if (changes.sightRangeTiles !== undefined) {
          const range = Number.isFinite(changes.sightRangeTiles) ? changes.sightRangeTiles : 1;
          map.sightRangeTiles = Math.max(1, Math.min(30, Math.round(range)));
        }
      }
      return;
    }

    case MAP_SET_ACTIVE: {
      maps.activeMapId = action.payload;
      return;
    }

    // ========================================================================
    // TERRAIN EDITING (TILE ASSIGNMENT)
    // ========================================================================

    case MAP_SET_TILE_TERRAIN: {
      const { mapId, tileId, terrainId, elevationOverride } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        const tile = map.tilesById[tileId];
        if (tile) {
          tile.terrainId = terrainId;
          map.lastPlacedTerrainId = terrainId;
          if (elevationOverride !== undefined && Number.isFinite(elevationOverride)) {
            tile.elevationOverride = Math.max(0, Math.min(MAX_ELEVATION, Math.round(elevationOverride)));
          }
        }
        // Expand map if painting near edge
        const expanded = expandMapIfNeededForPaint(map);
        if (expanded !== map) {
          maps.mapsById[mapId] = expanded;
        }
      }
      return;
    }

    case MAP_STAMP_TERRAIN: {
      const { mapId, tileIds, terrainId } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        for (const tileId of tileIds) {
          const tile = map.tilesById[tileId];
          if (tile) {
            tile.terrainId = terrainId;
          }
        }
        map.lastPlacedTerrainId = terrainId;
      }
      return;
    }

    case MAP_SET_TILE_ELEVATION: {
      const { mapId, tileIds, elevation } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        for (const tileId of tileIds) {
          const tile = map.tilesById[tileId];
          if (!tile) continue;
          if (elevation === null) {
            delete tile.elevationOverride;
          } else {
            const level = Number.isFinite(elevation) ? elevation : 0;
            tile.elevationOverride = Math.max(0, Math.min(MAX_ELEVATION, Math.round(level)));
          }
        }
      }
      return;
    }

    // ========================================================================
    // TERRAIN DEFINITIONS
    // ========================================================================

    case MAP_ADD_TERRAIN: {
      const { mapId, terrain } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        map.terrainById[terrain.id] = terrain;
      }
      return;
    }

    case MAP_UPDATE_TERRAIN: {
      const { mapId, terrainId, changes } = action.payload;
      const map = maps.mapsById[mapId];
      if (map && map.terrainById[terrainId]) {
        Object.assign(map.terrainById[terrainId], changes);
      }
      return;
    }

    case MAP_REMOVE_TERRAIN: {
      const { mapId, terrainId } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        delete map.terrainById[terrainId];
        // Clear terrain from tiles that use it
        for (const tile of Object.values(map.tilesById)) {
          if (tile.terrainId === terrainId) {
            tile.terrainId = null;
          }
        }
        // Clear structure cells painted with it
        for (const layer of map.structureLayers ?? []) {
          for (const [tileId, cellTerrainId] of Object.entries(layer.cells)) {
            if (cellTerrainId === terrainId) {
              delete layer.cells[tileId];
            }
          }
        }
      }
      return;
    }

    // ========================================================================
    // MARKERS
    // ========================================================================

    case MAP_ADD_MARKER: {
      const { mapId, marker } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        map.markersById[marker.id] = marker;
        const tile = map.tilesById[marker.tileId];
        if (tile && !tile.markerIds.includes(marker.id)) {
          tile.markerIds.push(marker.id);
        }
      }
      return;
    }

    case MAP_UPDATE_MARKER: {
      const { mapId, markerId, changes } = action.payload;
      const map = maps.mapsById[mapId];
      if (map && map.markersById[markerId]) {
        Object.assign(map.markersById[markerId], changes);
      }
      return;
    }

    case MAP_REMOVE_MARKER: {
      const { mapId, markerId } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        const marker = map.markersById[markerId];
        if (marker) {
          const tile = map.tilesById[marker.tileId];
          if (tile) {
            tile.markerIds = tile.markerIds.filter((id) => id !== markerId);
          }
          delete map.markersById[markerId];
        }
      }
      return;
    }

    // ========================================================================
    // LINKS
    // ========================================================================

    case MAP_ADD_LINK: {
      const { link } = action.payload;
      // Add link to the source map
      const fromMap = maps.mapsById[link.fromMapId];
      if (fromMap) {
        fromMap.linksById[link.id] = link;
        const tile = fromMap.tilesById[link.fromTileId];
        if (tile && !tile.linkIds.includes(link.id)) {
          tile.linkIds.push(link.id);
        }
      }
      return;
    }

    case MAP_REMOVE_LINK: {
      const { mapId, linkId } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        const link = map.linksById[linkId];
        if (link) {
          const tile = map.tilesById[link.fromTileId];
          if (tile) {
            tile.linkIds = tile.linkIds.filter((id) => id !== linkId);
          }
          delete map.linksById[linkId];
        }
      }
      return;
    }

    // ========================================================================
    // IMAGE LAYERS
    // ========================================================================

    case MAP_ADD_IMAGE_LAYER: {
      const { mapId, layer } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        map.imageLayers = map.imageLayers ?? [];
        map.imageLayers.push(layer);
      }
      return;
    }

    case MAP_UPDATE_IMAGE_LAYER: {
      const { mapId, layerId, changes } = action.payload;
      const layer = maps.mapsById[mapId]?.imageLayers?.find((l) => l.id === layerId);
      if (layer) {
        Object.assign(layer, changes);
        layer.opacity = Math.max(0, Math.min(1, layer.opacity));
        layer.elevation = Math.max(0, Math.min(MAX_ELEVATION, Math.round(layer.elevation)));
        layer.width = Math.max(0.1, layer.width);
        layer.height = Math.max(0.1, layer.height);
      }
      return;
    }

    case MAP_REMOVE_IMAGE_LAYER: {
      const { mapId, layerId } = action.payload;
      const map = maps.mapsById[mapId];
      if (map?.imageLayers) {
        map.imageLayers = map.imageLayers.filter((l) => l.id !== layerId);
      }
      return;
    }

    // ========================================================================
    // STRUCTURE LAYERS
    // ========================================================================

    case MAP_ADD_STRUCTURE_LAYER: {
      const { mapId, layer } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        map.structureLayers = map.structureLayers ?? [];
        map.structureLayers.push(layer);
        map.structureLayers.sort((a, b) => a.baseElevation - b.baseElevation);
      }
      return;
    }

    case MAP_UPDATE_STRUCTURE_LAYER: {
      const { mapId, layerId, changes } = action.payload;
      const map = maps.mapsById[mapId];
      const layer = map?.structureLayers?.find((l) => l.id === layerId);
      if (map && layer) {
        Object.assign(layer, changes);
        layer.baseElevation = Math.max(0, Math.min(MAX_ELEVATION, Math.round(layer.baseElevation)));
        layer.heightLevels = Math.max(1, Math.round(layer.heightLevels));
        map.structureLayers?.sort((a, b) => a.baseElevation - b.baseElevation);
      }
      return;
    }

    case MAP_REMOVE_STRUCTURE_LAYER: {
      const { mapId, layerId } = action.payload;
      const map = maps.mapsById[mapId];
      if (map?.structureLayers) {
        map.structureLayers = map.structureLayers.filter((l) => l.id !== layerId);
      }
      return;
    }

    case MAP_SET_STRUCTURE_CELLS: {
      const { mapId, layerId, tileIds, terrainId } = action.payload;
      const map = maps.mapsById[mapId];
      const layer = map?.structureLayers?.find((l) => l.id === layerId);
      if (!map || !layer) return;
      for (const tileId of tileIds) {
        if (!map.tilesById[tileId]) continue;
        if (terrainId === null) {
          delete layer.cells[tileId];
        } else if (map.terrainById[terrainId]) {
          layer.cells[tileId] = terrainId;
        }
      }
      return;
    }

    // ========================================================================
    // REVEAL & POSITION
    // ========================================================================

    case MAP_REVEAL_TILES: {
      const { mapId, tileIds } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        for (const tileId of tileIds) {
          map.revealedTileIds.add(tileId);
        }
        // Check expansion
        const expanded = expandMapIfNeeded(map);
        if (expanded !== map) {
          maps.mapsById[mapId] = expanded;
        }
      }
      return;
    }

    // ========================================================================
    // PENDING TERRAIN ASSIGNMENT
    // ========================================================================

    case MAP_SET_PENDING_TERRAIN: {
      maps.pendingTerrainAssignment = action.payload;
      return;
    }

    case MAP_CLEAR_PENDING_TERRAIN: {
      maps.pendingTerrainAssignment = null;
      return;
    }

    default:
      return;
  }
}
