import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ASPECTS } from '../../constants';
import { tallyAspects, computeDominantSecondary, getReagentAspectPoints } from '../../utils/alchemy';
import { toNumberOr } from '../../utils/helpers';

export function TallyWorksheetView({ reagents }) {
  const [worksheetItems, setWorksheetItems] = useState([]);

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

  function removeItem(id) {
    setWorksheetItems(worksheetItems.filter(i => i.id !== id));
  }

  function updateItem(id, field, value) {
    setWorksheetItems(worksheetItems.map(i => i.id === id ? {...i, [field]: value} : i));
  }

  // Calculate the tally
  const reagentsMap = new Map(reagents.map(r => [r.id, r]));
  const tally = tallyAspects(worksheetItems.map(item => ({
    reagentId: item.reagentId,
    role: 'active',
    unitsUsed: item.units,
    refinement: item.refinement
  })), reagentsMap);

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
              const tempReagent = reagent ? { ...reagent, refinement: item.refinement } : null;
              const aspectPoints = tempReagent ? getReagentAspectPoints(tempReagent) : {};

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
                      onChange={(e) => updateItem(item.id, 'refinement', e.target.value)}
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

                  {/* Show aspect contribution */}
                  {reagent && (
                    <div className="mt-2 text-xs text-gray-400">
                      Aspects: {reagent.aspects.primary} ({item.refinement === 'crude' ? '3' : item.refinement === 'prepared' ? '3' : '3'})
                      {reagent.aspects.secondary && item.refinement !== 'refined' && `, ${reagent.aspects.secondary} (${item.refinement === 'crude' ? '2' : '2'})`}
                      {reagent.aspects.tertiary && item.refinement === 'crude' && `, ${reagent.aspects.tertiary} (1)`}
                      {' × ' + item.units + ' units = '}
                      {Object.entries(aspectPoints).map(([asp, val]) => `${asp}:${val * item.units}`).join(', ')}
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

            {/* Bar chart visualization */}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 mb-2">Full Breakdown:</div>
              {ASPECTS.map(aspect => {
                const value = tally[aspect] || 0;
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
              })}
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
