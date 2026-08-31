/**
 * useWeatherModifiers - Hook for getting weather effects on activities
 *
 * Phase 5: Location & Weather System
 *
 * Provides weather modifiers for the current location that can be applied to activities.
 */

import { useMemo } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { getWeatherModifierForActivity, getCurrentLocation } from '../utils/weatherSystem';
import { getActiveAmbientWeather } from '../utils/ambientWeather';
import type { WeatherModifiers } from '../utils/activityCalculator';
import type { Weather } from '../types/location';

export type ActivityType = 'gathering' | 'hunting' | 'travel' | 'crafting' | 'alchemy' | 'cooking' | 'combat';

interface UseWeatherModifiersResult {
  /** Weather modifiers ready to pass to activityCalculator */
  modifiers: WeatherModifiers | null;
  /** The current weather object */
  weather: Weather | null;
  /** Current location name */
  locationName: string | null;
  /** Skill bonus from weather (can be negative) */
  skillBonus: number;
  /** Human-readable description of the weather effect */
  effectDescription: string;
  /** Whether weather has any effect on this activity */
  hasEffect: boolean;
}

/**
 * Hook to get weather modifiers for a specific activity type
 *
 * @param activityType - The type of activity to get modifiers for
 * @returns Weather modifiers and related info
 *
 * @example
 * ```tsx
 * const { modifiers, effectDescription, hasEffect } = useWeatherModifiers('gathering');
 *
 * // Use in activity calculation
 * const bonuses = calculateActivityBonuses({
 *   primaryWorkerId,
 *   helperWorkerIds,
 *   toolsUsed,
 *   facility,
 *   weatherModifiers: modifiers,
 * });
 *
 * // Show in UI
 * {hasEffect && <span>Weather: {effectDescription}</span>}
 * ```
 */
export function useWeatherModifiers(activityType: ActivityType): UseWeatherModifiersResult {
  const { state } = useCampaignStore();

  return useMemo(() => {
    const currentLocation = getCurrentLocation(state.locations);
    const { weather, mapName } = getActiveAmbientWeather(state);

    if (!weather) {
      return {
        modifiers: null,
        weather: null,
        locationName: null,
        skillBonus: 0,
        effectDescription: 'No weather data',
        hasEffect: false,
      };
    }

    const skillBonus = getWeatherModifierForActivity(weather, activityType);

    // Build effect description
    let effectDescription = weather.description;
    if (skillBonus !== 0) {
      const sign = skillBonus > 0 ? '+' : '';
      effectDescription += ` (${sign}${skillBonus} to ${activityType})`;
    }

    // Location modifiers also affect activities
    const locationBonus = getLocationModifierForActivity(currentLocation?.modifiers, activityType);
    const totalSkillBonus = skillBonus + locationBonus;

    const modifiers: WeatherModifiers = {
      skillBonus: totalSkillBonus,
      description: effectDescription,
    };

    return {
      modifiers,
      weather,
      // Kept for compatibility with existing consumers; ambient weather is map-sourced.
      locationName: mapName,
      skillBonus: totalSkillBonus,
      effectDescription,
      hasEffect: totalSkillBonus !== 0,
    };
  }, [
    state.locations,
    state.maps,
    state.entities.travelGroups,
    state.entities.vehicles,
    state.ui.activeTravelGroupId,
    activityType,
  ]);
}

/**
 * Get location modifier for a specific activity type
 */
function getLocationModifierForActivity(
  modifiers: { gathering: number; hunting: number; foraging: number; travel: number } | undefined,
  activityType: ActivityType
): number {
  if (!modifiers) return 0;

  switch (activityType) {
    case 'gathering':
      return modifiers.gathering ?? 0;
    case 'hunting':
      return modifiers.hunting ?? 0;
    case 'travel':
      return modifiers.travel ?? 0;
    // Foraging is considered part of gathering
    default:
      return 0;
  }
}

/**
 * Hook to get all weather effects at once
 * Useful for display components that show all effects
 */
export function useAllWeatherModifiers(): {
  weather: Weather | null;
  locationName: string | null;
  effects: Record<ActivityType, number>;
  hasAnyEffect: boolean;
} {
  const { state } = useCampaignStore();

  return useMemo(() => {
    const currentLocation = getCurrentLocation(state.locations);
    const { weather, mapName } = getActiveAmbientWeather(state);

    if (!weather) {
      return {
        weather: null,
        locationName: null,
        effects: {
          gathering: 0,
          hunting: 0,
          travel: 0,
          crafting: 0,
          alchemy: 0,
          cooking: 0,
          combat: 0,
        },
        hasAnyEffect: false,
      };
    }

    const effects: Record<ActivityType, number> = {
      gathering: weather.effects.gathering + (currentLocation?.modifiers.gathering ?? 0),
      hunting: weather.effects.hunting + (currentLocation?.modifiers.hunting ?? 0),
      travel: weather.effects.travel + (currentLocation?.modifiers.travel ?? 0),
      crafting: weather.effects.crafting,
      alchemy: weather.effects.alchemy,
      cooking: weather.effects.cooking,
      combat: weather.effects.combat,
    };

    const hasAnyEffect = Object.values(effects).some(v => v !== 0);

    return {
      weather,
      // Kept for compatibility with existing consumers; ambient weather is map-sourced.
      locationName: mapName,
      effects,
      hasAnyEffect,
    };
  }, [
    state.locations,
    state.maps,
    state.entities.travelGroups,
    state.entities.vehicles,
    state.ui.activeTravelGroupId,
  ]);
}

export default useWeatherModifiers;
