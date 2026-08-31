/**
 * Weather System Utilities
 *
 * Phase 5 of the Activities Panel Refactor
 *
 * Provides weather generation, effects calculation, and weather table management.
 */

import type {
  WeatherType,
  Temperature,
  WeatherIntensity,
  WeatherEffects,
  Weather,
  ActiveWeather,
  WeatherDuration,
  WeatherTableEntry,
  Location,
  ClimateType,
  TerrainType,
  WeatherGenerationInput,
  WeatherGenerationResult,
  LocationState,
  LocationModifiers,
} from '../types/location';
import { WEATHER_ICONS, TEMPERATURE_LABELS } from '../types/location';

// ============================================================================
// DEFAULT WEATHER EFFECTS
// ============================================================================

/**
 * Base weather effects for each weather type
 * These are modified by intensity
 */
export const BASE_WEATHER_EFFECTS: Record<WeatherType, Partial<WeatherEffects>> = {
  clear: {
    gathering: 1,
    hunting: 0,
    travel: 0,
    crafting: 0,
    alchemy: 0,
    cooking: 0,
    combat: 0,
    visibility: 0,
    hearing: 0,
    slipperyGround: false,
    reducedVisibility: false,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: false,
    fireRisk: 1,
    trackingMod: 0,
  },
  partlyCloudy: {
    gathering: 0,
    hunting: 0,
    travel: 0,
    crafting: 0,
    alchemy: 0,
    cooking: 0,
    combat: 0,
    visibility: 0,
    hearing: 0,
    slipperyGround: false,
    reducedVisibility: false,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: false,
    fireRisk: 0,
    trackingMod: 0,
  },
  overcast: {
    gathering: 0,
    hunting: 0,
    travel: 0,
    crafting: 0,
    alchemy: 0,
    cooking: 0,
    combat: 0,
    visibility: -1,
    hearing: 0,
    slipperyGround: false,
    reducedVisibility: false,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: false,
    fireRisk: -1,
    trackingMod: 0,
  },
  lightRain: {
    gathering: -1,
    hunting: -1,
    travel: -1,
    crafting: -1,
    alchemy: 0,
    cooking: -1,
    combat: 0,
    visibility: -1,
    hearing: -1,
    slipperyGround: false,
    reducedVisibility: false,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: false,
    fireRisk: -2,
    trackingMod: -1,
  },
  rain: {
    gathering: -2,
    hunting: -2,
    travel: -2,
    crafting: -2,
    alchemy: 0,
    cooking: -2,
    combat: -1,
    visibility: -2,
    hearing: -2,
    slipperyGround: true,
    reducedVisibility: true,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: false,
    fireRisk: -4,
    trackingMod: -2,
  },
  heavyRain: {
    gathering: -3,
    hunting: -3,
    travel: -3,
    crafting: -3,
    alchemy: 0,
    cooking: -3,
    combat: -2,
    visibility: -4,
    hearing: -3,
    slipperyGround: true,
    reducedVisibility: true,
    difficultTerrain: true,
    coldExposure: false,
    heatExposure: false,
    fireRisk: -6,
    trackingMod: -4,
  },
  thunderstorm: {
    gathering: -4,
    hunting: -4,
    travel: -4,
    crafting: -4,
    alchemy: -1,
    cooking: -4,
    combat: -3,
    visibility: -4,
    hearing: -4,
    slipperyGround: true,
    reducedVisibility: true,
    difficultTerrain: true,
    coldExposure: false,
    heatExposure: false,
    fireRisk: -6,
    trackingMod: -4,
  },
  fog: {
    gathering: -2,
    hunting: -3,
    travel: -3,
    crafting: 0,
    alchemy: 0,
    cooking: 0,
    combat: -2,
    visibility: -6,
    hearing: 0,
    slipperyGround: false,
    reducedVisibility: true,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: false,
    fireRisk: -1,
    trackingMod: -1,
  },
  mist: {
    gathering: -1,
    hunting: -1,
    travel: -1,
    crafting: 0,
    alchemy: 0,
    cooking: 0,
    combat: -1,
    visibility: -3,
    hearing: 0,
    slipperyGround: false,
    reducedVisibility: true,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: false,
    fireRisk: 0,
    trackingMod: 0,
  },
  snow: {
    gathering: -2,
    hunting: -1,
    travel: -2,
    crafting: -2,
    alchemy: 0,
    cooking: -1,
    combat: -1,
    visibility: -2,
    hearing: -1,
    slipperyGround: true,
    reducedVisibility: true,
    difficultTerrain: true,
    coldExposure: true,
    heatExposure: false,
    fireRisk: -2,
    trackingMod: 2, // Tracks visible in snow
  },
  blizzard: {
    gathering: -6,
    hunting: -4,
    travel: -6,
    crafting: -4,
    alchemy: 0,
    cooking: -3,
    combat: -4,
    visibility: -6,
    hearing: -3,
    slipperyGround: true,
    reducedVisibility: true,
    difficultTerrain: true,
    coldExposure: true,
    heatExposure: false,
    fireRisk: -3,
    trackingMod: -4, // Snow covers tracks quickly
  },
  hail: {
    gathering: -4,
    hunting: -3,
    travel: -3,
    crafting: -3,
    alchemy: 0,
    cooking: -3,
    combat: -2,
    visibility: -3,
    hearing: -3,
    slipperyGround: true,
    reducedVisibility: true,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: false,
    fireRisk: -2,
    trackingMod: -2,
  },
  sandstorm: {
    gathering: -4,
    hunting: -4,
    travel: -4,
    crafting: -3,
    alchemy: -1,
    cooking: -3,
    combat: -3,
    visibility: -6,
    hearing: -3,
    slipperyGround: false,
    reducedVisibility: true,
    difficultTerrain: true,
    coldExposure: false,
    heatExposure: false,
    fireRisk: 0,
    trackingMod: -4,
  },
  wind: {
    gathering: -1,
    hunting: -1,
    travel: -1,
    crafting: -1,
    alchemy: 0,
    cooking: -1,
    combat: -1, // Ranged penalty
    visibility: 0,
    hearing: -2,
    slipperyGround: false,
    reducedVisibility: false,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: false,
    fireRisk: 2, // Wind can spread fire but also makes it harder to start
    trackingMod: -1,
  },
  heatwave: {
    gathering: -2,
    hunting: -2,
    travel: -2,
    crafting: -2,
    alchemy: -1,
    cooking: 0,
    combat: -1,
    visibility: 0,
    hearing: 0,
    slipperyGround: false,
    reducedVisibility: false,
    difficultTerrain: false,
    coldExposure: false,
    heatExposure: true,
    fireRisk: 3,
    trackingMod: 0,
  },
  coldSnap: {
    gathering: -2,
    hunting: -1,
    travel: -2,
    crafting: -2,
    alchemy: 0,
    cooking: -1,
    combat: -1,
    visibility: 0,
    hearing: 0,
    slipperyGround: true,
    reducedVisibility: false,
    difficultTerrain: false,
    coldExposure: true,
    heatExposure: false,
    fireRisk: 1,
    trackingMod: 0,
  },
};

