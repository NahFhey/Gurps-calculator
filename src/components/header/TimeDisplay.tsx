import { useCampaignSelector } from '../../state/campaignStore';
import type { CampaignState } from '../../state/campaignReducer';
import { DEFAULT_CALENDAR, getCurrentSeason } from '../../utils/timeSystem';

const selectTime = (state: CampaignState) => state.time;

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
  const time = useCampaignSelector(selectTime);
  const { day, slot, slotLabels, slotsPerDay } = time;
  const season = getCurrentSeason(day, time.calendar ?? DEFAULT_CALENDAR);

  const slotLabel = slotLabels[slot] || `Slot ${slot + 1}`;

  if (compact) {
    return (
      <div
        className="text-sm text-fg-secondary"
        data-testid="time-display-compact"
      >
        D{day} {slotLabel.charAt(0)}
      </div>
    );
  }

  return (
    <div
      className="rounded border border-edge-strong bg-surface-2/50 px-4 py-2"
      data-testid="time-display"
    >
      <div className="flex items-center gap-4">
        {/* Day */}
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-fg-muted">Day</div>
          <div className="text-xl font-bold text-fg-bright">{day}</div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-surface-3" />

        {/* Time Slot */}
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-fg-muted">Time</div>
          <div className="text-lg font-semibold text-fg-bright">
            {slotLabel}
            {showSlotNumber && (
              <span className="ml-1 text-sm text-fg-muted">({slot + 1}/{slotsPerDay})</span>
            )}
          </div>
        </div>

        <div className="h-8 w-px bg-surface-3" />

        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-fg-muted">Season</div>
          <div className="text-lg font-semibold text-fg-bright">
            {season.def.name} <span className="text-sm text-fg-muted">Day {season.dayOfSeason}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimeDisplay;
