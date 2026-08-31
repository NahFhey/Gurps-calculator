/**
 * Map & Travel System Types
 *
 * TypeScript interfaces for the scaling map system with grid-based
 * terrain, markers, links (portals), and route-based travel.
 */

import type { ActiveWeather, ClimateType, Id } from './location';

// ============================================================================
// TYPE ALIASES
// ============================================================================

/** Unique identifier for a map */
export type MapId = string;

/** Unique identifier for a tile */
export type TileId = string;

/** Unique identifier for a terrain definition */
export type TerrainId = string;

/** Unique identifier for a marker */
export type MarkerId = string;

/** Unique identifier for a link (portal) */
export type LinkId = string;

/** Unique identifier for an image layer */
export type ImageLayerId = string;

/** Unique identifier for a structure layer */
export type StructureLayerId = string;

// ============================================================================
// TRAVEL MODES
// ============================================================================

/**
 * Travel modes available in the system.
 * Each mode is restricted to specific map scales.
 * - foot: 12-mile maps only
 * - boat: 50-mile maps only
 * - airship: 457-mile maps only
 */
export type TravelMode = 'foot' | 'boat' | 'airship';

/** Player visibility regime for an overworld map. */
export type VisionMode = 'lineOfSight' | 'open';

// ============================================================================
// MAP SCALES
// ============================================================================

/**
 * Fixed scale options for maps (miles per tile).
 * - 12: Local scale (foot travel)
 * - 50: Regional scale (boat travel)
 * - 457: World scale (airship travel)
 */
export type MapScale = 12 | 50 | 457;

// ============================================================================
// TERRAIN
// ============================================================================

/**
 * Per-travel-mode terrain properties.
 */
export interface TerrainModeProps {
  /** Whether this terrain is passable for this travel mode */
  passable: boolean;
  /** Speed modifier (1.0 = normal, >1 = faster, <1 = slower) */
  speedModifier: number;
}

/**
 * Terrain definition. Defines how a tile type looks and behaves.
 * Terrains are scoped per-map (copied from campaign defaults on map creation).
 */
export interface TerrainModel {
  id: TerrainId;
  name: string;
  /** Hex color for rendering (e.g., "#4ade80") */
  color: string;
  /** Travel properties per mode */
  perMode: Record<TravelMode, TerrainModeProps>;
  /** Elevation in levels (integer >= 0). Omitted = default terrain elevation. */
  elevation?: number;
  /** Location terrain type for weather system mapping (e.g., 'forest', 'plains').
   *  Used to sync map terrain with the location/weather system.
   *  Context-dependent terrains like Water and Road omit this and use adjacency logic instead. */
  locationTerrain?: string;
}

// ============================================================================
// TILES
// ============================================================================

/**
 * A single tile on the map grid.
 * Tiles have stable IDs even when grid indices shift during expansion.
 */
export interface TileModel {
  id: TileId;
  /** Current terrain assignment. Null = unassigned. */
  terrainId: TerrainId | null;
  /** Marker IDs attached to this tile */
  markerIds: MarkerId[];
  /** Link IDs attached to this tile */
  linkIds: LinkId[];
  /** Per-tile elevation override. Omitted = use terrain elevation. */
  elevationOverride?: number;
}

// ============================================================================
// MARKERS
// ============================================================================

/**
 * Marker type identifiers.
 * Built-in types plus arbitrary custom strings.
 */
export type MarkerType = 'mining_node' | 'settlement' | 'danger' | 'note' | (string & {});

/**
 * Marker visibility level.
 * - "gm": Only visible to GM
 * - "player": Visible to players on revealed tiles
 */
export type MarkerVisibility = 'gm' | 'player';

/**
 * A marker (structured annotation) attached to a tile.
 * Markers can represent points of interest, dangers, notes, etc.
 */
