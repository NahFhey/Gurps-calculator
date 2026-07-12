/**
 * Combat Round Integration Tests
 *
 * End-to-end tests for the combat lifecycle:
 * start combat → add combatants → activate session → advance turns/rounds
 * → register damage → end combat.
 *
 * Tests exercise the campaign reducer directly — no UI, no store wrapper.
 */

import { describe, expect, it } from 'vitest';
import {
  campaignReducer,
  createCampaignState,
  type CampaignAction,
} from '../state/campaignReducer';
import type { CombatCharacter, CombatSession } from '../types/campaign';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createCombatCharacter(overrides?: Partial<CombatCharacter>): CombatCharacter {
  return {
    id: 'char-fighter',
    name: 'Test Fighter',
    category: 'player',
    isNPC: false,
    hp: 12,
    maxHP: 12,
    st: 12,
    dx: 13,
    iq: 10,
    ht: 11,
    dodge: 9,
    dr: 2,
    skills: { 'Broadsword': 14, 'Shield': 12 },
    weapons: [
      { name: 'Broadsword', damage: '2d cut', reach: '1', skill: 'Broadsword' },
    ],
    ...overrides,
  };
}

function createCombatSession(overrides?: Partial<CombatSession>): CombatSession {
  return {
    id: 'session-1',
    name: 'Test Encounter',
    participants: [
      {
        characterId: 'char-fighter',
        team: 'ally',
        initiative: 6.25,
        currentHP: 12,
        status: 'active',
      },
      {
        characterId: 'char-goblin',
        team: 'enemy',
        initiative: 5.5,
        currentHP: 8,
        status: 'active',
      },
    ],
    currentRound: 1,
    currentTurn: 0,
    log: [],
    startDate: '2026-01-01',
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Combat Round Integration', () => {
  // --------------------------------------------------------------------------
  // Lifecycle: start → session → end
  // --------------------------------------------------------------------------

  describe('combat lifecycle', () => {
    it('startCombat sets active flag, creates checkpoint, and logs', () => {
      const state = createCampaignState();
      const next = campaignReducer(state, { type: 'startCombat' });

      expect(next.combat.active).toBe(true);
      expect(next.combat.encounterId).toBeTruthy();
      expect(next.checkpoints.entries.length).toBe(1);
      expect(next.checkpoints.entries[0].label).toBe('Before combat');
      expect(next.logs.entries[0].type).toBe('combat.started');
    });

    it('startCombat accepts optional encounterId', () => {
      const state = createCampaignState();
      const next = campaignReducer(state, {
        type: 'startCombat',
        payload: { encounterId: 'enc-custom' },
      });

      expect(next.combat.encounterId).toBe('enc-custom');
    });

    it('full lifecycle: start → add characters → activate session → end', () => {
      let state = createCampaignState();

      // 1. Start combat
      state = campaignReducer(state, { type: 'startCombat' });
      expect(state.combat.active).toBe(true);

      // 2. Add combat characters to the roster
      const fighter = createCombatCharacter();
      const goblin = createCombatCharacter({
        id: 'char-goblin',
        name: 'Goblin',
        isNPC: true,
        hp: 8,
        maxHP: 8,
        st: 9,
        dx: 12,
        iq: 8,
        ht: 9,
        dodge: 8,
        dr: 1,
        skills: { 'Shortsword': 11 },
        weapons: [{ name: 'Shortsword', damage: '1d+1 cut', reach: '1', skill: 'Shortsword' }],
      });

      state = campaignReducer(state, {
        type: 'addCombatCharacter' as CampaignAction['type'],
        payload: fighter,
      } as CampaignAction);
      state = campaignReducer(state, {
        type: 'addCombatCharacter' as CampaignAction['type'],
        payload: goblin,
      } as CampaignAction);

      expect(state.entities.combatCharacters['char-fighter']).toBeDefined();
      expect(state.entities.combatCharacters['char-goblin']).toBeDefined();

      // 3. Activate a combat session
      const session = createCombatSession();
      state = campaignReducer(state, {
        type: 'setCombatActive' as CampaignAction['type'],
        payload: session,
      } as CampaignAction);

      expect(state.combat.activeSession).not.toBeNull();
      expect(state.combat.activeSession!.participants).toHaveLength(2);
      expect(state.combat.activeSession!.currentRound).toBe(1);
      expect(state.combat.activeSession!.currentTurn).toBe(0);

      // 4. End combat by nulling the session
      state = campaignReducer(state, {
        type: 'setCombatActive' as CampaignAction['type'],
        payload: null,
      } as CampaignAction);

      expect(state.combat.activeSession).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Turn and round advancement
  // --------------------------------------------------------------------------

  describe('turn and round advancement', () => {
    it('updateCombatActive advances turn within a round', () => {
      let state = createCampaignState();
      state = campaignReducer(state, { type: 'startCombat' });

      const session = createCombatSession();
      state = campaignReducer(state, {
        type: 'setCombatActive' as CampaignAction['type'],
        payload: session,
      } as CampaignAction);

      // Advance to turn 1 (second participant)
      state = campaignReducer(state, {
        type: 'updateCombatActive' as CampaignAction['type'],
        payload: { currentTurn: 1 },
      } as CampaignAction);

      expect(state.combat.activeSession!.currentTurn).toBe(1);
      expect(state.combat.activeSession!.currentRound).toBe(1);
    });

    it('updateCombatActive advances round when cycling past last participant', () => {
      let state = createCampaignState();
      state = campaignReducer(state, { type: 'startCombat' });

      const session = createCombatSession();
      state = campaignReducer(state, {
        type: 'setCombatActive' as CampaignAction['type'],
        payload: session,
      } as CampaignAction);

      // Simulate round advancement: turn wraps back to 0, round increments
      state = campaignReducer(state, {
        type: 'updateCombatActive' as CampaignAction['type'],
        payload: { currentTurn: 0, currentRound: 2 },
      } as CampaignAction);

      expect(state.combat.activeSession!.currentTurn).toBe(0);
      expect(state.combat.activeSession!.currentRound).toBe(2);
    });

    it('log entries accumulate as actions are taken', () => {
      let state = createCampaignState();
      state = campaignReducer(state, { type: 'startCombat' });

      const session = createCombatSession();
      state = campaignReducer(state, {
        type: 'setCombatActive' as CampaignAction['type'],
        payload: session,
      } as CampaignAction);

      // Add a log entry via session update
      const logEntry = {
        round: 1,
        turn: 0,
        action: 'Attack',
        actorId: 'char-fighter',
        targetId: 'char-goblin',
        roll: 10,
        damage: 5,
        timestamp: Date.now(),
      };

      state = campaignReducer(state, {
        type: 'updateCombatActive' as CampaignAction['type'],
        payload: { log: [...session.log, logEntry] },
      } as CampaignAction);

      expect(state.combat.activeSession!.log).toHaveLength(1);
      expect(state.combat.activeSession!.log[0].action).toBe('Attack');
    });
  });

  // --------------------------------------------------------------------------
  // Damage registration and reveal
  // --------------------------------------------------------------------------

  describe('damage registration and reveal', () => {
    it('registerCombatDamage adds target to revealedTargets', () => {
      let state = createCampaignState();
      state = campaignReducer(state, { type: 'startCombat' });

      state = campaignReducer(state, {
        type: 'registerCombatDamage',
        payload: { targetId: 'char-goblin', remainingHp: 5 },
      });

      expect(state.combat.reveal.revealedTargets.has('char-goblin')).toBe(true);
    });

    it('registerCombatDamage reveals HP when target is defeated (HP <= 0)', () => {
      let state = createCampaignState();
      state = campaignReducer(state, { type: 'startCombat' });

      // Add the character so the defeat log can find its name
      const goblin = createCombatCharacter({
        id: 'char-goblin',
        name: 'Goblin',
        isNPC: true,
        hp: 8,
        maxHP: 8,
      });
      state = campaignReducer(state, {
        type: 'addCombatCharacter' as CampaignAction['type'],
        payload: goblin,
      } as CampaignAction);

      state = campaignReducer(state, {
        type: 'registerCombatDamage',
        payload: { targetId: 'char-goblin', remainingHp: 0 },
      });

      expect(state.combat.reveal.revealedTargets.has('char-goblin')).toBe(true);
      expect(state.combat.reveal.revealedHP.has('char-goblin')).toBe(true);
    });

    it('registerCombatDamage does NOT reveal HP when target is still standing', () => {
      let state = createCampaignState();
      state = campaignReducer(state, { type: 'startCombat' });

      state = campaignReducer(state, {
        type: 'registerCombatDamage',
        payload: { targetId: 'char-goblin', remainingHp: 3 },
      });

      expect(state.combat.reveal.revealedTargets.has('char-goblin')).toBe(true);
      expect(state.combat.reveal.revealedHP.has('char-goblin')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Participant status changes
  // --------------------------------------------------------------------------

  describe('participant status management', () => {
    it('participant status can be updated to unconscious or dead', () => {
      let state = createCampaignState();
      state = campaignReducer(state, { type: 'startCombat' });

      const session = createCombatSession();
      state = campaignReducer(state, {
        type: 'setCombatActive' as CampaignAction['type'],
        payload: session,
      } as CampaignAction);

      // Mark goblin as unconscious
      const updatedParticipants = state.combat.activeSession!.participants.map((p) =>
        p.characterId === 'char-goblin'
          ? { ...p, status: 'unconscious' as const, currentHP: 0 }
          : p
      );

      state = campaignReducer(state, {
        type: 'updateCombatActive' as CampaignAction['type'],
        payload: { participants: updatedParticipants },
      } as CampaignAction);

      const goblin = state.combat.activeSession!.participants.find(
        (p) => p.characterId === 'char-goblin'
      );
      expect(goblin!.status).toBe('unconscious');
      expect(goblin!.currentHP).toBe(0);
    });

    it('multiple rounds of combat accumulate state changes correctly', () => {
      let state = createCampaignState();
      state = campaignReducer(state, { type: 'startCombat' });

      const session = createCombatSession();
      state = campaignReducer(state, {
        type: 'setCombatActive' as CampaignAction['type'],
        payload: session,
      } as CampaignAction);

      // Round 1: advance through both turns
      state = campaignReducer(state, {
        type: 'updateCombatActive' as CampaignAction['type'],
        payload: { currentTurn: 1 },
      } as CampaignAction);

      // Round 2: wrap back
      state = campaignReducer(state, {
        type: 'updateCombatActive' as CampaignAction['type'],
        payload: { currentTurn: 0, currentRound: 2 },
      } as CampaignAction);

      // Round 2: second turn + damage
      state = campaignReducer(state, {
        type: 'updateCombatActive' as CampaignAction['type'],
        payload: { currentTurn: 1 },
      } as CampaignAction);

      state = campaignReducer(state, {
        type: 'registerCombatDamage',
        payload: { targetId: 'char-goblin', remainingHp: 2 },
      });

      // Round 3
      state = campaignReducer(state, {
        type: 'updateCombatActive' as CampaignAction['type'],
        payload: { currentTurn: 0, currentRound: 3 },
      } as CampaignAction);

      expect(state.combat.activeSession!.currentRound).toBe(3);
      expect(state.combat.reveal.revealedTargets.has('char-goblin')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Checkpoint integration
  // --------------------------------------------------------------------------

  describe('checkpoint integration', () => {
    it('startCombat creates a checkpoint that can be restored', () => {
      let state = createCampaignState();

      // Set some pre-combat state
      state = campaignReducer(state, { type: 'selectCharacter', payload: 'char-1' });

      // Start combat (creates checkpoint)
      state = campaignReducer(state, { type: 'startCombat' });
      expect(state.combat.active).toBe(true);
      expect(state.checkpoints.entries.length).toBe(1);

      const checkpointId = state.checkpoints.entries[0].id;

      // Restore the checkpoint
      state = campaignReducer(state, { type: 'restoreCheckpoint', payload: checkpointId });

      // Combat should be rolled back
      expect(state.combat.active).toBe(false);
    });
  });
});
