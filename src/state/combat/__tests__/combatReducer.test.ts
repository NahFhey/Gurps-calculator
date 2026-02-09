import { describe, expect, it, beforeEach } from 'vitest';
import { produce } from 'immer';
import { handleCombatAction } from '../combatReducer';
import {
  COMBAT_CHARACTER_ADD,
  COMBAT_CHARACTER_UPDATE,
  COMBAT_CHARACTER_REMOVE,
  COMBAT_CHARACTERS_SET,
  COMBAT_ACTIVE_SET,
  COMBAT_ACTIVE_UPDATE,
  COMBAT_HISTORY_SET,
  COMBAT_TOMBSTONES_SET,
  COMBAT_RULES_PRESET_SET,
  COMBAT_ITEMS_SET,
  COMBAT_ITEM_ADD,
  type CombatAction
} from '../combatActions';
import type { CampaignState } from '../../campaignReducer';
import type { CombatCharacter, CombatSession, CombatItem } from '../../../types/campaign';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockCombatCharacter = (overrides?: Partial<CombatCharacter>): CombatCharacter => ({
  id: 'char-1',
  name: 'Test Fighter',
  isNPC: false,
  hp: 12,
  maxHP: 12,
  fp: 10,
  maxFP: 10,
  st: 12,
  dx: 11,
  iq: 10,
  ht: 11,
  dodge: 8,
  parry: 9,
  block: 8,
  dr: 2,
  skills: { 'Broadsword': 14, 'Shield': 12 },
  weapons: [{ name: 'Broadsword', damage: '2d+1 cut', reach: '1', skill: 'Broadsword' }],
  armor: [{ location: 'Torso', dr: 2 }],
  notes: 'Test character',
  ...overrides
});

const createMockCombatSession = (overrides?: Partial<CombatSession>): CombatSession => ({
  id: 'session-1',
  name: 'Test Battle',
  participants: [
    { characterId: 'char-1', team: 'ally', initiative: 10, currentHP: 12, status: 'active' },
    { characterId: 'char-2', team: 'enemy', initiative: 8, currentHP: 8, status: 'active' }
  ],
  currentRound: 1,
  currentTurn: 0,
  log: [],
  ...overrides
});

const createMockCombatItem = (overrides?: Partial<CombatItem>): CombatItem => ({
  id: 'item-1',
  name: 'Healing Potion',
  type: 'potion',
  stats: { healing: 10 },
  quantity: 3,
  ...overrides
});

const createMinimalCampaignState = (): CampaignState => ({
  ui: {
    activeModule: 'combat',
    selectedCharacterId: null,
    characterPanelView: 'sheet',
    gmModeEnabled: false,
    gmSessionUnlocked: false,
    debugMode: false,
    activitiesSubview: null,
    blockingError: null
  },
  meta: {
    rulesVersion: '1.0.0',
    schemaVersion: '1.0.0',
    downtimeSchemaVersion: 1
  },
  entities: {
    characters: {},
    materials: {},
    foods: {},
    recipes: {},
    foodTypes: [],
    materialTypes: [],
    crafts: {},
    craftDesigns: {},
    customTemplates: {},
    alchemyReagents: {},
    alchemyFormulas: {},
    alchemyBatches: {},
    alchemyLabs: {},
    alchemySettings: {
      defaultLabRating: 0,
      showObviousRoles: true,
      workBlockMinutes: 60
    },
    gatheringSpecies: {},
    gatheringTools: {},
    gatheringTables: {},
    gatheringEnvironments: {},
    gatheringSessions: {},
    gatheringDailyEvents: {},
    gatheringBait: {},
    gatheringCategories: {},
    gatheringItems: {},
    combatCharacters: {},
    combatItems: {},
    combatHistory: [],
    combatTombstones: [],
    kitchens: {},
    cookingSkills: [],
    effectFamilyMap: {},
    toolTemplates: {},
    toolInstances: {},
    facilities: {},
    toolReservations: {},
    inventories: {},
    currencyLog: []
  },
  combat: {
    activeSession: null,
    rulesPreset: 'standard'
  },
  time: {
    currentDay: 1,
    currentSlot: 0
  },
  downtime: {
    schemaVersion: 1,
    tasksById: {},
    taskOrder: [],
    characterDayStatus: {},
    completedTasks: [],
    lastTimeSlot: { day: 1, slot: 0 }
  },
  location: {
    locations: {},
    currentLocationId: null,
    weatherTables: {},
    weatherHistory: [],
    travelHistory: [],
    currentTravelRoute: null,
    activeWeather: null
  }
}) as CampaignState;