/**
 * Default weather effects (all zeros)
 */
const DEFAULT_EFFECTS: WeatherEffects = {
  gathering: 0,
  hunting: 0,
  travel: 0,
  crafting: 0,
  alchemy: 0,
  cooking: 0,
  combat: 0,
  visibility: 0,
  hearing: 0,
  slipperyGround: false,
  reducedVisibility: false,
  difficultTerrain: false,
  coldExposure: false,
  heatExposure: false,
  fireRisk: 0,
  trackingMod: 0,
};

// ============================================================================
// DEFAULT WEATHER TABLES BY CLIMATE
// ============================================================================

/**
 * Default weather table entries for each climate type
 */
const DEFAULT_CLIMATE_TABLES: Record<ClimateType, WeatherTableEntry[]> = {
  temperate: [
    { weather: 'clear', probability: 25, temperatureRange: ['cool', 'warm'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 3 } } },
    { weather: 'partlyCloudy', probability: 20, temperatureRange: ['cool', 'warm'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 2 } } },
    { weather: 'overcast', probability: 15, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 2 } } },
    { weather: 'lightRain', probability: 12, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 4 } } },
    { weather: 'rain', probability: 10, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 1 } } },
    { weather: 'heavyRain', probability: 5, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 3 } } },
    { weather: 'thunderstorm', probability: 3, temperatureRange: ['mild', 'warm'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 2 } } },
    { weather: 'fog', probability: 5, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 2 } } },
    { weather: 'snow', probability: 3, temperatureRange: ['freezing', 'cold'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 2 } } },
    { weather: 'wind', probability: 2, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 3 } } },
  ],
  tropical: [
    { weather: 'clear', probability: 20, temperatureRange: ['warm', 'hot'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 2 } } },
    { weather: 'partlyCloudy', probability: 25, temperatureRange: ['warm', 'hot'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 2 } } },
    { weather: 'rain', probability: 20, temperatureRange: ['warm', 'hot'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 4 } } },
    { weather: 'heavyRain', probability: 15, temperatureRange: ['warm', 'hot'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 3 } } },
    { weather: 'thunderstorm', probability: 10, temperatureRange: ['warm', 'hot'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 2 } } },
    { weather: 'heatwave', probability: 5, temperatureRange: ['hot', 'extreme_heat'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 3 } } },
    { weather: 'mist', probability: 5, temperatureRange: ['warm', 'hot'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 2 } } },
  ],
  arid: [
    { weather: 'clear', probability: 50, temperatureRange: ['warm', 'extreme_heat'], durationRange: { min: { type: 'days', count: 1 }, max: { type: 'days', count: 7 } } },
    { weather: 'partlyCloudy', probability: 15, temperatureRange: ['warm', 'hot'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 2 } } },
    { weather: 'heatwave', probability: 15, temperatureRange: ['hot', 'extreme_heat'], durationRange: { min: { type: 'days', count: 1 }, max: { type: 'days', count: 4 } } },
    { weather: 'sandstorm', probability: 10, temperatureRange: ['warm', 'hot'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 4 } } },
    { weather: 'wind', probability: 8, temperatureRange: ['warm', 'hot'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 3 } } },
    { weather: 'coldSnap', probability: 2, temperatureRange: ['cold', 'cool'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 2 } } }, // Desert nights
  ],
  arctic: [
    { weather: 'clear', probability: 15, temperatureRange: ['extreme_cold', 'cold'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 2 } } },
    { weather: 'overcast', probability: 20, temperatureRange: ['extreme_cold', 'freezing'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 3 } } },
    { weather: 'snow', probability: 25, temperatureRange: ['extreme_cold', 'freezing'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 3 } } },
    { weather: 'blizzard', probability: 15, temperatureRange: ['extreme_cold', 'freezing'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 2 } } },
    { weather: 'coldSnap', probability: 15, temperatureRange: ['extreme_cold', 'extreme_cold'], durationRange: { min: { type: 'days', count: 1 }, max: { type: 'days', count: 4 } } },
    { weather: 'wind', probability: 10, temperatureRange: ['extreme_cold', 'freezing'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 4 } } },
  ],
  mediterranean: [
    { weather: 'clear', probability: 35, temperatureRange: ['mild', 'warm'], durationRange: { min: { type: 'days', count: 1 }, max: { type: 'days', count: 5 } } },
    { weather: 'partlyCloudy', probability: 25, temperatureRange: ['mild', 'warm'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 3 } } },
    { weather: 'overcast', probability: 10, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 1 } } },
    { weather: 'lightRain', probability: 10, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 3 } } },
    { weather: 'rain', probability: 8, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 1 } } },
    { weather: 'heatwave', probability: 7, temperatureRange: ['hot', 'extreme_heat'], durationRange: { min: { type: 'days', count: 1 }, max: { type: 'days', count: 3 } } },
    { weather: 'wind', probability: 5, temperatureRange: ['mild', 'warm'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 3 } } },
  ],
  continental: [
    { weather: 'clear', probability: 20, temperatureRange: ['cold', 'hot'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 3 } } },
    { weather: 'partlyCloudy', probability: 15, temperatureRange: ['cold', 'warm'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 2 } } },
    { weather: 'overcast', probability: 15, temperatureRange: ['freezing', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 2 } } },
    { weather: 'rain', probability: 12, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 1 } } },
    { weather: 'thunderstorm', probability: 8, temperatureRange: ['mild', 'hot'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 2 } } },
    { weather: 'snow', probability: 10, temperatureRange: ['extreme_cold', 'freezing'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 3 } } },
    { weather: 'blizzard', probability: 5, temperatureRange: ['extreme_cold', 'freezing'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 1 } } },
    { weather: 'heatwave', probability: 5, temperatureRange: ['hot', 'extreme_heat'], durationRange: { min: { type: 'days', count: 1 }, max: { type: 'days', count: 3 } } },
    { weather: 'coldSnap', probability: 5, temperatureRange: ['extreme_cold', 'cold'], durationRange: { min: { type: 'days', count: 1 }, max: { type: 'days', count: 3 } } },
    { weather: 'wind', probability: 5, temperatureRange: ['cold', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 3 } } },
  ],
  oceanic: [
    { weather: 'partlyCloudy', probability: 20, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 2 } } },
    { weather: 'overcast', probability: 20, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 2 }, max: { type: 'days', count: 3 } } },
    { weather: 'lightRain', probability: 15, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 4 } } },
    { weather: 'rain', probability: 15, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 2 } } },
    { weather: 'clear', probability: 10, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'days', count: 1 } } },
    { weather: 'fog', probability: 10, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 3 } } },
    { weather: 'mist', probability: 5, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 2 } } },
    { weather: 'wind', probability: 5, temperatureRange: ['cool', 'mild'], durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 3 } } },
  ],
};

