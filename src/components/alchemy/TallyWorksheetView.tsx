import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { REFINEMENT_LEVELS } from '../../constants';
import { computeDominantSecondary } from '../../utils/alchemy';
import { toNumberOr } from '../../utils/helpers';
import type { AlchemyReagent } from '../../types/views';

// ============================================================================
// TYPES
// ============================================================================

type RefinementLevel = 'crude' | 'prepared' | 'refined';

interface WorksheetItem {
  id: string;
  reagentId: string;
  units: number;
  refinement: RefinementLevel;
}

interface AspectPoints {
  [aspect: string]: number;
}

interface AspectTally {
  [aspect: string]: number;
}

export interface TallyWorksheetViewProps {
  reagents: AlchemyReagent[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get aspect points respecting identification level
 */
function getKnownAspectPoints(reagent: AlchemyReagent, refinement: RefinementLevel): AspectPoints {
  if (!reagent.aspects?.primary) return {};

  const identificationLevel = reagent.identificationLevel || 0;
  const activeSlots = REFINEMENT_LEVELS[refinement] || REFINEMENT_LEVELS.crude;
  const points: AspectPoints = {};

  // Use false profile if it exists, otherwise use real data
  const profile = reagent.falseProfile || reagent;
  const aspects = profile.aspects;

  if (!aspects) return {};

  // Primary (3pts) - known at level 1+
  if (identificationLevel >= 1 && activeSlots.includes('primary') && aspects.primary) {
    points[aspects.primary] = (points[aspects.primary] || 0) + 3;
  }

  // Secondary (2pts) - known at level 2+
  if (identificationLevel >= 2 && activeSlots.includes('secondary') && aspects.secondary) {
    points[aspects.secondary] = (points[aspects.secondary] || 0) + 2;
  }

  // Tertiary (1pt) - known at level 3+
  if (identificationLevel >= 3 && activeSlots.includes('tertiary') && aspects.tertiary) {
    points[aspects.tertiary] = (points[aspects.tertiary] || 0) + 1;
  }

  return points;
}

/**
 * Tally aspects from worksheet items (respecting identification)
 */
function tallyKnownAspects(items: WorksheetItem[], reagentsMap: Map<string, AlchemyReagent>): AspectTally {
  const tally: AspectTally = {};

  items.forEach(item => {
    const reagent = reagentsMap.get(item.reagentId);
    if (!reagent) return;

    const points = getKnownAspectPoints(reagent, item.refinement);

    Object.keys(points).forEach(aspect => {
      if (aspect) {
        tally[aspect] = (tally[aspect] || 0) + (points[aspect] * item.units);
      }
    });
  });

  return tally;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TallyWorksheetView({ reagents }: TallyWorksheetViewProps) {
  const [worksheetItems, setWorksheetItems] = useState<WorksheetItem[]>([]);

  function addItem() {
    if (reagents.length === 0) {
      alert('No reagents available!');
      return;
    }

    setWorksheetItems([...worksheetItems, {
      id: crypto.randomUUID(),
      reagentId: reagents[0].id,
      units: 1,
      refinement: 'crude'
    }]);
  }

  function removeItem(id: string) {
    setWorksheetItems(worksheetItems.filter(i => i.id !== id));
  }

  function updateItem(id: string, field: keyof WorksheetItem, value: string | number) {
    setWorksheetItems(worksheetItems.map(i => i.id === id ? {...i, [field]: value} : i));
  }

  // Calculate the tally using known aspects only
  const reagentsMap = new Map(reagents.map(r => [r.id, r]));
  const tally = tallyKnownAspects(worksheetItems, reagentsMap);

  const { dominant, dominantValue, secondary, secondaryValue } = computeDominantSecondary(tally);

  // Sort aspects by value for display
  const sortedTally = Object.entries(tally).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">Aspect Tally Worksheet</h2>
          <p className="text-sm text-gray-400">Build and preview aspect tallies for formula planning</p>
        </div>
        <button onClick={addItem} className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded">
          <Plus size={20} /> Add Reagent
        </button>
      </div>

      {/* Info box about identification */}
      <div className="mb-4 bg-blue-900 bg-opacity-30 border border-blue-500 p-3 rounded text-sm">
        <div className="font-semibold mb-1">Identification-Based Tally</div>
        <div className="text-xs text-gray-300">
          This worksheet only shows <strong>identified aspects</strong> based on each reagent's identification level.
          Use the <strong>Analysis</strong> tab to identify reagents and reveal their aspects before adding them to your tally.
        </div>
      </div>

      {worksheetItems.length === 0 && (
        <div className="text-gray-500 text-center py-8">
          No reagents added yet. Click "Add Reagent" to start building your tally.
        </div>
      )}

      {worksheetItems.length > 0 && (
        <div className="space-y-4">
          {/* Reagent List */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">Reagents</h3>
            {worksheetItems.map(item => {
              const reagent = reagentsMap.get(item.reagentId);
              const aspectPoints = reagent ? getKnownAspectPoints(reagent, item.refinement) : {};

              return (
                <div key={item.id} className="bg-gray-700 p-3 rounded">
                  <div className="grid grid-cols-4 gap-2">
                    <select
                      value={item.reagentId}
                      onChange={(e) => updateItem(item.id, 'reagentId', e.target.value)}
                      className="bg-gray-600 px-3 py-2 rounded text-sm"
                    >
                      {reagents.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.quantity}U)
                        </option>
                      ))}
                    </select>

                    <select
                      value={item.refinement}
                      onChange={(e) => updateItem(item.id, 'refinement', e.target.value as RefinementLevel)}
                      className="bg-gray-600 px-3 py-2 rounded text-sm"
                    >
                      <option value="crude">Crude</option>
                      <option value="prepared">Prepared</option>
                      <option value="refined">Refined</option>
                    </select>

                    <input
                      type="number"
                      min="1"
                      value={item.units}
                      onChange={(e) => updateItem(item.id, 'units', Math.max(1, toNumberOr(e.target.value, 1)))}
                      className="bg-gray-600 px-3 py-2 rounded text-sm"
                      placeholder="Units"
                    />

                    <button
                      onClick={() => removeItem(item.id)}
                      className="bg-red-600 px-3 py-2 rounded text-sm"
                    >
                      <Trash2 size={16} className="inline" />
                    </button>
                  </div>

                  {/* Show aspect contribution (only known aspects) */}
                  {reagent && (
                    <div className="mt-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded ${
                          (reagent.identificationLevel || 0) === 0 ? 'bg-red-600' :
                          (reagent.identificationLevel || 0) >= 4 ? 'bg-green-600' :
                          'bg-yellow-600'
                        }`}>
                          ID: Level {reagent.identificationLevel || 0}
                        </span>
                        {Object.keys(aspectPoints).length === 0 ? (
                          <span className="text-gray-500">Unknown aspects - identify reagent first</span>
                        ) : (
                          <span className="text-gray-400">
                            Known aspects: {Object.entries(aspectPoints).map(([asp, val]) => `${asp}:${val * item.units}`).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tally Results */}
          <div className="bg-gray-700 p-4 rounded">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Aspect Tally Results</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-xs text-gray-400 mb-1">Dominant Aspect</div>
                <div className="text-lg font-bold text-blue-400">
                  {dominant || 'None'} {dominantValue > 0 && `(${dominantValue})`}
                </div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-xs text-gray-400 mb-1">Secondary Aspect</div>
                <div className="text-lg font-bold text-blue-400">
                  {secondary || 'None'} {secondaryValue > 0 && `(${secondaryValue})`}
                </div>
              </div>
            </div>

            {/* Bar chart visualization - only show known aspects */}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 mb-2">
                Full Breakdown (Known Aspects Only):
              </div>
              {sortedTally.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  No aspects identified yet. Identify reagents to see their aspects.
                </div>
              ) : (
                sortedTally.map(([aspect, value]) => {
                  const maxValue = Math.max(...Object.values(tally), 1);
                  const percentage = (value / maxValue) * 100;

                  return (
                    <div key={aspect} className="flex items-center gap-2">
                      <div className="w-16 text-xs text-gray-300">{aspect}</div>
                      <div className="flex-1 bg-gray-600 rounded-full h-6 relative">
                        <div
                          className={`h-6 rounded-full ${
                            aspect === dominant ? 'bg-blue-500' :
                            aspect === secondary ? 'bg-blue-400' :
                            'bg-gray-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                          {value}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Summary */}
            {sortedTally.length > 0 && (
              <div className="mt-4 text-xs text-gray-400 bg-gray-800 p-2 rounded">
                Total: {Object.entries(tally).map(([asp, val]) => `${asp}:${val}`).join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
