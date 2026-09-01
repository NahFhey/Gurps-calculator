import { useState, useMemo, useCallback, memo } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';
import type {
  GatheringView,
  DeleteConfirmState,
  GatheringSpeciesExtended,
  GatheringToolExtended,
  GatheringTableExtended,
  GatheringEnvironmentExtended,
  GatheringBaitExtended,
  GatheringItemExtended
} from '../types/gathering';
import type { ForageZoneProfile } from '../types/foraging';
import { ConfirmDialog } from './ui/ConfirmDialog';

import {
  CampaignDayView,
  SpeciesView,
  ItemsView,
  ToolsView,
  TablesView,
  EnvironmentsView,
  BaitView
} from './gathering/views';

/**
 * GatheringManager Component - Manages gathering system configuration
 * Memoized to prevent re-renders from unrelated tab changes
 *
 * This component is a thin router that delegates to view components for:
 * - Species (fish and other gatherable creatures)
 * - Items (forageable items)
 * - Tools (fishing rods, nets, spears)
 * - Tables (catch tables, event tables)
 * - Environments (locations with table mappings)
 * - Bait (consumables)
 * - Campaign day tracking
 *
 * MIGRATED: Now uses useCampaignStore directly instead of props.
 * Decomposed from 1,754 lines to ~180 lines (90% reduction)
 */
