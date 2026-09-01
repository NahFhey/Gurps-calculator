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
    <div className="bg-gradient-to-r from-accent-900 to-surface-1 rounded-lg p-4 border-2 border-accent-500">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-fg-muted">Current Turn</p>
          <h3 className="text-2xl font-bold">{currentActor?.name}</h3>
          <p className="text-sm text-fg-muted">
            Speed: {currentActor?.basicSpeed} | Turn {combat.currentTurnIndex + 1} of {combat.turnOrder.length}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPrevTurn}
            className="p-3 bg-surface-2 hover:bg-surface-3 rounded"
            title="Previous turn"
            aria-label="Previous turn"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={onNextTurn}
            className="p-3 bg-success-600 hover:bg-success-700 rounded"
            title="Next turn"
            aria-label="Next turn"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

export const TurnControlsView = memo(TurnControlsViewBase);
