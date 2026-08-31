/**
 * Location Selectors
 *
 * Centralized selectors for accessing location and weather data from the campaign state.
 */

import type { CampaignState } from '../campaignReducer';
import type {
  Location,
  LocationState,
  WeatherTable,
} from '../../types/location';
import type { Id } from '../../types/campaign';

// ============================================================================
// LOCATION SELECTORS
// ============================================================================

/**
 * Select the full locations state slice
 */
export const selectLocationsState = (state: CampaignState): LocationState => state.locations;

/**
 * Select all locations as a record
 */
export const selectLocationsRecord = (state: CampaignState): Record<Id, Location> =>
  state.locations.locations;

/**
 * Select all locations as an array
 */
export const selectAllLocations = (state: CampaignState): Location[] =>
  Object.values(state.locations.locations);

/**
 * Select a location by ID
 */
export const selectLocationById = (state: CampaignState, id: Id): Location | undefined =>
  state.locations.locations[id];

/**
 * Select current location ID
 */
export const selectCurrentLocationId = (state: CampaignState): Id | null =>
  state.locations.currentLocationId;

/**
 * Select current location
 */
export const selectCurrentLocation = (state: CampaignState): Location | undefined => {
  const id = state.locations.currentLocationId;
  return id ? state.locations.locations[id] : undefined;
};

/**
 * Select location count
 */
export const selectLocationCount = (state: CampaignState): number =>
  Object.keys(state.locations.locations).length;

// ============================================================================
// WEATHER TABLE SELECTORS
// ============================================================================

/**
 * Select all weather tables as a record
 */
export const selectWeatherTablesRecord = (state: CampaignState): Record<Id, WeatherTable> =>
  state.locations.weatherTables;

/**
 * Select all weather tables as an array
 */
export const selectAllWeatherTables = (state: CampaignState): WeatherTable[] =>
  Object.values(state.locations.weatherTables);

/**
 * Select a weather table by ID
 */
export const selectWeatherTableById = (state: CampaignState, id: Id): WeatherTable | undefined =>
  state.locations.weatherTables[id];
