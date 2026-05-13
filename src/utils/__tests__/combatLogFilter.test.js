import { describe, it, expect } from 'vitest';
import { filterLogForPlayerView } from '../combatLogFilter';
import { RevealMode } from '../combatReveal';

const mkParticipant = (overrides = {}) => ({
  instanceId: 'enemy-001',
  name: 'Goblin',
  category: 'enemy',
  ...overrides,
});

const mkCombatState = (participants = []) => ({ participants });

const mkRevealState = (byInstanceId = {}) => ({ byInstanceId });

describe('filterLogForPlayerView', () => {
  describe('happy path / passthrough cases', () => {
    it('returns empty array for null log', () => {
      expect(filterLogForPlayerView(null, mkRevealState(), mkCombatState())).toEqual([]);
    });

    it('returns empty array for empty log', () => {
      expect(filterLogForPlayerView([], mkRevealState(), mkCombatState())).toEqual([]);
    });

    it('passes through turn entries unchanged', () => {
      const log = [{ entryType: 'turn', text: 'Round 1 begins' }];
      const result = filterLogForPlayerView(log, mkRevealState(), mkCombatState());
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Round 1 begins');
    });

    it('passes through note entries unchanged', () => {
      const log = [{ entryType: 'note', text: 'GM note' }];
      const result = filterLogForPlayerView(log, mkRevealState(), mkCombatState());
      expect(result[0].text).toBe('GM note');
    });
  });

  describe('resource entries', () => {
    it('shows full resource changes for player-side actors', () => {
      const actor = mkParticipant({ instanceId: 'pc-1', name: 'Hero', category: 'player' });
      const log = [{
        entryType: 'resource',
        actorInstanceId: 'pc-1',
        text: 'Hero lost 5 HP',
        hpDelta: -5,
      }];
      const result = filterLogForPlayerView(log, mkRevealState(), mkCombatState([actor]));
      expect(result[0].text).toBe('Hero lost 5 HP');
      expect(result[0].hpDelta).toBe(-5);
    });

    it('redacts exact HP numbers for hidden enemies', () => {
      const actor = mkParticipant();
      const log = [{
        entryType: 'resource',
        actorInstanceId: 'enemy-001',
        text: 'Goblin lost 5 HP',
        hpDelta: -5,
      }];
      const reveal = mkRevealState({
        'enemy-001': { name: RevealMode.NAME_HIDDEN, hp: { mode: RevealMode.NUMERIC_BAND } },
      });
      const result = filterLogForPlayerView(log, reveal, mkCombatState([actor]));
      expect(result[0].text).toBe('Unknown Foe took damage');
      expect(result[0].hpDelta).toBeUndefined();
    });
  });

  describe('action entries', () => {
    it('hides exact attack details for enemy attackers', () => {
      const actor = mkParticipant();
      const target = mkParticipant({ instanceId: 'pc-1', name: 'Hero', category: 'player' });
      const log = [{
        entryType: 'action',
        actorInstanceId: 'enemy-001',
        targetInstanceId: 'pc-1',
        text: 'Goblin attacks Hero with Sword',
        action: {
          kind: 'attack',
          attack: { name: 'Sword', success: true, rollTotal: 12, effectiveSkill: 14, margin: 2 },
        },
      }];
      const reveal = mkRevealState({
        'enemy-001': { name: RevealMode.NAME_HIDDEN },
        'pc-1': { name: RevealMode.NAME_FULL },
      });
      const result = filterLogForPlayerView(log, reveal, mkCombatState([actor, target]));
      expect(result[0].text).toBe('Unknown Foe attacked Hero');
      expect(result[0].action.attack.rollTotal).toBeUndefined();
      expect(result[0].action.attack.effectiveSkill).toBeUndefined();
      expect(result[0].action.attack.success).toBe(true);
    });
  });

  describe('condition entries', () => {
    it('filters out non-obvious conditions for hidden enemies', () => {
      const target = mkParticipant();
      const log = [{
        entryType: 'condition',
        targetInstanceId: 'enemy-001',
        conditionId: 'poisoned',
        text: 'Goblin became poisoned',
      }];
      const reveal = mkRevealState({
        'enemy-001': { name: RevealMode.NAME_HIDDEN },
      });
      const result = filterLogForPlayerView(log, reveal, mkCombatState([target]));
      expect(result).toHaveLength(0);
    });

    it('shows obvious conditions for hidden enemies', () => {
      const target = mkParticipant();
      const log = [{
        entryType: 'condition',
        targetInstanceId: 'enemy-001',
        conditionId: 'prone',
        text: 'Goblin became prone',
      }];
      const reveal = mkRevealState({
        'enemy-001': { name: RevealMode.NAME_HIDDEN },
      });
      const result = filterLogForPlayerView(log, reveal, mkCombatState([target]));
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Unknown Foe became prone');
    });
  });

  describe('maneuver entries', () => {
    it('hides maneuver details for hidden enemies', () => {
      const actor = mkParticipant();
      const log = [{
        entryType: 'maneuver',
        actorInstanceId: 'enemy-001',
        text: 'Goblin chose Aim',
        maneuverId: 'aim',
        maneuverLabel: 'Aim',
        aim: { rounds: 2 },
      }];
      const reveal = mkRevealState({
        'enemy-001': { name: RevealMode.NAME_HIDDEN },
      });
      const result = filterLogForPlayerView(log, reveal, mkCombatState([actor]));
      expect(result[0].text).toBe('Unknown Foe acted');
      expect(result[0].maneuverId).toBeUndefined();
      expect(result[0].aim).toBeUndefined();
    });

    it('shows maneuver when enemy name is fully revealed', () => {
      const actor = mkParticipant();
      const log = [{
        entryType: 'maneuver',
        actorInstanceId: 'enemy-001',
        text: 'Goblin chose Aim',
        maneuverId: 'aim',
      }];
      const reveal = mkRevealState({
        'enemy-001': { name: RevealMode.NAME_FULL },
      });
      const result = filterLogForPlayerView(log, reveal, mkCombatState([actor]));
      expect(result[0].text).toBe('Goblin chose Aim');
      expect(result[0].maneuverId).toBe('aim');
    });
  });

  describe('item entries', () => {
    it('redacts enemy item usage when HP not revealed', () => {
      const actor = mkParticipant();
      const log = [{
        entryType: 'item',
        actorInstanceId: 'enemy-001',
        text: 'Goblin used Healing Potion',
        item: { itemName: 'Healing Potion', qtyBefore: 2, qtyAfter: 1 },
        effect: { hp: 5 },
      }];
      const reveal = mkRevealState({
        'enemy-001': { name: RevealMode.NAME_HIDDEN },
      });
      const result = filterLogForPlayerView(log, reveal, mkCombatState([actor]));
      expect(result[0].text).toBe('Unknown Foe used an item');
      expect(result[0].item.itemName).toBe('Unknown Item');
      expect(result[0].item.qtyBefore).toBeNull();
      expect(result[0].effect).toEqual({});
    });
  });

  describe('reinforcement entries', () => {
    it('redacts enemy reinforcements when no enemy is fully revealed', () => {
      const log = [{
        entryType: 'reinforcement',
        text: 'Bandit Reinforcements arrived',
        reinforcement: { category: 'enemy', displayName: 'Bandit Captain' },
      }];
      const reveal = mkRevealState({});
      const result = filterLogForPlayerView(log, reveal, mkCombatState());
      expect(result[0].text).toBe('Enemy reinforcements arrived');
      expect(result[0].reinforcement.displayName).toBe('Unknown Enemy');
    });

    it('passes through ally/player reinforcements unchanged', () => {
      const log = [{
        entryType: 'reinforcement',
        text: 'Allied scouts arrived',
        reinforcement: { category: 'ally', displayName: 'Scout' },
      }];
      const result = filterLogForPlayerView(log, mkRevealState(), mkCombatState());
      expect(result[0].reinforcement.displayName).toBe('Scout');
    });
  });

  describe('edge cases', () => {
    it('handles unknown entry types by redacting names', () => {
      const actor = mkParticipant();
      const log = [{
        entryType: 'mystery',
        actorInstanceId: 'enemy-001',
        text: 'Goblin did something',
      }];
      const reveal = mkRevealState({
        'enemy-001': { name: RevealMode.NAME_HIDDEN },
      });
      const result = filterLogForPlayerView(log, reveal, mkCombatState([actor]));
      expect(result[0].text).toBe('Unknown Foe did something');
    });

    it('handles entries with missing actor participant gracefully', () => {
      const log = [{
        entryType: 'resource',
        actorInstanceId: 'missing-id',
        text: 'Ghost lost 1 HP',
        hpDelta: -1,
      }];
      const result = filterLogForPlayerView(log, mkRevealState(), mkCombatState());
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Unknown took damage');
    });

    it('redacts injury severity for hidden enemies', () => {
      const target = mkParticipant();
      const log = [{
        entryType: 'injury',
        targetInstanceId: 'enemy-001',
        text: 'Goblin was severely crippled',
      }];
      const reveal = mkRevealState({
        'enemy-001': { name: RevealMode.NAME_HIDDEN },
      });
      const result = filterLogForPlayerView(log, reveal, mkCombatState([target]));
      expect(result[0].text).toBe('Unknown Foe was badly wounded');
    });
  });
});
