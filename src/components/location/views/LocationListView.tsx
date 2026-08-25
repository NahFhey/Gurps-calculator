import type { Location, WeatherTable } from '../../../types/location';
import { getWeatherIcon } from '../../../utils/weatherSystem';

export interface LocationListViewProps {
  locations: Location[];
  currentLocationId?: string | null;
  weatherTablesById: Record<string, WeatherTable>;
  allClimateLabels: Record<string, string>;
  allTerrainLabels: Record<string, string>;
  onTravel: () => void;
  onCreate: () => void;
  onSetCurrent: (locationId: string) => void;
  onRollWeather: (locationId: string) => void;
  onEdit: (location: Location) => void;
  onDelete: (locationId: string) => void;
}

export function LocationListView({
  locations,
  currentLocationId,
  weatherTablesById,
  allClimateLabels,
  allTerrainLabels,
  onTravel,
  onCreate,
  onSetCurrent,
  onRollWeather,
  onEdit,
  onDelete,
}: LocationListViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-100">Locations</h3>
        <div className="flex gap-2">
          {locations.length > 1 && (
            <button
              onClick={onTravel}
              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
            >
              Travel
            </button>
          )}
          <button
            onClick={onCreate}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            + New Location
          </button>
        </div>
      </div>

      {locations.length === 0 ? (
        <p className="text-gray-400 text-sm">No locations defined.</p>
      ) : (
        <div className="space-y-2">
          {locations.map((location) => {
            const climateLabel = allClimateLabels[location.climate] ?? location.climate;
            const terrainLabel = allTerrainLabels[location.terrain] ?? location.terrain;
            const tableName = location.weatherTableId
              ? weatherTablesById[location.weatherTableId]?.name
              : null;

            return (
              <div
                key={location.id}
                className={`p-3 rounded border ${
                  location.id === currentLocationId
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-gray-600 bg-gray-700/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-100">{location.name}</span>
                      {location.id === currentLocationId && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {climateLabel} | {terrainLabel}
                      {tableName && (
                        <span className="text-cyan-400 ml-1">| {tableName}</span>
                      )}
                    </div>
                    {location.currentWeather && (
                      <div className="text-sm text-gray-300 mt-1 flex items-center gap-1">
                        <span>{getWeatherIcon(location.currentWeather.weather.type)}</span>
                        <span>{location.currentWeather.weather.description}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {location.id !== currentLocationId && (
                      <button
                        onClick={() => onSetCurrent(location.id)}
                        className="p-1.5 text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded"
                        title="Set as current location"
                      >
                        Go Here
                      </button>
                    )}
                    <button
                      onClick={() => onRollWeather(location.id)}
                      className="p-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded"
                      title="Roll new weather"
                    >
                      🎲
                    </button>
                    <button
                      onClick={() => onEdit(location)}
                      className="p-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded"
                      title="Edit location"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete(location.id)}
                      className="p-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded"
                      title="Delete location"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
