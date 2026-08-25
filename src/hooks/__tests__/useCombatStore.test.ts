import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCombatStore } from '../useCombatStore';
import type { CombatCharacter, CombatItem, Character } from '../../types/campaign';
import type { CombatState, RevealState } from '../../types/combatTracker';

// Mock the campaign store
interface MockCampaignState {
  entities: {
    combatCharacters: Record<string, CombatCharacter>;
    combatItems: Record<string, CombatItem>;
    characters: Record<string, Character>;
    combatHistory: CombatState[];
    combatTombstones: CombatCharacter[];
    encounterTemplates?: Record<string, never>;
  };
  combat: {
    activeSession: CombatState | null;
    rulesPreset: string;
    reveal: Record<string, unknown>;
    revealState?: RevealState | null;
  };
}

interface MockCampaignStoreValue {
  state: MockCampaignState;
  actions: ReturnType<typeof createMockActions>;
}

const useCampaignStoreMock = vi.hoisted(
  () => vi.fn<() => MockCampaignStoreValue>(),
);

vi.mock('../../state/campaignStore', () => ({
  useCampaignStore: useCampaignStoreMock,
}));

const mockedUseCampaignStore = useCampaignStoreMock;

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockCombatCharacter(
  overrides: Partial<CombatCharacter> = {},
): CombatCharacter {
  return {
    id: 'combat-char-1',
    name: 'Test Combat Character',
    category: 'player',
    isNPC: false,
    hp: 10,
    maxHP: 10,
    fp: 10,
    maxFP: 10,
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    dodge: 8,
    parry: 8,
    block: 0,
    dr: 0,
    skills: {},
    weapons: [],
    ...overrides,
  };
}

function createMockCombatState(
  overrides: Partial<CombatState> = {},
): CombatState {
  return {
    id: 'session-1',
    name: 'Test Combat Session',
    startTime: 1767225600000,
    participants: [],
    turnOrder: [],
    currentTurnIndex: 0,
    currentRound: 1,
    turnDecisions: {},
    log: [],
    ...overrides,
  };
}

function createMockCombatItem(
  overrides: Partial<CombatItem> = {},
): CombatItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    type: 'tool',
    stats: {},
    quantity: 1,
    ...overrides,
  };
}

function createMockCharacter(
  overrides: Partial<Character> = {},
): Character {
  return {
    id: 'party-char-1',
    name: 'Test Party Character',
    isPlayer: true,
    work: {
      enabled: true,
      skills: {},
    },
    ...overrides,
  };
}

function createLegacyRevealState(
  showEnemyHP: boolean,
): RevealState & { showEnemyHP: boolean } {
  const revealState = {
    showEnemyHP,
    byInstanceId: {},
  };
  Object.defineProperty(revealState, 'byInstanceId', { enumerable: false });
  return revealState;
}

function createMockCampaignState(
  overrides: {
    entities?: Partial<MockCampaignState['entities']>;
    combat?: Partial<MockCampaignState['combat']>;
  } = {},
): MockCampaignState {
  return {
    entities: {
      combatCharacters: {},
      combatItems: {},
      characters: {},
      combatHistory: [],
      combatTombstones: [],
      encounterTemplates: {},
      ...overrides.entities,
    },
    combat: {
      activeSession: null,
      rulesPreset: 'standard',
      reveal: {},
      revealState: null,
      ...overrides.combat,
    },
  };
}

