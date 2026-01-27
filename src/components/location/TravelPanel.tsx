/**
 * TravelPanel - Component for traveling between locations
 *
 * Part of Phase 5: Location & Weather System
 *
 * Features:
 * - View available locations
 * - Travel to connected locations
 * - Show travel time and effects
 */

import { useMemo } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import { getWeatherIcon } from '../../utils/weatherSystem';
import { CLIMATE_LABELS, TERRAIN_LABELS } from '../../types/location';
import type { Location } from '../../types/location';

interface TravelPanelProps {
  onClose?: () => void;
}

export function TravelPanel({ onClose }: TravelPanelProps) {
  const { state, actions } = useCampaignStore();

  const currentLocation = state.locations.currentLocationId
    ? state.locations.locations[state.locations.currentLocationId]
    : null;

  const allLocations = useMemo(
    () => Object.values(state.locations.locations),
    [state.locations.locations]
  );

  // Get locations that are connected to current location
  const connectedLocations = useMemo(() => {
    if (!currentLocation) return [];
    return currentLocation.connections.map(conn => ({
      connection: conn,
      location: state.locations.locations[conn.targetLocationId],
    })).filter(item => item.location);
  }, [currentLocation, state.locations.locations]);

  // Get locations that are not connected (for GM quick-travel)
  const otherLocations = useMemo(() => {
    if (!currentLocation) return allLocations;
    const connectedIds = new Set(currentLocation.connections.map(c => c.targetLocationId));
    connectedIds.add(currentLocation.id);
    return allLocations.filter(loc => !connectedIds.has(loc.id));
  }, [currentLocation, allLocations]);

  const handleTravel = (locationId: string) => {
    actions.setCurrentLocation(locationId);
    onClose?.();
  };

  // Format travel time for display
  const formatTravelTime = (slots: number) => {
    if (slots === 1) return '1 slot';
    if (slots < state.time.slotsPerDay) return `${slots} slots`;
    const days = Math.floor(slots / state.time.slotsPerDay);
    const remainingSlots = slots % state.time.slotsPerDay;
    if (remainingSlots === 0) return days === 1 ? '1 day' : `${days} days`;
    return `${days}d ${remainingSlots}s`;
  };

  if (!currentLocation) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-600">
        <p className="text-gray-400">No current location set. Create a location first.</p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 max-w-md">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Travel</h3>

      {/* Current Location */}
      <div className="mb-4 p-3 rounded bg-blue-900/30 border border-blue-700/50">
        <div className="text-xs text-blue-400 mb-1">Current Location</div>
        <div className="font-medium text-gray-100">{currentLocation.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {CLIMATE_LABELS[currentLocation.climate]} | {TERRAIN_LABELS[currentLocation.terrain]}
        </div>
        {currentLocation.currentWeather && (
          <div className="text-sm text-gray-300 mt-1 flex items-center gap-1">
            <span>{getWeatherIcon(currentLocation.currentWeather.weather.type)}</span>
            <span>{currentLocation.currentWeather.weather.description}</span>
          </div>
        )}
      </div>

      {/* Connected Locations */}
      {connectedLocations.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Connected Locations</h4>
          <div className="space-y-2">
            {connectedLocations.map(({ connection, location }) => (
              <div
                key={location.id}
                className="p-3 rounded border border-gray-600 bg-gray-700/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-100">{location.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {CLIMATE_LABELS[location.climate]} | {TERRAIN_LABELS[location.terrain]}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Travel: {formatTravelTime(connection.travelTime)}
                      {connection.travelDifficulty !== 0 && (
                        <span className="ml-2">
                          ({connection.travelDifficulty > 0 ? '+' : ''}{connection.travelDifficulty} difficulty)
                        </span>
                      )}
                    </div>
                    {connection.description && (
                      <div className="text-xs text-gray-400 mt-1 italic">
                        {connection.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleTravel(location.id)}
                    className="ml-2 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                  >
                    Go
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Locations (GM Quick Travel) */}
      {otherLocations.length > 0 && state.ui.gmModeEnabled && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            Other Locations <span className="text-xs text-gray-500">(GM Quick Travel)</span>
          </h4>
          <div className="space-y-2">
            {otherLocations.map((location) => (
              <div
                key={location.id}
                className="p-3 rounded border border-gray-600 bg-gray-700/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-200">{location.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {CLIMATE_LABELS[location.climate]} | {TERRAIN_LABELS[location.terrain]}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTravel(location.id)}
                    className="ml-2 px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-gray-200 rounded"
                  >
                    Teleport
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No other locations message */}
      {connectedLocations.length === 0 && otherLocations.length === 0 && (
        <p className="text-sm text-gray-400 mb-4">
          No other locations to travel to. Create more locations in the Location Manager.
        </p>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
        >
          Close
        </button>
      )}
    </div>
  );
}

export default TravelPanel;
