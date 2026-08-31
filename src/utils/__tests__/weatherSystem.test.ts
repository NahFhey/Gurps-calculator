import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BASE_WEATHER_EFFECTS,
  DEFAULT_TERRAIN_MODIFIERS,
  generateWeather,
  isWeatherExpired,
  getRemainingWeatherSlots,
  getWeatherModifierForActivity,
  getWeatherActivityModifiers,
  getWeatherIcon,
  createDefaultLocationModifiers,
  getTerrainModifiers,
  createDefaultLocation,
  createInitialLocationState,
  getCurrentLocation,
  applySeasonToEntries,
  shiftTemperatureRange,
} from '../weatherSystem';
import type {
  ActiveWeather,
  Location,
  LocationState,
  Weather,
  WeatherEffects,
  WeatherTableEntry,
  WeatherTable,
} from '../../types/location';
import type { SeasonDef } from '../timeSystem';

function buildLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'loc-test',
    name: 'Test Location',
    description: 'A place for testing',
    climate: 'temperate',
    terrain: 'plains',
    modifiers: createDefaultLocationModifiers(),
    createdAt: 0,
    modifiedAt: 0,
    ...overrides,
  };
}

describe('weatherSystem', () => {
  describe('generateWeather', () => {
    beforeEach(() => {
      // Deterministic randomness: Math.random returns 0 — first entry, light intensity, min duration
      vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('produces a well-formed ActiveWeather for the temperate climate', () => {
      const location = buildLocation({ climate: 'temperate' });
      const result = generateWeather({
        climate: location.climate,
        currentTime: { day: 0, slot: 0 },
      });

      expect(result.weather.weather.type).toBe('clear'); // first entry in temperate table
      expect(result.weather.weather.intensity).toBe('light');
      expect(result.weather.startedAt).toEqual({ day: 0, slot: 0 });
      expect(result.weather.duration).toBeDefined();
      expect(result.weather.expiresAt).toBeDefined();
      expect(result.logMessage).toContain('Weather changed');
      expect(result.logMessage).toContain('Clear skies');
    });

    it('falls back to the temperate table for an unknown climate', () => {
      const location = buildLocation({ climate: 'unknown-climate' as never });
      const result = generateWeather({
        climate: location.climate,
        currentTime: { day: 1, slot: 1 },
      });
      // The temperate table's first entry is "clear"
      expect(result.weather.weather.type).toBe('clear');
    });

    it('uses a custom weather table when provided', () => {
      const location = buildLocation();
      const result = generateWeather({
        climate: location.climate,
        currentTime: { day: 0, slot: 0 },
        weatherTable: {
          id: 'wt-custom',
          name: 'Always Thunderstorms',
          entries: [
            {
              weather: 'thunderstorm',
              probability: 1,
              temperatureRange: ['warm', 'warm'],
              durationRange: {
                min: { type: 'slots', count: 1 },
                max: { type: 'slots', count: 1 },
              },
            },
          ],
        },
      });
      expect(result.weather.weather.type).toBe('thunderstorm');
      expect(result.weather.weather.temperature).toBe('warm');
    });

    it('applies GM effect overrides before intensity scaling', () => {
      const location = buildLocation();
      const result = generateWeather({
        climate: location.climate,
        currentTime: { day: 0, slot: 0 },
        weatherEffectOverrides: {
          clear: { gathering: 10 },
        },
      });
      // With Math.random=0 intensity is 'light' (×0.5), so 10 → 5
      expect(result.weather.weather.effects.gathering).toBe(5);
    });
  });

  describe('isWeatherExpired', () => {
    const baseWeather: ActiveWeather = {
      weather: {
        type: 'clear',
        intensity: 'moderate',
        temperature: 'mild',
        description: 'Clear skies, mild',
        effects: { ...BASE_WEATHER_EFFECTS.clear } as WeatherEffects,
      },
      startedAt: { day: 0, slot: 0 },
      duration: { type: 'slots', count: 2 },
      expiresAt: { day: 1, slot: 0 }, // total slot = 3
    };

    it('returns false when current time is before expiration', () => {
      expect(isWeatherExpired(baseWeather, { day: 0, slot: 2 })).toBe(false);
    });

    it('returns true when current time matches or exceeds expiration', () => {
      expect(isWeatherExpired(baseWeather, { day: 1, slot: 0 })).toBe(true);
      expect(isWeatherExpired(baseWeather, { day: 2, slot: 0 })).toBe(true);
    });

    it('returns false for indefinite (untilChange) weather with no expiresAt', () => {
      const indefinite: ActiveWeather = {
        ...baseWeather,
        duration: { type: 'untilChange' },
        expiresAt: undefined,
      };
      expect(isWeatherExpired(indefinite, { day: 999, slot: 0 })).toBe(false);
    });
  });

  describe('getRemainingWeatherSlots', () => {
    const baseWeather: ActiveWeather = {
      weather: {
        type: 'clear',
        intensity: 'moderate',
        temperature: 'mild',
        description: '',
        effects: { ...BASE_WEATHER_EFFECTS.clear } as WeatherEffects,
      },
      startedAt: { day: 0, slot: 0 },
      duration: { type: 'slots', count: 5 },
      expiresAt: { day: 1, slot: 2 }, // total = 5
    };

    it('returns remaining slot count when before expiration', () => {
      expect(getRemainingWeatherSlots(baseWeather, { day: 0, slot: 1 })).toBe(4);
    });

    it('clamps at zero past expiration', () => {
      expect(getRemainingWeatherSlots(baseWeather, { day: 5, slot: 0 })).toBe(0);
    });

    it('returns null for indefinite weather', () => {
      const indefinite: ActiveWeather = { ...baseWeather, expiresAt: undefined };
      expect(getRemainingWeatherSlots(indefinite, { day: 0, slot: 0 })).toBeNull();
    });
  });

  describe('getWeatherModifierForActivity', () => {
    const rainWeather: Weather = {
      type: 'rain',
      intensity: 'moderate',
      temperature: 'cool',
      description: '',
      effects: { ...BASE_WEATHER_EFFECTS.rain } as WeatherEffects,
    };

    it('returns the modifier for the requested activity', () => {
      expect(getWeatherModifierForActivity(rainWeather, 'gathering')).toBe(-2);
      expect(getWeatherModifierForActivity(rainWeather, 'combat')).toBe(-1);
    });

    it('returns 0 when weather is undefined', () => {
      expect(getWeatherModifierForActivity(undefined, 'gathering')).toBe(0);
    });
  });

  describe('getWeatherActivityModifiers', () => {
    it('returns all-zeros for undefined weather', () => {
      const mods = getWeatherActivityModifiers(undefined);
      expect(mods).toEqual({
        gathering: 0,
        hunting: 0,
        travel: 0,
        crafting: 0,
        alchemy: 0,
        cooking: 0,
        combat: 0,
      });
    });

    it('returns a fully populated modifier object for a weather instance', () => {
      const weather: Weather = {
        type: 'snow',
        intensity: 'moderate',
        temperature: 'freezing',
        description: '',
        effects: { ...BASE_WEATHER_EFFECTS.snow } as WeatherEffects,
      };
      const mods = getWeatherActivityModifiers(weather);
      expect(mods.gathering).toBe(-2);
      expect(mods.travel).toBe(-2);
    });
  });

  describe('getWeatherIcon', () => {
    it('returns a known icon for a recognized weather type', () => {
      expect(getWeatherIcon('clear')).toBe('☀️');
    });

    it('returns the fallback icon for an unknown weather type', () => {
      expect(getWeatherIcon('totally-fake' as never)).toBe('🌡️');
    });
  });

  describe('createDefaultLocationModifiers', () => {
    it('returns all-zero modifiers', () => {
      expect(createDefaultLocationModifiers()).toEqual({
        gathering: 0,
        hunting: 0,
        foraging: 0,
        travel: 0,
      });
    });
  });

  describe('getTerrainModifiers', () => {
    it('returns the defaults for a known terrain', () => {
      expect(getTerrainModifiers('forest')).toEqual(DEFAULT_TERRAIN_MODIFIERS.forest);
    });

    it('returns zeroed defaults for an unknown terrain', () => {
      expect(getTerrainModifiers('made-up-terrain' as never)).toEqual(
        createDefaultLocationModifiers()
      );
    });

    it('applies GM overrides on top of defaults', () => {
      const result = getTerrainModifiers('forest', {
        forest: { gathering: 99 },
      });
      expect(result.gathering).toBe(99);
      expect(result.hunting).toBe(DEFAULT_TERRAIN_MODIFIERS.forest.hunting);
      expect(result.travel).toBe(DEFAULT_TERRAIN_MODIFIERS.forest.travel);
    });
  });

  describe('createDefaultLocation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('produces a "Camp" location without ambient weather fields', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const location = createDefaultLocation({ day: 0, slot: 0 });
      expect(location.name).toBe('Camp');
      expect(location.climate).toBe('temperate');
      expect(location.terrain).toBe('plains');
      expect('currentWeather' in location).toBe(false);
      expect(location.id.startsWith('loc-')).toBe(true);
    });
  });

  describe('createInitialLocationState / getCurrentLocation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('seeds a state with a default location and empty tables', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = createInitialLocationState({ day: 0, slot: 0 });
      expect(state.currentLocationId).toBeTruthy();
      expect(state.weatherTables).toEqual({});

      const loc = getCurrentLocation(state);
      expect(loc?.name).toBe('Camp');

    });

    it('getCurrentLocation returns null when currentLocationId is missing', () => {
      const state: LocationState = {
        currentLocationId: null,
        locations: {},
        weatherTables: {},
      };
      expect(getCurrentLocation(state)).toBeNull();
    });

    it('getCurrentLocation returns null when the id points at a missing location', () => {
      const state: LocationState = {
        currentLocationId: 'missing',
        locations: {},
        weatherTables: {},
      };
      expect(getCurrentLocation(state)).toBeNull();
    });
  });

  describe('seasonal weather hooks', () => {
    const dry: WeatherTableEntry = {
      weather: 'clear',
      probability: 10,
      temperatureRange: ['cool', 'warm'],
      durationRange: { min: { type: 'slots', count: 1 }, max: { type: 'slots', count: 1 } },
    };
    const wet: WeatherTableEntry = {
      ...dry,
      weather: 'rain',
      probability: 20,
    };
    const winter: SeasonDef = {
      name: 'Winter',
      days: 90,
      temperatureShift: -2,
      precipitationMultiplier: 1.5,
    };

    it('returns the original entries when no season is supplied', () => {
      const entries = [dry, wet];
      expect(applySeasonToEntries(entries, undefined)).toBe(entries);
    });

    it('scales rain probability', () => {
      expect(applySeasonToEntries([wet], winter)[0].probability).toBe(30);
    });

    it('leaves clear probability unchanged', () => {
      expect(applySeasonToEntries([dry], winter)[0].probability).toBe(10);
    });

    it.each(['lightRain', 'rain', 'heavyRain', 'thunderstorm', 'snow', 'blizzard', 'hail'] as const)(
      'classifies %s as precipitation',
      (weather) => {
        const entry = { ...wet, weather };
        expect(applySeasonToEntries([entry], winter)[0].probability).toBe(30);
      }
    );

    it('does not mutate authored entries', () => {
      applySeasonToEntries([wet], winter);
      expect(wet.probability).toBe(20);
    });

    it('returns the original range for a zero shift', () => {
      const range: ['cool', 'warm'] = ['cool', 'warm'];
      expect(shiftTemperatureRange(range, 0)).toBe(range);
    });

    it('shifts a temperature range colder', () => {
      expect(shiftTemperatureRange(['mild', 'warm'], -2)).toEqual(['cold', 'cool']);
    });

    it('shifts a temperature range warmer', () => {
      expect(shiftTemperatureRange(['cool', 'mild'], 2)).toEqual(['warm', 'hot']);
    });

    it('clamps shifts at extreme cold', () => {
      expect(shiftTemperatureRange(['extreme_cold', 'freezing'], -3)).toEqual(['extreme_cold', 'extreme_cold']);
    });

    it('clamps shifts at extreme heat', () => {
      expect(shiftTemperatureRange(['hot', 'extreme_heat'], 3)).toEqual(['extreme_heat', 'extreme_heat']);
    });

    it('applies winter temperature shift to a custom table deterministically', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const weatherTable: WeatherTable = { id: 'stable', name: 'Stable', entries: [{ ...dry, temperatureRange: ['mild', 'mild'] }] };
      const baseline = generateWeather({ climate: 'temperate', weatherTable, currentTime: { day: 1, slot: 0 } });
      const seasonal = generateWeather({ climate: 'temperate', weatherTable, currentTime: { day: 1, slot: 0 }, season: winter });
      expect(baseline.weather.weather.temperature).toBe('mild');
      expect(seasonal.weather.weather.temperature).toBe('cold');
      vi.restoreAllMocks();
    });

    it('uses slotsPerDay for duration expiration', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const weatherTable = {
        id: 'duration', name: 'Duration', entries: [{
          ...dry,
          durationRange: { min: { type: 'days' as const, count: 1 }, max: { type: 'days' as const, count: 1 } },
        }],
      };
      const result = generateWeather({ climate: 'temperate', weatherTable, currentTime: { day: 2, slot: 3 }, slotsPerDay: 4 });
      expect(result.weather.expiresAt).toEqual({ day: 3, slot: 3 });
      vi.restoreAllMocks();
    });

    it('checks expiration with a non-default slot count', () => {
      const weather: ActiveWeather = {
        weather: { type: 'clear', intensity: 'light', temperature: 'mild', description: '', effects: { ...BASE_WEATHER_EFFECTS.clear } as WeatherEffects },
        startedAt: { day: 1, slot: 0 },
        duration: { type: 'slots', count: 1 },
        expiresAt: { day: 1, slot: 3 },
      };
      expect(isWeatherExpired(weather, { day: 1, slot: 2 }, 4)).toBe(false);
      expect(isWeatherExpired(weather, { day: 1, slot: 3 }, 4)).toBe(true);
    });
  });
});
