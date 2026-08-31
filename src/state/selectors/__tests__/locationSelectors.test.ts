import { describe, expect, it } from 'vitest';
import { initialCampaignState, type CampaignState } from '../../campaignReducer';
import type {
  Location,
  WeatherTable,
  ActiveWeather,
  Weather,
  WeatherEffects,
} from '../../../types/location';
import {
  selectLocationsState,
  selectLocationsRecord,
  selectAllLocations,
  selectLocationById,
  selectCurrentLocationId,
  selectCurrentLocation,
  selectLocationCount,
  selectCurrentWeather,
  selectWeatherForLocation,
  selectWeatherTablesRecord,
  selectAllWeatherTables,
  selectWeatherTableById,
  selectWeatherTableForLocation,
} from '../locationSelectors';

const emptyEffects: WeatherEffects = {
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

const clearWeather: Weather = {
  type: 'clear',
  intensity: 'light',
  temperature: 'mild',
  description: 'Clear skies',
  effects: emptyEffects,
};

const rainWeather: Weather = {
  type: 'rain',
  intensity: 'moderate',
  temperature: 'cool',
  description: 'Steady rain',
  effects: emptyEffects,
};

const activeClear: ActiveWeather = {
  weather: clearWeather,
  startedAt: { day: 1, slot: 0 },
  duration: { type: 'slots', count: 6 },
};

const activeRain: ActiveWeather = {
  weather: rainWeather,
  startedAt: { day: 1, slot: 0 },
  duration: { type: 'slots', count: 4 },
};

const forest: Location = {
  id: 'loc-forest',
  name: 'Thornwood Forest',
  climate: 'temperate',
  terrain: 'forest',
  weatherTableId: 'wt-forest',
  currentWeather: activeClear,
  modifiers: { gathering: 1, hunting: 1, foraging: 1, travel: 0 },
  connections: [],
  createdAt: 0,
  modifiedAt: 0,
};

const desert: Location = {
  id: 'loc-desert',
  name: 'Sandspire Desert',
  climate: 'arid',
  terrain: 'desert',
  // No weatherTableId — exercises that branch
  currentWeather: activeRain,
  modifiers: { gathering: -1, hunting: 0, foraging: -1, travel: -2 },
  connections: [],
  createdAt: 0,
  modifiedAt: 0,
};

const forestTable: WeatherTable = {
  id: 'wt-forest',
  name: 'Temperate Forest',
  entries: [],
};

const desertTable: WeatherTable = {
  id: 'wt-desert',
  name: 'Arid Desert',
  entries: [],
};

const buildState = (): CampaignState => ({
  ...initialCampaignState,
  locations: {
    currentLocationId: 'loc-forest',
    locations: {
      'loc-forest': forest,
      'loc-desert': desert,
    },
    weatherTables: {
      'wt-forest': forestTable,
      'wt-desert': desertTable,
    },
  },
});

describe('locationSelectors', () => {
  describe('location selectors', () => {
    it('selectLocationsState returns the full slice', () => {
      const state = buildState();
      expect(selectLocationsState(state)).toBe(state.locations);
    });

    it('selectLocationsRecord returns the locations record', () => {
      const state = buildState();
      expect(selectLocationsRecord(state)).toEqual({
        'loc-forest': forest,
        'loc-desert': desert,
      });
    });

    it('selectAllLocations returns an array of locations', () => {
      const all = selectAllLocations(buildState());
      expect(all).toHaveLength(2);
      expect(all).toContain(forest);
      expect(all).toContain(desert);
    });

    it('selectLocationById returns the matching location or undefined', () => {
      const state = buildState();
      expect(selectLocationById(state, 'loc-forest')).toBe(forest);
      expect(selectLocationById(state, 'missing')).toBeUndefined();
    });

    it('selectCurrentLocationId returns the current id', () => {
      expect(selectCurrentLocationId(buildState())).toBe('loc-forest');
    });

    it('selectCurrentLocation returns the current location', () => {
      expect(selectCurrentLocation(buildState())).toBe(forest);
    });

    it('selectCurrentLocation returns undefined when no current id is set', () => {
      const state = buildState();
      state.locations.currentLocationId = null;
      expect(selectCurrentLocation(state)).toBeUndefined();
    });

    it('selectLocationCount returns the number of locations', () => {
      expect(selectLocationCount(buildState())).toBe(2);
    });

    it('selectLocationCount returns 0 when there are no locations', () => {
      const state = buildState();
      state.locations.locations = {};
      expect(selectLocationCount(state)).toBe(0);
    });
  });

  describe('weather selectors', () => {
    it('selectCurrentWeather returns the active weather for the current location', () => {
      expect(selectCurrentWeather(buildState())).toBe(activeClear);
    });

    it('selectCurrentWeather returns undefined when there is no current location', () => {
      const state = buildState();
      state.locations.currentLocationId = null;
      expect(selectCurrentWeather(state)).toBeUndefined();
    });

    it('selectWeatherForLocation returns the weather for a given location', () => {
      expect(selectWeatherForLocation(buildState(), 'loc-desert')).toBe(activeRain);
    });

    it('selectWeatherForLocation returns undefined for an unknown location', () => {
      expect(selectWeatherForLocation(buildState(), 'missing')).toBeUndefined();
    });
  });

  describe('weather table selectors', () => {
    it('selectWeatherTablesRecord returns the tables record', () => {
      expect(selectWeatherTablesRecord(buildState())).toEqual({
        'wt-forest': forestTable,
        'wt-desert': desertTable,
      });
    });

    it('selectAllWeatherTables returns an array of tables', () => {
      const all = selectAllWeatherTables(buildState());
      expect(all).toHaveLength(2);
      expect(all).toContain(forestTable);
      expect(all).toContain(desertTable);
    });

    it('selectWeatherTableById returns the matching table or undefined', () => {
      const state = buildState();
      expect(selectWeatherTableById(state, 'wt-forest')).toBe(forestTable);
      expect(selectWeatherTableById(state, 'missing')).toBeUndefined();
    });

    it('selectWeatherTableForLocation returns the table assigned to a location', () => {
      expect(selectWeatherTableForLocation(buildState(), 'loc-forest')).toBe(forestTable);
    });

    it('selectWeatherTableForLocation returns undefined when the location has no table', () => {
      expect(selectWeatherTableForLocation(buildState(), 'loc-desert')).toBeUndefined();
    });

    it('selectWeatherTableForLocation returns undefined for an unknown location', () => {
      expect(selectWeatherTableForLocation(buildState(), 'missing')).toBeUndefined();
    });
  });

});
