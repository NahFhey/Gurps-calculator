import { useCampaignStore } from '../../state/campaignStore';

/**
 * TimeControls - Buttons to advance game time
 *
 * Part of Phase 2: Layout Restructure
 *
 * Provides:
 * - Advance Slot button (moves to next time slot)
 * - Advance Day button (moves to next day, resets slot to Morning)
 *
 * Uses the campaign store's advanceTime action which:
 * - Checks for blocking errors (paused activities)
 * - Updates time state (day, slot)
 * - Logs the time change
 */

interface TimeControlsProps {
  compact?: boolean;
  showAdvanceDay?: boolean;
  disabled?: boolean;
}

export function TimeControls({
  compact = false,
  showAdvanceDay = true,
  disabled = false,
}: TimeControlsProps) {
  const { state, actions } = useCampaignStore();

  // Check if there are any blocking conditions
  const hasBlockingError = state.ui.blockingError !== null;
  const hasPausedActivities = state.activities.pausedSessionIds.length > 0;
  const isBlocked = hasBlockingError || hasPausedActivities;

  const handleAdvanceSlot = () => {
    if (disabled || isBlocked) return;
    actions.advanceTime();
  };

  const handleAdvanceDay = () => {
    if (disabled || isBlocked) return;
    // Advance through remaining slots to get to next day
    const { slot, slotsPerDay } = state.time;
    const slotsRemaining = slotsPerDay - slot;
    for (let i = 0; i < slotsRemaining; i++) {
      actions.advanceTime();
    }
  };

  const buttonBaseClass = compact
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  const activeButtonClass = `${buttonBaseClass} rounded border font-semibold transition-colors`;
  const disabledButtonClass = `${buttonBaseClass} rounded border cursor-not-allowed opacity-50`;

  if (compact) {
    return (
      <div className="flex items-center gap-1" data-testid="time-controls-compact">
        <button
          type="button"
          onClick={handleAdvanceSlot}
          disabled={disabled || isBlocked}
          className={
            disabled || isBlocked
              ? `${disabledButtonClass} border-gray-600 bg-gray-700 text-gray-400`
              : `${activeButtonClass} border-blue-500 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30`
          }
          title={isBlocked ? 'Blocked by paused activities' : 'Advance to next time slot'}
          data-testid="advance-slot-compact"
        >
          +Slot
        </button>
        {showAdvanceDay && (
          <button
            type="button"
            onClick={handleAdvanceDay}
            disabled={disabled || isBlocked}
            className={
              disabled || isBlocked
                ? `${disabledButtonClass} border-gray-600 bg-gray-700 text-gray-400`
                : `${activeButtonClass} border-amber-500 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30`
            }
            title={isBlocked ? 'Blocked by paused activities' : 'Advance to next day'}
            data-testid="advance-day-compact"
          >
            +Day
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded border border-gray-600 bg-gray-700/50 px-3 py-2"
      data-testid="time-controls"
    >
      <span className="text-xs uppercase tracking-wide text-gray-400 mr-2">Time</span>

      <button
        type="button"
        onClick={handleAdvanceSlot}
        disabled={disabled || isBlocked}
        className={
          disabled || isBlocked
            ? `${disabledButtonClass} border-gray-600 bg-gray-700 text-gray-400`
            : `${activeButtonClass} border-blue-500 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30`
        }
        title={isBlocked ? 'Blocked by paused activities' : 'Advance to next time slot'}
        data-testid="advance-slot"
      >
        Adv. Slot
      </button>

      {showAdvanceDay && (
        <button
          type="button"
          onClick={handleAdvanceDay}
          disabled={disabled || isBlocked}
          className={
            disabled || isBlocked
              ? `${disabledButtonClass} border-gray-600 bg-gray-700 text-gray-400`
              : `${activeButtonClass} border-amber-500 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30`
          }
          title={isBlocked ? 'Blocked by paused activities' : 'Advance to next day'}
          data-testid="advance-day"
        >
          Adv. Day
        </button>
      )}

      {isBlocked && (
        <span
          className="ml-2 text-xs text-amber-400"
          title="Complete or clear paused activities to advance time"
        >
          (blocked)
        </span>
      )}
    </div>
  );
}

export default TimeControls;
