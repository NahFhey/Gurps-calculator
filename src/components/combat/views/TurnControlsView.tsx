import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TurnControlsViewProps } from '../../../types/combatTracker';

/**
 * TurnControlsView - Current turn display with navigation
 *
 * Shows the current actor's name, speed, and turn position.
 * Provides previous/next turn navigation buttons.
 */
function TurnControlsViewBase({
  currentActor,
  combat,
  onPrevTurn,
  onNextTurn
}: TurnControlsViewProps) {
  return (
    <div className="bg-gradient-to-r from-blue-900 to-gray-800 rounded-lg p-4 border-2 border-blue-500">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-400">Current Turn</p>
          <h3 className="text-2xl font-bold">{currentActor?.name}</h3>
          <p className="text-sm text-gray-400">
            Speed: {currentActor?.basicSpeed} | Turn {combat.currentTurnIndex + 1} of {combat.turnOrder.length}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPrevTurn}
            className="p-3 bg-gray-700 hover:bg-gray-600 rounded"
            title="Previous turn"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={onNextTurn}
            className="p-3 bg-green-600 hover:bg-green-700 rounded"
            title="Next turn"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

export const TurnControlsView = memo(TurnControlsViewBase);
