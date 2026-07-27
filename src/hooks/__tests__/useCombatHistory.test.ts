import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CombatState,
  Participant,
  RevealEntry,
  RevealState,
} from '../../types/combatTracker';
import { createTurnAdvanceAction } from '../../utils/combatActions';

interface MockCombatStoreValue {
  combatActive: CombatState | null;
  combatReveal: RevealState | null;
  saveCombatActive: ReturnType<
    typeof vi.fn<(combat: CombatState) => void>
  >;
  saveCombatReveal: ReturnType<
    typeof vi.fn<(reveal: RevealState | null) => void>
  >;
}

const useCombatStoreMock = vi.hoisted(
  () => vi.fn<() => MockCombatStoreValue>(),
);

vi.mock('../useCombatStore', () => ({
  useCombatStore: useCombatStoreMock,
}));

import { useCombatHistory } from '../useCombatHistory';

function makeParticipant(
  overrides: Partial<Participant> = {},
): Participant {
  return {
    instanceId: 'participant-1',
    name: 'Knight',
    category: 'ally',
    st: 12,
    dx: 11,
    iq: 10,
    ht: 11,
    hp: 12,
    fp: 11,
    mp: 0,
    basicSpeed: 5.5,
    basicMove: 5,
    ...overrides,
  };
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  const participant = makeParticipant();
  return {
    id: 'combat-1',
    name: 'Bridge Ambush',
    startTime: 1,
    participants: [participant],
    turnOrder: [participant.instanceId],
    currentTurnIndex: 0,
    currentRound: 1,
    turnDecisions: {},
    log: [],
    ...overrides,
  };
}

function makeRevealEntry(): RevealEntry {
  return {
    name: 'full',
    tags: 'full',
    hp: { mode: 'exact' },
    fp: { mode: 'exact' },
    mp: { mode: 'exact' },
    defenses: {
      dodge: 'exact',
      parry: 'exact',
      block: 'exact',
    },
    dr: {
      general: 'exact',
      byLocation: {},
    },
    attacks: 'full',
    notes: 'full',
  };
}

function makeReveal(): RevealState {
  return {
    version: 1,
    combatId: 'combat-1',
    byInstanceId: { 'participant-1': makeRevealEntry() },
  };
}

function makeStore(
  overrides: Partial<MockCombatStoreValue> = {},
): MockCombatStoreValue {
  return {
    combatActive: makeCombat(),
    combatReveal: null,
    saveCombatActive: vi.fn<(combat: CombatState) => void>(),
    saveCombatReveal: vi.fn<(reveal: RevealState | null) => void>(),
    ...overrides,
  };
}

describe('useCombatHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records an action and advances the history cursor', () => {
    const store = makeStore();
    useCombatStoreMock.mockReturnValue(store);
    const { result } = renderHook(() => useCombatHistory());
    const action = createTurnAdvanceAction(1, 0, 2, 0);

    act(() => {
      result.current.recordAction(action);
    });

    expect(result.current.history.actions).toEqual([action]);
    expect(result.current.history.cursor).toBe(1);
  });

  it('undoes and redoes a store-backed state change as a round trip', () => {
    const before = makeCombat({ currentRound: 1 });
    const after = makeCombat({ currentRound: 2 });
    let store = makeStore({ combatActive: before });
    useCombatStoreMock.mockImplementation(() => store);
    const { result, rerender } = renderHook(() => useCombatHistory());

    act(() => {
      result.current.recordAction(createTurnAdvanceAction(1, 0, 2, 0));
    });

    store = { ...store, combatActive: after };
    rerender();

    act(() => {
      result.current.handleUndo();
    });

    expect(store.saveCombatActive).toHaveBeenLastCalledWith(before);
    expect(result.current.history.cursor).toBe(0);

    store = { ...store, combatActive: before };
    rerender();

    act(() => {
      result.current.handleRedo();
    });

    expect(store.saveCombatActive).toHaveBeenLastCalledWith(after);
    expect(store.saveCombatActive).toHaveBeenCalledTimes(2);
    expect(result.current.history.cursor).toBe(1);
  });

  it('saves synchronized reveal state when undo and redo produce it', () => {
    const reveal = makeReveal();
    let store = makeStore({ combatReveal: reveal });
    useCombatStoreMock.mockImplementation(() => store);
    const { result, rerender } = renderHook(() => useCombatHistory());

    act(() => {
      result.current.recordAction(createTurnAdvanceAction(1, 0, 2, 0));
    });

    store = {
      ...store,
      combatActive: makeCombat({ currentRound: 2 }),
      combatReveal: reveal,
    };
    rerender();

    act(() => {
      result.current.handleUndo();
    });

    const undoReveal = store.saveCombatReveal.mock.calls[0][0];
    expect(undoReveal).toEqual(reveal);

    store = {
      ...store,
      combatActive: store.saveCombatActive.mock.calls[0][0],
      combatReveal: undoReveal,
    };
    rerender();

    act(() => {
      result.current.handleRedo();
    });

    expect(store.saveCombatReveal).toHaveBeenCalledTimes(2);
    expect(store.saveCombatReveal).toHaveBeenLastCalledWith(reveal);
  });

  it('does not save when empty history cannot undo or redo', () => {
    const store = makeStore();
    useCombatStoreMock.mockReturnValue(store);
    const { result } = renderHook(() => useCombatHistory());

    act(() => {
      result.current.handleUndo();
      result.current.handleRedo();
    });

    expect(store.saveCombatActive).not.toHaveBeenCalled();
    expect(store.saveCombatReveal).not.toHaveBeenCalled();
    expect(result.current.history.cursor).toBe(0);
  });

  it('ignores actions without an active combat and resets for a new combat id', () => {
    let store = makeStore({ combatActive: null });
    useCombatStoreMock.mockImplementation(() => store);
    const { result, rerender } = renderHook(() => useCombatHistory());

    act(() => {
      result.current.recordAction(createTurnAdvanceAction(1, 0, 2, 0));
    });
    expect(result.current.history.actions).toEqual([]);

    store = { ...store, combatActive: makeCombat({ id: 'combat-1' }) };
    rerender();
    act(() => {
      result.current.recordAction(createTurnAdvanceAction(1, 0, 2, 0));
    });
    expect(result.current.history.cursor).toBe(1);

    store = { ...store, combatActive: makeCombat({ id: 'combat-2' }) };
    rerender();
    expect(result.current.history.actions).toEqual([]);
    expect(result.current.history.cursor).toBe(0);
  });
});