export interface MarkerModel {
  id: MarkerId;
  /** The tile this marker is attached to */
  tileId: TileId;
  /** Type of marker */
  type: MarkerType;
  /** Display label */
  label: string;
  /** Optional notes/description */
  notes?: string;
  /** When this marker was discovered (optional) */
  discoveredAt?: { day: number; slot: 1 | 2 | 3 };
  /** Visibility level */
  visibility: MarkerVisibility;
  /** Optional tags for categorization */
  tags?: string[];
  /** Optional resource references (future-proof) */
  resources?: string[];
}

// ============================================================================
// LINKS (PORTALS)
// ============================================================================

/**
 * A link (portal) connecting a tile on one map to a tile on another map.
 * Links are GM-created and always usable (no constraints in v1).
 * Using a link is instant and does not consume time.
 */
export interface LinkModel {
  id: LinkId;
  /** Source map ID */
  fromMapId: MapId;
  /** Source tile ID */
  fromTileId: TileId;
  /** Destination map ID */
  toMapId: MapId;
  /** Destination tile ID */
  toTileId: TileId;
  /** Optional display label (e.g., "Open Port Map") */
  label?: string;
}

// ============================================================================
// IMAGE LAYERS
// ============================================================================

/**
 * Where an image layer renders relative to the tile geometry.
 * - "underlay": skins the floor at its elevation (play visual; raised tiles poke through)
 * - "overlay": always drawn on top of the scene (tracing reference while authoring)
 */
export type ImageLayerPlacement = 'underlay' | 'overlay';

/**
 * An imported image (e.g. a battlemap) positioned on the map grid.
 * Stored as a base64 data URL, downscaled on import.
 */
export interface MapImageLayer {
  id: ImageLayerId;
  name: string;
  /** Base64 data URL of the (downscaled) image */
  src: string;
  placement: ImageLayerPlacement;
  /** Render opacity, 0..1 */
  opacity: number;
  visible: boolean;
  /** Only rendered for the GM (tracing references that players should never see) */
  gmOnly: boolean;
  /** Top-left corner in tile units: x = column, y = row */
  x: number;
  y: number;
  /** Size in tile units */
  width: number;
  height: number;
  /** Elevation (in levels) of the floor this image sits on/above */
  elevation: number;
}

// ============================================================================
// STRUCTURE LAYERS
// ============================================================================

/**
 * A structure layer: a sparse sheet of terrain-painted cells floating at an
 * elevation offset above the ground grid. Layers stack to build multi-story
 * structures (upper floors, bridges, walkways) on top of the base heightfield.
 *
 * Cells are keyed by the ground tile's stable TileId, so layers survive map
 * expansion. Structure layers are visual/tactical only in v1 — they do not
 * affect travel routing or line-of-sight.
 */
export interface StructureLayer {
  id: StructureLayerId;
  /** Display name (e.g. "Second Floor", "Bridge") */
  name: string;
  /** Bottom of the layer, in elevation levels above 0 */
  baseElevation: number;
  /** Slab thickness in levels (integer >= 1) */
  heightLevels: number;
  /** Painted cells: ground TileId -> terrain used for the cell */
  cells: Record<TileId, TerrainId>;
  visible: boolean;
}

// ============================================================================
// MAP MODEL
// ============================================================================

/**
 * Complete map model.
 * Contains the grid, tile data, terrain definitions, markers, links,
 * and exploration state.
 */
export interface MapModel {
  id: MapId;
  /** Display name (required) */
  name: string;
  /** Optional description */
  description?: string;

  /** Ambient climate and weather shared by every presence on this map. */
  climate: ClimateType;
  currentWeather?: ActiveWeather | null;
  /** Optional custom weather table stored in the location-authoring slice. */
  weatherTableId?: Id | null;

  /** Vision regime for players. */
  visionMode: VisionMode;
  /** Sight range in tiles (Chebyshev). Omitted = default sight range. */
  sightRangeTiles?: number;

  /** Fixed scale: miles per tile */
  scaleMilesPerTile: MapScale;

