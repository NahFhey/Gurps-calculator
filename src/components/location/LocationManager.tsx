/**
 * LocationManager - GM tool for managing locations, weather tables, and climate/terrain
 *
 * Features:
 * - View and manage all locations
 * - Create new locations with climate, terrain, weather table assignment
 * - Edit location properties
 * - Roll or set weather for locations
 * - Create and edit custom weather tables
 * - Add custom climate and terrain types
 */

import { useState, useMemo } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import {
  generateWeather,
  createDefaultLocationModifiers,
  getWeatherIcon,
} from '../../utils/weatherSystem';
import type {
  Location,
  ClimateType,
  TerrainType,
  WeatherTable,
} from '../../types/location';
import {
  CLIMATE_LABELS,
  TERRAIN_LABELS,
} from '../../types/location';
import { TravelPanel } from './TravelPanel';
import { WeatherTableEditor } from './WeatherTableEditor';
import { ClimateTerrainEditor } from './ClimateTerrainEditor';
import { ConfirmDialog, useConfirmDialog, useToast } from '../ui';

// ============================================================================
// TYPES
// ============================================================================

interface LocationManagerProps {
  onClose?: () => void;
}

type ManagerView =
  | 'list'
  | 'create'
  | 'edit'
  | 'travel'
  | 'weatherTables'
  | 'editWeatherTable'
  | 'climatesTerrain';

// ============================================================================
// COMPONENT
// ============================================================================

