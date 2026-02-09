import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCombatStore } from '../useCombatStore';
import type { CombatCharacter, CombatSession, CombatItem, Character } from '../../types/campaign';

// Mock the campaign store
vi.mock('../../state/campaignStore', () => ({
  useCampaignStore: vi.fn(),
}));

import { useCampaignStore } from '../../state/campaignStore';

const mockedUseCampaignStore = vi.mocked(useCampaignStore);

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockCombatCharacter(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return {
    id: 'combat-char-1',
    name: 'Test Combat Character',
    hp: 10,
    maxHp: 10,
    fp: 10,
    maxFp: 10,
    speed: 5,
    move: 5,
    dx: 10,
    iq: 10,
    ht: 10,
    will: 10,
    per: 10,
    dodge: 8,
    parry: 8,
    block: 0,
    dr: 0,
    ...overrides,
  };
}

function createMockCombatSession(overrides: Partial<CombatSession> = {}): CombatSession {
  return {
    id: 'session-1',
    name: 'Test Combat Session',
    round: 1,
    turn: 0,
    participants: [],
    log: [],
    startedAt: Date.now(),
    isActive: true,
    ...overrides,
  };
}

function createMockCombatItem(overrides: Partial<CombatItem> = {}): CombatItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    quantity: 1,
    notes: '',
    ...overrides,
  };
}

function createMockCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'party-char-1',
    name: 'Test Party Character',
    isPlayer: true,
    ...overrides,
  };
}

function createMockCampaignState(overrides: any = {}) {
  return {
    entities: {
      combatCharacters: {},
      combatItems: {},
      characters: {},
      combatHistory: [],
      combatTombstones: [],
      ...overrides.entities,
    },
    combat: {
      activeSession: null,
      rulesPreset: 'standard',
      reveal: {},
      ...overrides.combat,
    },
    ...overrides,
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
      } as any);

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
      } as any);

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
      } as any);

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.partyCharacters).toHaveLength(1);
      expect(result.current.partyCharacters[0]).toEqual(partyChar);
    });

    it('returns active combat session', () => {
      const session = createMockCombatSession({ id: 'active-session' });

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
      } as any);

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatActive).toEqual(session);
    });

    it('returns null when no active session', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      } as any);

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatActive).toBeNull();
    });

    it('returns combat history', () => {
      const historySession = createMockCombatSession({ id: 'past-session', isActive: false });

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
      } as any);

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
      } as any);

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
      } as any);

      const { result } = renderHook(() => useCombatStore());

      expect(result.current.combatRulesPreset).toBe('cinematic');
    });

    it('returns combat reveal state', () => {
      const revealState = { showEnemyHP: true, showEnemyStats: false };

      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState({
          combat: {
            activeSession: null,
            rulesPreset: 'standard',
            reveal: revealState,
          },
        }),
        actions: mockActions,
      } as any);

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
      } as any);

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
      } as any);

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
      } as any);

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
      } as any);

      const { result } = renderHook(() => useCombatStore());

      const session = createMockCombatSession({ id: 'new-session' });

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
      } as any);

      const { result } = renderHook(() => useCombatStore());

      act(() => {
        result.current.saveCombatActive(null);
      });

      expect(mockActions.setCombatActive).toHaveBeenCalledWith(null);
    });

    it('supports functional update pattern', () => {
      const existingSession = createMockCombatSession({ id: 'session-1', round: 1 });
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
      } as any);

      const { result } = renderHook(() => useCombatStore());

      act(() => {
        result.current.saveCombatActive((prev: CombatSession | null) => {
          if (!prev) return null;
          return { ...prev, round: prev.round + 1 };
        });
      });

      expect(mockActions.setCombatActive).toHaveBeenCalledTimes(1);
      const calledWith = mockActions.setCombatActive.mock.calls[0][0];
      expect(calledWith.round).toBe(2);
    });

    it('functional update receives null when no active session', () => {
      const mockActions = createMockActions();
      mockedUseCampaignStore.mockReturnValue({
        state: createMockCampaignState(),
        actions: mockActions,
      } as any);

      const { result } = renderHook(() => useCombatStore());

      let receivedValue: any = 'not-called';
      act(() => {
        result.current.saveCombatActive((prev: CombatSession | null) => {
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
      } as any);

      const { result } = renderHook(() => useCombatStore());

      const history = [
        createMockCombatSession({ id: 'past-1' }),
        createMockCombatSession({ id: 'past-2' }),
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
      } as any);

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
      } as any);

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
      } as any);

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
      } as any);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useCombatStore());

      act(() => {
        result.current.saveCombatReveal({ showEnemyHP: true });
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'saveCombatReveal: reveal state updates are not yet fully implemented'
      );

      consoleSpy.mockRestore();
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
      } as any);

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
      } as any);

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
      } as any);

      rerender();
      const secondResult = result.current;

      // Should be different object references
      expect(firstResult).not.toBe(secondResult);
      expect(secondResult.combatCharacters).toHaveLength(1);
    });
  });
});
