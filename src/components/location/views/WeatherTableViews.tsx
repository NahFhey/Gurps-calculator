import type { WeatherTable } from '../../../types/location';
import type { MapModel } from '../../../types/map';
import { WeatherTableEditor } from '../WeatherTableEditor';

export interface WeatherTablesListViewProps {
  maps: MapModel[];
  weatherTables: WeatherTable[];
  onCreate: () => void;
  onEdit: (tableId: string) => void;
  onDelete: (tableId: string) => void;
}

export function WeatherTablesListView({
  maps,
  weatherTables,
  onCreate,
  onEdit,
  onDelete,
}: WeatherTablesListViewProps) {
  const tableUsage: Record<string, string[]> = {};
  for (const map of maps) {
    if (map.weatherTableId) {
      if (!tableUsage[map.weatherTableId]) tableUsage[map.weatherTableId] = [];
      tableUsage[map.weatherTableId].push(map.name);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-100">Weather Tables</h3>
        <button
          onClick={onCreate}
          className="px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded"
        >
          + New Table
        </button>
      </div>

      {weatherTables.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-400 text-sm">No custom weather tables yet.</p>
          <p className="text-gray-500 text-xs mt-1">
            Maps use climate-based defaults. Create a table to customize weather probabilities.
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
                      onClick={() => onEdit(table.id)}
                      className="p-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded"
                      title="Edit table"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete(table.id)}
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
}

export interface WeatherTableFormViewProps {
  table?: WeatherTable;
  onSave: (table: WeatherTable) => void;
  onCancel: () => void;
}

export function WeatherTableFormView({ table, onSave, onCancel }: WeatherTableFormViewProps) {
  return <WeatherTableEditor table={table} onSave={onSave} onCancel={onCancel} />;
}