function GatheringManagerBase() {
  const { state, actions } = useCampaignStore();
  const [view, setView] = useState<GatheringView>('species');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  // Derive data from normalized state
  const species = useMemo(() =>
    denormalizeObject(state.entities.gatheringSpecies || {}),
    [state.entities.gatheringSpecies]
  );

  const tools = useMemo(() =>
    denormalizeObject(state.entities.gatheringTools || {}),
    [state.entities.gatheringTools]
  );

  const tables = useMemo(() =>
    denormalizeObject(state.entities.gatheringTables || {}),
    [state.entities.gatheringTables]
  );

  const environments = useMemo(() =>
    denormalizeObject(state.entities.gatheringEnvironments || {}),
    [state.entities.gatheringEnvironments]
  );

  const bait = useMemo(() =>
    denormalizeObject(state.entities.gatheringBait || {}),
    [state.entities.gatheringBait]
  );

  const items = useMemo(() =>
    denormalizeObject(state.entities.gatheringItems || {}),
    [state.entities.gatheringItems]
  );

  const forageZoneProfiles = useMemo(() =>
    Object.values(state.entities.forageZoneProfiles || {}) as ForageZoneProfile[],
    [state.entities.forageZoneProfiles]
  );

  const currentDay = state.time.day;

  // Extract locations for environment editor (linking environments to locations)
  const locations = useMemo(() => {
    const locs = state.locations?.locations;
    if (!locs) return [];
    return Object.values(locs).map((loc: any) => ({ id: loc.id, name: loc.name }));
  }, [state.locations?.locations]);

  // Get food and material types from state
  const foodTypes = state.entities.foodTypes || [];
  const materialTypes = state.entities.materialTypes || [];

  // Normalize food type names
  const availableFoodTypes = useMemo(() => {
    if (!Array.isArray(foodTypes)) return [];
    return foodTypes.map((ft: any) => typeof ft === 'string' ? ft : ft.name);
  }, [foodTypes]);

  // Normalize material type names
  const availableMaterialTypes = useMemo(() => {
    if (!Array.isArray(materialTypes)) return [];
    return materialTypes.map((mt: any) => typeof mt === 'string' ? mt : mt.name);
  }, [materialTypes]);

  // Save callbacks that normalize arrays back to records
  const saveSpecies = useCallback((speciesArray: GatheringSpeciesExtended[]) => {
    actions.setGatheringSpecies(normalizeArray(speciesArray));
  }, [actions]);

  const saveTools = useCallback((toolsArray: GatheringToolExtended[]) => {
    actions.setGatheringTools(normalizeArray(toolsArray));
  }, [actions]);

  const saveTables = useCallback((tablesArray: GatheringTableExtended[]) => {
    actions.setGatheringTables(normalizeArray(tablesArray));
  }, [actions]);

  const saveEnvironments = useCallback((environmentsArray: GatheringEnvironmentExtended[]) => {
    actions.setGatheringEnvironments(normalizeArray(environmentsArray));
  }, [actions]);

  const saveBait = useCallback((baitArray: GatheringBaitExtended[]) => {
    actions.setGatheringBait(normalizeArray(baitArray));
  }, [actions]);

  const saveItems = useCallback((itemsArray: GatheringItemExtended[]) => {
    actions.setGatheringItems(normalizeArray(itemsArray));
  }, [actions]);

  const saveForageZoneProfile = useCallback((profile: ForageZoneProfile) => {
    // Upsert: add or update a forage zone profile
    actions.addForageZoneProfile(profile);
  }, [actions]);

  const removeForageZoneProfile = useCallback((id: string) => {
    actions.removeForageZoneProfile(id);
  }, [actions]);

  const saveCurrentDay = useCallback((_day: number) => {
    // Update time.day - we need to dispatch a time update action
    // Note: The time system is managed elsewhere, this is kept for API compatibility
  }, []);

  // Unified delete handler for all views
  function handleDelete(type: string, id: string, name: string) {
    setDeleteConfirm({ type, id, name });
  }

  function executeDelete() {
    if (!deleteConfirm) return;

    switch (deleteConfirm.type) {
      case 'species':
        saveSpecies(species.filter(s => s.id !== deleteConfirm.id));
        break;
      case 'tool':
        saveTools(tools.filter(t => t.id !== deleteConfirm.id));
        break;
      case 'table':
        saveTables(tables.filter(t => t.id !== deleteConfirm.id));
        break;
      case 'environment':
        saveEnvironments(environments.filter(e => e.id !== deleteConfirm.id));
        break;
      case 'bait':
        saveBait(bait.filter(b => b.id !== deleteConfirm.id));
        break;
      case 'item':
        saveItems(items.filter(i => i.id !== deleteConfirm.id));
        break;
    }
    setDeleteConfirm(null);
  }

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Confirm Delete"
        message={deleteConfirm ? `Delete "${deleteConfirm.name}"?` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Sub-navigation */}
      <div className="flex gap-2 border-b border-edge pb-2 flex-wrap">
        <button onClick={() => setView('species')} className={`px-3 py-1 rounded ${view === 'species' ? 'bg-accent-600' : 'bg-surface-2'}`}>Species</button>
        <button onClick={() => setView('items')} className={`px-3 py-1 rounded ${view === 'items' ? 'bg-accent-600' : 'bg-surface-2'}`}>Items</button>
        <button onClick={() => setView('tools')} className={`px-3 py-1 rounded ${view === 'tools' ? 'bg-accent-600' : 'bg-surface-2'}`}>Tools</button>
        <button onClick={() => setView('tables')} className={`px-3 py-1 rounded ${view === 'tables' ? 'bg-accent-600' : 'bg-surface-2'}`}>Tables</button>
        <button onClick={() => setView('environments')} className={`px-3 py-1 rounded ${view === 'environments' ? 'bg-accent-600' : 'bg-surface-2'}`}>Environments</button>
        <button onClick={() => setView('bait')} className={`px-3 py-1 rounded ${view === 'bait' ? 'bg-accent-600' : 'bg-surface-2'}`}>Bait</button>
        <button onClick={() => setView('campaign')} className={`px-3 py-1 rounded ${view === 'campaign' ? 'bg-accent-600' : 'bg-surface-2'}`}>Campaign Day</button>
      </div>

      {/* View Router */}
      {view === 'species' && (
        <SpeciesView
          species={species}
          foodTypes={availableFoodTypes}
          saveSpecies={saveSpecies}
          onDelete={handleDelete}
        />
      )}

      {view === 'items' && (
        <ItemsView
          items={items}
          foodTypes={availableFoodTypes}
          materialTypes={availableMaterialTypes}
          saveItems={saveItems}
          onDelete={handleDelete}
        />
      )}

      {view === 'tools' && (
        <ToolsView
          tools={tools}
          foodTypes={availableFoodTypes}
          materialTypes={availableMaterialTypes}
          saveTools={saveTools}
          onDelete={handleDelete}
        />
      )}

      {view === 'tables' && (
        <TablesView
          tables={tables}
          species={species}
          items={items}
          saveTables={saveTables}
          onDelete={handleDelete}
        />
      )}

      {view === 'environments' && (
        <EnvironmentsView
          environments={environments}
          tables={tables}
          items={items}
          locations={locations}
          forageZoneProfiles={forageZoneProfiles}
          saveEnvironments={saveEnvironments}
          saveForageZoneProfile={saveForageZoneProfile}
          removeForageZoneProfile={removeForageZoneProfile}
          onDelete={handleDelete}
        />
      )}

      {view === 'bait' && (
        <BaitView
          bait={bait}
          species={species}
          saveBait={saveBait}
          onDelete={handleDelete}
        />
      )}

      {view === 'campaign' && (
        <CampaignDayView
          currentDay={currentDay}
          saveCurrentDay={saveCurrentDay}
        />
      )}
    </div>
  );
}

export const GatheringManager = memo(GatheringManagerBase);
