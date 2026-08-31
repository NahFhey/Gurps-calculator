import type { Id } from '../types/partyTool';
import type { ReservationEngine } from './reservationEngine';

export interface SeasonDef {
  name: string;
  days: number;
  temperatureShift: number;
  precipitationMultiplier: number;
}

export interface CalendarConfig {
  seasons: SeasonDef[];
  startSeasonIndex: number;
}

export interface CurrentSeason {
  index: number;
  def: SeasonDef;
  /** One-based day within the current season. */
  dayOfSeason: number;
}

const FALLBACK_SEASON: SeasonDef = {
  name: 'Season',
  days: 90,
  temperatureShift: 0,
  precipitationMultiplier: 1,
};

export const DEFAULT_CALENDAR: CalendarConfig = {
  seasons: [
    { name: 'Spring', days: 90, temperatureShift: 0, precipitationMultiplier: 1.1 },
    { name: 'Summer', days: 90, temperatureShift: 1, precipitationMultiplier: 0.85 },
    { name: 'Autumn', days: 90, temperatureShift: 0, precipitationMultiplier: 1.15 },
    { name: 'Winter', days: 90, temperatureShift: -2, precipitationMultiplier: 1 },
  ],
  startSeasonIndex: 0,
};

/** Resolve a campaign day to a season in a calendar that repeats forever. */
export function getCurrentSeason(day: number, calendar: CalendarConfig): CurrentSeason {
  const seasons = calendar.seasons;
  const cycleDays = seasons.reduce(
    (total, season) => total + (Number.isFinite(season.days) && season.days > 0 ? Math.floor(season.days) : 0),
    0
  );
  if (seasons.length === 0 || cycleDays <= 0) {
    const dayOfSeason = ((Math.max(1, Math.floor(day)) - 1) % FALLBACK_SEASON.days) + 1;
    return { index: 0, def: FALLBACK_SEASON, dayOfSeason };
  }

  const rawStartIndex = Number.isFinite(calendar.startSeasonIndex)
    ? Math.floor(calendar.startSeasonIndex)
    : 0;
  const startIndex = ((rawStartIndex % seasons.length) + seasons.length) % seasons.length;
  let remaining = (Math.max(1, Math.floor(day)) - 1) % cycleDays;
  for (let offset = 0; offset < seasons.length; offset += 1) {
    const index = (startIndex + offset) % seasons.length;
    const def = seasons[index];
    const seasonDays = Number.isFinite(def.days) && def.days > 0 ? Math.floor(def.days) : 0;
    if (seasonDays === 0) continue;
    if (remaining < seasonDays) {
      return { index, def, dayOfSeason: remaining + 1 };
    }
    remaining -= seasonDays;
  }

  return { index: 0, def: FALLBACK_SEASON, dayOfSeason: 1 };
}

export interface TimeLogEntry {
  fromSlot: number;
  toSlot: number;
  timestamp: number;
  label?: string;
}

export interface TimeSystemOptions {
  totalSlots: number;
  slotLabels?: string[];
  clearEquipmentSelections?: () => void;
  logEntry?: (entry: TimeLogEntry) => void;
}

export const advanceTimeSlot = (
  currentSlot: number,
  reservationEngine: Pick<ReservationEngine, 'clearAllReservations'>,
  options: TimeSystemOptions
): { nextSlot: number; logEntry: TimeLogEntry } => {
  const { totalSlots, slotLabels, clearEquipmentSelections, logEntry } = options;
  if (totalSlots <= 0) {
    throw new Error('Total slots must be greater than zero');
  }

  const nextSlot = (currentSlot + 1) % totalSlots;
  reservationEngine.clearAllReservations();
  clearEquipmentSelections?.();

  const entry: TimeLogEntry = {
    fromSlot: currentSlot,
    toSlot: nextSlot,
    timestamp: Date.now(),
    label: slotLabels?.[nextSlot],
  };

  logEntry?.(entry);

  return { nextSlot, logEntry: entry };
};

export interface EquipmentSelectionState {
  sessionId: Id;
  toolIds: Id[];
}

export const clearEquipmentSelections = (selections: Record<Id, EquipmentSelectionState>) => {
  Object.keys(selections).forEach(key => {
    delete selections[key];
  });
};
