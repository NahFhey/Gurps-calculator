/**
 * Map & Travel System Types
 *
 * TypeScript interfaces for the scaling map system with grid-based
 * terrain, markers, links (portals), and route-based travel.
 */

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

// ============================================================================
// MAP SCALES
// ============================================================================

/**
 * Fixed scale options for overland maps (miles per tile).
 * - 12: Local scale (foot travel)
 * - 50: Regional scale (boat travel)
 * - 457: World scale (airship travel)
 */
export type MapScale = 12 | 50 | 457;

/**
 * Extended scale value that includes tactical (yard-based) maps.
 * - 1: Tactical scale (1 yard per tile, for combat maps)
 * - 12/50/457: Overland scales (miles per tile)
 * For backward compatibility, MapScale remains the overland-only subset.
 */
export type MapScaleValue = 1 | MapScale;

/**
 * Scale unit discriminator.
 * - 'miles': Overland maps (12/50/457 miles per tile)
 * - 'yards': Tactical combat maps (1 yard per tile)
 * Existing maps without this field default to 'miles'.
 */
export type ScaleUnit = 'miles' | 'yards';

/**
 * Grid geometry type.
 * - 'square': Standard 4/8-directional grid (current default)
 * - 'hex': Hexagonal grid with 6 directions (future)
 */
export type GridType = 'square' | 'hex';

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
 * Tactical-scale terrain properties.
 * Used for combat maps (1 yard/tile) instead of the overland perMode system.
 */
export interface TacticalTerrainProps {
  /** Movement cost multiplier (1 = normal, 2 = difficult, Infinity = impassable) */
  movementCost: number;
  /** Whether this terrain blocks line-of-sight */
  blocksLoS: boolean;
  /** Whether this terrain blocks movement entirely */
  blocksMovement: boolean;
  /** Optional cover level: 0 = none, 1 = light (-2 to hit), 2 = heavy (-4 to hit) */
  coverLevel?: number;
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
  /** Location terrain type for weather system mapping (e.g., 'forest', 'plains').
   *  Used to sync map terrain with the location/weather system.
   *  Context-dependent terrains like Water and Road omit this and use adjacency logic instead. */
  locationTerrain?: string;
  /** Tactical-scale terrain properties (for combat maps only) */
  tactical?: TacticalTerrainProps;
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
  /** Elevation in yards (for tactical maps with height variation) */
  elevation?: number;
  /** Whether this tile blocks line-of-sight (tactical shortcut) */
  isBlocking?: boolean;
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

  /** Scale value per tile. For overland maps: miles (12/50/457). For tactical maps: yards (1). */
  scaleMilesPerTile: MapScaleValue;

  /** Scale unit: 'miles' for overland, 'yards' for tactical. Defaults to 'miles' when absent. */
  scaleUnit?: ScaleUnit;

  /** Grid geometry. Defaults to 'square' when absent. */
  gridType?: GridType;

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

  /**
   * Set of revealed tile IDs (global reveal for the map).
   * Serialized as array for persistence.
   */
  revealedTileIds: Set<TileId>;

  /** Party's current tile on this map (null if party is not on this map) */
  partyTileId: TileId | null;

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
  INSUFFICIENT_PERSONNEL: 'INSUFFICIENT_PERSONNEL',
  NULL_TERRAIN_ON_ROUTE: 'NULL_TERRAIN_ON_ROUTE',
  IMPASSABLE_TERRAIN: 'IMPASSABLE_TERRAIN',
  EXCEEDS_TIME_BUDGET: 'EXCEEDS_TIME_BUDGET',
} as const;

/**
 * UI state for the travel wizard.
 */
export interface TravelWizardState {
  /** Current wizard step */
  step: 1 | 2 | 3;
  /** Selected travel mode (null = not yet chosen) */
  selectedMode: TravelMode | null;
  /** Ordered list of tile IDs forming the route (start to destination) */
  routeTileIds: TileId[];
  /** Current blocking reasons (empty = valid) */
  blockers: TravelBlocker[];
}

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
  /** Travel wizard UI state (null if wizard not open) */
  travelWizard: TravelWizardState | null;
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
  travelWizard: null,
  pendingTerrainAssignment: null,
};
