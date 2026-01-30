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
  TravelAction,
  ActiveWeather
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
// WEATHER SELECTORS
// ============================================================================

/**
 * Select current location's active weather
 */
export const selectCurrentWeather = (state: CampaignState): ActiveWeather | undefined => {
  const location = selectCurrentLocation(state);
  return location?.currentWeather;
};

/**
 * Select weather for a specific location
 */
export const selectWeatherForLocation = (
  state: CampaignState,
  locationId: Id
): ActiveWeather | undefined => {
  const location = state.locations.locations[locationId];
  return location?.currentWeather;
};

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

/**
 * Select weather table for a location
 */
export const selectWeatherTableForLocation = (
  state: CampaignState,
  locationId: Id
): WeatherTable | undefined => {
  const location = state.locations.locations[locationId];
  return location?.weatherTableId
    ? state.locations.weatherTables[location.weatherTableId]
    : undefined;
};

// ============================================================================
// TRAVEL SELECTORS
// ============================================================================

/**
 * Select all active travels
 */
export const selectActiveTravels = (state: CampaignState): TravelAction[] =>
  state.locations.activeTravels;

/**
 * Select a travel by ID
 */
export const selectTravelById = (state: CampaignState, id: Id): TravelAction | undefined =>
  state.locations.activeTravels.find((t) => t.id === id);

/**
 * Select travels by destination
 */
export const selectTravelsByDestination = (
  state: CampaignState,
  destinationId: Id
): TravelAction[] =>
  state.locations.activeTravels.filter((t) => t.toLocationId === destinationId);

/**
 * Select travels by origin
 */
export const selectTravelsByOrigin = (state: CampaignState, originId: Id): TravelAction[] =>
  state.locations.activeTravels.filter((t) => t.fromLocationId === originId);

/**
 * Select active travel count
 */
export const selectActiveTravelCount = (state: CampaignState): number =>
  state.locations.activeTravels.length;

/**
 * Check if party is traveling
 */
export const selectIsPartyTraveling = (state: CampaignState): boolean =>
  state.locations.activeTravels.length > 0;
