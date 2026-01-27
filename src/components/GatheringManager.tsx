import { useState, useMemo, memo } from 'react';
import type {
  GatheringManagerProps,
  GatheringView,
  DeleteConfirmState,
  GatheringSpeciesExtended,
  GatheringToolExtended,
  GatheringTableExtended,
  GatheringEnvironmentExtended,
  GatheringBaitExtended,
  GatheringItemExtended
} from '../types/gathering';

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
 * Decomposed from 1,754 lines to ~180 lines (90% reduction)
 */
function GatheringManagerBase({
  species,
  tools,
  tables,
  environments,
  bait,
  items,
  currentDay,
  foodTypes = [],
  materialTypes = [],
  saveSpecies,
  saveTools,
  saveTables,
  saveEnvironments,
  saveBait,
  saveItems,
  saveCurrentDay
}: GatheringManagerProps) {
  const [view, setView] = useState<GatheringView>('species');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  // Normalize food type names from manager
  const availableFoodTypes = useMemo(() => {
    return foodTypes.map(ft => typeof ft === 'string' ? ft : ft.name);
  }, [foodTypes]);

  // Normalize material type names from manager
  const availableMaterialTypes = useMemo(() => {
    return materialTypes.map(mt => typeof mt === 'string' ? mt : mt.name);
  }, [materialTypes]);

  // Unified delete handler for all views
  function handleDelete(type: string, id: string, name: string) {
    setDeleteConfirm({ type, id, name });
  }

  function executeDelete() {
    if (!deleteConfirm) return;

    switch (deleteConfirm.type) {
      case 'species':
        saveSpecies((species as GatheringSpeciesExtended[]).filter(s => s.id !== deleteConfirm.id));
        break;
      case 'tool':
        saveTools((tools as GatheringToolExtended[]).filter(t => t.id !== deleteConfirm.id));
        break;
      case 'table':
        saveTables((tables as GatheringTableExtended[]).filter(t => t.id !== deleteConfirm.id));
        break;
      case 'environment':
        saveEnvironments((environments as GatheringEnvironmentExtended[]).filter(e => e.id !== deleteConfirm.id));
        break;
      case 'bait':
        saveBait((bait as GatheringBaitExtended[]).filter(b => b.id !== deleteConfirm.id));
        break;
      case 'item':
        saveItems((items as GatheringItemExtended[]).filter(i => i.id !== deleteConfirm.id));
        break;
    }
    setDeleteConfirm(null);
  }

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Delete "{deleteConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={executeDelete} className="px-4 py-2 bg-red-600 rounded">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex gap-2 border-b border-gray-700 pb-2 flex-wrap">
        <button onClick={() => setView('species')} className={`px-3 py-1 rounded ${view === 'species' ? 'bg-blue-600' : 'bg-gray-700'}`}>Species</button>
        <button onClick={() => setView('items')} className={`px-3 py-1 rounded ${view === 'items' ? 'bg-blue-600' : 'bg-gray-700'}`}>Items</button>
        <button onClick={() => setView('tools')} className={`px-3 py-1 rounded ${view === 'tools' ? 'bg-blue-600' : 'bg-gray-700'}`}>Tools</button>
        <button onClick={() => setView('tables')} className={`px-3 py-1 rounded ${view === 'tables' ? 'bg-blue-600' : 'bg-gray-700'}`}>Tables</button>
        <button onClick={() => setView('environments')} className={`px-3 py-1 rounded ${view === 'environments' ? 'bg-blue-600' : 'bg-gray-700'}`}>Environments</button>
        <button onClick={() => setView('bait')} className={`px-3 py-1 rounded ${view === 'bait' ? 'bg-blue-600' : 'bg-gray-700'}`}>Bait</button>
        <button onClick={() => setView('campaign')} className={`px-3 py-1 rounded ${view === 'campaign' ? 'bg-blue-600' : 'bg-gray-700'}`}>Campaign Day</button>
      </div>

      {/* View Router */}
      {view === 'species' && (
        <SpeciesView
          species={species as GatheringSpeciesExtended[]}
          foodTypes={availableFoodTypes}
          saveSpecies={saveSpecies}
          onDelete={handleDelete}
        />
      )}

      {view === 'items' && (
        <ItemsView
          items={items as GatheringItemExtended[]}
          foodTypes={availableFoodTypes}
          materialTypes={availableMaterialTypes}
          saveItems={saveItems}
          onDelete={handleDelete}
        />
      )}

      {view === 'tools' && (
        <ToolsView
          tools={tools as GatheringToolExtended[]}
          foodTypes={availableFoodTypes}
          materialTypes={availableMaterialTypes}
          saveTools={saveTools}
          onDelete={handleDelete}
        />
      )}

      {view === 'tables' && (
        <TablesView
          tables={tables as GatheringTableExtended[]}
          species={species as GatheringSpeciesExtended[]}
          items={items as GatheringItemExtended[]}
          saveTables={saveTables}
          onDelete={handleDelete}
        />
      )}

      {view === 'environments' && (
        <EnvironmentsView
          environments={environments as GatheringEnvironmentExtended[]}
          tables={tables as GatheringTableExtended[]}
          saveEnvironments={saveEnvironments}
          onDelete={handleDelete}
        />
      )}

      {view === 'bait' && (
        <BaitView
          bait={bait as GatheringBaitExtended[]}
          species={species as GatheringSpeciesExtended[]}
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
