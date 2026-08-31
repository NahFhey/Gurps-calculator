/**
 * LocationManager - GM tool for managing locations, weather tables, and climate/terrain
 */

import { useMemo, useState } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import { CLIMATE_LABELS, TERRAIN_LABELS } from '../../types/location';
import type {
  ClimateType,
  Location,
  TerrainType,
  WeatherTable,
} from '../../types/location';
import {
  createDefaultLocationModifiers,
} from '../../utils/weatherSystem';
import { ConfirmDialog, useConfirmDialog, useToast } from '../ui';
import type { LocationManagerProps, ManagerView } from './managerTypes';
import { ClimateView, TerrainView } from './views/ClimateTerrainViews';
import { LocationFormView } from './views/LocationFormView';
import { LocationListView } from './views/LocationListView';
import { ManagerNavigation } from './views/ManagerNavigation';
import { TerrainModifiersEditor } from './views/TerrainModifiersEditor';
import { WeatherModifiersEditor } from './views/WeatherModifiersEditor';
import {
  WeatherTableFormView,
  WeatherTablesListView,
} from './views/WeatherTableViews';

export function LocationManager({ onClose }: LocationManagerProps) {
  const { state, actions } = useCampaignStore();
  const [view, setView] = useState<ManagerView>('list');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Location>>({});
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

  const locations = useMemo(
    () => Object.values(state.locations.locations),
    [state.locations.locations],
  );
  const weatherTables = useMemo(
    () => Object.values(state.locations.weatherTables ?? {}),
    [state.locations.weatherTables],
  );
  const customClimates = state.locations.customClimates ?? [];
  const customTerrains = state.locations.customTerrains ?? [];

  const allClimateLabels = useMemo(() => {
    const labels: Record<string, string> = { ...CLIMATE_LABELS };
    for (const climate of customClimates) labels[climate.key] = climate.label;
    return labels;
  }, [customClimates]);

  const allTerrainLabels = useMemo(() => {
    const labels: Record<string, string> = { ...TERRAIN_LABELS };
    for (const terrain of customTerrains) labels[terrain.key] = terrain.label;
    return labels;
  }, [customTerrains]);

  const editingTable = editingTableId
    ? state.locations.weatherTables?.[editingTableId]
    : undefined;

  const handleCreateLocation = () => {
    const id = `loc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const climate = (editForm.climate as ClimateType) || 'temperate';
    const terrain = (editForm.terrain as TerrainType) || 'plains';

    const newLocation: Location = {
      id,
      name: editForm.name || 'New Location',
      description: editForm.description,
      climate,
      terrain,
      modifiers: editForm.modifiers || createDefaultLocationModifiers(),
      connections: [],
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
      modifiers: editForm.modifiers,
      theme: editForm.theme,
    });
    setEditForm({});
    setSelectedLocationId(null);
    setView('list');
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (locations.length <= 1) {
      showWarning('Cannot delete the last location. Create another location first.');
      return;
    }
    const confirmed = await deleteLocationDialog.confirm();
    if (confirmed) actions.removeLocation(locationId);
  };

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

  const handleStartCreate = () => {
    setEditForm({
      climate: 'temperate',
      terrain: 'plains',
      modifiers: createDefaultLocationModifiers(),
    });
    setView('create');
  };

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
    if (confirmed) actions.removeWeatherTable(tableId);
  };

  const handleCancelForm = () => {
    setView('list');
    setEditForm({});
    setSelectedLocationId(null);
  };

  const handleCancelWeatherTable = () => {
    setEditingTableId(null);
    setView('weatherTables');
  };

  const renderView = () => {
    switch (view) {
      case 'list':
        return (
          <LocationListView
            locations={locations}
            currentLocationId={state.locations.currentLocationId}
            allClimateLabels={allClimateLabels}
            allTerrainLabels={allTerrainLabels}
            onCreate={handleStartCreate}
            onSetCurrent={actions.setCurrentLocation}
            onEdit={handleStartEdit}
            onDelete={handleDeleteLocation}
          />
        );
      case 'create':
      case 'edit':
        return (
          <LocationFormView
            isEdit={view === 'edit'}
            editForm={editForm}
            allClimateLabels={allClimateLabels}
            allTerrainLabels={allTerrainLabels}
            onChange={setEditForm}
            onCancel={handleCancelForm}
            onSubmit={view === 'edit' ? handleUpdateLocation : handleCreateLocation}
          />
        );
      case 'weatherTables':
        return (
          <WeatherTablesListView
            maps={Object.values(state.maps.mapsById)}
            weatherTables={weatherTables}
            onCreate={() => {
              setEditingTableId(null);
              setView('editWeatherTable');
            }}
            onEdit={(tableId) => {
              setEditingTableId(tableId);
              setView('editWeatherTable');
            }}
            onDelete={handleDeleteWeatherTable}
          />
        );
      case 'editWeatherTable':
        return (
          <WeatherTableFormView
            table={editingTable}
            onSave={handleSaveWeatherTable}
            onCancel={handleCancelWeatherTable}
          />
        );
      case 'climates':
        return (
          <ClimateView
            customClimates={customClimates}
            locations={locations}
            onAddClimate={actions.addCustomClimate}
            onRemoveClimate={actions.removeCustomClimate}
          />
        );
      case 'terrain':
        return (
          <TerrainView
            customTerrains={customTerrains}
            locations={locations}
            onAddTerrain={actions.addCustomTerrain}
            onRemoveTerrain={actions.removeCustomTerrain}
          />
        );
      case 'terrainModifiers':
        return (
          <TerrainModifiersEditor
            overrides={state.locations.terrainModifierOverrides ?? {}}
            allTerrainLabels={allTerrainLabels}
            onSave={actions.setTerrainModifierOverrides}
          />
        );
      case 'weatherModifiers':
        return (
          <WeatherModifiersEditor
            overrides={state.locations.weatherEffectOverrides ?? {}}
            onSave={actions.setWeatherEffectOverrides}
          />
        );
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 max-w-md">
      <ManagerNavigation view={view} onChangeView={setView} />
      {renderView()}

      {onClose && view !== 'editWeatherTable' && (
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
        >
          Close
        </button>
      )}

      <ConfirmDialog {...deleteLocationDialog.dialogProps} />
      <ConfirmDialog {...deleteTableDialog.dialogProps} />
    </div>
  );
}

export default LocationManager;
