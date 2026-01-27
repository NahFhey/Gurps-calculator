import type { DaySummaryPanelProps, InventoryDelta } from '../../../types/dayplanner';

/**
 * DaySummaryPanel - Shows pending inventory from completed tasks
 *
 * Displays a summary of all items collected during the current day
 * that will be committed to inventory when the day ends.
 */
export function DaySummaryPanel({ pendingDayLedger }: DaySummaryPanelProps) {
  if (!pendingDayLedger || pendingDayLedger.taskSummaries.length === 0) {
    return null;
  }

  // Group food items
  const foodItems = Object.values(
    pendingDayLedger.pendingInventoryDelta
      .filter((delta): delta is InventoryDelta & { type: 'food' } => delta.type === 'food')
      .reduce<Record<string, InventoryDelta & { type: 'food' }>>((acc, delta) => {
        const key = `${delta.speciesName}-${delta.foodType}`;
        if (!acc[key]) {
          acc[key] = { ...delta, units: 0 };
        }
        acc[key].units += delta.units;
        return acc;
      }, {})
  );

  // Group material items
  const materialItems = Object.values(
    pendingDayLedger.pendingInventoryDelta
      .filter((delta): delta is InventoryDelta & { type: 'material' } => delta.type === 'material')
      .reduce<Record<string, InventoryDelta & { type: 'material' }>>((acc, delta) => {
        const key = `${delta.name}-${delta.materialType}`;
        if (!acc[key]) {
          acc[key] = { ...delta, units: 0 };
        }
        acc[key].units += delta.units;
        return acc;
      }, {})
  );

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-bold mb-2">Pending Day Summary</h3>
      <div className="text-sm text-gray-400 mb-3">
        {pendingDayLedger.taskSummaries.length} task(s) completed
      </div>

      {pendingDayLedger.pendingInventoryDelta.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-300">Pending Inventory:</div>

          {/* Food items */}
          {foodItems.length > 0 && (
            <div className="bg-gray-700 p-2 rounded text-sm">
              <div className="text-gray-400 text-xs mb-1">Food:</div>
              {foodItems.map((item, idx) => (
                <div key={idx} className="text-gray-200">
                  • {item.speciesName}: {item.units} units ({item.foodType})
                </div>
              ))}
            </div>
          )}

          {/* Material items */}
          {materialItems.length > 0 && (
            <div className="bg-gray-700 p-2 rounded text-sm">
              <div className="text-gray-400 text-xs mb-1">Materials:</div>
              {materialItems.map((item, idx) => (
                <div key={idx} className="text-gray-200">
                  • {item.name}: {item.units} units ({item.materialType})
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">No items collected yet</div>
      )}
    </div>
  );
}