// ============================================================================
// WEATHER GENERATION UTILITIES
// ============================================================================

/**
 * Get a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Weighted random selection from an array of items with probabilities
 */
function weightedRandom<T extends { probability: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.probability, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.probability;
    if (random <= 0) {
      return item;
    }
  }

  // Fallback to last item
  return items[items.length - 1];
}

/**
 * Temperature ordering for range selection
 */
const TEMPERATURE_ORDER: Temperature[] = [
  'extreme_cold',
  'freezing',
  'cold',
  'cool',
  'mild',
  'warm',
  'hot',
  'extreme_heat',
];

/**
 * Get a random temperature within a range
 */
function randomTemperature(range: [Temperature, Temperature]): Temperature {
  const minIndex = TEMPERATURE_ORDER.indexOf(range[0]);
  const maxIndex = TEMPERATURE_ORDER.indexOf(range[1]);
  const index = randomInt(Math.min(minIndex, maxIndex), Math.max(minIndex, maxIndex));
  return TEMPERATURE_ORDER[index];
}

/**
 * Get a random intensity, optionally weighted
 */
function randomIntensity(weights?: { light: number; moderate: number; heavy: number }): WeatherIntensity {
  if (!weights) {
    // Default: more likely to be moderate
    weights = { light: 30, moderate: 50, heavy: 20 };
  }

  const total = weights.light + weights.moderate + weights.heavy;
  const random = Math.random() * total;

  if (random < weights.light) return 'light';
  if (random < weights.light + weights.moderate) return 'moderate';
  return 'heavy';
}

