/**
 * WeatherTableEditor - GM tool for creating and editing weather tables
 *
 * Manages a list of WeatherTableEntry items with probability weights,
 * temperature ranges, intensity weights, and duration ranges.
 */

import { useState, useMemo } from 'react';
import { Trash2, Plus } from 'lucide-react';
import {
  WEATHER_ICONS,
  WEATHER_LABELS,
  TEMPERATURE_LABELS,
} from '../../types/location';
import type {
  WeatherTable,
  WeatherTableEntry,
  WeatherType,
  Temperature,
  WeatherDuration,
} from '../../types/location';

// ============================================================================
// CONSTANTS
// ============================================================================

/** All weather types for the dropdown */
const WEATHER_TYPES: WeatherType[] = [
  'clear', 'partlyCloudy', 'overcast',
  'lightRain', 'rain', 'heavyRain', 'thunderstorm',
  'fog', 'mist',
  'snow', 'blizzard', 'hail',
  'sandstorm', 'wind', 'heatwave', 'coldSnap',
];

/** Temperature ordering (coldest to hottest) */
const TEMPERATURE_ORDER: Temperature[] = [
  'extreme_cold', 'freezing', 'cold', 'cool', 'mild', 'warm', 'hot', 'extreme_heat',
];

// ============================================================================
// TYPES
// ============================================================================