  /** Grid dimensions */
  rows: number;
  cols: number;

  /**
   * The grid stores tileIds (NOT tile data directly).
   * grid[row][col] = TileId
   * Indices may shift when expanding the map.
   */
  grid: TileId[][];

  /** Tile data keyed by stable TileId */
  tilesById: Record<TileId, TileModel>;

  /** Terrain definitions available on this map */
  terrainById: Record<TerrainId, TerrainModel>;

  /** Markers keyed by MarkerId */
  markersById: Record<MarkerId, MarkerModel>;

  /** Links keyed by LinkId */
  linksById: Record<LinkId, LinkModel>;

  /** Imported image under/overlays, in render order. Absent on older maps. */
  imageLayers?: MapImageLayer[];

  /** Structure layers stacked above the ground grid, bottom to top. Absent on older maps. */
  structureLayers?: StructureLayer[];

  /**
   * Set of revealed tile IDs (global reveal for the map).
   * Serialized as array for persistence.
   */
  revealedTileIds: Set<TileId>;

  /** Last terrain selected by GM during map creation */
  lastSelectedTerrainId: TerrainId;

  /** Last terrain placed/painted by GM (for "inherit last" workflow) */
  lastPlacedTerrainId: TerrainId;
}

// ============================================================================
// TRAVEL WIZARD STATE
// ============================================================================

/**
 * A blocking reason preventing travel from being confirmed.
 */
export interface TravelBlocker {
  /** Machine-readable blocker code */
  code: string;
  /** Human-readable description */
  message: string;
  /** Optional additional details (e.g., character names) */
  details?: string[];
}

/**
 * Travel blocker codes.
 */
export const TRAVEL_BLOCKER_CODES = {
  MODE_INCOMPATIBLE: 'MODE_INCOMPATIBLE',
  PARTY_IN_DOWNTIME: 'PARTY_IN_DOWNTIME',
  PARTY_INCAPACITATED: 'PARTY_INCAPACITATED',
  INSUFFICIENT_CREW: 'INSUFFICIENT_CREW',
  VEHICLE_MODE_INCOMPATIBLE: 'VEHICLE_MODE_INCOMPATIBLE',
  NULL_TERRAIN_ON_ROUTE: 'NULL_TERRAIN_ON_ROUTE',
  IMPASSABLE_TERRAIN: 'IMPASSABLE_TERRAIN',
  EXCEEDS_TIME_BUDGET: 'EXCEEDS_TIME_BUDGET',
} as const;

// ============================================================================
// MAP STATE (TOP-LEVEL STATE SLICE)
// ============================================================================

/**
 * Root state shape for the map system.
 * Stored as `state.maps` in CampaignState.
 */
export interface MapState {
  /** All maps keyed by MapId */
  mapsById: Record<MapId, MapModel>;
  /** Currently active/displayed map (null if none) */
  activeMapId: MapId | null;
  /** Tile IDs needing terrain assignment after GM override travel (null if none) */
  pendingTerrainAssignment: TileId[] | null;
}

// ============================================================================
// TRAVEL MODE DEFINITIONS
// ============================================================================

/**
 * Personnel requirement for a travel mode.
 */
export interface PersonnelRequirement {
  role: string;
  count: number;
}

/**
 * Definition of a travel mode including constraints and requirements.
 */
export interface TravelModeDefinition {
  id: TravelMode;
  label: string;
  /** Map scales this mode is usable on */
  allowedScales: MapScale[];
  /** Miles traveled per 8-hour slot (base range, before terrain modifiers) */
  milesPerSlot: number;
  /** Personnel requirements */
  personnel: PersonnelRequirement[];
  /** Description shown in the wizard */
  description: string;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

/**
 * Initial/default map state for new campaigns.
 */
export const initialMapState: MapState = {
  mapsById: {},
  activeMapId: null,
  pendingTerrainAssignment: null,
};