// Helper to apply action using Immer (mimics how campaignReducer works)
function applyAction(state: CampaignState, action: CombatAction): CampaignState {
  return produce(state, draft => {
    handleCombatAction(draft, action);
  });
}

// ============================================================================
// COMBAT CHARACTER TESTS
// ============================================================================

describe('combatReducer - Character Actions', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('COMBAT_CHARACTER_ADD', () => {
    it('adds a new combat character to the state', () => {
      const character = createMockCombatCharacter();
      const action: CombatAction = {
        type: COMBAT_CHARACTER_ADD,
        payload: character
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatCharacters['char-1']).toEqual(character);
    });

    it('can add multiple characters', () => {
      const char1 = createMockCombatCharacter({ id: 'char-1', name: 'Fighter' });
      const char2 = createMockCombatCharacter({ id: 'char-2', name: 'Mage', isNPC: true });

      let nextState = applyAction(state, { type: COMBAT_CHARACTER_ADD, payload: char1 });
      nextState = applyAction(nextState, { type: COMBAT_CHARACTER_ADD, payload: char2 });

      expect(Object.keys(nextState.entities.combatCharacters)).toHaveLength(2);
      expect(nextState.entities.combatCharacters['char-1'].name).toBe('Fighter');
      expect(nextState.entities.combatCharacters['char-2'].name).toBe('Mage');
    });
  });

  describe('COMBAT_CHARACTER_UPDATE', () => {
    it('updates an existing character', () => {
      const character = createMockCombatCharacter();
      state = applyAction(state, { type: COMBAT_CHARACTER_ADD, payload: character });

      const action: CombatAction = {
        type: COMBAT_CHARACTER_UPDATE,
        payload: { id: 'char-1', changes: { hp: 8, notes: 'Wounded' } }
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatCharacters['char-1'].hp).toBe(8);
      expect(nextState.entities.combatCharacters['char-1'].notes).toBe('Wounded');
      // Other fields unchanged
      expect(nextState.entities.combatCharacters['char-1'].name).toBe('Test Fighter');
      expect(nextState.entities.combatCharacters['char-1'].maxHP).toBe(12);
    });

    it('does nothing for non-existent character', () => {
      const action: CombatAction = {
        type: COMBAT_CHARACTER_UPDATE,
        payload: { id: 'non-existent', changes: { hp: 5 } }
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatCharacters['non-existent']).toBeUndefined();
    });

    it('can update skills', () => {
      const character = createMockCombatCharacter();
      state = applyAction(state, { type: COMBAT_CHARACTER_ADD, payload: character });

      const action: CombatAction = {
        type: COMBAT_CHARACTER_UPDATE,
        payload: { id: 'char-1', changes: { skills: { 'Broadsword': 16, 'Shield': 14 } } }
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatCharacters['char-1'].skills['Broadsword']).toBe(16);
    });
  });

  describe('COMBAT_CHARACTER_REMOVE', () => {
    it('removes a character from the state', () => {
      const character = createMockCombatCharacter();
      state = applyAction(state, { type: COMBAT_CHARACTER_ADD, payload: character });
      expect(state.entities.combatCharacters['char-1']).toBeDefined();

      const action: CombatAction = {
        type: COMBAT_CHARACTER_REMOVE,
        payload: 'char-1'
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatCharacters['char-1']).toBeUndefined();
    });

    it('does not throw for non-existent character', () => {
      const action: CombatAction = {
        type: COMBAT_CHARACTER_REMOVE,
        payload: 'non-existent'
      };

      expect(() => applyAction(state, action)).not.toThrow();
    });
  });

  describe('COMBAT_CHARACTERS_SET', () => {
    it('replaces all combat characters', () => {
      // Add initial character
      const initial = createMockCombatCharacter({ id: 'old-char' });
      state = applyAction(state, { type: COMBAT_CHARACTER_ADD, payload: initial });

      const newCharacters: Record<string, CombatCharacter> = {
        'char-a': createMockCombatCharacter({ id: 'char-a', name: 'Alice' }),
        'char-b': createMockCombatCharacter({ id: 'char-b', name: 'Bob' })
      };

      const action: CombatAction = {
        type: COMBAT_CHARACTERS_SET,
        payload: newCharacters
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatCharacters['old-char']).toBeUndefined();
      expect(nextState.entities.combatCharacters['char-a'].name).toBe('Alice');
      expect(nextState.entities.combatCharacters['char-b'].name).toBe('Bob');
    });
  });
});

