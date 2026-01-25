import React, { useState } from 'react';
import { Shield, Dices } from 'lucide-react';
import ModifierStack from './ModifierStack';
import { DEFENSE_MODIFIERS, calculateEffective } from '../../utils/modifiers';
import { rollVsTarget } from '../../utils/dice';

/**
 * DefenseAssist Component
 * Handles defense selection, modifier calculation, and optional roll
 * Returns defense data for logging
 */
export default function DefenseAssist({
  defender,
  injectedModifiers = [],
  onComplete,
  onCancel
}) {
  const [defenseType, setDefenseType] = useState('dodge');
  const [customBaseDefense, setCustomBaseDefense] = useState('');
  const [modifiers, setModifiers] = useState([]);
  const [rollResult, setRollResult] = useState(null);

  // Phase 5: Extract defense value from filtered structure
  const extractDefenseValue = (defenseField) => {
    if (!defenseField) return null;

    // Phase 5 filtered structure
    if (typeof defenseField === 'object' && defenseField.mode) {
      if (defenseField.mode === 'exact' || defenseField.mode === 'approx') {
        return defenseField.value;
      }
      return null; // Unknown
    }

    // Legacy: simple number
    return defenseField;
  };

  // Get base defense value
  const getBaseDefense = () => {
    if (defenseType === 'custom') {
      return parseInt(customBaseDefense) || 0;
    }

    // Phase 5: Extract values from filtered structure
    const defenseValues = {
      dodge: extractDefenseValue(defender.defenses?.dodge ?? defender.dodge),
      parry: extractDefenseValue(defender.defenses?.parry ?? defender.parry),
      block: extractDefenseValue(defender.defenses?.block ?? defender.block)
    };

    return defenseValues[defenseType] || 0;
  };

  const baseDefense = getBaseDefense();
  const effectiveDefense = calculateEffective(baseDefense, [...injectedModifiers, ...modifiers]);

  const handleRoll = () => {
    const result = rollVsTarget('3d6', effectiveDefense);
    setRollResult(result);
  };

  const handleComplete = () => {
    const defenseData = {
      type: defenseType === 'custom' ? customBaseDefense : defenseType,
      baseDefense,
      modifiers: [...modifiers],
      injectedModifiers: [...injectedModifiers],
      effectiveDefense,
      rollTotal: rollResult ? rollResult.total : null,
      margin: rollResult ? rollResult.margin : null,
      success: rollResult ? rollResult.success : null
    };

    onComplete({
      defense: defenseData
    });
  };

  const isValid = () => {
    if (defenseType === 'custom') {
      return customBaseDefense && !isNaN(parseInt(customBaseDefense));
    }
    return baseDefense !== null && baseDefense !== undefined;
  };

  // Phase 5: Get display values for defense buttons
  const dodgeValue = extractDefenseValue(defender.defenses?.dodge ?? defender.dodge);
  const parryValue = extractDefenseValue(defender.defenses?.parry ?? defender.parry);
  const blockValue = extractDefenseValue(defender.defenses?.block ?? defender.block);

  return (
    <div className="space-y-4">
      {/* Defense Type Selection */}
      <div>
        <h4 className="font-semibold mb-2">Defense Type</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDefenseType('dodge')}
            className={`p-3 rounded border-2 ${
              defenseType === 'dodge'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <div className="font-semibold">Dodge</div>
            <div className="text-sm text-gray-400">
              {dodgeValue !== null && dodgeValue !== undefined
                ? `Base: ${dodgeValue}`
                : 'Not set'}
            </div>
          </button>

          <button
            onClick={() => setDefenseType('parry')}
            className={`p-3 rounded border-2 ${
              defenseType === 'parry'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <div className="font-semibold">Parry</div>
            <div className="text-sm text-gray-400">
              {parryValue !== null && parryValue !== undefined
                ? `Base: ${parryValue}`
                : 'Not set'}
            </div>
          </button>

          <button
            onClick={() => setDefenseType('block')}
            className={`p-3 rounded border-2 ${
              defenseType === 'block'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <div className="font-semibold">Block</div>
            <div className="text-sm text-gray-400">
              {blockValue !== null && blockValue !== undefined
                ? `Base: ${blockValue}`
                : 'Not set'}
            </div>
          </button>

          <button
            onClick={() => setDefenseType('custom')}
            className={`p-3 rounded border-2 ${
              defenseType === 'custom'
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <div className="font-semibold">Custom</div>
            <div className="text-sm text-gray-400">Enter value</div>
          </button>
        </div>

        {/* Custom Defense Input */}
        {defenseType === 'custom' && (
          <div className="mt-2">
            <input
              type="number"
              value={customBaseDefense}
              onChange={(e) => setCustomBaseDefense(e.target.value)}
              placeholder="Enter base defense value"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
          </div>
        )}
      </div>

      {/* Modifier Stack */}
      {isValid() && (
        <div>
          <h4 className="font-semibold mb-2">Defense Modifiers</h4>
          <ModifierStack
            baseValue={baseDefense}
            baseLabel={`Base ${defenseType === 'custom' ? 'Defense' : defenseType.charAt(0).toUpperCase() + defenseType.slice(1)}`}
            modifiers={modifiers}
            lockedModifiers={injectedModifiers}
            onModifiersChange={setModifiers}
            presets={DEFENSE_MODIFIERS}
          />
        </div>
      )}

      {/* Roll Button */}
      {isValid() && (
        <button
          onClick={handleRoll}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded"
        >
          <Dices size={20} />
          Roll Defense
        </button>
      )}

      {/* Roll Result */}
      {rollResult && (
        <div className={`p-4 rounded ${rollResult.success ? 'bg-green-900/30 border border-green-600' : 'bg-red-900/30 border border-red-600'}`}>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {rollResult.total} vs {rollResult.target}
            </div>
            <div className="text-lg mt-1">
              Margin: <span className={rollResult.margin >= 0 ? 'text-green-400' : 'text-red-400'}>
                {rollResult.margin >= 0 ? '+' : ''}{rollResult.margin}
              </span>
            </div>
            <div className="text-xl font-bold mt-2">
              {rollResult.success ? '✓ SUCCESS' : '✗ FAILURE'}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleComplete}
          disabled={!isValid()}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rollResult ? 'Confirm & Log' : 'Log (No Roll)'}
        </button>
      </div>
    </div>
  );
}