/**
 * Calculate weather duration in slots
 */
function calculateDurationSlots(duration: WeatherDuration, slotsPerDay: number = 3): number {
  if (duration.type === 'slots') {
    return duration.count;
  }
  if (duration.type === 'days') {
    return duration.count * slotsPerDay;
  }
  // untilChange - use a default
  return slotsPerDay * 2; // 2 days default
}

/**
 * Get random duration within a range
 */
function randomDuration(
  range: { min: WeatherDuration; max: WeatherDuration },
  slotsPerDay: number = 3
): WeatherDuration {
  const minSlots = calculateDurationSlots(range.min, slotsPerDay);
  const maxSlots = calculateDurationSlots(range.max, slotsPerDay);
  const slots = randomInt(minSlots, maxSlots);

  // Return in the most appropriate format
  if (slots >= slotsPerDay && slots % slotsPerDay === 0) {
    return { type: 'days', count: slots / slotsPerDay };
  }
  return { type: 'slots', count: slots };
}

/**
 * Calculate when weather expires based on current time and duration
 */
function calculateExpiration(
  currentTime: { day: number; slot: number },
  duration: WeatherDuration,
  slotsPerDay: number = 3
): { day: number; slot: number } | undefined {
  if (duration.type === 'untilChange') {
    return undefined;
  }

  const durationSlots = calculateDurationSlots(duration, slotsPerDay);
  let totalSlots = currentTime.day * slotsPerDay + currentTime.slot + durationSlots;

  const day = Math.floor(totalSlots / slotsPerDay);
  const slot = totalSlots % slotsPerDay;

  return { day, slot };
}

