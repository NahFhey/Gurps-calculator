import { describe, expect, it } from 'vitest';
import { initialCampaignState, type CampaignState } from '../../campaignReducer';
import type {
  Location,
  WeatherTable,
} from '../../../types/location';
import {
  selectLocationsState,
  selectLocationsRecord,
  selectAllLocations,
  selectLocationById,
  selectCurrentLocationId,
  selectCurrentLocation,
  selectLocationCount,
  selectWeatherTablesRecord,
  selectAllWeatherTables,
  selectWeatherTableById,
} from '../locationSelectors';

const forest: Location = {
  id: 'loc-forest',
  name: 'Thornwood Forest',
  climate: 'temperate',
  terrain: 'forest',
  modifiers: { gathering: 1, hunting: 1, foraging: 1, travel: 0 },
  createdAt: 0,
  modifiedAt: 0,
};

const desert: Location = {
  id: 'loc-desert',
  name: 'Sandspire Desert',
  climate: 'arid',
  terrain: 'desert',
  modifiers: { gathering: -1, hunting: 0, foraging: -1, travel: -2 },
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

  });

});
