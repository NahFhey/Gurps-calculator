import { memo, ChangeEvent } from 'react';
import { Dices } from 'lucide-react';
import type { DicePanelViewProps } from '../../../types/combatTracker';

/**
 * DicePanelView - Collapsible dice tools panel
 *
 * Provides dice expression input with optional target number
 * for skill checks. Includes quick buttons for common expressions.
 */
function DicePanelViewBase({
  showDicePanel,
  diceExpression,
  rollTarget,
  onToggleDicePanel,
  onSetDiceExpression,
  onSetRollTarget,
  onRoll
}: DicePanelViewProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <button
        onClick={onToggleDicePanel}
        className="flex items-center gap-2 w-full justify-between"
      >
        <div className="flex items-center gap-2">
          <Dices size={20} />
          <span className="font-semibold">Dice Tools</span>
        </div>
        <span className="text-gray-400">{showDicePanel ? '▲' : '▼'}</span>
      </button>

      {showDicePanel && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Expression</label>
              <input
                type="text"
                value={diceExpression}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onSetDiceExpression(e.target.value)}
                placeholder="e.g. 3d6, 2d+1"
                className="w-full px-3 py-2 bg-gray-700 rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Target (optional)</label>
              <input
                type="number"
                value={rollTarget}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onSetRollTarget(e.target.value)}
                placeholder="e.g. 12"
                className="w-full px-3 py-2 bg-gray-700 rounded"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRoll}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            >
              Roll
            </button>
            <button
              onClick={() => onSetDiceExpression('3d6')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
            >
              3d6
            </button>
            <button
              onClick={() => onSetDiceExpression('1d')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
            >
              1d
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const DicePanelView = memo(DicePanelViewBase);