/**
 * Apply intensity modifier to weather effects
 */
function applyIntensityModifier(
  baseEffects: Partial<WeatherEffects>,
  intensity: WeatherIntensity
): WeatherEffects {
  const multiplier = intensity === 'light' ? 0.5 : intensity === 'heavy' ? 1.5 : 1;

  const effects: WeatherEffects = { ...DEFAULT_EFFECTS };

  // Apply multiplier to numeric values
  const numericKeys: (keyof WeatherEffects)[] = [
    'gathering', 'hunting', 'travel', 'crafting', 'alchemy', 'cooking',
    'combat', 'visibility', 'hearing', 'fireRisk', 'trackingMod'
  ];

  for (const key of numericKeys) {
    const baseValue = baseEffects[key];
    if (typeof baseValue === 'number') {
      // || 0 normalizes Math.round(-0.5) === -0, which JSON round-trips as +0
      effects[key] = (Math.round(baseValue * multiplier) || 0) as never;
    }
  }

  // Copy boolean values directly
  effects.slipperyGround = baseEffects.slipperyGround ?? false;
  effects.reducedVisibility = baseEffects.reducedVisibility ?? false;
  effects.difficultTerrain = baseEffects.difficultTerrain ?? false;
  effects.coldExposure = baseEffects.coldExposure ?? false;
  effects.heatExposure = baseEffects.heatExposure ?? false;

  return effects;
}

/**
 * Generate a description for the weather
 */
function generateWeatherDescription(
  weatherType: WeatherType,
  intensity: WeatherIntensity,
  temperature: Temperature
): string {
  const intensityLabel = intensity === 'moderate' ? '' : `${intensity} `;
  const tempLabel = TEMPERATURE_LABELS[temperature];

  const weatherDescriptions: Record<WeatherType, string> = {
    clear: 'Clear skies',
    partlyCloudy: 'Partly cloudy',
    overcast: 'Overcast',
    lightRain: 'Light rain',
    rain: 'Rain',
    heavyRain: 'Heavy rain',
    thunderstorm: 'Thunderstorm',
    fog: 'Foggy',
    mist: 'Misty',
    snow: 'Snow',
    blizzard: 'Blizzard',
    hail: 'Hail',
    sandstorm: 'Sandstorm',
    wind: 'Windy',
    heatwave: 'Heat wave',
    coldSnap: 'Cold snap',
  };

  const baseDesc = weatherDescriptions[weatherType];

  // Don't add intensity for some weather types
  if (['clear', 'partlyCloudy', 'overcast', 'heatwave', 'coldSnap'].includes(weatherType)) {
    return `${baseDesc}, ${tempLabel}`;
  }

  return `${intensityLabel}${baseDesc}, ${tempLabel}`.trim();
}

