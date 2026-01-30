/**
 * LocationManager - GM tool for managing locations and weather
 *
 * Part of Phase 5: Location & Weather System
 *
 * Features:
 * - View and manage all locations
 * - Create new locations
 * - Edit location properties
 * - Roll or set weather for locations
 * - Set current location
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
  WeatherType,
  Temperature,
  WeatherIntensity,
  ActiveWeather,
} from '../../types/location';
import {
  CLIMATE_LABELS,
  TERRAIN_LABELS,
  TEMPERATURE_LABELS,
  WEATHER_ICONS,
} from '../../types/location';
import { TravelPanel } from './TravelPanel';
import { ConfirmDialog, useConfirmDialog, useToast } from '../ui';

interface LocationManagerProps {
  onClose?: () => void;
}

type ManagerView = 'list' | 'create' | 'edit' | 'weather' | 'travel';

export function LocationManager({ onClose }: LocationManagerProps) {
  const { state, actions } = useCampaignStore();
  const [view, setView] = useState<ManagerView>('list');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Location>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { warning: showWarning } = useToast();

  const deleteLocationDialog = useConfirmDialog({
    title: 'Delete Location',
    message: 'Are you sure you want to delete this location? This cannot be undone.',
    confirmLabel: 'Delete',
    variant: 'danger',
  });

  const locations = useMemo(
    () => Object.values(state.locations.locations),
    [state.locations.locations]
  );

  const currentLocation = state.locations.currentLocationId
    ? state.locations.locations[state.locations.currentLocationId]
    : null;

  const selectedLocation = selectedLocationId
    ? state.locations.locations[selectedLocationId]
    : null;

  // Create new location
  const handleCreateLocation = () => {
    const id = `loc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const currentTime = { day: state.time.day, slot: state.time.slot };

    const newLocation: Location = {
      id,
      name: editForm.name || 'New Location',
      description: editForm.description,
      climate: (editForm.climate as ClimateType) || 'temperate',
      terrain: (editForm.terrain as TerrainType) || 'plains',
      modifiers: editForm.modifiers || createDefaultLocationModifiers(),
      connections: [],
      currentWeather: generateWeather({
        location: {
          id,
          name: editForm.name || 'New Location',
          climate: (editForm.climate as ClimateType) || 'temperate',
          terrain: (editForm.terrain as TerrainType) || 'plains',
          modifiers: createDefaultLocationModifiers(),
          connections: [],
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        } as Location,
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

  // Update existing location
  const handleUpdateLocation = () => {
    if (!selectedLocationId) return;

    actions.updateLocation(selectedLocationId, {
      name: editForm.name,
      description: editForm.description,
      climate: editForm.climate as ClimateType,
      terrain: editForm.terrain as TerrainType,
      modifiers: editForm.modifiers,
      theme: editForm.theme,
    });

    setEditForm({});
    setSelectedLocationId(null);
    setView('list');
  };

  // Roll new weather for a location
  const handleRollWeather = (locationId: string) => {
    actions.rollNewWeather(locationId);
  };

  // Set location as current
  const handleSetCurrent = (locationId: string) => {
    actions.setCurrentLocation(locationId);
  };

  // Delete location
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

  // Start editing a location
  const handleStartEdit = (location: Location) => {
    setSelectedLocationId(location.id);
    setEditForm({
      name: location.name,
      description: location.description,
      climate: location.climate,
      terrain: location.terrain,
      modifiers: { ...location.modifiers },
      theme: location.theme ? { ...location.theme } : undefined,
    });
    setView('edit');
  };

  // Start creating a new location
  const handleStartCreate = () => {
    setEditForm({
      climate: 'temperate',
      terrain: 'plains',
      modifiers: createDefaultLocationModifiers(),
    });
    setView('create');
  };

  // Render location list view
  const renderList = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
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
          {locations.map((location) => (
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
                    {CLIMATE_LABELS[location.climate]} | {TERRAIN_LABELS[location.terrain]}
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
          ))}
        </div>
      )}
    </div>
  );

  // Render create/edit form
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
              {Object.entries(CLIMATE_LABELS).map(([value, label]) => (
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
              {Object.entries(TERRAIN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 max-w-md">
      {view === 'list' && renderList()}
      {(view === 'create' || view === 'edit') && renderForm()}
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

      {onClose && view !== 'travel' && (
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
        >
          Close
        </button>
      )}

      {/* Delete Location Confirmation Dialog */}
      <ConfirmDialog {...deleteLocationDialog.dialogProps} />
    </div>
  );
}

export default LocationManager;
