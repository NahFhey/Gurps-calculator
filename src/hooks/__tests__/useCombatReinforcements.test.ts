import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Character,
  CombatState,
  Participant,
  ReinforcementData,
  RevealEntry,
  RevealState,
} from '../../types/combatTracker';
import { ACTION_TYPES } from '../../utils/combatActions';

interface MockCombatStoreValue {
  combatCharacters: Character[];
  saveCombatActive: ReturnType<
    typeof vi.fn<(combat: CombatState) => void>
  >;
  saveCombatReveal: ReturnType<
    typeof vi.fn<(reveal: RevealState) => void>
  >;
}

const useCombatStoreMock = vi.hoisted(
  () => vi.fn<() => MockCombatStoreValue>(),
);

vi.mock('../useCombatStore', () => ({
  useCombatStore: useCombatStoreMock,
}));

import { useCombatReinforcements } from '../useCombatReinforcements';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'library-1',
    name: 'Goblin',
    category: 'enemy',
    hp: 10,
    fp: 8,
    mp: 0,
    basicSpeed: 6,
    dx: 12,
    st: 9,
    iq: 9,
    ht: 10,
    dodge: 9,
    parry: 8,
    block: 0,
    dr: 1,
    ...overrides,
  };
}

function makeParticipant(
  overrides: Partial<Participant> = {},
): Participant {
  return {
    instanceId: 'participant-fast',
    name: 'Swift',
    category: 'enemy',
    st: 10,
    dx: 13,
    iq: 10,
    ht: 10,
    hp: 10,
    fp: 10,
    mp: 0,
    basicSpeed: 7,
    basicMove: 6,
    ...overrides,
  };
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  const fast = makeParticipant();
  const slow = makeParticipant({
    instanceId: 'participant-slow',
    name: 'Slow',
    dx: 10,
    basicSpeed: 5,
  });
  return {
    id: 'combat-1',
    name: 'Gate Battle',
    startTime: 1,
    participants: [fast, slow],
    turnOrder: [fast.instanceId, slow.instanceId],
    currentTurnIndex: 0,
    currentRound: 3,
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
    dr: { general: 'exact', byLocation: {} },
    attacks: 'full',
    notes: 'full',
  };
}

function makeReveal(): RevealState {
  return {
    version: 1,
    combatId: 'combat-1',
    byInstanceId: {
      'participant-fast': makeRevealEntry(),
      'participant-slow': makeRevealEntry(),
    },
  };
}

function makeData(
  overrides: Partial<ReinforcementData> = {},
): ReinforcementData {
  return {
    characterId: 'library-1',
    category: 'enemy',
    previewNames: ['Goblin A'],
    insertionMode: 'next_turn',
    ...overrides,
  };
}

function setup(
  options: {
    combat?: CombatState;
    reveal?: RevealState | null;
    characters?: Character[];
  } = {},
) {
  const combat = options.combat ?? makeCombat();
  const reveal = options.reveal === undefined ? makeReveal() : options.reveal;
  const store: MockCombatStoreValue = {
    combatCharacters: options.characters ?? [makeCharacter()],
    saveCombatActive: vi.fn<(value: CombatState) => void>(),
    saveCombatReveal: vi.fn<(value: RevealState) => void>(),
  };
  const recordAction = vi.fn<(action: unknown) => void>();
  useCombatStoreMock.mockReturnValue(store);
  const { result } = renderHook(() =>
    useCombatReinforcements({ combat, reveal, recordAction }),
  );

  return { result, combat, reveal, store, recordAction };
}

function addedParticipants(saved: CombatState, original: CombatState) {
  return saved.participants.slice(original.participants.length);
}

describe('useCombatReinforcements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts next-turn reinforcements after the current actor and saves reveal/action data', () => {
    const { result, combat, store, recordAction } = setup();

    act(() => {
      result.current.handleAddReinforcements(makeData());
    });

    const saved = store.saveCombatActive.mock.calls[0][0];
    const [added] = addedParticipants(saved, combat);
    expect(saved.turnOrder).toEqual([
      'participant-fast',
      added.instanceId,
      'participant-slow',
    ]);
    expect(added).toEqual(
      expect.objectContaining({
        name: 'Goblin A',
        libraryId: 'library-1',
        category: 'enemy',
        currentHP: 10,
      }),
    );
    expect(saved.log[0]).toEqual(
      expect.objectContaining({
        entryType: 'reinforcement',
        round: 3,
        turn: 0,
      }),
    );
    expect(store.saveCombatReveal).toHaveBeenCalledTimes(1);
    expect(
      store.saveCombatReveal.mock.calls[0][0].byInstanceId[added.instanceId],
    ).toBeDefined();
    expect(recordAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: ACTION_TYPES.ADD_REINFORCEMENTS }),
    );
  });

  it('appends end-of-round reinforcements in preview-name order', () => {
    const { result, combat, store } = setup();

    act(() => {
      result.current.handleAddReinforcements(
        makeData({
          insertionMode: 'end_of_round',
          previewNames: ['Goblin A', 'Goblin B'],
        }),
      );
    });

    const saved = store.saveCombatActive.mock.calls[0][0];
    const added = addedParticipants(saved, combat);
    expect(added.map((participant) => participant.name)).toEqual([
      'Goblin A',
      'Goblin B',
    ]);
    expect(saved.turnOrder).toEqual([
      ...combat.turnOrder,
      ...added.map((participant) => participant.instanceId),
    ]);
  });

  it('auto-sorts reinforcements by speed between existing combatants', () => {
    const { result, combat, store } = setup();

    act(() => {
      result.current.handleAddReinforcements(
        makeData({ insertionMode: 'auto' }),
      );
    });

    const saved = store.saveCombatActive.mock.calls[0][0];
    const [added] = addedParticipants(saved, combat);
    expect(saved.turnOrder).toEqual([
      'participant-fast',
      added.instanceId,
      'participant-slow',
    ]);
  });

  it('resolves manual new-index placeholders into generated instance ids', () => {
    const { result, combat, store } = setup();

    act(() => {
      result.current.handleAddReinforcements(
        makeData({
          insertionMode: 'manual',
          previewNames: ['Goblin A', 'Goblin B'],
          manualOrder: [
            'participant-slow',
            'new-1',
            'participant-fast',
            'new-0',
          ],
        }),
      );
    });

    const saved = store.saveCombatActive.mock.calls[0][0];
    const added = addedParticipants(saved, combat);
    expect(saved.turnOrder).toEqual([
      'participant-slow',
      added[1].instanceId,
      'participant-fast',
      added[0].instanceId,
    ]);
  });

  it('keeps objects out of turn order while still adding them to combat', () => {
    const { result, combat, store } = setup();

    act(() => {
      result.current.handleAddReinforcements(
        makeData({ category: 'object', insertionMode: 'auto' }),
      );
    });

    const saved = store.saveCombatActive.mock.calls[0][0];
    expect(saved.turnOrder).toEqual(combat.turnOrder);
    expect(addedParticipants(saved, combat)[0].category).toBe('object');
  });

  it('is a no-op for an unknown character or an empty preview list', () => {
    const { result, store, recordAction } = setup();

    act(() => {
      result.current.handleAddReinforcements(
        makeData({ characterId: 'missing' }),
      );
      result.current.handleAddReinforcements(
        makeData({ previewNames: [] }),
      );
    });

    expect(store.saveCombatActive).not.toHaveBeenCalled();
    expect(store.saveCombatReveal).not.toHaveBeenCalled();
    expect(recordAction).not.toHaveBeenCalled();
  });
});
