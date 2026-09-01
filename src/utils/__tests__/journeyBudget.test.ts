import { describe, expect, it } from 'vitest';
import type { VehicleTypeDef } from '../../types/party';
import { computeSlotBudgetMiles } from '../mapTravelValidation';
import { getNightSlotIndices, isNightSlot } from '../timeSystem';

const vehicle: VehicleTypeDef = {
  id: 'v', name: 'Vessel', mode: 'boat', speedMilesPerSlot: 80, minCrew: 1, hangarSlots: 0,
};

describe('computeSlotBudgetMiles', () => {
  it('uses the travel-mode base for foot travel', () => {
    expect(computeSlotBudgetMiles({ mode: 'foot', vehicleType: null, weatherTravelModifier: 0, worstEncumbranceLevel: null })).toBe(12);
  });
  it('uses a vehicle speed override', () => {
    expect(computeSlotBudgetMiles({ mode: 'boat', vehicleType: vehicle, weatherTravelModifier: 0, worstEncumbranceLevel: null })).toBe(80);
  });
  it('applies positive weather tenths', () => {
    expect(computeSlotBudgetMiles({ mode: 'foot', vehicleType: null, weatherTravelModifier: 2, worstEncumbranceLevel: null })).toBeCloseTo(14.4);
  });
  it('applies negative weather tenths', () => {
    expect(computeSlotBudgetMiles({ mode: 'foot', vehicleType: null, weatherTravelModifier: -5, worstEncumbranceLevel: null })).toBe(6);
  });
  it('applies worst encumbrance only on foot', () => {
    expect(computeSlotBudgetMiles({ mode: 'foot', vehicleType: null, weatherTravelModifier: 0, worstEncumbranceLevel: 3 })).toBeCloseTo(4.8);
    expect(computeSlotBudgetMiles({ mode: 'boat', vehicleType: vehicle, weatherTravelModifier: 0, worstEncumbranceLevel: 3 })).toBe(80);
  });
  it('floors severely reduced budgets at one mile', () => {
    expect(computeSlotBudgetMiles({ mode: 'foot', vehicleType: null, weatherTravelModifier: -20, worstEncumbranceLevel: 4 })).toBe(1);
  });
});

describe('journey night slots', () => {
  it('defaults to the last slot', () => expect(getNightSlotIndices(3)).toEqual([2]));
  it('honors an explicit override', () => expect(getNightSlotIndices(4, [1, 3])).toEqual([1, 3]));
  it('normalizes duplicate and invalid overrides', () => expect(getNightSlotIndices(3, [2, 2, -1, 9])).toEqual([2]));
  it('checks night membership through the shared helper', () => {
    expect(isNightSlot(1, 4, [1, 3])).toBe(true);
    expect(isNightSlot(2, 4, [1, 3])).toBe(false);
  });
});