function createMockActions() {
  return {
    setCombatCharacters: vi.fn(),
    setCombatActive: vi.fn(),
    setCombatHistory: vi.fn(),
    setCombatTombstones: vi.fn(),
    setCombatRulesPreset: vi.fn(),
    setCombatItems: vi.fn(),
    setCombatRevealState: vi.fn(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('useCombatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // STATE ACCESS TESTS
  // ==========================================================================

  describe('state access', () => {
    it('returns empty arrays when no combat characters exist', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatCharacters).toEqual([]);
      expect(result.current.partyCharacters).toEqual([]);
      expect(result.current.combatItems).toEqual([]);
    });

    it('returns denormalized combat characters array', () => {
      const char1 = createMockCombatCharacter({ id: 'char-1', name: 'Fighter' });
      const char2 = createMockCombatCharacter({ id: 'char-2', name: 'Mage' });

      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          entities: {
            combatCharacters: {
              'char-1': char1,
              'char-2': char2,
            },
            combatItems: {},
            characters: {},
            combatHistory: [],
            combatTombstones: [],
          },
        }),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatCharacters).toHaveLength(2);
      expect(result.current.combatCharacters).toContainEqual(char1);
      expect(result.current.combatCharacters).toContainEqual(char2);
    });

    it('returns denormalized party characters array', () => {
      const partyChar = createMockCharacter({ id: 'party-1', name: 'Hero' });

      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          entities: {
            combatCharacters: {},
            combatItems: {},
            characters: {
              'party-1': partyChar,
            },
            combatHistory: [],
            combatTombstones: [],
          },
        }),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.partyCharacters).toHaveLength(1);
      expect(result.current.partyCharacters[0]).toEqual(partyChar);
    });

    it('returns active combat session', () => {
      const session = createMockCombatState({ id: 'active-session' });

      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          combat: {
            activeSession: session,
            rulesPreset: 'standard',
            reveal: {},
          },
        }),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatActive).toEqual(session);
    });

    it('returns null when no active session', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatActive).toBeNull();
    });

    it('returns combat history', () => {
      const historySession = createMockCombatState({ id: 'past-session' });

      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          entities: {
            combatCharacters: {},
            combatItems: {},
            characters: {},
            combatHistory: [historySession],
            combatTombstones: [],
          },
        }),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatHistory).toHaveLength(1);
      expect(result.current.combatHistory[0]).toEqual(historySession);
    });

    it('returns combat tombstones', () => {
      const tombstone = createMockCombatCharacter({ id: 'deleted-char' });

      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          entities: {
            combatCharacters: {},
            combatItems: {},
            characters: {},
            combatHistory: [],
            combatTombstones: [tombstone],
          },
        }),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatTombstones).toHaveLength(1);
      expect(result.current.combatTombstones[0]).toEqual(tombstone);
    });

    it('returns combat rules preset', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          combat: {
            activeSession: null,
            rulesPreset: 'cinematic',
            reveal: {},
          },
        }),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatRulesPreset).toBe('cinematic');
    });

    it('returns combat reveal state', () => {
      const revealState: RevealState = { byInstanceId: {} };

      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          combat: {
            activeSession: null,
            rulesPreset: 'standard',
            reveal: {},
            revealState,
          },
        }),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatReveal).toEqual(revealState);
    });

    it('returns denormalized combat items array', () => {
      const item1 = createMockCombatItem({ id: 'item-1', name: 'Sword' });
      const item2 = createMockCombatItem({ id: 'item-2', name: 'Shield' });

      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          entities: {
            combatCharacters: {},
            combatItems: {
              'item-1': item1,
              'item-2': item2,
            },
            characters: {},
            combatHistory: [],
            combatTombstones: [],
          },
        }),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatItems).toHaveLength(2);
      expect(result.current.combatItems).toContainEqual(item1);
      expect(result.current.combatItems).toContainEqual(item2);
    });
  });

  // ==========================================================================
  // ACTION TESTS
  // ==========================================================================

  describe('saveCombatCharacters', () => {
    it('normalizes array and calls setCombatCharacters', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      const char1 = createMockCombatCharacter({ id: 'char-1' });
      const char2 = createMockCombatCharacter({ id: 'char-2' });

      act(() => {
        result.current.saveCombatCharacters([char1, char2]);
      });

      expect(mockActions.setCombatCharacters).toHaveBeenCalledTimes(1);
      expect(mockActions.setCombatCharacters).toHaveBeenCalledWith({
        'char-1': char1,
        'char-2': char2,
      });
    });

    it('handles empty array', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      act(() => {
        result.current.saveCombatCharacters([]);
      });

      expect(mockActions.setCombatCharacters).toHaveBeenCalledWith({});
    });
  });

  describe('saveCombatActive', () => {
    it('calls setCombatActive with direct session value', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      const session = createMockCombatState({ id: 'new-session' });

      act(() => {
        result.current.saveCombatActive(session);
      });

      expect(mockActions.setCombatActive).toHaveBeenCalledTimes(1);
      expect(mockActions.setCombatActive).toHaveBeenCalledWith(session);
    });

    it('calls setCombatActive with null to clear session', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      act(() => {
        result.current.saveCombatActive(null);
      });

      expect(mockActions.setCombatActive).toHaveBeenCalledWith(null);
    });

    it('supports functional update pattern', () => {
      // CombatState uses currentRound (not round) — same key mix-up as the
      // campaignStorage round-trip tests fixed in PR #29
      const existingSession = createMockCombatState({ id: 'session-1', currentRound: 1 });
      const mockActions = createMockActions();

      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          combat: {
            activeSession: existingSession,
            rulesPreset: 'standard',
            reveal: {},
          },
        }),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      act(() => {
        result.current.saveCombatActive((prev: CombatState | null) => {
          if (!prev) return null;
          return { ...prev, currentRound: prev.currentRound + 1 };
        });
      });

      expect(mockActions.setCombatActive).toHaveBeenCalledTimes(1);
      const calledWith = mockActions.setCombatActive.mock.calls[0][0];
      expect(calledWith.currentRound).toBe(2);
    });

    it('functional update receives null when no active session', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      let receivedValue: CombatState | null | 'not-called' = 'not-called';
      act(() => {
        result.current.saveCombatActive((prev: CombatState | null) => {
          receivedValue = prev;
          return prev;
        });
      });

      expect(receivedValue).toBeNull();
    });
  });

  describe('saveCombatHistory', () => {
    it('calls setCombatHistory with provided array', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      const history = [
        createMockCombatState({ id: 'past-1' }),
        createMockCombatState({ id: 'past-2' }),
      ];

      act(() => {
        result.current.saveCombatHistory(history);
      });

      expect(mockActions.setCombatHistory).toHaveBeenCalledTimes(1);
      expect(mockActions.setCombatHistory).toHaveBeenCalledWith(history);
    });
  });

  describe('saveCombatTombstones', () => {
    it('calls setCombatTombstones with provided array', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      const tombstones = [createMockCombatCharacter({ id: 'deleted-1' })];

      act(() => {
        result.current.saveCombatTombstones(tombstones);
      });

      expect(mockActions.setCombatTombstones).toHaveBeenCalledTimes(1);
      expect(mockActions.setCombatTombstones).toHaveBeenCalledWith(tombstones);
    });
  });

  describe('saveCombatRulesPreset', () => {
    it('calls setCombatRulesPreset with provided preset', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      act(() => {
        result.current.saveCombatRulesPreset('cinematic');
      });

      expect(mockActions.setCombatRulesPreset).toHaveBeenCalledTimes(1);
      expect(mockActions.setCombatRulesPreset).toHaveBeenCalledWith('cinematic');
    });
  });

  describe('saveCombatItems', () => {
    it('normalizes array and calls setCombatItems', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      const item1 = createMockCombatItem({ id: 'item-1' });
      const item2 = createMockCombatItem({ id: 'item-2' });

      act(() => {
        result.current.saveCombatItems([item1, item2]);
      });

      expect(mockActions.setCombatItems).toHaveBeenCalledTimes(1);
      expect(mockActions.setCombatItems).toHaveBeenCalledWith({
        'item-1': item1,
        'item-2': item2,
      });
    });
  });

  describe('saveCombatReveal', () => {
    it('logs warning (deprecated function)', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      });

      const { result } = renderHook(() => useCombatStore());

      act(() => {
        result.current.saveCombatReveal(createLegacyRevealState(true));
      });

      expect(mockActions.setCombatRevealState).toHaveBeenCalledWith({ showEnemyHP: true });
    });
  });

  // ==========================================================================
  // MEMOIZATION TESTS
  // ==========================================================================

  describe('memoization', () => {
    it('returns same reference when state has not changed', () => {
      const mockState = createMockCampaignState();
      const mockActions = createMockActions();

      mockedUseCampaignStore.mockReturnValue({
        state: mockState,
        actions: mockActions,
      });

      const { result, rerender } = renderHook(() => useCombatStore());
      const firstResult = result.current;

      rerender();
      const secondResult = result.current;

      // Should be the same object reference due to useMemo
      expect(firstResult).toBe(secondResult);
    });

    it('returns new reference when combat characters change', () => {
      const mockActions = createMockActions();
      let mockState = createMockCampaignState();

      mockedUseCampaignStore.mockReturnValue({
        state: mockState,
        actions: mockActions,
      });

      const { result, rerender } = renderHook(() => useCombatStore());
      const firstResult = result.current;

      // Update the mock to return different state
      mockState = createMockCampaignState({
        entities: {
          combatCharacters: {
            'new-char': createMockCombatCharacter({ id: 'new-char' }),
          },
          combatItems: {},
          characters: {},
          combatHistory: [],
          combatTombstones: [],
        },
      });

      mockedUseCampaignStore.mockReturnValue({
        state: mockState,
        actions: mockActions,
      });

      rerender();
      const secondResult = result.current;

      // Should be different object references
      expect(firstResult).not.toBe(secondResult);
      expect(secondResult.combatCharacters).toHaveLength(1);
    });
  });
});