interface WeatherTableEditorProps {
  /** Existing table to edit, or undefined for create mode */
  table?: WeatherTable;
  /** Called when the user saves the table */
  onSave: (table: WeatherTable) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

/** Default new entry values */
function createDefaultEntry(): WeatherTableEntry {
  return {
    weather: 'clear',
    probability: 10,
    temperatureRange: ['cool', 'warm'],
    durationRange: {
      min: { type: 'slots', count: 1 },
      max: { type: 'days', count: 1 },
    },
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function WeatherTableEditor({
  table,
  onSave,
  onCancel,
}: WeatherTableEditorProps) {
  const isEdit = !!table;

  // Form state
  const [name, setName] = useState(table?.name ?? '');
  const [description, setDescription] = useState(table?.description ?? '');
  const [entries, setEntries] = useState<WeatherTableEntry[]>(
    table?.entries ? [...table.entries] : [createDefaultEntry()]
  );
  const [showIntensity, setShowIntensity] = useState<Record<number, boolean>>({});

  // Calculate total weight and percentages
  const totalWeight = useMemo(
    () => entries.reduce((sum, e) => sum + (e.probability || 0), 0),
    [entries]
  );

  // Update a specific entry field
  const updateEntry = (index: number, changes: Partial<WeatherTableEntry>) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...changes };
      return updated;
    });
  };

  // Update nested duration fields
  const updateDuration = (
    index: number,
    which: 'min' | 'max',
    changes: Partial<WeatherDuration>
  ) => {
    setEntries((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index] };
      entry.durationRange = { ...entry.durationRange };
      entry.durationRange[which] = { ...entry.durationRange[which], ...changes } as WeatherDuration;
      updated[index] = entry;
      return updated;
    });
  };

  // Update intensity weights
  const updateIntensityWeight = (
    index: number,
    field: 'light' | 'moderate' | 'heavy',
    value: number
  ) => {
    setEntries((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index] };
      entry.intensityWeights = {
        light: entry.intensityWeights?.light ?? 30,
        moderate: entry.intensityWeights?.moderate ?? 50,
        heavy: entry.intensityWeights?.heavy ?? 20,
        [field]: value,
      };
      updated[index] = entry;
      return updated;
    });
  };

  // Update temperature range
  const updateTempRange = (index: number, which: 0 | 1, value: Temperature) => {
    setEntries((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index] };
      const range: [Temperature, Temperature] = [...entry.temperatureRange];
      range[which] = value;
      entry.temperatureRange = range;
      updated[index] = entry;
      return updated;
    });
  };

  // Add a new entry
  const addEntry = () => {
    setEntries((prev) => [...prev, createDefaultEntry()]);
  };

  // Remove an entry
  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  // Toggle intensity section visibility
  const toggleIntensity = (index: number) => {
    setShowIntensity((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Handle save
  const handleSave = () => {
    if (!name.trim() || entries.length === 0) return;

    const id = table?.id ?? `wt-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    onSave({
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      entries,
    });
  };

  const isValid = name.trim() && entries.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">
          {isEdit ? 'Edit Weather Table' : 'New Weather Table'}
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-200 text-sm"
        >
          Cancel
        </button>
      </div>

      {/* Table Name & Description */}
      <div className="space-y-2">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Table Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
            placeholder="e.g., Temperate Forest - Summer"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
            placeholder="Optional description"
          />
        </div>
      </div>

      {/* Totals Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-sm">
        <span className="text-gray-300">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
        <span className="text-gray-300">
          Total weight: <span className="font-medium text-blue-400">{totalWeight}</span>
        </span>
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {entries.map((entry, index) => {
          const pct = totalWeight > 0 ? ((entry.probability / totalWeight) * 100).toFixed(1) : '0';
          return (
            <div
              key={index}
              className="bg-gray-700/50 border border-gray-600 rounded p-3 space-y-2"
            >
              {/* Row 1: Weather type + probability + delete */}
              <div className="flex items-center gap-2">
                <select
                  value={entry.weather}
                  onChange={(e) =>
                    updateEntry(index, { weather: e.target.value as WeatherType })
                  }
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-gray-100"
                >
                  {WEATHER_TYPES.map((wt) => (
                    <option key={wt} value={wt}>
                      {WEATHER_ICONS[wt]} {WEATHER_LABELS[wt]}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-400">Wt:</label>
                  <input
                    type="number"
                    min={0}
                    value={entry.probability}
                    onChange={(e) =>
                      updateEntry(index, {
                        probability: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-gray-100 text-center"
                  />
                  <span className="text-xs text-gray-500 w-12 text-right">{pct}%</span>
                </div>

                <button
                  onClick={() => removeEntry(index)}
                  disabled={entries.length <= 1}
                  className={`p-1 rounded ${
                    entries.length <= 1
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-red-400 hover:bg-red-600/20'
                  }`}
                  title="Remove entry"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Row 2: Temperature range */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-12">Temp:</label>
                <select
                  value={entry.temperatureRange[0]}
                  onChange={(e) =>
                    updateTempRange(index, 0, e.target.value as Temperature)
                  }
                  className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100"
                >
                  {TEMPERATURE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TEMPERATURE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">to</span>
                <select
                  value={entry.temperatureRange[1]}
                  onChange={(e) =>
                    updateTempRange(index, 1, e.target.value as Temperature)
                  }
                  className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100"
                >
                  {TEMPERATURE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TEMPERATURE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 3: Duration range */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-12">Dur:</label>
                <input
                  type="number"
                  min={1}
                  value={(entry.durationRange.min as { count: number }).count ?? 1}
                  onChange={(e) =>
                    updateDuration(index, 'min', {
                      type: (entry.durationRange.min as { type: string }).type as 'slots' | 'days',
                      count: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-14 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100 text-center"
                />
                <select
                  value={(entry.durationRange.min as { type: string }).type ?? 'slots'}
                  onChange={(e) =>
                    updateDuration(index, 'min', {
                      type: e.target.value as 'slots' | 'days',
                      count: (entry.durationRange.min as { count: number }).count ?? 1,
                    })
                  }
                  className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100"
                >
                  <option value="slots">slots</option>
                  <option value="days">days</option>
                </select>
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="number"
                  min={1}
                  value={(entry.durationRange.max as { count: number }).count ?? 1}
                  onChange={(e) =>
                    updateDuration(index, 'max', {
                      type: (entry.durationRange.max as { type: string }).type as 'slots' | 'days',
                      count: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-14 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100 text-center"
                />
                <select
                  value={(entry.durationRange.max as { type: string }).type ?? 'days'}
                  onChange={(e) =>
                    updateDuration(index, 'max', {
                      type: e.target.value as 'slots' | 'days',
                      count: (entry.durationRange.max as { count: number }).count ?? 1,
                    })
                  }
                  className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100"
                >
                  <option value="slots">slots</option>
                  <option value="days">days</option>
                </select>
              </div>

              {/* Row 4: Intensity weights (collapsible) */}
              <div>
                <button
                  onClick={() => toggleIntensity(index)}
                  className="text-xs text-gray-400 hover:text-gray-200"
                >
                  {showIntensity[index] ? '- Hide' : '+'} Intensity Weights
                </button>
                {showIntensity[index] && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Light:</label>
                      <input
                        type="number"
                        min={0}
                        value={entry.intensityWeights?.light ?? 30}
                        onChange={(e) =>
                          updateIntensityWeight(
                            index,
                            'light',
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className="w-12 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100 text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Mod:</label>
                      <input
                        type="number"
                        min={0}
                        value={entry.intensityWeights?.moderate ?? 50}
                        onChange={(e) =>
                          updateIntensityWeight(
                            index,
                            'moderate',
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className="w-12 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100 text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Heavy:</label>
                      <input
                        type="number"
                        min={0}
                        value={entry.intensityWeights?.heavy ?? 20}
                        onChange={(e) =>
                          updateIntensityWeight(
                            index,
                            'heavy',
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className="w-12 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100 text-center"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Entry Button */}
      <button
        onClick={addEntry}
        className="w-full py-2 border border-dashed border-gray-500 rounded text-sm text-gray-400 hover:text-gray-200 hover:border-gray-400 flex items-center justify-center gap-1"
      >
        <Plus size={14} />
        Add Weather Entry
      </button>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
        >
          {isEdit ? 'Save Changes' : 'Create Weather Table'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
