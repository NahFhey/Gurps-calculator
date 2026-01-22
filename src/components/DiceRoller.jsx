import React from 'react';
import PropTypes from 'prop-types';
import { Dices } from 'lucide-react';

/**
 * DiceRoller - Manual dice rolling component with colored dice display
 *
 * Features:
 * - Roll button to generate random dice
 * - Individual colored dice display
 * - Editable total input
 * - Supports any number of dice and sides
 */
export function DiceRoller({
  label,
  diceCount = 3,
  diceSides = 6,
  dice = [],
  total = 0,
  onRoll,
  onTotalChange,
  disabled = false,
  targetNumber = null,
  modifier = 0
}) {
  const hasRolled = dice.length > 0;

  // Colors for individual dice (cycle through if more dice than colors)
  const diceColors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-orange-500'
  ];

  function handleRoll() {
    const rolls = [];
    for (let i = 0; i < diceCount; i++) {
      rolls.push(Math.floor(Math.random() * diceSides) + 1);
    }
    const sum = rolls.reduce((a, b) => a + b, 0) + modifier;
    onRoll(rolls, sum);
  }

  return (
    <div className="bg-gray-700 p-3 rounded space-y-2">
      {/* Label */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-200">
          {label}
          {targetNumber !== null && (
            <span className="text-gray-400 ml-2">vs {targetNumber}</span>
          )}
        </div>
        <button
          onClick={handleRoll}
          disabled={disabled}
          className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
            disabled
              ? 'bg-gray-600 opacity-50 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          <Dices size={16} />
          Roll {diceCount}d{diceSides}
          {modifier !== 0 && `${modifier >= 0 ? '+' : ''}${modifier}`}
        </button>
      </div>

      {/* Dice Display */}
      {hasRolled && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {dice.map((die, idx) => (
              <div
                key={idx}
                className={`${diceColors[idx % diceColors.length]} text-white font-bold text-sm w-8 h-8 flex items-center justify-center rounded shadow-md`}
              >
                {die}
              </div>
            ))}
          </div>
          {modifier !== 0 && (
            <div className="text-gray-400 text-sm">
              {modifier >= 0 ? '+' : ''}{modifier}
            </div>
          )}
          <div className="text-gray-400 text-sm">=</div>
        </div>
      )}

      {/* Total Input */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">Total:</label>
        <input
          type="number"
          value={total || ''}
          onChange={(e) => onTotalChange(parseInt(e.target.value) || 0)}
          placeholder={hasRolled ? '' : 'Enter or roll'}
          disabled={disabled}
          className="w-20 bg-gray-600 px-2 py-1 rounded text-center text-lg font-bold disabled:opacity-50"
        />
        {hasRolled && targetNumber !== null && (
          <div className={`text-sm font-medium ${
            total <= targetNumber ? 'text-green-400' : 'text-red-400'
          }`}>
            {total <= targetNumber ? 'Success' : 'Failure'} (MoS: {targetNumber - total})
          </div>
        )}
      </div>
    </div>
  );
}

DiceRoller.propTypes = {
  label: PropTypes.string,
  diceCount: PropTypes.number,
  diceSides: PropTypes.number,
  dice: PropTypes.arrayOf(PropTypes.number),
  total: PropTypes.number,
  onRoll: PropTypes.func.isRequired,
  onTotalChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  targetNumber: PropTypes.number,
  modifier: PropTypes.number
};

DiceRoller.defaultProps = {
  label: 'Roll Dice',
  diceCount: 3,
  diceSides: 6,
  dice: [],
  total: 0,
  disabled: false,
  targetNumber: null,
  modifier: 0
};
