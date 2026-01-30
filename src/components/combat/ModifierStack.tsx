import { useState, ChangeEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { sumModifiers } from '../../utils/modifiers';

interface Modifier {
  label: string;
  value: number;
}

interface PresetModifier {
  label: string;
  value?: number | null;  // null allowed for presets that require input
  requireInput?: boolean;
  placeholder?: string;
  note?: string;
}

interface ModifierStackProps {
  baseValue: number;
  baseLabel?: string;
  modifiers?: Modifier[];
  lockedModifiers?: Modifier[];
  onModifiersChange: (modifiers: Modifier[]) => void;
  presets?: Record<string, PresetModifier> | null;
  allowCustom?: boolean;
}

/**
 * ModifierStack Component
 * Reusable modifier entry UI for attack/defense/damage calculations
 * Displays running total and allows add/remove of modifiers
 */
export default function ModifierStack({
  baseValue,
  baseLabel = 'Base',
  modifiers = [],
  lockedModifiers = [],
  onModifiersChange,
  presets = null,
  allowCustom = true
}: ModifierStackProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const total = sumModifiers([...lockedModifiers, ...modifiers]);
  const effective = baseValue + total;

  // Add a modifier to the stack
  const addModifier = (label: string, value: number) => {
    const newModifiers = [...modifiers, { label, value }];
    onModifiersChange(newModifiers);
  };

  // Remove a modifier from the stack
  const removeModifier = (index: number) => {
    const newModifiers = modifiers.filter((_, i) => i !== index);
    onModifiersChange(newModifiers);
  };

  // Handle preset selection
  const handlePresetSelect = (presetKey: string, presetData: PresetModifier) => {
    if (presetData.requireInput) {
      // Show input prompt for value
      const value = prompt(`${presetData.label}\n${presetData.placeholder}:`);
      if (value !== null) {
        const numValue = parseInt(value);
        if (!isNaN(numValue)) {
          addModifier(presetData.label, numValue);
        }
      }
    } else {
      // Direct add
      addModifier(presetData.label, presetData.value ?? 0);
    }
    setShowPresets(false);
  };

  // Handle custom modifier
  const handleAddCustom = () => {
    if (!customLabel.trim() || !customValue.trim()) {
      return;
    }

    const value = parseInt(customValue);
    if (isNaN(value)) {
      return;
    }

    addModifier(customLabel, value);
    setCustomLabel('');
    setCustomValue('');
    setShowCustomInput(false);
  };

  return (
    <div className="space-y-2">
      {/* Base and Total Display */}
      <div className="bg-gray-700 rounded p-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{baseLabel}:</span>
          <span className="font-semibold">{baseValue}</span>
        </div>

        {(modifiers.length > 0 || lockedModifiers.length > 0) && (
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-gray-400">Modifiers:</span>
            <span className={total >= 0 ? 'text-green-400' : 'text-red-400'}>
              {total >= 0 ? '+' : ''}{total}
            </span>
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-gray-600 flex justify-between">
          <span className="font-semibold">Effective:</span>
          <span className="font-bold text-lg text-blue-400">{effective}</span>
        </div>
      </div>

      {/* Modifier List */}
      {(modifiers.length > 0 || lockedModifiers.length > 0) && (
        <div className="space-y-1">
          {lockedModifiers.map((mod, index) => (
            <div
              key={`locked-${index}`}
              className="flex justify-between items-center bg-gray-900/60 rounded px-3 py-2 text-sm border border-gray-700"
            >
              <span className="flex-1">{mod.label}</span>
              <span className={`font-semibold ${mod.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {mod.value >= 0 ? '+' : ''}{mod.value}
              </span>
              <span className="ml-2 text-xs text-gray-400 uppercase tracking-wide">Injected</span>
            </div>
          ))}
          {modifiers.map((mod, index) => (
            <div
              key={index}
              className="flex justify-between items-center bg-gray-800 rounded px-3 py-2 text-sm"
            >
              <span className="flex-1">{mod.label}</span>
              <span className={`font-semibold ${mod.value >= 0 ? 'text-green-400' : 'text-red-400'} mr-2`}>
                {mod.value >= 0 ? '+' : ''}{mod.value}
              </span>
              <button
                onClick={() => removeModifier(index)}
                className="p-1 hover:bg-gray-700 rounded"
                title="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Modifier Controls */}
      <div className="flex gap-2">
        {presets && (
          <div className="relative flex-1">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              Quick Add
            </button>

            {showPresets && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded max-h-60 overflow-y-auto z-10 shadow-lg">
                {Object.entries(presets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => handlePresetSelect(key, preset)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm border-b border-gray-700 last:border-b-0"
                  >
                    <div className="flex justify-between items-center">
                      <span>{preset.label}</span>
                      {!preset.requireInput && (
                        <span className={`font-semibold ${(preset.value ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(preset.value ?? 0) >= 0 ? '+' : ''}{preset.value}
                        </span>
                      )}
                      {preset.requireInput && (
                        <span className="text-gray-400 text-xs">...</span>
                      )}
                    </div>
                    {preset.note && (
                      <div className="text-xs text-gray-400 mt-1">{preset.note}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {allowCustom && (
          <button
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded"
            title="Add custom modifier"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Custom Modifier Input */}
      {showCustomInput && (
        <div className="bg-gray-800 rounded p-3 space-y-2">
          <input
            type="text"
            value={customLabel}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomLabel(e.target.value)}
            placeholder="Modifier name"
            className="w-full px-3 py-2 bg-gray-700 rounded text-sm"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={customValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomValue(e.target.value)}
              placeholder="Value"
              className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm"
            />
            <button
              onClick={handleAddCustom}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowCustomInput(false);
                setCustomLabel('');
                setCustomValue('');
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
