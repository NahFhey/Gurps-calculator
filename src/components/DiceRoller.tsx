import { ChangeEvent } from 'react';
import { Dices } from 'lucide-react';

interface DiceRollerProps {
  label?: string;
  diceCount?: number;
  diceSides?: number;
  dice?: number[];
  total?: number;
  onRoll: (dice: number[], total: number) => void;
  onTotalChange: (total: number) => void;
  disabled?: boolean;
  targetNumber?: number | null;
  modifier?: number;
}

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
  label = 'Roll Dice',
  diceCount = 3,
  diceSides = 6,
  dice = [],
  total = 0,
  onRoll,
  onTotalChange,
  disabled = false,
  targetNumber = null,
  modifier = 0
}: DiceRollerProps) {
  const hasRolled = dice.length > 0;

  // Colors for individual dice (cycle through if more dice than colors)
  const diceColors = [
    'bg-danger-500',
    'bg-accent-500',
    'bg-success-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-orange-500'
  ];

  function handleRoll() {
    const rolls: number[] = [];
    for (let i = 0; i < diceCount; i++) {
      rolls.push(Math.floor(Math.random() * diceSides) + 1);
    }
    const sum = rolls.reduce((a, b) => a + b, 0) + modifier;
    onRoll(rolls, sum);
  }

  return (
    <div className="bg-surface-2 p-3 rounded space-y-2">
      {/* Label */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-fg-primary">
          {label}
          {targetNumber !== null && (
            <span className="text-fg-muted ml-2">vs {targetNumber}</span>
          )}
        </div>
        <button
          onClick={handleRoll}
          disabled={disabled}
          className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
            disabled
              ? 'bg-surface-3 opacity-50 cursor-not-allowed'
              : 'bg-accent-600 hover:bg-accent-500'
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
            <div className="text-fg-muted text-sm">
              {modifier >= 0 ? '+' : ''}{modifier}
            </div>
          )}
          <div className="text-fg-muted text-sm">=</div>
        </div>
      )}

      {/* Total Input */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-fg-muted">Total:</label>
        <input
          type="number"
          value={total || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onTotalChange(parseInt(e.target.value) || 0)}
          placeholder={hasRolled ? '' : 'Enter or roll'}
          disabled={disabled}
          className="w-20 bg-surface-3 px-2 py-1 rounded text-center text-lg font-bold disabled:opacity-50"
        />
        {hasRolled && targetNumber !== null && (
          <div className={`text-sm font-medium ${
            total <= targetNumber ? 'text-success-400' : 'text-danger-400'
          }`}>
            {total <= targetNumber ? 'Success' : 'Failure'} (MoS: {targetNumber - total})
          </div>
        )}
      </div>
    </div>
  );
}
