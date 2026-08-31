import { useCampaignStore } from '../../state/campaignStore';
import { DEFAULT_CALENDAR, getCurrentSeason } from '../../utils/timeSystem';

/**
 * TimeDisplay - Shows current game day and time slot
 *
 * Part of Phase 2: Layout Restructure
 *
 * Displays:
 * - Current day number
 * - Current time slot (Morning, Afternoon, Night)
 */

interface TimeDisplayProps {
  compact?: boolean;
  showSlotNumber?: boolean;
}

export function TimeDisplay({ compact = false, showSlotNumber = false }: TimeDisplayProps) {
  const { state } = useCampaignStore();
  const { day, slot, slotLabels, slotsPerDay } = state.time;
  const season = getCurrentSeason(day, state.time.calendar ?? DEFAULT_CALENDAR);

  const slotLabel = slotLabels[slot] || `Slot ${slot + 1}`;

  if (compact) {
    return (
      <div
        className="text-sm text-gray-300"
        data-testid="time-display-compact"
      >
        D{day} {slotLabel.charAt(0)}
      </div>
    );
  }

  return (
    <div
      className="rounded border border-gray-600 bg-gray-700/50 px-4 py-2"
      data-testid="time-display"
    >
      <div className="flex items-center gap-4">
        {/* Day */}
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-gray-400">Day</div>
          <div className="text-xl font-bold text-gray-100">{day}</div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-600" />

        {/* Time Slot */}
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-gray-400">Time</div>
          <div className="text-lg font-semibold text-gray-100">
            {slotLabel}
            {showSlotNumber && (
              <span className="ml-1 text-sm text-gray-400">({slot + 1}/{slotsPerDay})</span>
            )}
          </div>
        </div>

        <div className="h-8 w-px bg-gray-600" />

        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-gray-400">Season</div>
          <div className="text-lg font-semibold text-gray-100">
            {season.def.name} <span className="text-sm text-gray-400">Day {season.dayOfSeason}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimeDisplay;
