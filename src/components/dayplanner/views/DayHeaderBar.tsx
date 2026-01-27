import { Moon, ChevronRight } from 'lucide-react';
import { SLOTS_PER_DAY, SLOT_NAMES } from '../../../constants';
import type { DayHeaderBarProps } from '../../../types/dayplanner';

/**
 * DayHeaderBar - Displays current day/slot and action buttons
 *
 * Shows the current campaign day, time slot, and provides
 * Sleep and Advance Slot buttons for time progression.
 */
export function DayHeaderBar({
  currentDay,
  currentSlot,
  canAdvance,
  onSleep,
  onAdvanceSlot
}: DayHeaderBarProps) {
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex items-center justify-between">
        {/* Day Display */}
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold">Day {currentDay}</div>
          <div className="text-lg text-gray-400">
            {SLOT_NAMES[currentSlot]} (Slot {currentSlot + 1}/{SLOTS_PER_DAY})
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onSleep}
            className="px-4 py-2 bg-indigo-600 rounded flex items-center gap-2"
          >
            <Moon size={16} /> Sleep
          </button>
          <button
            onClick={onAdvanceSlot}
            disabled={!canAdvance.canAdvance}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              canAdvance.canAdvance
                ? 'bg-blue-600'
                : 'bg-gray-600 opacity-50 cursor-not-allowed'
            }`}
          >
            <ChevronRight size={16} />
            {currentSlot === SLOTS_PER_DAY - 1 ? 'End Day' : 'Advance Slot'}
          </button>
        </div>
      </div>

      {/* Slot Status */}
      {!canAdvance.canAdvance && (
        <div className="mt-2 text-sm text-yellow-400">
          {canAdvance.reason}
        </div>
      )}
    </div>
  );
}