// ============================================================================
// MAIN WEATHER GENERATION FUNCTION
// ============================================================================

/**
 * Generate new weather for a location
 */
export function generateWeather(input: WeatherGenerationInput): WeatherGenerationResult {
  const { location, weatherTable, currentTime, weatherEffectOverrides } = input;

  // Get weather entries from custom table or climate defaults
  const entries = weatherTable?.entries ?? DEFAULT_CLIMATE_TABLES[location.climate] ?? DEFAULT_CLIMATE_TABLES.temperate;

  // Select a random weather entry
  const selected = weightedRandom(entries);

  // Determine specific values
  const temperature = randomTemperature(selected.temperatureRange);
  const intensity = randomIntensity(selected.intensityWeights);
  const duration = randomDuration(selected.durationRange);

  // Calculate effects (merge GM overrides with defaults before intensity scaling)
  const defaults = BASE_WEATHER_EFFECTS[selected.weather] ?? {};
  const overrides = weatherEffectOverrides?.[selected.weather];
  const baseEffects = overrides ? { ...defaults, ...overrides } : defaults;
  const effects = applyIntensityModifier(baseEffects, intensity);

  // Generate description
  const description = generateWeatherDescription(selected.weather, intensity, temperature);

  // Build the weather object
  const weather: Weather = {
    type: selected.weather,
    intensity,
    temperature,
    description,
    effects,
  };

  // Build active weather with timing
  const activeWeather: ActiveWeather = {
    weather,
    startedAt: currentTime,
    duration,
    expiresAt: calculateExpiration(currentTime, duration),
  };

  return {
    weather: activeWeather,
    logMessage: `Weather in ${location.name} changed to: ${description}`,
  };
}

/**
 * Check if weather has expired at the given time
 */
export function isWeatherExpired(
  weather: ActiveWeather,
  currentTime: { day: number; slot: number }
): boolean {
  if (!weather.expiresAt) {
    return false;
  }

  const currentTotal = currentTime.day * 3 + currentTime.slot;
  const expiresTotal = weather.expiresAt.day * 3 + weather.expiresAt.slot;

  return currentTotal >= expiresTotal;
}

/**
 * Get remaining duration of weather in slots
 */
