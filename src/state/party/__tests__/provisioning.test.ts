import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createCampaignState } from '../../campaignReducer';
import { createDefaultGCSData } from '../../../types/characterSheet';
import { handleJourneyDayBoundary } from '../journeyEngine';

function fixture() {
  const state = createCampaignState();
  state.time.day = 2;
  state.entities.characters = {
    a: { id: 'a', name: 'Ada', work: { skills: {} }, gcsData: createDefaultGCSData() },
    b: { id: 'b', name: 'Borin', work: { skills: {} }, gcsData: createDefaultGCSData() },
  };
  state.entities.travelGroups = {
    g: { id: 'g', name: 'Travelers', memberIds: ['a', 'b'], vehicleId: null, position: null },
  };
  state.downtime = {
    tasksById: { travel: {
      id: 'travel', activityType: 'travel', dayKey: 1, slot: 0, leaderId: 'a', helperIds: ['b'], status: 'resolved',
      activityData: { type: 'travel', journeyId: 'j', groupId: 'g', vehicleId: null, milesMoved: 12, drifted: false },
      createdAt: 0, updatedAt: 0,
    } },
    taskOrder: ['travel'],
    pendingDayLedger: null,
  };
  return state;
}

function boundary(state: ReturnType<typeof fixture>) {
  return produce(state, (draft) => handleJourneyDayBoundary(draft));
}

describe('journey provisioning day boundary', () => {
  it('leaves a fed traveling group untouched', () => {
    const state = fixture();
    state.entities.groupMeals = { g: 1 };
    expect(boundary(state).entities.characters.a.gcsData?.pools.FP.current).toBe(10);
  });

  it('costs every unfed traveler 1 FP and adds debt', () => {
    const next = boundary(fixture());
    expect(next.entities.characters.a.gcsData?.pools.FP.current).toBe(9);
    expect(next.entities.characters.b.gcsData?.pools.FP.current).toBe(9);
    expect(next.entities.starvationFpDebt).toEqual({ a: 1, b: 1 });
  });

  it('increments existing starvation debt', () => {
    const state = fixture();
    state.entities.starvationFpDebt = { a: 2 };
    expect(boundary(state).entities.starvationFpDebt?.a).toBe(3);
  });

  it('ignores a group that did not travel on the completed day', () => {
    const state = fixture();
    state.downtime = {
      ...state.downtime,
      tasksById: { travel: { ...state.downtime.tasksById.travel, dayKey: 0 } },
    };
    expect(boundary(state).entities.characters.a.gcsData?.pools.FP.current).toBe(10);
  });

  it('uses the same ledger rule for a forced-march journey', () => {
    const state = fixture();
    state.entities.travelGroups!.g.journey = {
      id: 'j', mapId: 'map', routeTileIds: ['a', 'b'], destinationTileId: 'b', mode: 'foot', navigatorId: null,
      gmNavigationSkill: 10, forcedMarch: true, legProgressMiles: 0, milesTraveled: 0, status: 'active', gmOverride: false,
      startedAt: { day: 1, slot: 0 },
    };
    expect(boundary(state).entities.starvationFpDebt?.a).toBe(1);
  });
});
