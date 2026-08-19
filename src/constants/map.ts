/**
 * Map System Constants
 *
 * Preset terrain definitions, travel mode definitions, and scale constants.
 */

import type { TerrainModel, TravelMode, TravelModeDefinition, MapScale } from '../types/map';

// ============================================================================
// SCALE CONSTANTS
// ============================================================================

export const MAP_SCALES: { value: MapScale; label: string; description: string }[] = [
  { value: 12, label: 'Local (12 mi/tile)', description: 'All travel modes' },
  { value: 50, label: 'Region (50 mi/tile)', description: 'Boat & Airship' },
  { value: 457, label: 'World (457 mi/tile)', description: 'Airship only' },
];

/** Scale → allowed travel modes (higher-tier modes work on smaller maps too) */
export const SCALE_TO_MODES: Record<MapScale, TravelMode[]> = {
  12: ['foot', 'boat', 'airship'],
  50: ['boat', 'airship'],
  457: ['airship'],
};

/** Initial grid size for new maps */
export const INITIAL_GRID_SIZE = 9;

/** Center index (0-based) in the initial grid */
export const INITIAL_CENTER = 4;

/** Minimum allocation buffer beyond explored frontier */
export const EXPANSION_BUFFER = 2;

/** Tile size in pixels for rendering */
export const TILE_SIZE_PX = 40;

/** Slots per day */
export const SLOTS_PER_DAY = 3;

/** Hours per slot */
export const HOURS_PER_SLOT = 8;

/** Default terrain elevation in levels. */
export const DEFAULT_TERRAIN_ELEVATION = 1;

/** Maximum terrain or tile elevation in levels. */
export const MAX_ELEVATION = 20;

/** Default line-of-sight radius in tiles. */
export const DEFAULT_SIGHT_RANGE_TILES = 8;

// ============================================================================
// TRAVEL MODE DEFINITIONS
// ============================================================================

export const TRAVEL_MODE_DEFINITIONS: TravelModeDefinition[] = [
  {
    id: 'foot',
    label: 'Foot',
    allowedScales: [12],
    milesPerSlot: 12,
    personnel: [],
    description: 'Travel on foot — 12 miles per slot.',
  },
  {
    id: 'boat',
    label: 'Boat',
    allowedScales: [12, 50],
    milesPerSlot: 50,
    personnel: [
      { role: 'pilot', count: 1 },
      { role: 'crew', count: 4 },
    ],
    description: 'Travel by boat — 50 miles per slot. Requires 1 pilot and 4 crew.',
  },
  {
    id: 'airship',
    label: 'Airship',
    allowedScales: [12, 50, 457],
    milesPerSlot: 457,
    personnel: [
      { role: 'pilot', count: 1 },
      { role: 'crystal diver', count: 1 },
      { role: 'crew', count: 3 },
    ],
    description: 'Travel by airship — 457 miles per slot. Requires 1 pilot, 1 crystal diver, and 3 crew.',
  },
];

/** Lookup travel mode definition by ID */
export function getTravelModeDefinition(mode: TravelMode): TravelModeDefinition {
  return TRAVEL_MODE_DEFINITIONS.find((m) => m.id === mode)!;
}

// ============================================================================
// PRESET TERRAINS
// ============================================================================

/**
 * Generate preset terrain definitions.
 * Each call produces new IDs so they can be copied into individual maps.
 */
export function createPresetTerrains(): TerrainModel[] {
  return [
    {
      id: 'terrain-plains',
      name: 'Plains',
      color: '#4ade80',
      elevation: 1,
      locationTerrain: 'plains',
      perMode: {
        foot: { passable: true, speedModifier: 1.0 },
        boat: { passable: false, speedModifier: 1.0 },
        airship: { passable: true, speedModifier: 1.0 },
      },
    },
    {
      id: 'terrain-forest',
      name: 'Forest',
      color: '#166534',
      elevation: 2,
      locationTerrain: 'forest',
      perMode: {
        foot: { passable: true, speedModifier: 0.8 },
        boat: { passable: false, speedModifier: 1.0 },
        airship: { passable: true, speedModifier: 1.0 },
      },
    },
    {
      id: 'terrain-hills',
      name: 'Hills',
      color: '#a3a23a',
      elevation: 2,
      locationTerrain: 'plains',
      perMode: {
        foot: { passable: true, speedModifier: 0.7 },
        boat: { passable: false, speedModifier: 1.0 },
        airship: { passable: true, speedModifier: 1.0 },
      },
    },
    {
      id: 'terrain-mountains',
      name: 'Mountains',
      color: '#6b7280',
      elevation: 4,
      locationTerrain: 'mountains',
      perMode: {
        foot: { passable: false, speedModifier: 1.0 },
        boat: { passable: false, speedModifier: 1.0 },
        airship: { passable: true, speedModifier: 0.8 },
      },
    },
    {
      id: 'terrain-swamp',
      name: 'Swamp',
      color: '#7e22ce',
      elevation: 1,
      locationTerrain: 'swamp',
      perMode: {
        foot: { passable: true, speedModifier: 0.5 },
        boat: { passable: false, speedModifier: 1.0 },
        airship: { passable: true, speedModifier: 1.0 },
      },
    },
    {
      id: 'terrain-desert',
      name: 'Desert',
      color: '#eab308',
      elevation: 1,
      locationTerrain: 'desert',
      perMode: {
        foot: { passable: true, speedModifier: 0.7 },
        boat: { passable: false, speedModifier: 1.0 },
        airship: { passable: true, speedModifier: 1.0 },
      },
    },
    {
      id: 'terrain-water',
      name: 'Water',
      color: '#3b82f6',
      elevation: 0,
      perMode: {
        foot: { passable: false, speedModifier: 1.0 },
        boat: { passable: true, speedModifier: 1.0 },
        airship: { passable: true, speedModifier: 1.0 },
      },
    },
    {
      id: 'terrain-urban',
      name: 'Urban',
      color: '#92400e',
      elevation: 1,
      locationTerrain: 'urban',
      perMode: {
        foot: { passable: true, speedModifier: 1.0 },
        boat: { passable: false, speedModifier: 1.0 },
        airship: { passable: true, speedModifier: 1.0 },
      },
    },
    {
      id: 'terrain-road',
      name: 'Road',
      color: '#d4a574',
      elevation: 1,
      perMode: {
        foot: { passable: true, speedModifier: 1.2 },
        boat: { passable: false, speedModifier: 1.0 },
        airship: { passable: true, speedModifier: 1.0 },
      },
    },
  ];
}

/** Preset terrain IDs for lookup */
export const PRESET_TERRAIN_IDS = [
  'terrain-plains',
  'terrain-forest',
  'terrain-hills',
  'terrain-mountains',
  'terrain-swamp',
  'terrain-desert',
  'terrain-water',
  'terrain-urban',
  'terrain-road',
] as const;
