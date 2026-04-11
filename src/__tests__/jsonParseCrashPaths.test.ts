// @ts-nocheck
/**
 * Tests for unprotected JSON.parse crash paths.
 *
 * These tests verify that functions using JSON.parse(JSON.stringify(x))
 * for deep cloning don't crash when given corrupted or unexpected input.
 * The ROADMAP flagged these as high-risk unprotected paths:
 * - combatReveal.js: setRevealForInstance, addCombatantToReveal,
 *   syncRevealStateForParticipants, removeCombatantFromReveal
 * - combatHistory.js: rebuildStateAtCursor, applyRevealUpdate
 * - campaignReducer.ts: restoreCheckpoint action
 */
import { describe, it, expect } from 'vitest';
import {
  setRevealForInstance,
  addCombatantToReveal,
  syncRevealStateForParticipants,
  removeCombatantFromReveal,
} from '../utils/combatReveal';

// ---------------------------------------------------------------------------
// combatReveal.js — JSON.parse(JSON.stringify(revealState)) deep-clone paths
// ---------------------------------------------------------------------------
describe('combatReveal deep-clone crash paths', () => {
  const validRevealState = {
    byInstanceId: {
      'char-1': { name: 'visible', hp: { mode: 'hidden' } },
    },
  };

  describe('setRevealForInstance', () => {
    it('works with valid reveal state', () => {
      const result = setRevealForInstance(validRevealState, 'char-2', { name: 'visible' });
      expect(result.byInstanceId['char-2'].name).toBe('visible');
      // Original untouched
      expect(validRevealState.byInstanceId['char-2']).toBeUndefined();
    });

    it('initializes byInstanceId if missing', () => {
      const result = setRevealForInstance({}, 'char-1', { name: 'visible' });
      expect(result.byInstanceId['char-1'].name).toBe('visible');
    });

    it('throws on null input (documents crash risk)', () => {
      expect(() => setRevealForInstance(null, 'char-1', {})).toThrow();
    });

    it('throws on undefined input (documents crash risk)', () => {
      expect(() => setRevealForInstance(undefined, 'char-1', {})).toThrow();
    });

    it('handles circular reference rejection', () => {
      const circular = { byInstanceId: {} };
      circular.self = circular;
      expect(() => setRevealForInstance(circular, 'char-1', {})).toThrow();
    });
  });

  describe('addCombatantToReveal', () => {
    it('works with valid reveal state', () => {
      const result = addCombatantToReveal(validRevealState, 'new-1', 'enemy');
      expect(result.byInstanceId['new-1']).toBeDefined();
      expect(result.byInstanceId['char-1']).toBeDefined();
    });

    it('throws on null input (documents crash risk)', () => {
      expect(() => addCombatantToReveal(null, 'char-1', 'enemy')).toThrow();
    });
  });

  describe('syncRevealStateForParticipants', () => {
    it('returns null/undefined for null input (guard clause)', () => {
      expect(syncRevealStateForParticipants(null, [])).toBeNull();
      expect(syncRevealStateForParticipants(undefined, [])).toBeUndefined();
    });

    it('removes entries for missing participants', () => {
      const result = syncRevealStateForParticipants(validRevealState, []);
      expect(Object.keys(result.byInstanceId)).toHaveLength(0);
    });

    it('adds defaults for new participants', () => {
      const result = syncRevealStateForParticipants(validRevealState, [
        { instanceId: 'char-1', category: 'ally' },
        { instanceId: 'new-char', category: 'enemy' },
      ]);
      expect(result.byInstanceId['char-1']).toBeDefined();
      expect(result.byInstanceId['new-char']).toBeDefined();
    });

    it('crashes with reveal state missing byInstanceId (documents bug)', () => {
      // This documents a real crash: syncRevealStateForParticipants assumes
      // byInstanceId exists after deep clone but doesn't initialize it.
      // Fix target: Phase 10d
      expect(() =>
        syncRevealStateForParticipants({}, [
          { instanceId: 'char-1', category: 'enemy' },
        ])
      ).toThrow();
    });
  });

  describe('removeCombatantFromReveal', () => {
    it('removes the specified instance', () => {
      const result = removeCombatantFromReveal(validRevealState, 'char-1');
      expect(result.byInstanceId['char-1']).toBeUndefined();
    });

    it('throws on null input (documents crash risk)', () => {
      expect(() => removeCombatantFromReveal(null, 'char-1')).toThrow();
    });

    it('handles removing non-existent instance gracefully', () => {
      const result = removeCombatantFromReveal(validRevealState, 'nonexistent');
      expect(result.byInstanceId['char-1']).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// campaignReducer — restoreCheckpoint deep-clone
// ---------------------------------------------------------------------------
describe('campaignReducer restoreCheckpoint', () => {
  // Import dynamically since the reducer is large
  it('restoreCheckpoint handles nonexistent checkpoint id', async () => {
    const { campaignReducer, createCampaignState } = await import('../state/campaignReducer');
    const state = createCampaignState();
    state.checkpoints = { entries: [], maxEntries: 10 };

    // Should not crash, just return unchanged state
    const next = campaignReducer(state, {
      type: 'restoreCheckpoint',
      payload: 'nonexistent-id',
    });
    expect(next.time.day).toBe(state.time.day);
  });

  it('restoreCheckpoint with valid checkpoint restores state', async () => {
    const { campaignReducer, createCampaignState } = await import('../state/campaignReducer');
    const state = createCampaignState();
    state.time.day = 10;

    const snapshot = {
      ui: state.ui,
      meta: state.meta,
      entities: state.entities,
      legacy: state.legacy,
      time: { ...state.time, day: 5 },
      inventory: state.inventory,
      crafting: state.crafting,
      alchemy: state.alchemy,
      gathering: state.gathering,
      combat: state.combat,
      locations: state.locations,
      downtime: state.downtime,
      maps: state.maps,
      dayPlanner: state.dayPlanner,
      activities: state.activities,
      logs: state.logs,
    };

    state.checkpoints = {
      entries: [{ id: 'cp-1', label: 'Checkpoint 1', snapshot, timestamp: Date.now() }],
      maxEntries: 10,
    };

    const next = campaignReducer(state, {
      type: 'restoreCheckpoint',
      payload: 'cp-1',
    });
    expect(next.time.day).toBe(5);
  });
});