export function getRemainingWeatherSlots(
  weather: ActiveWeather,
  currentTime: { day: number; slot: number },
  slotsPerDay: number = 3
): number | null {
  if (!weather.expiresAt) {
    return null; // Indefinite
  }

  const currentTotal = currentTime.day * slotsPerDay + currentTime.slot;
  const expiresTotal = weather.expiresAt.day * slotsPerDay + weather.expiresAt.slot;

  return Math.max(0, expiresTotal - currentTotal);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get weather effects for an activity type
 */
export function getWeatherModifierForActivity(
  weather: Weather | undefined,
  activityType: 'gathering' | 'hunting' | 'travel' | 'crafting' | 'alchemy' | 'cooking' | 'combat'
): number {
  if (!weather) return 0;
  return weather.effects[activityType] ?? 0;
}

/**
 * Get all weather effects that apply to activities
 */
export function getWeatherActivityModifiers(weather: Weather | undefined): {
  gathering: number;
  hunting: number;
  travel: number;
  crafting: number;
  alchemy: number;
  cooking: number;
  combat: number;
} {
  if (!weather) {
    return {
      gathering: 0,
      hunting: 0,
      travel: 0,
      crafting: 0,
      alchemy: 0,
      cooking: 0,
      combat: 0,
    };
  }

  return {
    gathering: weather.effects.gathering,
    hunting: weather.effects.hunting,
    travel: weather.effects.travel,
    crafting: weather.effects.crafting,
    alchemy: weather.effects.alchemy,
    cooking: weather.effects.cooking,
    combat: weather.effects.combat,
  };
}

/**
 * Get display icon for weather type
 */
export function getWeatherIcon(weatherType: WeatherType): string {
  return WEATHER_ICONS[weatherType] ?? '🌡️';
}

/**
 * Create default location modifiers
 */
export function createDefaultLocationModifiers(): LocationModifiers {
  return {
    gathering: 0,
    hunting: 0,
    foraging: 0,
    travel: 0,
  };
}

// ============================================================================
// TERRAIN-BASED MODIFIERS
// ============================================================================

/**
 * Default activity modifiers for each terrain type.
 * These auto-apply to LocationModifiers when the party's terrain changes.
 * GMs can override via terrainModifierOverrides in LocationState.
 */
export const DEFAULT_TERRAIN_MODIFIERS: Record<string, LocationModifiers> = {
  forest:      { gathering: 1,  hunting: 2,  foraging: 2,  travel: -1 },
  plains:      { gathering: 0,  hunting: 1,  foraging: 0,  travel: 1 },
  mountains:   { gathering: -1, hunting: 0,  foraging: -1, travel: -3 },
  desert:      { gathering: -2, hunting: -1, foraging: -2, travel: -1 },
  swamp:       { gathering: 1,  hunting: 1,  foraging: 1,  travel: -2 },
  coastal:     { gathering: 1,  hunting: 0,  foraging: 1,  travel: 0 },
  urban:       { gathering: -1, hunting: -2, foraging: -1, travel: 2 },
  underground: { gathering: 0,  hunting: -1, foraging: -1, travel: -1 },
  river:       { gathering: 2,  hunting: 0,  foraging: 1,  travel: -1 },
};

/**
 * Get the effective terrain modifiers for a terrain type.
 * Checks GM overrides first, then falls back to defaults.
 */
export function getTerrainModifiers(
  terrain: TerrainType,
  overrides?: Record<string, Partial<LocationModifiers>>
): LocationModifiers {
  const defaults = DEFAULT_TERRAIN_MODIFIERS[terrain] ?? createDefaultLocationModifiers();

  if (overrides && overrides[terrain]) {
    return {
      gathering: overrides[terrain].gathering ?? defaults.gathering,
      hunting: overrides[terrain].hunting ?? defaults.hunting,
      foraging: overrides[terrain].foraging ?? defaults.foraging,
      travel: overrides[terrain].travel ?? defaults.travel,
    };
  }

  return { ...defaults };
}

/**
 * Create a default "Camp" location
 */
export function createDefaultLocation(currentTime: { day: number; slot: number }): Location {
  const id = `loc-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // Generate initial weather
  const tempLocation: Location = {
    id,
    name: 'Camp',
    description: 'Your current base of operations',
    climate: 'temperate',
    terrain: 'plains',
    modifiers: createDefaultLocationModifiers(),
    connections: [],
    currentWeather: null as unknown as ActiveWeather, // Will be set below
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };

  const { weather } = generateWeather({
    location: tempLocation,
    currentTime,
  });

  return {
    ...tempLocation,
    currentWeather: weather,
  };
}

/**
 * Create initial location state with a default location
 */
export function createInitialLocationState(currentTime: { day: number; slot: number }): LocationState {
  const defaultLocation = createDefaultLocation(currentTime);

  return {
    currentLocationId: defaultLocation.id,
    locations: {
      [defaultLocation.id]: defaultLocation,
    },
    weatherTables: {},
  };
}

/**
 * Get the current location from state
 */
export function getCurrentLocation(state: LocationState): Location | null {
  if (!state.currentLocationId) return null;
  return state.locations[state.currentLocationId] ?? null;
}

/**
 * Get current weather from state
 */
export function getCurrentWeather(state: LocationState): Weather | null {
  const location = getCurrentLocation(state);
  return location?.currentWeather?.weather ?? null;
}
