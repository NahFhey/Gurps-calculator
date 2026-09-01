import { useState } from 'react';
import { Plus, Save, X, Trash2 } from 'lucide-react';
import type { FoodTypesViewProps } from '../../../types/views';
import type { FoodType } from '../../../types/campaign';

/**
 * FoodTypesView - Manages food type definitions with colors
 *
 * Allows creating, editing, and deleting food types that are used
 * to categorize food items throughout the application.
 */
export function FoodTypesView({ foodTypes, saveFoodTypes, onDelete }: FoodTypesViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#60A5FA');

  function addType() {
    const typeName = newType.trim().toLowerCase();
    if (!typeName) {
      alert('Enter a type name');
      return;
    }

    // Check for duplicates in both old and new format
    const exists = foodTypes.some(ft => (typeof ft === 'string' ? ft : ft.name) === typeName);
    if (exists) {
      alert('Duplicate type');
      return;
    }

    saveFoodTypes([...foodTypes, { name: typeName, color: newTypeColor }]);
    setNewType('');
    setNewTypeColor('#60A5FA');
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Food Types</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-success-600 px-4 py-2 rounded"
        >
          <Plus size={20} className="inline" /> Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-surface-2 p-4 rounded mb-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="Type name"
              className="flex-1 bg-surface-3 px-3 py-2 rounded"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-fg-muted">Color:</label>
              <input
                type="color"
                value={newTypeColor}
                onChange={(e) => setNewTypeColor(e.target.value)}
                className="w-16 h-10 bg-surface-3 rounded cursor-pointer"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addType}
              className="flex-1 bg-success-600 px-4 py-2 rounded"
            >
              <Save size={20} className="inline" /> Save
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="bg-danger-600 px-4 py-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {foodTypes.map(t => {
          const tName = typeof t === 'string' ? t : t.name;
          const tColor = typeof t === 'object' ? (t as FoodType).color : '#60A5FA';

          return (
            <div key={tName} className="flex items-center gap-4 bg-surface-2 p-3 rounded">
              <span
                className="w-6 h-6 rounded-full flex-shrink-0"
                style={{backgroundColor: tColor}}
              />
              <input
                value={tName}
                onChange={(e) => {
                  const v = e.target.value.toLowerCase();
                  const exists = foodTypes.some(ft => {
                    const ftName = typeof ft === 'string' ? ft : ft.name;
                    return ftName === v && ftName !== tName;
                  });
                  if (exists) {
                    alert('Duplicate');
                    return;
                  }

                  saveFoodTypes(foodTypes.map(x => {
                    const xName = typeof x === 'string' ? x : x.name;
                    if (xName === tName) {
                      return typeof x === 'object'
                        ? {...x, name: v}
                        : { name: v, color: '#60A5FA' };
                    }
                    return x;
                  }));
                }}
                className="flex-1 bg-surface-3 px-3 py-1 rounded"
              />
              <input
                type="color"
                value={tColor}
                onChange={(e) => {
                  saveFoodTypes(foodTypes.map(x => {
                    const xName = typeof x === 'string' ? x : x.name;
                    if (xName === tName) {
                      return { name: xName, color: e.target.value };
                    }
                    return x;
                  }));
                }}
                className="w-16 h-8 bg-surface-3 rounded cursor-pointer"
                title="Change color"
              />
              <button
                onClick={() => onDelete('foodType', tName)}
                className="text-danger-400"
              >
                <Trash2 size={20} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
