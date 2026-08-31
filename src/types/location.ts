/**
 * Location & Weather System Types
 *
 * Phase 5 of the Activities Panel Refactor
 *
 * This file defines all types for:
 * - Locations (GM-created areas with climates and weather tables)
 * - Weather (types, effects, duration)
 * - Travel (movement between locations)
 */

import type { SeasonDef } from '../utils/timeSystem';

export type Id = string;

// ============================================================================
// CLIMATE & TERRAIN TYPES
// ============================================================================

/**
 * Preset climate types with known weather probabilities
 */
export type PresetClimateType =
  | 'temperate'      // Balanced, all weather types possible
  | 'tropical'       // Hot, rainy, no snow
  | 'arid'           // Hot, dry, minimal rain
  | 'arctic'         // Cold, snow common
  | 'mediterranean'  // Mild, dry summers, wet winters
  | 'continental'    // Extreme seasons
  | 'oceanic';       // Mild, frequent rain

/**
 * Climate types — includes presets + GM-defined custom types
 * Custom types can be paired with a custom weather table by the owning map.
 */
export type ClimateType = PresetClimateType | (string & {});

/**
 * Preset terrain types
 */
export type PresetTerrainType =
  | 'forest'
  | 'plains'
  | 'mountains'
  | 'desert'
  | 'swamp'
  | 'coastal'
  | 'urban'
  | 'underground'
  | 'river';

/**
 * Terrain types — includes presets + GM-defined custom types
 */
export type TerrainType = PresetTerrainType | (string & {});

// ============================================================================
// WEATHER TYPES
// ============================================================================

/**
 * Weather condition types
 */
export type WeatherType =
  | 'clear'          // Sunny, no clouds
  | 'partlyCloudy'   // Some clouds, pleasant
  | 'overcast'       // Cloudy but dry
  | 'lightRain'      // Drizzle, light showers
  | 'rain'           // Steady rain
  | 'heavyRain'      // Downpour
  | 'thunderstorm'   // Rain + lightning + wind
  | 'fog'            // Low visibility
  | 'mist'           // Light fog
  | 'snow'           // Snowfall
  | 'blizzard'       // Heavy snow + wind
  | 'hail'           // Hailstorm
  | 'sandstorm'      // Desert-specific
  | 'wind'           // Strong winds, no precipitation
  | 'heatwave'       // Extreme heat
  | 'coldSnap';      // Extreme cold

/**
 * Temperature ranges
 */
export type Temperature =
  | 'extreme_cold'   // Below 0°F (-18°C) - FP loss risk
  | 'freezing'       // 0-32°F (-18 to 0°C)
  | 'cold'           // 32-50°F (0-10°C)
  | 'cool'           // 50-65°F (10-18°C)
  | 'mild'           // 65-75°F (18-24°C)
  | 'warm'           // 75-85°F (24-29°C)
  | 'hot'            // 85-100°F (29-38°C)
  | 'extreme_heat';  // Above 100°F (38°C) - FP loss risk

/**
 * Weather intensity levels
 */
export type WeatherIntensity = 'light' | 'moderate' | 'heavy';

/**
 * Weather duration can be specified in slots or days
 */
export type WeatherDuration =
  | { type: 'slots'; count: number }
  | { type: 'days'; count: number }
  | { type: 'untilChange' };

// ============================================================================
// WEATHER EFFECTS
// ============================================================================

/**
 * Weather effects on various activities and conditions
 * All modifiers are additive bonuses/penalties to skill rolls
 */
export interface WeatherEffects {
  // Activity modifiers (applied to skill rolls)
  gathering: number;          // Foraging, fishing
  hunting: number;            // Tracking, hunting
  travel: number;             // Hiking, navigation
  crafting: number;           // Outdoor crafting (smithing, building)
  alchemy: number;            // Alchemy (usually unaffected by weather)
  cooking: number;            // Outdoor cooking
  combat: number;             // Ranged attacks, footing

  // Perception modifiers
  visibility: number;         // Vision-based tasks, spotting, searching
  hearing: number;            // Listening, detecting sounds

  // Physical conditions (boolean flags)
  slipperyGround: boolean;    // DX penalty for movement
  reducedVisibility: boolean; // Range penalties for attacks
  difficultTerrain: boolean;  // Reduced movement rate

  // Health risks
  coldExposure: boolean;      // Risk of FP loss from cold
  heatExposure: boolean;      // Risk of FP loss from heat

  // Special modifiers
  fireRisk: number;           // Modifier to fire-starting (+dry, -wet)
  trackingMod: number;        // Easier/harder to follow tracks
}

/**
 * Current weather state for a location
 */
export interface Weather {
  type: WeatherType;
  intensity: WeatherIntensity;
  temperature: Temperature;
  description: string;        // Human-readable description
  effects: WeatherEffects;
}

/**
 * Active weather with duration tracking
 */
export interface ActiveWeather {
  weather: Weather;
  startedAt: { day: number; slot: number };
  duration: WeatherDuration;
  expiresAt?: { day: number; slot: number };  // Calculated from duration
}

// ============================================================================
// WEATHER TABLES
// ============================================================================

/**
 * Entry in a location's weather table for random generation
 */
