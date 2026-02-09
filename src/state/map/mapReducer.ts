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
  MAP_SET_TRAVEL_WIZARD,
  MAP_CLEAR_TRAVEL_WIZARD,
  MAP_EXECUTE_TRAVEL,
  MAP_SET_PENDING_TERRAIN,
  MAP_CLEAR_PENDING_TERRAIN,
} from './mapActions';
import {
  createNewMap,
  expandMapIfNeeded,
  expandMapIfNeededForPaint,
} from '../../utils/mapUtils';

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
      maps.mapsById[newMap.id] = newMap as any;
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
      const { mapId, tileId, terrainId } = action.payload;
      const map = maps.mapsById[mapId];
      if (map) {
        const tile = map.tilesById[tileId];
        if (tile) {
          tile.terrainId = terrainId;
          map.lastPlacedTerrainId = terrainId;
        }
        // Expand map if painting near edge
        const expanded = expandMapIfNeededForPaint(map as any);
        if (expanded !== (map as any)) {
          maps.mapsById[mapId] = expanded as any;
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
        const expanded = expandMapIfNeeded(map as any);
        if (expanded !== (map as any)) {
          maps.mapsById[mapId] = expanded as any;
        }
      }
      return;
    }

    case MAP_SET_PARTY_TILE: {
      const { mapId, tileId } = action.payload;
      // Clear party from all other maps
      for (const m of Object.values(maps.mapsById)) {
        if (m.id !== mapId) {
          m.partyTileId = null;
        }
      }
      const map = maps.mapsById[mapId];
      if (map) {
        map.partyTileId = tileId;
      }
      return;
    }

    // ========================================================================
    // TRAVEL WIZARD
    // ========================================================================

    case MAP_SET_TRAVEL_WIZARD: {
      maps.travelWizard = action.payload;
      return;
    }

    case MAP_CLEAR_TRAVEL_WIZARD: {
      maps.travelWizard = null;
      return;
    }

    // ========================================================================
    // TRAVEL EXECUTION
    // ========================================================================

    case MAP_EXECUTE_TRAVEL: {
      const { mapId, routeTileIds, destinationTileId, gmOverride } = action.payload;
      const map = maps.mapsById[mapId];
      if (!map) return;

      // 1. Move party
      map.partyTileId = destinationTileId;
      // Clear party from other maps
      for (const m of Object.values(maps.mapsById)) {
        if (m.id !== mapId) {
          m.partyTileId = null;
        }
      }

      // 2. Reveal all route tiles
      for (const tileId of routeTileIds) {
        map.revealedTileIds.add(tileId);
      }

      // 3. Expand map if needed
      const expanded = expandMapIfNeeded(map as any);
      if (expanded !== (map as any)) {
        maps.mapsById[mapId] = expanded as any;
      }

      // 4. Clear travel wizard
      maps.travelWizard = null;

      // 5. Check for null terrain tiles (GM override)
      if (gmOverride) {
        const nullTiles = routeTileIds.filter((tileId) => {
          const tile = maps.mapsById[mapId]?.tilesById[tileId];
          return tile && tile.terrainId === null;
        });
        if (nullTiles.length > 0) {
          maps.pendingTerrainAssignment = nullTiles;
        }
      }

      // Note: Time advancement is handled in the main reducer
      // since it's a cross-slice operation
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