// ============================================================================
// COMBAT SESSION TESTS
// ============================================================================

describe('combatReducer - Session Actions', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('COMBAT_ACTIVE_SET', () => {
    it('sets the active combat session', () => {
      const session = createMockCombatSession();
      const action: CombatAction = {
        type: COMBAT_ACTIVE_SET,
        payload: session
      };

      const nextState = applyAction(state, action);

      expect(nextState.combat.activeSession).toEqual(session);
    });

    it('can clear the active session', () => {
      const session = createMockCombatSession();
      state = applyAction(state, { type: COMBAT_ACTIVE_SET, payload: session });
      expect(state.combat.activeSession).not.toBeNull();

      const action: CombatAction = {
        type: COMBAT_ACTIVE_SET,
        payload: null
      };

      const nextState = applyAction(state, action);

      expect(nextState.combat.activeSession).toBeNull();
    });
  });

  describe('COMBAT_ACTIVE_UPDATE', () => {
    it('updates the active session', () => {
      const session = createMockCombatSession();
      state = applyAction(state, { type: COMBAT_ACTIVE_SET, payload: session });

      const action: CombatAction = {
        type: COMBAT_ACTIVE_UPDATE,
        payload: { currentRound: 2, currentTurn: 1 }
      };

      const nextState = applyAction(state, action);

      expect(nextState.combat.activeSession?.currentRound).toBe(2);
      expect(nextState.combat.activeSession?.currentTurn).toBe(1);
      // Other fields unchanged
      expect(nextState.combat.activeSession?.name).toBe('Test Battle');
    });

    it('does nothing if no active session', () => {
      expect(state.combat.activeSession).toBeNull();

      const action: CombatAction = {
        type: COMBAT_ACTIVE_UPDATE,
        payload: { currentRound: 5 }
      };

      const nextState = applyAction(state, action);

      expect(nextState.combat.activeSession).toBeNull();
    });

    it('can update participants', () => {
      const session = createMockCombatSession();
      state = applyAction(state, { type: COMBAT_ACTIVE_SET, payload: session });

      const updatedParticipants = [
        ...session.participants,
        { characterId: 'char-3', team: 'ally' as const, initiative: 12, currentHP: 15, status: 'active' as const }
      ];

      const action: CombatAction = {
        type: COMBAT_ACTIVE_UPDATE,
        payload: { participants: updatedParticipants }
      };

      const nextState = applyAction(state, action);

      expect(nextState.combat.activeSession?.participants).toHaveLength(3);
    });
  });
});

// ============================================================================
// COMBAT HISTORY TESTS
// ============================================================================

describe('combatReducer - History Actions', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('COMBAT_HISTORY_SET', () => {
    it('sets combat history', () => {
      const sessions = [
        createMockCombatSession({ id: 'session-1', name: 'Battle 1' }),
        createMockCombatSession({ id: 'session-2', name: 'Battle 2' })
      ];

      const action: CombatAction = {
        type: COMBAT_HISTORY_SET,
        payload: sessions
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatHistory).toHaveLength(2);
      expect(nextState.entities.combatHistory[0].name).toBe('Battle 1');
      expect(nextState.entities.combatHistory[1].name).toBe('Battle 2');
    });

    it('can clear history', () => {
      const session = createMockCombatSession();
      state = applyAction(state, { type: COMBAT_HISTORY_SET, payload: [session] });
      expect(state.entities.combatHistory).toHaveLength(1);

      const action: CombatAction = {
        type: COMBAT_HISTORY_SET,
        payload: []
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatHistory).toHaveLength(0);
    });
  });

  describe('COMBAT_TOMBSTONES_SET', () => {
    it('sets combat tombstones (dead characters)', () => {
      const deadCharacters = [
        createMockCombatCharacter({ id: 'dead-1', name: 'Fallen Warrior', hp: 0 }),
        createMockCombatCharacter({ id: 'dead-2', name: 'Slain Mage', hp: -5 })
      ];

      const action: CombatAction = {
        type: COMBAT_TOMBSTONES_SET,
        payload: deadCharacters
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatTombstones).toHaveLength(2);
      expect(nextState.entities.combatTombstones[0].hp).toBe(0);
      expect(nextState.entities.combatTombstones[1].hp).toBe(-5);
    });
  });
});

