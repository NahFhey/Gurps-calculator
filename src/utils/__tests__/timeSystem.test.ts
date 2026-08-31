import { describe, expect, it, vi } from 'vitest';
import { advanceTimeSlot, clearEquipmentSelections } from '../timeSystem';
import { ReservationEngine } from '../reservationEngine';
import type { GlobalState } from '../../types/partyTool';

describe('TimeSystem', () => {
  it('advances time slot, clears reservations, and logs transition', () => {
    const state: GlobalState = {
      characters: {},
      inventories: {},
      toolTemplates: {},
      toolInstances: {},
      currencyLogs: [],
    };
    const reservationEngine = new ReservationEngine(state, {
      session: ['tool-1'],
    });
    const clearSelections = vi.fn();
    const logSpy = vi.fn();

    const result = advanceTimeSlot(0, reservationEngine, {
      totalSlots: 3,
      slotLabels: ['Morning', 'Afternoon', 'Evening'],
      clearEquipmentSelections: clearSelections,
      logEntry: logSpy,
    });

    expect(result.nextSlot).toBe(1);
    expect(reservationEngine.activeReservations).toEqual({});
    expect(clearSelections).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ fromSlot: 0, toSlot: 1, label: 'Afternoon' })
    );
  });

  it('clears equipment selections map', () => {
    const selections = {
      sessionA: { sessionId: 'sessionA', toolIds: ['tool-1'] },
    };

    clearEquipmentSelections(selections);

    expect(selections).toEqual({});
  });
});
