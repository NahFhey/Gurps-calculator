/**
 * Map Actions
 *
 * Action type constants and type definitions for map-related state changes.
 */

import type {
  MapId,
  TileId,
  TerrainId,
  MarkerId,
  LinkId,
  MapScale,
  TerrainModel,
  MarkerModel,
  LinkModel,
  TravelWizardState,
  TravelMode,
  MapModel,
} from '../../types/map';

// ============================================================================
// ACTION TYPE CONSTANTS
// ============================================================================

// Map CRUD
export const MAP_CREATE = 'map/createMap' as const;
export const MAP_DELETE = 'map/deleteMap' as const;
export const MAP_UPDATE = 'map/updateMap' as const;
export const MAP_SET_ACTIVE = 'map/setActiveMap' as const;

// Terrain editing (tile assignment)
export const MAP_SET_TILE_TERRAIN = 'map/setTileTerrain' as const;
export const MAP_STAMP_TERRAIN = 'map/stampTerrain' as const;
export const MAP_SET_TILE_ELEVATION = 'map/setTileElevation' as const;

// Terrain definitions
export const MAP_ADD_TERRAIN = 'map/addTerrain' as const;
export const MAP_UPDATE_TERRAIN = 'map/updateTerrain' as const;
export const MAP_REMOVE_TERRAIN = 'map/removeTerrain' as const;

// Markers
export const MAP_ADD_MARKER = 'map/addMarker' as const;
export const MAP_UPDATE_MARKER = 'map/updateMarker' as const;
export const MAP_REMOVE_MARKER = 'map/removeMarker' as const;

// Links
export const MAP_ADD_LINK = 'map/addLink' as const;
export const MAP_REMOVE_LINK = 'map/removeLink' as const;

// Reveal & position
export const MAP_REVEAL_TILES = 'map/revealTiles' as const;
export const MAP_SET_PARTY_TILE = 'map/setPartyTile' as const;

// Travel wizard
export const MAP_SET_TRAVEL_WIZARD = 'map/setTravelWizard' as const;
export const MAP_CLEAR_TRAVEL_WIZARD = 'map/clearTravelWizard' as const;

// Travel execution
export const MAP_EXECUTE_TRAVEL = 'map/executeTravel' as const;

// Pending terrain assignment
export const MAP_SET_PENDING_TERRAIN = 'map/setPendingTerrain' as const;
export const MAP_CLEAR_PENDING_TERRAIN = 'map/clearPendingTerrain' as const;

// ============================================================================
// ACTION TYPES
// ============================================================================

export type CreateMapAction = {
  type: typeof MAP_CREATE;
  payload: {
    name: string;
    description?: string;
    scaleMilesPerTile: MapScale;
    startTerrainId: TerrainId;
  };
};

export type DeleteMapAction = {
  type: typeof MAP_DELETE;
  payload: MapId;
};

export type UpdateMapAction = {
  type: typeof MAP_UPDATE;
  payload: {
    mapId: MapId;
    changes: Partial<Pick<MapModel, 'name' | 'description' | 'visionMode' | 'sightRangeTiles'>>;
  };
};

export type SetActiveMapAction = {
  type: typeof MAP_SET_ACTIVE;
  payload: MapId | null;
};

export type SetTileTerrainAction = {
  type: typeof MAP_SET_TILE_TERRAIN;
  /** elevationOverride: absent = leave the tile's override alone; a number = paint that elevation. */
  payload: { mapId: MapId; tileId: TileId; terrainId: TerrainId; elevationOverride?: number };
};

export type StampTerrainAction = {
  type: typeof MAP_STAMP_TERRAIN;
  payload: { mapId: MapId; tileIds: TileId[]; terrainId: TerrainId };
};

export type SetTileElevationAction = {
  type: typeof MAP_SET_TILE_ELEVATION;
  payload: { mapId: MapId; tileIds: TileId[]; elevation: number | null };
};

export type AddTerrainAction = {
  type: typeof MAP_ADD_TERRAIN;
  payload: { mapId: MapId; terrain: TerrainModel };
};

export type UpdateTerrainAction = {
  type: typeof MAP_UPDATE_TERRAIN;
  payload: { mapId: MapId; terrainId: TerrainId; changes: Partial<TerrainModel> };
};

export type RemoveTerrainAction = {
  type: typeof MAP_REMOVE_TERRAIN;
  payload: { mapId: MapId; terrainId: TerrainId };
};

export type AddMarkerAction = {
  type: typeof MAP_ADD_MARKER;
  payload: { mapId: MapId; marker: MarkerModel };
};

export type UpdateMarkerAction = {
  type: typeof MAP_UPDATE_MARKER;
  payload: { mapId: MapId; markerId: MarkerId; changes: Partial<MarkerModel> };
};

export type RemoveMarkerAction = {
  type: typeof MAP_REMOVE_MARKER;
  payload: { mapId: MapId; markerId: MarkerId };
};

export type AddLinkAction = {
  type: typeof MAP_ADD_LINK;
  payload: { link: LinkModel };
};

export type RemoveLinkAction = {
  type: typeof MAP_REMOVE_LINK;
  payload: { mapId: MapId; linkId: LinkId };
};

export type RevealTilesAction = {
  type: typeof MAP_REVEAL_TILES;
  payload: { mapId: MapId; tileIds: TileId[] };
};

export type SetPartyTileAction = {
  type: typeof MAP_SET_PARTY_TILE;
  payload: { mapId: MapId; tileId: TileId | null };
};

export type SetTravelWizardAction = {
  type: typeof MAP_SET_TRAVEL_WIZARD;
  payload: TravelWizardState;
};

export type ClearTravelWizardAction = {
  type: typeof MAP_CLEAR_TRAVEL_WIZARD;
};

export type ExecuteTravelAction = {
  type: typeof MAP_EXECUTE_TRAVEL;
  payload: {
    mapId: MapId;
    routeTileIds: TileId[];
    destinationTileId: TileId;
    mode: TravelMode;
    gmOverride: boolean;
  };
};

export type SetPendingTerrainAction = {
  type: typeof MAP_SET_PENDING_TERRAIN;
  payload: TileId[];
};

export type ClearPendingTerrainAction = {
  type: typeof MAP_CLEAR_PENDING_TERRAIN;
};

// ============================================================================
// UNION TYPE
// ============================================================================

export type MapAction =
  | CreateMapAction
  | DeleteMapAction
  | UpdateMapAction
  | SetActiveMapAction
  | SetTileTerrainAction
  | StampTerrainAction
  | SetTileElevationAction
  | AddTerrainAction
  | UpdateTerrainAction
  | RemoveTerrainAction
  | AddMarkerAction
  | UpdateMarkerAction
  | RemoveMarkerAction
  | AddLinkAction
  | RemoveLinkAction
  | RevealTilesAction
  | SetPartyTileAction
  | SetTravelWizardAction
  | ClearTravelWizardAction
  | ExecuteTravelAction
  | SetPendingTerrainAction
  | ClearPendingTerrainAction;

// ============================================================================
// TYPE GUARD
// ============================================================================

const MAP_ACTION_TYPES = new Set<string>([
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
  MAP_SET_PARTY_TILE,
  MAP_SET_TRAVEL_WIZARD,
  MAP_CLEAR_TRAVEL_WIZARD,
  MAP_EXECUTE_TRAVEL,
  MAP_SET_PENDING_TERRAIN,
  MAP_CLEAR_PENDING_TERRAIN,
]);

export function isMapAction(action: { type: string }): action is MapAction {
  return MAP_ACTION_TYPES.has(action.type);
}
