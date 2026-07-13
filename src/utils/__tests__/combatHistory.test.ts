import { describe, it, expect, vi } from 'vitest';
import {
  createHistoryState,
  createSnapshot,
  addAction,
  canUndo,
  canRedo,
  getUndoCount,
  getRedoCount,
  rebuildState,
  moveCursor,
  undo,
  redo,
  exportHistory,
  importHistory,
  type RebuildResult,
} from '../combatHistory';
import {
  createTurnAdvanceAction,
  createAddLogEntryAction,
} from '../combatActions';
import type {
  CombatState,
  HistoryState,
  RevealState,
} from '../../types/combatTracker';

// ---------------------------------------------------------------------------
// Fixtures — real-shaped combat state, not synthetic-clean data.
// ---------------------------------------------------------------------------

function makeCombatState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    version: 3,
    id: 'combat-1',
    name: 'Test Skirmish',
    startTime: 1_700_000_000_000,
    participants: [
      {
        instanceId: 'p1',
        name: 'Player 1',
        category: 'player',
        st: 10,
        dx: 12,
        iq: 11,
        ht: 10,
        hp: 10,
        fp: 10,
        mp: 0,
        basicSpeed: 5.5,
        basicMove: 5,
      },
      {
        instanceId: 'e1',
        name: 'Goblin',
        category: 'enemy',
        st: 9,
        dx: 11,
        iq: 8,
        ht: 10,
        hp: 8,
        fp: 8,
        mp: 0,
        basicSpeed: 5.25,
        basicMove: 5,
      },
    ],
    turnOrder: ['p1', 'e1'],
    currentTurnIndex: 0,
    currentRound: 1,
    turnDecisions: {},
    log: [],
    ...overrides,
  };
}

function makeRevealState(): RevealState {
  return {
    combatId: 'combat-1',
    byInstanceId: {
      e1: { hp: { mode: 'hidden' } },
    },
  };
}

// A TURN_ADVANCE action moving to an explicit (round, turnIndex). Deterministic
// and self-inverting via its `inverse` field — ideal for rebuild/undo/redo.
function advanceTo(
  fromRound: number,
  fromTurn: number,
  toRound: number,
  toTurn: number,
): Record<string, unknown> {
  return createTurnAdvanceAction(fromRound, fromTurn, toRound, toTurn) as Record<string, unknown>;
}

