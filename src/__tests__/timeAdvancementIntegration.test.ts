/**
 * Time Advancement Integration Tests
 *
 * End-to-end tests for the time system:
 * advance slot → day rollover → blocking on paused activities
 * → checkpoint creation → weather expiration.
 *
 * Tests exercise the campaign reducer directly — no UI, no store wrapper.
 */

import { describe, expect, it } from 'vitest';
import {
  campaignReducer,
  createCampaignState,
  type CampaignState,
} from '../state/campaignReducer';

// ============================================================================
// HELPERS
// ============================================================================

/** Dispatch advanceTime N times and return final state */
function advanceN(state: CampaignState, n: number): CampaignState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = campaignReducer(s, { type: 'advanceTime' });
  }
  return s;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Time Advancement Integration', () => {
  // --------------------------------------------------------------------------
  // Basic slot advancement
  // --------------------------------------------------------------------------

  describe('basic slot advancement', () => {
    it('advances from slot 0 to slot 1 on the same day', () => {
      const state = createCampaignState();
      expect(state.time.day).toBe(1);
      expect(state.time.slot).toBe(0);

      const next = campaignReducer(state, { type: 'advanceTime' });

      expect(next.time.day).toBe(1);
      expect(next.time.slot).toBe(1);
    });

    it('advances through all slots within a day', () => {
      const state = createCampaignState();
      const slotsPerDay = state.time.slotsPerDay; // 3

      // Advance to the last slot of day 1
      const atLastSlot = advanceN(state, slotsPerDay - 1);

      expect(atLastSlot.time.day).toBe(1);
      expect(atLastSlot.time.slot).toBe(slotsPerDay - 1);
    });

    it('creates a log entry for each advance', () => {
      const state = createCampaignState();
      const next = campaignReducer(state, { type: 'advanceTime' });

      expect(next.logs.entries.length).toBeGreaterThan(0);
      // Weather logs may also be pushed, so find the time.advance entry
      const timeLog = next.logs.entries.find((e) => e.type === 'time.advance');
      expect(timeLog).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Day rollover
  // --------------------------------------------------------------------------

  describe('day rollover', () => {
    it('rolls over to the next day when advancing past the last slot', () => {
      const state = createCampaignState();
      const slotsPerDay = state.time.slotsPerDay; // 3

      // Advance through all slots of day 1 → should be day 2, slot 0
      const next = advanceN(state, slotsPerDay);

      expect(next.time.day).toBe(2);
      expect(next.time.slot).toBe(0);
    });

    it('correctly handles multiple day rollovers', () => {
      const state = createCampaignState();
      const slotsPerDay = state.time.slotsPerDay;

      // Advance through 3 full days
      const next = advanceN(state, slotsPerDay * 3);

      expect(next.time.day).toBe(4); // started on day 1, advanced 3 days
      expect(next.time.slot).toBe(0);
    });

    it('history tracks every advancement with correct day values', () => {
      const state = createCampaignState();
      const slotsPerDay = state.time.slotsPerDay;

      // Advance through one full day + 1 slot into next day
      const next = advanceN(state, slotsPerDay + 1);

      // Should have slotsPerDay + 1 history entries
      expect(next.time.history).toHaveLength(slotsPerDay + 1);

      // The rollover entry should show the new day
      // After the last slot wraps, the next entry is on the new day
      const newDayEntry = next.time.history[slotsPerDay];
      expect(newDayEntry.day).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Checkpoint creation
  // --------------------------------------------------------------------------

  describe('checkpoint creation', () => {
    it('creates a checkpoint on each time advance', () => {
      const state = createCampaignState();
      expect(state.checkpoints.entries).toHaveLength(0);

      const next = campaignReducer(state, { type: 'advanceTime' });
      expect(next.checkpoints.entries).toHaveLength(1);
      expect(next.checkpoints.entries[0].label).toBe('Before time advance');
    });

    it('respects maxSize limit for checkpoints', () => {
      const state = createCampaignState();
      const maxSize = state.checkpoints.maxSize; // 10

      // Advance more than maxSize times
      const next = advanceN(state, maxSize + 5);

      expect(next.checkpoints.entries.length).toBeLessThanOrEqual(maxSize);
    });

    it('checkpoint can be used to restore pre-advance state', () => {
      const state = createCampaignState();
      expect(state.time.day).toBe(1);
      expect(state.time.slot).toBe(0);

      // Advance once
      let next = campaignReducer(state, { type: 'advanceTime' });
      expect(next.time.slot).toBe(1);

      const checkpointId = next.checkpoints.entries[0].id;

      // Restore
      next = campaignReducer(next, { type: 'restoreCheckpoint', payload: checkpointId });

      expect(next.time.day).toBe(1);
      expect(next.time.slot).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Blocking on paused activities
  // --------------------------------------------------------------------------

  describe('paused activity blocking', () => {
    it('blocks time advance when pausedSessionIds is non-empty', () => {
      let state = createCampaignState();

      // Set a paused session
      state = campaignReducer(state, {
        type: 'setPausedSessionIds',
        payload: ['session-paused-1'],
      });

      const next = campaignReducer(state, { type: 'advanceTime' });

      // Time should NOT have advanced
      expect(next.time.day).toBe(1);
      expect(next.time.slot).toBe(0);

      // Blocking error should be set
      expect(next.ui.blockingError).not.toBeNull();
      expect(next.ui.blockingError!.type).toBe('pausedActivities');
    });

    it('clears blocking error on successful advance after unpausing', () => {
      let state = createCampaignState();

      // Pause → try advance → blocks
      state = campaignReducer(state, {
        type: 'setPausedSessionIds',
        payload: ['session-1'],
      });
      state = campaignReducer(state, { type: 'advanceTime' });
      expect(state.ui.blockingError).not.toBeNull();

      // Unpause → advance → succeeds
      state = campaignReducer(state, {
        type: 'setPausedSessionIds',
        payload: [],
      });
      state = campaignReducer(state, { type: 'advanceTime' });

      expect(state.ui.blockingError).toBeNull();
      expect(state.time.slot).toBe(1);
    });

    it('does not create a checkpoint when advance is blocked', () => {
      let state = createCampaignState();

      state = campaignReducer(state, {
        type: 'setPausedSessionIds',
        payload: ['session-1'],
      });

      const next = campaignReducer(state, { type: 'advanceTime' });

      expect(next.checkpoints.entries).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Slot label correctness
  // --------------------------------------------------------------------------

  describe('slot labels', () => {
    it('log message includes the correct slot label', () => {
      const state = createCampaignState();
      const next = campaignReducer(state, { type: 'advanceTime' });

      // After advancing from slot 0, we're at slot 1
      // The log should mention the destination slot label
      // (weather logs may be interspersed, so find the time.advance entry)
      const timeLog = next.logs.entries.find((e) => e.type === 'time.advance');
      expect(timeLog).toBeDefined();
      const logMessage = timeLog!.payload?.message as string;
      expect(logMessage).toContain(state.time.slotLabels[1]);
    });

    it('slot labels cycle correctly across day boundaries', () => {
      const state = createCampaignState();
      const slotsPerDay = state.time.slotsPerDay;

      // Advance to day 2 slot 0
      const next = advanceN(state, slotsPerDay);

      expect(next.time.slot).toBe(0);
      // Find the time.advance log entry (weather logs may be pushed on top)
      const timeLog = next.logs.entries.find((e: { type: string }) => e.type === 'time.advance');
      expect(timeLog).toBeDefined();
      const logMessage = (timeLog as { payload?: { message?: string } })?.payload?.message as string;
      expect(logMessage).toContain(state.time.slotLabels[0]);
    });
  });
});
