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
  createDefaultRevealForInstance,
  syncRevealStateForParticipants,
  removeCombatantFromReveal,
} from '../utils/combatReveal';
import type { RevealEntry, RevealState } from '../types/combatTracker';

// TODO(types): setRevealForInstance's RevealState/RevealEntry parameters exclude malformed crash-path inputs.
const setRevealForMalformedInput = setRevealForInstance as (
  revealState: RevealState | Record<string, unknown> | null | undefined,
  instanceId: string,
  nextReveal: RevealEntry | Record<string, unknown>
) => RevealState;

// TODO(types): addCombatantToReveal's RevealState parameter excludes malformed crash-path inputs.
const addCombatantToMalformedReveal = addCombatantToReveal as (
  revealState: unknown,
  instanceId: string,
  side: string
) => RevealState;

// TODO(types): syncRevealStateForParticipants's RevealState parameter excludes malformed crash-path inputs.
const syncMalformedRevealState = syncRevealStateForParticipants as (
  revealState: unknown,
  participants: Parameters<typeof syncRevealStateForParticipants>[1]
) => RevealState | null | undefined;

// TODO(types): removeCombatantFromReveal's RevealState parameter excludes malformed crash-path inputs.
const removeCombatantFromMalformedReveal = removeCombatantFromReveal as (
  revealState: unknown,
  instanceId: string
) => RevealState;

function requireRevealState(
  revealState: RevealState | null | undefined
): RevealState {
  if (!revealState) {
    throw new Error('Expected reveal state');
  }
  return revealState;
}

// ---------------------------------------------------------------------------
// combatReveal.js — JSON.parse(JSON.stringify(revealState)) deep-clone paths
// ---------------------------------------------------------------------------
describe('combatReveal deep-clone crash paths', () => {
  const validRevealState: RevealState = {
    byInstanceId: {
      'char-1': createDefaultRevealForInstance('char-1', 'enemy'),
    },
  };

  describe('setRevealForInstance', () => {
    it('works with valid reveal state', () => {
      const result = setRevealForMalformedInput(
        validRevealState,
        'char-2',
        { name: 'visible' }
      );
      expect(result.byInstanceId['char-2'].name).toBe('visible');
      // Original untouched
      expect(validRevealState.byInstanceId['char-2']).toBeUndefined();
    });

    it('initializes byInstanceId if missing', () => {
      const result = setRevealForMalformedInput({}, 'char-1', { name: 'visible' });
      expect(result.byInstanceId['char-1'].name).toBe('visible');
    });

    it('throws on null input (documents crash risk)', () => {
      expect(() => setRevealForMalformedInput(null, 'char-1', {})).toThrow();
    });

    it('throws on undefined input (documents crash risk)', () => {
      expect(() => setRevealForMalformedInput(undefined, 'char-1', {})).toThrow();
    });

    it('handles circular reference gracefully (safeDeepClone returns original)', () => {
      const circular: RevealState & { self?: RevealState } = { byInstanceId: {} };
      circular.self = circular;
      // safeDeepClone catches the JSON serialization error and returns the original reference,
      // so setRevealForInstance completes without throwing
      const result = setRevealForMalformedInput(circular, 'char-1', {});
      expect(result.byInstanceId['char-1']).toBeDefined();
    });
  });

  describe('addCombatantToReveal', () => {
    it('works with valid reveal state', () => {
      const result = addCombatantToReveal(validRevealState, 'new-1', 'enemy');
      expect(result.byInstanceId['new-1']).toBeDefined();
      expect(result.byInstanceId['char-1']).toBeDefined();
    });

    it('throws on null input (documents crash risk)', () => {
      expect(() => addCombatantToMalformedReveal(null, 'char-1', 'enemy')).toThrow();
    });
  });

  describe('syncRevealStateForParticipants', () => {
    it('returns null/undefined for null input (guard clause)', () => {
      expect(syncRevealStateForParticipants(null, [])).toBeNull();
      expect(syncRevealStateForParticipants(undefined, [])).toBeUndefined();
    });

    it('removes entries for missing participants', () => {
      const result = requireRevealState(
        syncRevealStateForParticipants(validRevealState, [])
      );
      expect(Object.keys(result.byInstanceId)).toHaveLength(0);
    });

    it('adds defaults for new participants', () => {
      const result = requireRevealState(
        syncRevealStateForParticipants(validRevealState, [
          { instanceId: 'char-1', category: 'ally' },
          { instanceId: 'new-char', category: 'enemy' },
        ])
      );
      expect(result.byInstanceId['char-1']).toBeDefined();
      expect(result.byInstanceId['new-char']).toBeDefined();
    });

    it('crashes with reveal state missing byInstanceId (documents bug)', () => {
      // This documents a real crash: syncRevealStateForParticipants assumes
      // byInstanceId exists after deep clone but doesn't initialize it.
      // Fix target: Phase 10d
      expect(() =>
        syncMalformedRevealState({}, [
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
      expect(() => removeCombatantFromMalformedReveal(null, 'char-1')).toThrow();
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
    state.checkpoints = { entries: [], maxSize: 10 };

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
      entries: [{ id: 'cp-1', label: 'Checkpoint 1', snapshot, createdAt: Date.now() }],
      maxSize: 10,
    };

    const next = campaignReducer(state, {
      type: 'restoreCheckpoint',
      payload: 'cp-1',
    });
    expect(next.time.day).toBe(5);
  });
});