// ============================================================================
// COMBAT RULES TESTS
// ============================================================================

describe('combatReducer - Rules Actions', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('COMBAT_RULES_PRESET_SET', () => {
    it('sets the rules preset', () => {
      const action: CombatAction = {
        type: COMBAT_RULES_PRESET_SET,
        payload: 'cinematic'
      };

      const nextState = applyAction(state, action);

      expect(nextState.combat.rulesPreset).toBe('cinematic');
    });

    it('can change between presets', () => {
      state = applyAction(state, { type: COMBAT_RULES_PRESET_SET, payload: 'realistic' });
      expect(state.combat.rulesPreset).toBe('realistic');

      const action: CombatAction = {
        type: COMBAT_RULES_PRESET_SET,
        payload: 'standard'
      };

      const nextState = applyAction(state, action);

      expect(nextState.combat.rulesPreset).toBe('standard');
    });
  });
});

// ============================================================================
// COMBAT ITEM TESTS
// ============================================================================

describe('combatReducer - Item Actions', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  describe('COMBAT_ITEMS_SET', () => {
    it('replaces all combat items', () => {
      const items: Record<string, CombatItem> = {
        'item-1': createMockCombatItem({ id: 'item-1', name: 'Potion' }),
        'item-2': createMockCombatItem({ id: 'item-2', name: 'Sword', type: 'weapon' })
      };

      const action: CombatAction = {
        type: COMBAT_ITEMS_SET,
        payload: items
      };

      const nextState = applyAction(state, action);

      expect(Object.keys(nextState.entities.combatItems)).toHaveLength(2);
      expect(nextState.entities.combatItems['item-1'].name).toBe('Potion');
      expect(nextState.entities.combatItems['item-2'].type).toBe('weapon');
    });
  });

  describe('COMBAT_ITEM_ADD', () => {
    it('adds a new combat item', () => {
      const item = createMockCombatItem();
      const action: CombatAction = {
        type: COMBAT_ITEM_ADD,
        payload: item
      };

      const nextState = applyAction(state, action);

      expect(nextState.entities.combatItems['item-1']).toEqual(item);
    });

    it('can add multiple items', () => {
      const potion = createMockCombatItem({ id: 'potion-1', name: 'Healing Potion' });
      const weapon = createMockCombatItem({ id: 'weapon-1', name: 'Magic Sword', type: 'weapon' });

      let nextState = applyAction(state, { type: COMBAT_ITEM_ADD, payload: potion });
      nextState = applyAction(nextState, { type: COMBAT_ITEM_ADD, payload: weapon });

      expect(Object.keys(nextState.entities.combatItems)).toHaveLength(2);
    });
  });
});

// ============================================================================
// EDGE CASES AND RETURN VALUE TESTS
// ============================================================================

describe('combatReducer - Edge Cases', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createMinimalCampaignState();
  });

  it('returns true for valid combat actions', () => {
    const character = createMockCombatCharacter();
    const action: CombatAction = {
      type: COMBAT_CHARACTER_ADD,
      payload: character
    };

    let handled = false;
    produce(state, draft => {
      handled = handleCombatAction(draft, action);
    });

    expect(handled).toBe(true);
  });

  it('returns false for unknown action types', () => {
    const unknownAction = { type: 'UNKNOWN_ACTION', payload: {} } as unknown as CombatAction;

    let handled = false;
    produce(state, draft => {
      handled = handleCombatAction(draft, unknownAction);
    });

    expect(handled).toBe(false);
  });

  it('handles empty payload for SET actions', () => {
    const action: CombatAction = {
      type: COMBAT_CHARACTERS_SET,
      payload: {}
    };

    const nextState = applyAction(state, action);

    expect(nextState.entities.combatCharacters).toEqual({});
  });

  it('preserves other state slices when handling combat actions', () => {
    // Add some data to other slices
    const modifiedState = {
      ...state,
      ui: { ...state.ui, activeModule: 'different' },
      time: { currentDay: 5, currentSlot: 2 }
    } as CampaignState;

    const action: CombatAction = {
      type: COMBAT_CHARACTER_ADD,
      payload: createMockCombatCharacter()
    };

    const nextState = applyAction(modifiedState, action);

    // Combat state updated
    expect(nextState.entities.combatCharacters['char-1']).toBeDefined();
    // Other state preserved
    expect(nextState.ui.activeModule).toBe('different');
    expect(nextState.time.currentDay).toBe(5);
  });
});