export interface WeatherTableEntry {
  weather: WeatherType;
  probability: number;        // Weight (not percentage)
  temperatureRange: [Temperature, Temperature];  // Min, max
  intensityWeights?: {
    light: number;
    moderate: number;
    heavy: number;
  };
  durationRange: {
    min: WeatherDuration;
    max: WeatherDuration;
  };
}

/**
 * Complete weather table for a location
 */
export interface WeatherTable {
  id: Id;
  name: string;               // e.g., "Temperate Forest - Summer"
  description?: string;
  entries: WeatherTableEntry[];
}

// ============================================================================
// LOCATION TYPES
// ============================================================================

/**
 * Modifiers specific to a location
 */
export interface LocationModifiers {
  gathering: number;          // Bonus/penalty to gathering here
  hunting: number;            // Bonus/penalty to hunting
  foraging: number;           // Bonus/penalty to foraging
  travel: number;             // Difficulty of travel within
}

/**
 * Visual theming for future animated backgrounds
 */
export interface LocationTheme {
  biome: 'forest' | 'desert' | 'mountain' | 'coastal' | 'plains' | 'swamp' | 'tundra' | 'urban';
  palette?: string;           // Color scheme identifier
}

/**
 * A location in the game world
 */
export interface Location {
  id: Id;
  name: string;               // "Thornwood Forest", "Sandspire Desert"
  description?: string;       // Flavor text for the location
  gmNotes?: string;

  // Environment classification
  climate: ClimateType;
  terrain: TerrainType;

  // Location-specific modifiers
  modifiers: LocationModifiers;

  // Visual theming (for future animated backgrounds)
  theme?: LocationTheme;

  // Metadata
  createdAt: number;
  modifiedAt: number;
}

// ============================================================================
// LOCATION STATE
// ============================================================================

/**
 * Complete location system state for the campaign store
 */
export interface LocationState {
  currentLocationId: Id | null;
  locations: Record<Id, Location>;
  weatherTables: Record<Id, WeatherTable>;
  /** GM-defined custom climate types beyond the 7 presets */
  customClimates?: Array<{ key: string; label: string }>;
  /** GM-defined custom terrain types beyond the 8 presets */
  customTerrains?: Array<{ key: string; label: string }>;
  /** GM overrides for default terrain modifiers (per terrain type) */
  terrainModifierOverrides?: Record<string, Partial<LocationModifiers>>;
  /** GM overrides for base weather effects (per weather type) */
  weatherEffectOverrides?: Record<string, Partial<WeatherEffects>>;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Input for weather generation
 */
export interface WeatherGenerationInput {
  climate: ClimateType;
  weatherTable?: WeatherTable;
  currentTime: { day: number; slot: number };
  season?: SeasonDef;
  slotsPerDay?: number;
  /** GM overrides for base weather effects (applied before intensity scaling) */
  weatherEffectOverrides?: Record<string, Partial<WeatherEffects>>;
}

/**
 * Result of weather generation
 */
export interface WeatherGenerationResult {
  weather: ActiveWeather;
  logMessage: string;
}

/**
 * Weather icon mapping for display
 */
export const WEATHER_ICONS: Record<WeatherType, string> = {
  clear: '☀️',
  partlyCloudy: '⛅',
  overcast: '☁️',
  lightRain: '🌦️',
  rain: '🌧️',
  heavyRain: '⛈️',
  thunderstorm: '🌩️',
  fog: '🌫️',
  mist: '🌁',
  snow: '🌨️',
  blizzard: '❄️',
  hail: '🧊',
  sandstorm: '🏜️',
  wind: '💨',
  heatwave: '🔥',
  coldSnap: '🥶',
};

/**
 * Weather type display labels
 */
export const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: 'Clear',
  partlyCloudy: 'Partly Cloudy',
  overcast: 'Overcast',
  lightRain: 'Light Rain',
  rain: 'Rain',
  heavyRain: 'Heavy Rain',
  thunderstorm: 'Thunderstorm',
  fog: 'Fog',
  mist: 'Mist',
  snow: 'Snow',
  blizzard: 'Blizzard',
  hail: 'Hail',
  sandstorm: 'Sandstorm',
  wind: 'Wind',
  heatwave: 'Heatwave',
  coldSnap: 'Cold Snap',
};

/**
 * Temperature display labels
 */
export const TEMPERATURE_LABELS: Record<Temperature, string> = {
  extreme_cold: 'Extreme Cold',
  freezing: 'Freezing',
  cold: 'Cold',
  cool: 'Cool',
  mild: 'Mild',
  warm: 'Warm',
  hot: 'Hot',
  extreme_heat: 'Extreme Heat',
};

/**
 * Climate display labels
 */
export const CLIMATE_LABELS: Record<ClimateType, string> = {
  temperate: 'Temperate',
  tropical: 'Tropical',
  arid: 'Arid',
  arctic: 'Arctic',
  mediterranean: 'Mediterranean',
  continental: 'Continental',
  oceanic: 'Oceanic',
};

/**
 * Terrain display labels
 */
export const TERRAIN_LABELS: Record<TerrainType, string> = {
  forest: 'Forest',
  plains: 'Plains',
  mountains: 'Mountains',
  desert: 'Desert',
  swamp: 'Swamp',
  coastal: 'Coastal',
  urban: 'Urban',
  underground: 'Underground',
  river: 'River',
};
