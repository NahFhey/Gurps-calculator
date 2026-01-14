import React, { useState } from 'react';
import { Dices } from 'lucide-react';

export function DiceRoller({ onRoll, currentValue, disabled = false }) {
  const [lastRoll, setLastRoll] = useState(null);

  const rollDice = () => {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const die3 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2 + die3;

    const rollResult = { die1, die2, die3, total };
    setLastRoll(rollResult);

    if (onRoll) {
      onRoll(total, rollResult);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={rollDice}
        disabled={disabled}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-3 py-1 rounded flex items-center gap-1 text-sm font-semibold transition-colors"
        title="Roll 3d6"
      >
        <Dices size={16} />
        Roll 3d6
      </button>

      {lastRoll && (
        <div className="flex items-center gap-1 text-sm font-mono">
          <span className="text-red-400 font-bold">({lastRoll.die1})</span>
          <span className="text-white">+</span>
          <span className="text-green-400 font-bold">({lastRoll.die2})</span>
          <span className="text-white">+</span>
          <span className="text-blue-400 font-bold">({lastRoll.die3})</span>
          <span className="text-white">=</span>
          <span className="text-yellow-400 font-bold">({lastRoll.total})</span>
        </div>
      )}
    </div>
  );
}
