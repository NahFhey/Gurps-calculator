import type { Id } from '../types/partyTool';
import type { ReservationEngine } from './reservationEngine';

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
  reservationEngine: ReservationEngine | { clearAllReservations(): void },
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