describe('combatHistory', () => {
  describe('createHistoryState', () => {
    it('returns an empty history with default config', () => {
      const h = createHistoryState();
      expect(h.version).toBe(1);
      expect(h.actions).toEqual([]);
      expect(h.cursor).toBe(0);
      expect(h.checkpoints).toEqual([]);
      expect(h.checkpointEvery).toBe(25);
      expect(h.maxActions).toBe(500);
      expect(h.maxCheckpoints).toBe(30);
    });

    it('honors overridden config values', () => {
      const h = createHistoryState({ checkpointEvery: 2, maxActions: 3, maxCheckpoints: 5 });
      expect(h.checkpointEvery).toBe(2);
      expect(h.maxActions).toBe(3);
      expect(h.maxCheckpoints).toBe(5);
    });
  });

  describe('createSnapshot', () => {
    it('strips the history field from the combat state', () => {
      const stateWithHistory: CombatState & { history: HistoryState } = {
        ...makeCombatState(),
        history: createHistoryState(),
      };
      const snapshot = createSnapshot(stateWithHistory, null);
      expect(snapshot).not.toHaveProperty('history');
      expect(snapshot).toHaveProperty('id', 'combat-1');
    });

    it('wraps the snapshot with a deep-cloned reveal state when provided', () => {
      const reveal = makeRevealState();
      const snapshot = createSnapshot(makeCombatState(), reveal);
      expect(snapshot).toHaveProperty('combatState');
      expect(snapshot).toHaveProperty('revealState');
      const wrapped = snapshot as { revealState: RevealState };
      // Deep clone: equal by value but not the same reference.
      expect(wrapped.revealState).toEqual(reveal);
      expect(wrapped.revealState).not.toBe(reveal);
    });
  });

  describe('addAction', () => {
    it('appends an action and advances the cursor', () => {
      const h0 = createHistoryState();
      const h1 = addAction(h0, advanceTo(1, 0, 1, 1), makeCombatState());
      expect(h1.actions).toHaveLength(1);
      expect(h1.cursor).toBe(1);
      expect(h0.actions).toHaveLength(0); // original untouched
    });

    it('discards the redo tail when adding after moving the cursor back (branching)', () => {
      let h = createHistoryState();
      h = addAction(h, advanceTo(1, 0, 1, 1), makeCombatState());
      h = addAction(h, advanceTo(1, 1, 2, 0), makeCombatState());
      expect(h.cursor).toBe(2);

      h = moveCursor(h, 1);
      const branchAction = advanceTo(1, 1, 5, 5);
      h = addAction(h, branchAction, makeCombatState());

      expect(h.actions).toHaveLength(2);
      expect(h.cursor).toBe(2);
      expect(h.actions[1]).toBe(branchAction);
    });

    it('creates a checkpoint every `checkpointEvery` actions', () => {
      let h = createHistoryState({ checkpointEvery: 2 });
      h = addAction(h, advanceTo(1, 0, 1, 1), makeCombatState());
      expect(h.checkpoints).toHaveLength(0);
      h = addAction(h, advanceTo(1, 1, 2, 0), makeCombatState({ currentRound: 2 }));
      expect(h.checkpoints).toHaveLength(1);
      expect(h.checkpoints[0].at).toBe(2);
    });

    it('prunes the oldest actions past maxActions and shifts the cursor', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let h = createHistoryState({ maxActions: 3, checkpointEvery: 999 });
      for (let i = 0; i < 5; i++) {
        h = addAction(h, advanceTo(1, i, 1, i + 1), makeCombatState());
      }
      expect(h.actions).toHaveLength(3);
      // Five added, capped at three, cursor tracks the retained window.
      expect(h.cursor).toBe(3);
      warn.mockRestore();
    });

    it('throws when historyState or action is missing', () => {
      const h = createHistoryState();
      // @ts-expect-error deliberately passing null action to hit the guard
      expect(() => addAction(h, null, makeCombatState())).toThrow();
    });
  });

  describe('canUndo / canRedo / counts', () => {
    it('reports undo availability from the cursor position', () => {
      let h = createHistoryState();
      expect(canUndo(h)).toBe(false);
      expect(getUndoCount(h)).toBe(0);
      h = addAction(h, advanceTo(1, 0, 1, 1), makeCombatState());
      expect(canUndo(h)).toBe(true);
      expect(getUndoCount(h)).toBe(1);
    });

    it('reports redo availability after moving the cursor back', () => {
      let h = createHistoryState();
      h = addAction(h, advanceTo(1, 0, 1, 1), makeCombatState());
      expect(canRedo(h)).toBe(false);
      expect(getRedoCount(h)).toBe(0);
      h = moveCursor(h, 0);
      expect(canRedo(h)).toBe(true);
      expect(getRedoCount(h)).toBe(1);
    });

    it('handles null/undefined history safely', () => {
      expect(canUndo(null)).toBe(false);
      expect(canRedo(undefined)).toBe(false);
      expect(getUndoCount(null)).toBe(0);
      expect(getRedoCount(undefined)).toBe(0);
    });
  });

  describe('moveCursor', () => {
    it('clamps the cursor into the valid [0, actions.length] range', () => {
      let h = createHistoryState();
      h = addAction(h, advanceTo(1, 0, 1, 1), makeCombatState());
      expect(moveCursor(h, 99).cursor).toBe(1);
      expect(moveCursor(h, -5).cursor).toBe(0);
    });

    it('throws when historyState is missing', () => {
      // @ts-expect-error deliberately passing null to hit the guard
      expect(() => moveCursor(null, 0)).toThrow();
    });
  });

  describe('rebuildState', () => {
    it('returns the base state unchanged at cursor 0', () => {
      const base = makeCombatState();
      let h = createHistoryState();
      h = addAction(h, advanceTo(1, 0, 1, 1), base);
      expect(rebuildState(base, h, 0)).toBe(base);
    });

    it('replays actions forward from the base when no checkpoint applies', () => {
      const base = makeCombatState();
      let h = createHistoryState({ checkpointEvery: 999 });
      h = addAction(h, advanceTo(1, 0, 1, 1), base);
      h = addAction(h, advanceTo(1, 1, 2, 0), base);

      const rebuilt = rebuildState(base, h, 1) as CombatState;
      expect(rebuilt.currentRound).toBe(1);
      expect(rebuilt.currentTurnIndex).toBe(1);
      // Base is never mutated by replay.
      expect(base.currentTurnIndex).toBe(0);
    });

    it('resumes from the nearest checkpoint instead of replaying from zero', () => {
      const base = makeCombatState();
      let h = createHistoryState({ checkpointEvery: 2 });
      // Two actions -> checkpoint recorded at cursor 2 with the post-action state.
      h = addAction(h, advanceTo(1, 0, 1, 1), makeCombatState({ currentTurnIndex: 1 }));
      h = addAction(h, advanceTo(1, 1, 2, 0), makeCombatState({ currentRound: 2, currentTurnIndex: 0 }));
      // Third action after the checkpoint.
      h = addAction(h, advanceTo(2, 0, 2, 1), makeCombatState());
      expect(h.checkpoints[0].at).toBe(2);

      const rebuilt = rebuildState(base, h, 3) as CombatState;
      expect(rebuilt.currentRound).toBe(2);
      expect(rebuilt.currentTurnIndex).toBe(1);
    });

    it('returns a RebuildResult carrying reveal state when a base reveal is supplied', () => {
      const base = makeCombatState();
      const reveal = makeRevealState();
      let h = createHistoryState();
      h = addAction(h, advanceTo(1, 0, 1, 1), base);
      const result = rebuildState(base, h, 0, reveal) as RebuildResult;
      expect(result.combatState).toBe(base);
      expect(result.revealState).toBe(reveal);
    });

    it('warns and stops when the target cursor exceeds the recorded actions', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const base = makeCombatState();
      let h = createHistoryState({ checkpointEvery: 999 });
      h = addAction(h, advanceTo(1, 0, 1, 1), base);
      // Ask to rebuild beyond the single recorded action.
      rebuildState(base, h, 5);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('throws when baseState or historyState is missing', () => {
      const h = createHistoryState();
      // @ts-expect-error deliberately passing null base state
      expect(() => rebuildState(null, h, 0)).toThrow();
    });
  });

  describe('undo / redo', () => {
    it('inverts the last action via the current state fast-path', () => {
      const base = makeCombatState();
      let h = createHistoryState();
      const action = advanceTo(1, 0, 1, 1);
      h = addAction(h, action, base);
      const current = makeCombatState({ currentTurnIndex: 1 });

      const result = undo(base, h, current);
      expect(result.newHistory.cursor).toBe(0);
      expect(result.newCombatState.currentTurnIndex).toBe(0);
      expect(result.newCombatState.currentRound).toBe(1);
    });

    it('is a no-op at the undo boundary and preserves reveal state', () => {
      const base = makeCombatState();
      const reveal = makeRevealState();
      const h = createHistoryState();
      const result = undo(base, h, null, reveal);
      expect(result.newHistory).toBe(h);
      expect(result.newCombatState).toBe(base);
      expect(result.newRevealState).toBe(reveal);
    });

    it('replays the next action forward on redo', () => {
      const base = makeCombatState();
      let h = createHistoryState();
      h = addAction(h, advanceTo(1, 0, 1, 1), base);
      h = moveCursor(h, 0); // rewind so redo has something to do

      const result = redo(base, h, base);
      expect(result.newHistory.cursor).toBe(1);
      expect(result.newCombatState.currentTurnIndex).toBe(1);
    });

    it('is a no-op at the redo boundary', () => {
      const base = makeCombatState();
      let h = createHistoryState();
      h = addAction(h, advanceTo(1, 0, 1, 1), base);
      const current = makeCombatState({ currentTurnIndex: 1 });
      const result = redo(base, h, current);
      expect(result.newHistory).toBe(h);
      expect(result.newCombatState).toBe(current);
    });

    it('round-trips state through undo then redo', () => {
      const base = makeCombatState();
      let h = createHistoryState();
      const action = createAddLogEntryAction({
        id: 'log-1',
        timestamp: 1_700_000_000_001,
        entryType: 'note',
        text: 'first blood',
      }) as Record<string, unknown>;
      // Apply then record, mirroring real usage.
      h = addAction(h, action, base);
      const afterAdd = rebuildState(base, h, 1) as CombatState;
      expect(afterAdd.log).toHaveLength(1);

      const undone = undo(base, h, afterAdd);
      expect(undone.newCombatState.log).toHaveLength(0);

      const redone = redo(base, undone.newHistory, undone.newCombatState);
      expect(redone.newCombatState.log).toHaveLength(1);
      expect(redone.newCombatState.log[0].text).toBe('first blood');
    });
  });

  describe('exportHistory / importHistory', () => {
    it('exports all history fields verbatim', () => {
      let h = createHistoryState({ checkpointEvery: 2 });
      h = addAction(h, advanceTo(1, 0, 1, 1), makeCombatState());
      const exported = exportHistory(h);
      expect(exported).toEqual({
        version: h.version,
        actions: h.actions,
        cursor: h.cursor,
        checkpoints: h.checkpoints,
        checkpointEvery: h.checkpointEvery,
        maxActions: h.maxActions,
        maxCheckpoints: h.maxCheckpoints,
      });
    });

    it('round-trips through export then import', () => {
      let h = createHistoryState();
      h = addAction(h, advanceTo(1, 0, 1, 1), makeCombatState());
      const restored = importHistory(exportHistory(h));
      expect(restored.actions).toHaveLength(1);
      expect(restored.cursor).toBe(1);
    });

    it('falls back to a fresh history for non-object input', () => {
      expect(importHistory(null)).toEqual(createHistoryState());
      expect(importHistory('not an object')).toEqual(createHistoryState());
      expect(importHistory(42)).toEqual(createHistoryState());
    });

    it('sanitizes partial or malformed fields to safe defaults', () => {
      const restored = importHistory({ actions: 'not-an-array', cursor: 'nope', checkpoints: null });
      expect(restored.actions).toEqual([]);
      expect(restored.cursor).toBe(0);
      expect(restored.checkpoints).toEqual([]);
      expect(restored.checkpointEvery).toBe(25);
      expect(restored.maxActions).toBe(500);
    });

    it('preserves valid partial fields', () => {
      const restored = importHistory({ version: 2, cursor: 3, actions: [{ type: 'X' }] });
      expect(restored.version).toBe(2);
      expect(restored.cursor).toBe(3);
      expect(restored.actions).toHaveLength(1);
    });
  });
});
