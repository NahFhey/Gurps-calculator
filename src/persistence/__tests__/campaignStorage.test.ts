import { beforeEach, describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { loadCampaignState, saveCampaignState } from '../campaignStorage';
import { idbClear, idbSet } from '../db';
import type { CombatCharacter, CombatSession, CombatItem } from '../../types/campaign';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockCombatCharacter(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return {
    id: 'combat-char-1',
    name: 'Test Combat Character',
    isNPC: false,
    hp: 10,
    maxHP: 10,
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    dodge: 8,
    dr: 0,
    skills: {},
    weapons: [],
    armor: [],
    notes: '',
    ...overrides,
  };
}

function createMockCombatSession(overrides: Partial<CombatSession> = {}): CombatSession {
  return {
    id: 'session-1',
    name: 'Test Combat Session',
    currentRound: 1,
    currentTurn: 0,
    participants: [],
    log: [],
    startDate: new Date().toISOString(),
    ...overrides,
  };
}

function createMockCombatItem(overrides: Partial<CombatItem> = {}): CombatItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    type: 'weapon',
    stats: {},
    quantity: 1,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('campaignStorage', () => {
  beforeEach(async () => {
    localStorage.clear();
    await idbClear();
  });

  it('loadCampaignState returns defaults when empty', async () => {
    const state = await loadCampaignState();

    expect(state.time.day).toBe(1);
    expect(state.time.slot).toBe(0);
    expect(state.combat.active).toBe(false);
  });

  it('saveCampaignState round-trips key fields', async () => {
    const state = createCampaignState();
    state.time.day = 5;
    state.ui.debugMode = true;
    state.combat.reveal.revealedTargets.add('target-1');

    await saveCampaignState(state);
    const loaded = await loadCampaignState();

    expect(loaded.time.day).toBe(5);
    expect(loaded.ui.debugMode).toBe(true);
    expect(loaded.combat.reveal.revealedTargets.has('target-1')).toBe(true);
  });

  // ==========================================================================
  // COMBAT STATE ROUND-TRIP TESTS
  // ==========================================================================

  describe('combat state persistence', () => {
    it('round-trips combat characters', async () => {
      const state = createCampaignState();
      const char1 = createMockCombatCharacter({ id: 'fighter-1', name: 'Fighter', hp: 15, maxHP: 15 });
      const char2 = createMockCombatCharacter({ id: 'mage-1', name: 'Mage', hp: 8, maxHP: 8 });

      state.entities.combatCharacters = {
        'fighter-1': char1,
        'mage-1': char2,
      };

      await saveCampaignState(state);
      const loaded = await loadCampaignState();

      expect(Object.keys(loaded.entities.combatCharacters)).toHaveLength(2);
      expect(loaded.entities.combatCharacters['fighter-1']).toEqual(char1);
      expect(loaded.entities.combatCharacters['mage-1']).toEqual(char2);
    });

    it('round-trips active combat session', async () => {
      const state = createCampaignState();
      const session = createMockCombatSession({
        id: 'session-active',
        name: 'Battle at the Bridge',
        currentRound: 3,
        currentTurn: 2,
        participants: [
          { characterId: 'fighter-1', team: 'ally', initiative: 1, currentHP: 10, status: 'active' },
          { characterId: 'mage-1', team: 'ally', initiative: 2, currentHP: 8, status: 'active' },
          { characterId: 'goblin-1', team: 'enemy', initiative: 0, currentHP: 5, status: 'active' }
        ],
        log: [
          { type: 'attack', actor: 'fighter-1', target: 'goblin-1', result: 'hit', round: 1, turn: 0 } as any,
        ],
      });

      state.combat.activeSession = session;
      state.combat.active = true;

      await saveCampaignState(state);
      const loaded = await loadCampaignState();

      expect(loaded.combat.activeSession).not.toBeNull();
      expect(loaded.combat.activeSession?.id).toBe('session-active');
      expect(loaded.combat.activeSession?.name).toBe('Battle at the Bridge');
      expect(loaded.combat.activeSession?.currentRound).toBe(3);
      expect(loaded.combat.activeSession?.currentTurn).toBe(2);
      expect(loaded.combat.activeSession?.participants.length).toBe(3);
      expect(loaded.combat.active).toBe(true);
    });

    it('round-trips null active session', async () => {
      const state = createCampaignState();
      state.combat.activeSession = null;
      state.combat.active = false;

      await saveCampaignState(state);
      const loaded = await loadCampaignState();

      expect(loaded.combat.activeSession).toBeNull();
      expect(loaded.combat.active).toBe(false);
    });

    it('round-trips combat history', async () => {
      const state = createCampaignState();
      const pastSession1 = createMockCombatSession({
        id: 'past-1',
        name: 'Tavern Brawl',
      });
      const pastSession2 = createMockCombatSession({
        id: 'past-2',
        name: 'Dungeon Ambush',
      });

      state.entities.combatHistory = [pastSession1, pastSession2];

      await saveCampaignState(state);
      const loaded = await loadCampaignState();

      expect(loaded.entities.combatHistory).toHaveLength(2);
      expect(loaded.entities.combatHistory[0].id).toBe('past-1');
      expect(loaded.entities.combatHistory[0].name).toBe('Tavern Brawl');
      expect(loaded.entities.combatHistory[1].id).toBe('past-2');
    });

    it('round-trips combat tombstones', async () => {
      const state = createCampaignState();
      const deletedChar = createMockCombatCharacter({
        id: 'deleted-goblin',
        name: 'Dead Goblin',
      });

      state.entities.combatTombstones = [deletedChar];

      await saveCampaignState(state);
      const loaded = await loadCampaignState();

      expect(loaded.entities.combatTombstones).toHaveLength(1);
      expect(loaded.entities.combatTombstones[0].id).toBe('deleted-goblin');
      expect(loaded.entities.combatTombstones[0].name).toBe('Dead Goblin');
    });

    it('round-trips combat rules preset', async () => {
      const state = createCampaignState();
      state.combat.rulesPreset = 'cinematic';

      await saveCampaignState(state);
      const loaded = await loadCampaignState();

      expect(loaded.combat.rulesPreset).toBe('cinematic');
    });

    it('round-trips combat items', async () => {
      const state = createCampaignState();
      const item1 = createMockCombatItem({ id: 'sword-1', name: 'Longsword', quantity: 1 });
      const item2 = createMockCombatItem({ id: 'potion-1', name: 'Healing Potion', quantity: 3 });

      state.entities.combatItems = {
        'sword-1': item1,
        'potion-1': item2,
      };

      await saveCampaignState(state);
      const loaded = await loadCampaignState();

      expect(Object.keys(loaded.entities.combatItems)).toHaveLength(2);
      expect(loaded.entities.combatItems['sword-1']).toEqual(item1);
      expect(loaded.entities.combatItems['potion-1']).toEqual(item2);
    });

    it('round-trips combat reveal state with Set conversion', async () => {
      const state = createCampaignState();
      state.combat.reveal.revealedTargets.add('target-1');
      state.combat.reveal.revealedTargets.add('target-2');
      state.combat.reveal.revealedHP.add('hp-1');
      state.combat.reveal.revealedDefenseValues = {
        'char-1': { dodge: 8 },
      };

      await saveCampaignState(state);
      const loaded = await loadCampaignState();

      // Sets should be properly hydrated back from arrays
      expect(loaded.combat.reveal.revealedTargets).toBeInstanceOf(Set);
      expect(loaded.combat.reveal.revealedTargets.has('target-1')).toBe(true);
      expect(loaded.combat.reveal.revealedTargets.has('target-2')).toBe(true);
      expect(loaded.combat.reveal.revealedTargets.size).toBe(2);

      expect(loaded.combat.reveal.revealedHP).toBeInstanceOf(Set);
      expect(loaded.combat.reveal.revealedHP.has('hp-1')).toBe(true);

      expect(loaded.combat.reveal.revealedDefenseValues['char-1']).toEqual({
        dodge: 8,
      });
    });

    it('round-trips complex combat state with all fields populated', async () => {
      const state = createCampaignState();

      // Combat characters
      const fighter = createMockCombatCharacter({ id: 'fighter', name: 'Sir Galahad', hp: 12, maxHP: 15 });
      const mage = createMockCombatCharacter({ id: 'mage', name: 'Merlin', hp: 6, maxHP: 8 });
      const goblin = createMockCombatCharacter({ id: 'goblin', name: 'Goblin Scout', hp: 5, maxHP: 7 });

      state.entities.combatCharacters = {
        'fighter': fighter,
        'mage': mage,
        'goblin': goblin,
      };

      // Active session
      state.combat.activeSession = createMockCombatSession({
        id: 'current-battle',
        name: 'Forest Ambush',
        currentRound: 2,
        currentTurn: 1,
        participants: [
          { characterId: 'fighter', team: 'ally', initiative: 1, currentHP: 12, status: 'active' },
          { characterId: 'mage', team: 'ally', initiative: 2, currentHP: 6, status: 'active' },
          { characterId: 'goblin', team: 'enemy', initiative: 0, currentHP: 5, status: 'active' }
        ],
      });
      state.combat.active = true;

      // Combat history
      state.entities.combatHistory = [
        createMockCombatSession({ id: 'past-battle', name: 'Tavern Fight' }),
      ];

      // Tombstones
      state.entities.combatTombstones = [
        createMockCombatCharacter({ id: 'dead-orc', name: 'Slain Orc' }),
      ];

      // Items
      state.entities.combatItems = {
        'healing': createMockCombatItem({ id: 'healing', name: 'Healing Potion', quantity: 2 }),
      };

      // Rules preset
      state.combat.rulesPreset = 'realistic';

      // Reveal state
      state.combat.reveal.revealedTargets.add('goblin');
      state.combat.reveal.revealedHP.add('goblin');

      await saveCampaignState(state);
      const loaded = await loadCampaignState();

      // Verify all fields survived the round-trip
      expect(Object.keys(loaded.entities.combatCharacters)).toHaveLength(3);
      expect(loaded.entities.combatCharacters['fighter'].name).toBe('Sir Galahad');
      expect(loaded.entities.combatCharacters['fighter'].hp).toBe(12);

      expect(loaded.combat.activeSession?.name).toBe('Forest Ambush');
      expect(loaded.combat.activeSession?.currentRound).toBe(2);
      expect(loaded.combat.active).toBe(true);

      expect(loaded.entities.combatHistory).toHaveLength(1);
      expect(loaded.entities.combatHistory[0].name).toBe('Tavern Fight');

      expect(loaded.entities.combatTombstones).toHaveLength(1);
      expect(loaded.entities.combatTombstones[0].name).toBe('Slain Orc');

      expect(loaded.entities.combatItems['healing'].name).toBe('Healing Potion');

      expect(loaded.combat.rulesPreset).toBe('realistic');

      expect(loaded.combat.reveal.revealedTargets.has('goblin')).toBe(true);
      expect(loaded.combat.reveal.revealedHP.has('goblin')).toBe(true);
    });

    it('handles corrupted JSON gracefully', async () => {
      // Manually set corrupted data in IndexedDB
      await idbSet('campaignState', 'not-valid-json{{{');

      const loaded = await loadCampaignState();

      // Should return fresh state with defaults
      expect(loaded.time.day).toBe(1);
      expect(loaded.combat.active).toBe(false);
      expect(loaded.entities.combatCharacters).toEqual({});
    });

    it('handles missing combat fields in stored state', async () => {
      // Simulate older schema without combat fields
      const partialState = {
        ui: { activeModule: 'inventory' },
        time: { day: 3, slot: 2 },
        entities: {},
        // combat field is missing entirely
      };

      await idbSet('campaignState', JSON.stringify(partialState));

      const loaded = await loadCampaignState();

      // Should have combat defaults merged in
      expect(loaded.time.day).toBe(3);
      expect(loaded.combat).toBeDefined();
      expect(loaded.combat.active).toBe(false);
      expect(loaded.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    });
  });
});