export function LocationManager({ onClose }: LocationManagerProps) {
  const { state, actions } = useCampaignStore();
  const [view, setView] = useState<ManagerView>('list');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Location>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  const { warning: showWarning } = useToast();

  const deleteLocationDialog = useConfirmDialog({
    title: 'Delete Location',
    message: 'Are you sure you want to delete this location? This cannot be undone.',
    confirmLabel: 'Delete',
    variant: 'danger',
  });

  const deleteTableDialog = useConfirmDialog({
    title: 'Delete Weather Table',
    message: 'Are you sure you want to delete this weather table? Locations using it will fall back to climate defaults.',
    confirmLabel: 'Delete',
    variant: 'danger',
  });

  // Derived data
  const locations = useMemo(
    () => Object.values(state.locations.locations),
    [state.locations.locations]
  );

  const weatherTables = useMemo(
    () => Object.values(state.locations.weatherTables ?? {}),
    [state.locations.weatherTables]
  );

  const customClimates = state.locations.customClimates ?? [];
  const customTerrains = state.locations.customTerrains ?? [];

  // Merged climate/terrain labels (presets + custom)
  const allClimateLabels: Record<string, string> = useMemo(() => {
    const labels: Record<string, string> = { ...CLIMATE_LABELS };
    for (const c of customClimates) {
      labels[c.key] = c.label;
    }
    return labels;
  }, [customClimates]);

  const allTerrainLabels: Record<string, string> = useMemo(() => {
    const labels: Record<string, string> = { ...TERRAIN_LABELS };
    for (const t of customTerrains) {
      labels[t.key] = t.label;
    }
    return labels;
  }, [customTerrains]);

  const selectedLocation = selectedLocationId
    ? state.locations.locations[selectedLocationId]
    : null;

  const editingTable = editingTableId
    ? state.locations.weatherTables?.[editingTableId]
    : undefined;

  // ========================================================================
  // LOCATION HANDLERS
  // ========================================================================

  const handleCreateLocation = () => {
    const id = `loc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const currentTime = { day: state.time.day, slot: state.time.slot };
    const climate = (editForm.climate as ClimateType) || 'temperate';
    const terrain = (editForm.terrain as TerrainType) || 'plains';

    // Look up weather table if assigned
    const weatherTableId = editForm.weatherTableId;
    const weatherTable = weatherTableId
      ? state.locations.weatherTables?.[weatherTableId]
      : undefined;

    const newLocation: Location = {
      id,
      name: editForm.name || 'New Location',
      description: editForm.description,
      climate,
      terrain,
      weatherTableId,
      modifiers: editForm.modifiers || createDefaultLocationModifiers(),
      connections: [],
      currentWeather: generateWeather({
        location: {
          id,
          name: editForm.name || 'New Location',
          climate,
          terrain,
          modifiers: createDefaultLocationModifiers(),
          connections: [],
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        } as Location,
        weatherTable,
        currentTime,
      }).weather,
      theme: editForm.theme,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    actions.addLocation(newLocation);
    setEditForm({});
    setView('list');
  };

  const handleUpdateLocation = () => {
    if (!selectedLocationId) return;

    actions.updateLocation(selectedLocationId, {
      name: editForm.name,
      description: editForm.description,
      climate: editForm.climate as ClimateType,
      terrain: editForm.terrain as TerrainType,
      weatherTableId: editForm.weatherTableId || undefined,
      modifiers: editForm.modifiers,
      theme: editForm.theme,
    });

    setEditForm({});
    setSelectedLocationId(null);
    setView('list');
  };

  const handleRollWeather = (locationId: string) => {
    actions.rollNewWeather(locationId);
  };

  const handleSetCurrent = (locationId: string) => {
    actions.setCurrentLocation(locationId);
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (locations.length <= 1) {
      showWarning('Cannot delete the last location. Create another location first.');
      return;
    }
    setPendingDeleteId(locationId);
    const confirmed = await deleteLocationDialog.confirm();
    if (confirmed) {
      actions.removeLocation(locationId);
    }
    setPendingDeleteId(null);
  };

  const handleStartEdit = (location: Location) => {
    setSelectedLocationId(location.id);
    setEditForm({
      name: location.name,
      description: location.description,
      climate: location.climate,
      terrain: location.terrain,
      weatherTableId: location.weatherTableId,
      modifiers: { ...location.modifiers },
      theme: location.theme ? { ...location.theme } : undefined,
    });
    setView('edit');
  };

  const handleStartCreate = () => {
    setEditForm({
      climate: 'temperate',
      terrain: 'plains',
      modifiers: createDefaultLocationModifiers(),
    });
    setView('create');
  };

  // ========================================================================
  // WEATHER TABLE HANDLERS
  // ========================================================================

  const handleSaveWeatherTable = (table: WeatherTable) => {
    if (state.locations.weatherTables?.[table.id]) {
      actions.updateWeatherTable(table.id, {
        name: table.name,
        description: table.description,
        entries: table.entries,
      });
    } else {
      actions.addWeatherTable(table);
    }
    setEditingTableId(null);
    setView('weatherTables');
  };

  const handleDeleteWeatherTable = async (tableId: string) => {
    const confirmed = await deleteTableDialog.confirm();
    if (confirmed) {
      actions.removeWeatherTable(tableId);
    }
  };

  const handleEditWeatherTable = (tableId: string) => {
    setEditingTableId(tableId);
    setView('editWeatherTable');
  };

  const handleCreateWeatherTable = () => {
    setEditingTableId(null);
    setView('editWeatherTable');
  };

  // ========================================================================
  // NAVIGATION TABS
  // ========================================================================

  const renderNavTabs = () => {
    const isOnSubView = view === 'list' || view === 'weatherTables' || view === 'climatesTerrain';
    if (!isOnSubView) return null;

    return (
      <div className="flex gap-1 mb-4 border-b border-gray-600 pb-2">
        <button
          onClick={() => setView('list')}
          className={`px-3 py-1.5 text-sm rounded-t ${
            view === 'list'
              ? 'bg-gray-700 text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Locations
        </button>
        <button
          onClick={() => setView('weatherTables')}
          className={`px-3 py-1.5 text-sm rounded-t ${
            view === 'weatherTables'
              ? 'bg-gray-700 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Weather Tables
        </button>
        <button
          onClick={() => setView('climatesTerrain')}
          className={`px-3 py-1.5 text-sm rounded-t ${
            view === 'climatesTerrain'
              ? 'bg-gray-700 text-green-400 border-b-2 border-green-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Climates & Terrain
        </button>
      </div>
    );
  };

  // ========================================================================
  // LOCATION LIST VIEW
  // ========================================================================

  const renderList = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-100">Locations</h3>
        <div className="flex gap-2">
          {locations.length > 1 && (
            <button
              onClick={() => setView('travel')}
              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
            >
              Travel
            </button>
          )}
          <button
            onClick={handleStartCreate}
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
              ? state.locations.weatherTables?.[location.weatherTableId]?.name
              : null;

            return (
              <div
                key={location.id}
                className={`p-3 rounded border ${
                  location.id === state.locations.currentLocationId
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-gray-600 bg-gray-700/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-100">{location.name}</span>
                      {location.id === state.locations.currentLocationId && (
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
                    {location.id !== state.locations.currentLocationId && (
                      <button
                        onClick={() => handleSetCurrent(location.id)}
                        className="p-1.5 text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded"
                        title="Set as current location"
                      >
                        Go Here
                      </button>
                    )}
                    <button
                      onClick={() => handleRollWeather(location.id)}
                      className="p-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded"
                      title="Roll new weather"
                    >
                      🎲
                    </button>
                    <button
                      onClick={() => handleStartEdit(location)}
                      className="p-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded"
                      title="Edit location"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(location.id)}
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

  // ========================================================================
  // LOCATION CREATE/EDIT FORM
  // ========================================================================

  const renderForm = () => {
    const isEdit = view === 'edit';
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">
            {isEdit ? 'Edit Location' : 'Create Location'}
          </h3>
          <button
            onClick={() => {
              setView('list');
              setEditForm({});
              setSelectedLocationId(null);
            }}
            className="text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={editForm.name || ''}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              placeholder="Location name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={editForm.description || ''}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              rows={2}
              placeholder="Optional description"
            />
          </div>

          {/* Climate */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Climate</label>
            <select
              value={editForm.climate || 'temperate'}
              onChange={(e) => setEditForm({ ...editForm, climate: e.target.value as ClimateType })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
            >
              {Object.entries(allClimateLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Terrain */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Terrain</label>
            <select
              value={editForm.terrain || 'plains'}
              onChange={(e) => setEditForm({ ...editForm, terrain: e.target.value as TerrainType })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
            >
              {Object.entries(allTerrainLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Weather Table */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Weather Table</label>
            <select
              value={editForm.weatherTableId || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, weatherTableId: e.target.value || undefined })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
            >
              <option value="">Use climate default</option>
              {weatherTables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Custom tables override the default weather probabilities for this location's climate
            </p>
          </div>

          {/* Modifiers */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Location Modifiers</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Gathering</label>
                <input
                  type="number"
                  value={editForm.modifiers?.gathering ?? 0}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      modifiers: {
                        ...createDefaultLocationModifiers(),
                        ...editForm.modifiers,
                        gathering: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Hunting</label>
                <input
                  type="number"
                  value={editForm.modifiers?.hunting ?? 0}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      modifiers: {
                        ...createDefaultLocationModifiers(),
                        ...editForm.modifiers,
                        hunting: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Foraging</label>
                <input
                  type="number"
                  value={editForm.modifiers?.foraging ?? 0}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      modifiers: {
                        ...createDefaultLocationModifiers(),
                        ...editForm.modifiers,
                        foraging: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Travel</label>
                <input
                  type="number"
                  value={editForm.modifiers?.travel ?? 0}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      modifiers: {
                        ...createDefaultLocationModifiers(),
                        ...editForm.modifiers,
                        travel: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={isEdit ? handleUpdateLocation : handleCreateLocation}
            disabled={!editForm.name?.trim()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
          >
            {isEdit ? 'Save Changes' : 'Create Location'}
          </button>
        </div>
      </div>
    );
  };

  // ========================================================================
  // WEATHER TABLES LIST VIEW
  // ========================================================================

  const renderWeatherTablesList = () => {
    // Find which locations use each table
    const tableUsage: Record<string, string[]> = {};
    for (const loc of locations) {
      if (loc.weatherTableId) {
        if (!tableUsage[loc.weatherTableId]) tableUsage[loc.weatherTableId] = [];
        tableUsage[loc.weatherTableId].push(loc.name);
      }
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-100">Weather Tables</h3>
          <button
            onClick={handleCreateWeatherTable}
            className="px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded"
          >
            + New Table
          </button>
        </div>

        {weatherTables.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-400 text-sm">No custom weather tables yet.</p>
            <p className="text-gray-500 text-xs mt-1">
              Locations use climate-based defaults. Create a table to customize weather probabilities.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {weatherTables.map((table) => {
              const usedBy = tableUsage[table.id] ?? [];
              return (
                <div
                  key={table.id}
                  className="p-3 rounded border border-gray-600 bg-gray-700/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-100">{table.name}</span>
                      {table.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{table.description}</p>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {table.entries.length} {table.entries.length === 1 ? 'entry' : 'entries'}
                        {usedBy.length > 0 && (
                          <span className="text-cyan-400 ml-2">
                            Used by: {usedBy.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleEditWeatherTable(table.id)}
                        className="p-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded"
                        title="Edit table"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteWeatherTable(table.id)}
                        className="p-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded"
                        title="Delete table"
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
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 max-w-md">
      {/* Navigation tabs for top-level views */}
      {renderNavTabs()}

      {/* Location list */}
      {view === 'list' && renderList()}

      {/* Location create/edit form */}
      {(view === 'create' || view === 'edit') && renderForm()}

      {/* Travel view */}
      {view === 'travel' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-100">Travel</h3>
            <button
              onClick={() => setView('list')}
              className="text-gray-400 hover:text-gray-200"
            >
              Back
            </button>
          </div>
          <TravelPanel onClose={() => setView('list')} />
        </div>
      )}

      {/* Weather tables list */}
      {view === 'weatherTables' && renderWeatherTablesList()}

      {/* Weather table editor */}
      {view === 'editWeatherTable' && (
        <WeatherTableEditor
          table={editingTable}
          onSave={handleSaveWeatherTable}
          onCancel={() => {
            setEditingTableId(null);
            setView('weatherTables');
          }}
        />
      )}

      {/* Climate & Terrain editor */}
      {view === 'climatesTerrain' && (
        <ClimateTerrainEditor
          customClimates={customClimates}
          customTerrains={customTerrains}
          locations={locations}
          onAddClimate={(key, label) => actions.addCustomClimate(key, label)}
          onRemoveClimate={(key) => actions.removeCustomClimate(key)}
          onAddTerrain={(key, label) => actions.addCustomTerrain(key, label)}
          onRemoveTerrain={(key) => actions.removeCustomTerrain(key)}
          onBack={() => setView('list')}
        />
      )}

      {/* Close button (not shown for travel or sub-editors) */}
      {onClose && !['travel', 'editWeatherTable'].includes(view) && (
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
        >
          Close
        </button>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog {...deleteLocationDialog.dialogProps} />
      <ConfirmDialog {...deleteTableDialog.dialogProps} />
    </div>
  );
}

export default LocationManager;
