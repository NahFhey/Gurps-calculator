import { describe, it, expect } from 'vitest';
import {
  calculateHPStatus,
  generateTurnOrder,
  formatLogEntry,
  exportCombatLog,
  exportActiveCombat,
  parseImportedCombat,
  generateId,
  createLogEntry,
  createTurnLogEntry,
  createResourceLogEntry,
  createRollLogEntry,
  createNoteLogEntry,
  createActionLogEntry,
  createNumberedEnemies,
  createInjuryLogEntry,
  createEffectLogEntry,
  createManeuverLogEntry,
  createReinforcementLogEntry,
  createItemLogEntry,
  createConditionLogEntry,
  createMovementLogEntry,
} from '../combatHelpers';
import type {
  EnemyTemplate,
  TurnOrderCombatant,
} from '../combatHelpers';
import type {
  CombatState,
  LogEntry,
  Participant,
  RollData,
} from '../../types/combatTracker';

function createParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    instanceId: 'participant-1',
    name: 'Test Participant',
    category: 'player',
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    hp: 10,
    fp: 10,
    mp: 0,
    basicSpeed: 5,
    basicMove: 5,
    ...overrides,
  };
}

describe('combatHelpers', () => {
  describe('calculateHPStatus', () => {
    it('returns healthy when maxHP is 0 or invalid', () => {
      expect(calculateHPStatus(10, 0)).toBe('healthy');
      expect(calculateHPStatus(10, -5)).toBe('healthy');
    });

    it('returns dead when current HP <= -maxHP', () => {
      expect(calculateHPStatus(-10, 10)).toBe('dead');
      expect(calculateHPStatus(-15, 10)).toBe('dead');
    });

    it('returns critical when HP <= 0 but > -maxHP', () => {
      expect(calculateHPStatus(0, 10)).toBe('critical');
      expect(calculateHPStatus(-5, 10)).toBe('critical');
    });

    it('returns injured when HP <= 1/3 maxHP', () => {
      expect(calculateHPStatus(3, 10)).toBe('injured');
      expect(calculateHPStatus(1, 10)).toBe('injured');
    });

    it('returns healthy when HP > 1/3 maxHP', () => {
      expect(calculateHPStatus(10, 10)).toBe('healthy');
      expect(calculateHPStatus(7, 10)).toBe('healthy');
    });
  });

  describe('generateTurnOrder', () => {
    it('sorts by basic speed descending', () => {
      const combatants: Participant[] = [
        createParticipant({ instanceId: 'a', name: 'A', basicSpeed: 5 }),
        createParticipant({ instanceId: 'b', name: 'B', basicSpeed: 7 }),
        createParticipant({ instanceId: 'c', name: 'C', basicSpeed: 6 }),
      ];
      expect(generateTurnOrder(combatants)).toEqual(['b', 'c', 'a']);
    });

    it('breaks tied basic speed by DX descending', () => {
      const combatants: Participant[] = [
        createParticipant({ instanceId: 'a', name: 'A', dx: 10 }),
        createParticipant({ instanceId: 'b', name: 'B', dx: 14 }),
        createParticipant({ instanceId: 'c', name: 'C', dx: 12 }),
      ];
      expect(generateTurnOrder(combatants)).toEqual(['b', 'c', 'a']);
    });

    it('breaks ties by name ascending', () => {
      const combatants: Participant[] = [
        createParticipant({ instanceId: 'b', name: 'Charlie' }),
        createParticipant({ instanceId: 'a', name: 'Alice' }),
        createParticipant({ instanceId: 'c', name: 'Bob' }),
      ];
      expect(generateTurnOrder(combatants)).toEqual(['a', 'c', 'b']);
    });

    it('filters out objects', () => {
      const combatants: Participant[] = [
        createParticipant({ instanceId: 'a', name: 'PC' }),
        createParticipant({
          instanceId: 'obj',
          name: 'Door',
          basicSpeed: 0,
          dx: 0,
          category: 'object',
        }),
      ];
      expect(generateTurnOrder(combatants)).toEqual(['a']);
    });

    it('falls back to id when no instanceId', () => {
      const combatants: TurnOrderCombatant[] = [
        { id: 'fallback', name: 'X', basicSpeed: 5, dx: 10 },
      ];
      expect(generateTurnOrder(combatants)).toEqual(['fallback']);
    });
  });

  describe('formatLogEntry', () => {
    it('formats Phase 2 structured entries with timestamp + text', () => {
      const ts = Date.now();
      const result = formatLogEntry({ entryType: 'note', text: 'Hello', timestamp: ts });
      expect(result).toContain('Hello');
      expect(result).toMatch(/^\[/);
    });

    it('formats Phase 1 combat_start', () => {
      const result = formatLogEntry({ type: 'combat_start', timestamp: Date.now() });
      expect(result).toContain('Combat started');
    });

    it('formats Phase 1 round_change', () => {
      const result = formatLogEntry({ type: 'round_change', round: 3, timestamp: Date.now() });
      expect(result).toContain('Round 3');
    });

    it('formats hp_change', () => {
      const result = formatLogEntry({
        type: 'hp_change', actorName: 'Bob', oldValue: 10, newValue: 7, timestamp: Date.now()
      });
      expect(result).toContain('Bob');
      expect(result).toContain('10');
      expect(result).toContain('7');
    });

    it('returns Unknown event for unrecognized type', () => {
      const result = formatLogEntry({ type: 'mystery', timestamp: Date.now() });
      expect(result).toContain('Unknown event');
    });
  });

  describe('exportCombatLog', () => {
    it('includes header and footer', () => {
      const result = exportCombatLog([], {});
      expect(result).toContain('=== GURPS Combat Log ===');
      expect(result).toContain('=== End of Log ===');
    });

    it('includes encounter name and date when provided', () => {
      const result = exportCombatLog([], { name: 'Goblin Ambush', date: 1 });
      expect(result).toContain('Goblin Ambush');
      expect(result).toContain('Date:');
    });

    it('formats each entry on its own line', () => {
      const ts = Date.now();
      const entries: LogEntry[] = [
        { entryType: 'note', text: 'A', timestamp: ts },
        { entryType: 'note', text: 'B', timestamp: ts },
      ];
      const result = exportCombatLog(entries, {});
      expect(result).toContain('A');
      expect(result).toContain('B');
    });
  });

  describe('exportActiveCombat / parseImportedCombat', () => {
    it('round-trips a minimal valid combat state', () => {
      const combatState: CombatState = {
        id: 'combat-1',
        name: 'Test Combat',
        startTime: 1,
        participants: [],
        currentTurnIndex: 0,
        currentRound: 1,
        turnOrder: [],
        turnDecisions: {},
        log: [],
      };
      const json = exportActiveCombat(combatState, null);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.combatState).toEqual(combatState);
      expect(parsed.history).toBeNull();
    });

    it('parseImportedCombat returns error for invalid JSON', () => {
      const result = parseImportedCombat('not json{');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it('parseImportedCombat returns validation error for malformed object', () => {
      const result = parseImportedCombat(JSON.stringify({ foo: 'bar' }));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });

  describe('generateId', () => {
    it('produces a string', () => {
      expect(typeof generateId()).toBe('string');
    });

    it('produces distinct IDs on successive calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) ids.add(generateId());
      expect(ids.size).toBe(20);
    });
  });

  describe('createLogEntry', () => {
    it('returns an entry with id, timestamp, round, turn, entryType, text', () => {
      const e = createLogEntry({ entryType: 'note', round: 2, turn: 3, text: 'hi' });
      expect(e.id).toBeTruthy();
      expect(typeof e.timestamp).toBe('number');
      expect(e.round).toBe(2);
      expect(e.turn).toBe(3);
      expect(e.entryType).toBe('note');
      expect(e.text).toBe('hi');
    });

    it('includes roll when provided', () => {
      const roll: RollData = {
        expression: '3d6',
        dice: [3, 4, 5],
        modifier: 0,
        total: 12,
        target: null,
        margin: 0,
        success: false,
      };
      const e = createLogEntry({ entryType: 'roll', round: 1, turn: 1, text: 't', roll });
      expect(e.roll).toEqual(roll);
    });
  });

  describe('createTurnLogEntry', () => {
    it('uses actor name when provided', () => {
      const e = createTurnLogEntry(1, 0, 'a', 'Alice');
      expect(e.text).toContain("Alice's turn");
    });

    it('falls back to turn number text when no name', () => {
      const e = createTurnLogEntry(1, 5, 'a', null);
      expect(e.text).toBe('Turn 5');
    });
  });

  describe('createResourceLogEntry', () => {
    it('formats positive deltas with +', () => {
      const e = createResourceLogEntry(1, 0, 'a', 'Bob', 'HP', 5, 10);
      expect(e.text).toContain('HP 5 → 10');
      expect(e.text).toContain('+5');
    });

    it('formats negative deltas', () => {
      const e = createResourceLogEntry(1, 0, 'a', 'Bob', 'FP', 10, 7);
      expect(e.text).toContain('-3');
    });
  });

  describe('createRollLogEntry', () => {
    it('formats unopposed roll without target', () => {
      const e = createRollLogEntry(1, 0, 'a', 'Alice', {
        expression: '3d6', dice: [1, 2, 3], total: 6
      });
      expect(e.text).toContain('rolled 3d6: 6');
    });

    it('formats success against target', () => {
      const e = createRollLogEntry(1, 0, 'a', 'Alice', {
        expression: '3d6', dice: [1, 2, 3], total: 6, target: 12, margin: 6, success: true
      });
      expect(e.text).toContain('SUCCESS');
      expect(e.text).toContain('+6');
    });

    it('formats failure against target', () => {
      const e = createRollLogEntry(1, 0, 'a', 'Alice', {
        expression: '3d6', dice: [6, 6, 5], total: 17, target: 12, margin: -5, success: false
      });
      expect(e.text).toContain('FAILURE');
      expect(e.text).toContain('-5');
    });
  });

  describe('createNoteLogEntry', () => {
    it('prepends actor name when provided', () => {
      const e = createNoteLogEntry(1, 0, 'a', 'Alice', 'observed cover');
      expect(e.text).toBe('Alice: observed cover');
    });

    it('omits actor prefix when null', () => {
      const e = createNoteLogEntry(1, 0, null, null, 'gm note');
      expect(e.text).toBe('gm note');
    });
  });

  describe('createActionLogEntry', () => {
    it('builds an attack description with margin and target', () => {
      const e = createActionLogEntry({
        round: 1, turn: 0,
        actorInstanceId: 'a', actorName: 'Alice',
        targetInstanceId: 'b', targetName: 'Bob',
        maneuver: 'attack',
        action: {
          kind: 'attack',
          attack: { name: 'sword', rollTotal: 10, effectiveSkill: 14, margin: 4, success: true }
        }
      });
      expect(e.entryType).toBe('action');
      expect(e.text).toContain('Alice');
      expect(e.text).toContain('Bob');
      expect(e.text).toContain('sword');
      expect(e.text).toContain('SUCCESS');
    });

    it('builds a defense description', () => {
      const e = createActionLogEntry({
        round: 1, turn: 0, actorInstanceId: 'a', actorName: 'Alice',
        action: { kind: 'defense', defense: { type: 'parry', rollTotal: 8, effectiveDefense: 11, margin: 3, success: true } }
      });
      expect(e.text).toContain('defends');
      expect(e.text).toContain('parry');
    });

    it('builds a damage description', () => {
      const e = createActionLogEntry({
        round: 1, turn: 0, actorInstanceId: 'a', actorName: 'Bob',
        action: { kind: 'damage', damage: { penetrating: 4, rolledDamage: 6, generalDRUsed: 2 } }
      });
      expect(e.text).toContain('takes');
      expect(e.text).toContain('4 HP');
    });
  });

  describe('createNumberedEnemies', () => {
    it('numbers enemies when quantity > 1', () => {
      const template: EnemyTemplate = { hp: 10 };
      const result = createNumberedEnemies('Goblin', 3, template);
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Goblin #1');
      expect(result[2].name).toBe('Goblin #3');
    });

    it('does not number a singleton', () => {
      const template: EnemyTemplate = { hp: 30 };
      const result = createNumberedEnemies('Boss', 1, template);
      expect(result[0].name).toBe('Boss');
    });

    it('applies template defaults', () => {
      const template: EnemyTemplate = { hp: 5 };
      const result = createNumberedEnemies('Goblin', 1, template);
      const g = result[0];
      expect(g.hp).toBe(5);
      expect(g.currentHP).toBe(5);
      expect(g.fp).toBe(0);
      expect(g.basicSpeed).toBe(5);
      expect(g.category).toBe('enemy');
      expect(g.shockPenalty).toBe(0);
      expect(g.conditions).toEqual([]);
    });

    it('produces unique instance IDs', () => {
      const template: EnemyTemplate = { hp: 10 };
      const result = createNumberedEnemies('Goblin', 5, template);
      const ids = new Set(result.map(r => r.instanceId));
      expect(ids.size).toBe(5);
    });
  });

  describe('createInjuryLogEntry', () => {
    it('describes injury with hit location', () => {
      const e = createInjuryLogEntry({
        round: 1, turn: 0, targetInstanceId: 'a', targetName: 'Bob',
        hitLocation: { locationLabel: 'torso' },
        damageBreakdown: { raw: 10, dr: 2, penetrating: 8, injuryApplied: 8, damageType: 'cr' },
        currentHP: 10, newHP: 2,
      });
      expect(e.entryType).toBe('injury');
      expect(e.text).toContain('Bob');
      expect(e.text).toContain('torso');
      expect(e.text).toContain('HP 10→2');
    });

    it('describes blocked damage when no penetration', () => {
      const e = createInjuryLogEntry({
        round: 1, turn: 0, targetInstanceId: 'a', targetName: 'Bob',
        hitLocation: null,
        damageBreakdown: { raw: 5, dr: 10, penetrating: 0, injuryApplied: 0 },
      });
      expect(e.text).toContain('no penetration');
    });
  });

  describe('createEffectLogEntry', () => {
    it('uses provided text when given', () => {
      const e = createEffectLogEntry({
        round: 1, turn: 0, targetInstanceId: 'a', targetName: 'Bob',
        effectType: 'stun', effectData: {}, text: 'custom'
      });
      expect(e.text).toBe('custom');
    });

    it('falls back to "name: effectType"', () => {
      const e = createEffectLogEntry({
        round: 1, turn: 0, targetInstanceId: 'a', targetName: 'Bob',
        effectType: 'stunned', effectData: {}
      });
      expect(e.text).toBe('Bob: stunned');
    });
  });

  describe('createManeuverLogEntry', () => {
    it('encodes maneuver id and label', () => {
      const e = createManeuverLogEntry({
        round: 2, turn: 1, actorInstanceId: 'a', actorName: 'Alice',
        maneuverId: 'aim', maneuverLabel: 'Aim'
      });
      expect(e.entryType).toBe('maneuver');
      expect(e.text).toContain('Alice');
      expect(e.text).toContain('Aim');
      expect(e.maneuver).toBe('aim');
    });
  });

  describe('createReinforcementLogEntry', () => {
    it('formats single reinforcement', () => {
      const e = createReinforcementLogEntry({
        round: 1, turn: 0, category: 'enemy',
        displayName: 'Wolf', quantity: 1, insertionMode: 'end_of_round'
      });
      expect(e.text).toContain('Wolf');
      expect(e.text).toContain('x1');
      expect(e.text).toContain('end of round');
    });

    it('formats multi-quantity', () => {
      const e = createReinforcementLogEntry({
        round: 1, turn: 0, category: 'enemy',
        displayName: 'Goblin', quantity: 4, insertionMode: 'next_turn'
      });
      expect(e.text).toContain('x4');
    });
  });

  describe('createItemLogEntry', () => {
    it('describes self-use', () => {
      const e = createItemLogEntry({
        round: 1, turn: 0, actorInstanceId: 'a', actorName: 'Alice',
        item: { itemId: 'p1', itemName: 'Healing Potion', qtyBefore: 2, qtyAfter: 1 }
      });
      expect(e.text).toBe('Alice used Healing Potion');
    });

    it('describes targeted use', () => {
      const e = createItemLogEntry({
        round: 1, turn: 0,
        actorInstanceId: 'a', actorName: 'Alice',
        targetInstanceId: 'b', targetName: 'Bob',
        item: { itemId: 'p1', itemName: 'Healing Potion', qtyBefore: 2, qtyAfter: 1 }
      });
      expect(e.text).toBe('Alice used Healing Potion on Bob');
    });

    it('honors explicit text override', () => {
      const e = createItemLogEntry({
        round: 1, turn: 0, actorInstanceId: 'a', actorName: 'Alice',
        item: { itemId: 'x', itemName: 'X', qtyBefore: 1, qtyAfter: 0 },
        text: 'overridden'
      });
      expect(e.text).toBe('overridden');
    });
  });

  describe('createConditionLogEntry', () => {
    it('formats applied with source', () => {
      const e = createConditionLogEntry({
        round: 1, turn: 0, targetInstanceId: 'a', targetName: 'Bob',
        changeType: 'applied', conditionId: 'stun', conditionLabel: 'Stun', source: 'major wound'
      });
      expect(e.text).toContain('Bob');
      expect(e.text).toContain('Stun');
      expect(e.text).toContain('applied');
      expect(e.text).toContain('major wound');
    });

    it('formats removed', () => {
      const e = createConditionLogEntry({
        round: 1, turn: 0, targetInstanceId: 'a', targetName: 'Bob',
        changeType: 'removed', conditionId: 'stun', conditionLabel: 'Stun'
      });
      expect(e.text).toContain('removed');
    });

    it('formats expired', () => {
      const e = createConditionLogEntry({
        round: 1, turn: 0, targetInstanceId: 'a', targetName: 'Bob',
        changeType: 'expired', conditionId: 'stun', conditionLabel: 'Stun'
      });
      expect(e.text).toContain('expired');
    });

    it('falls back to default for unknown changeType', () => {
      const e = createConditionLogEntry({
        round: 1, turn: 0, targetInstanceId: 'a', targetName: 'Bob',
        changeType: 'mutated', conditionId: 'x', conditionLabel: 'X'
      });
      expect(e.text).toContain('mutated');
    });
  });

  describe('createMovementLogEntry', () => {
    it('pluralizes yards', () => {
      const e = createMovementLogEntry({
        round: 1, turn: 0, actorInstanceId: 'a', actorName: 'Alice', yardsSpent: 3
      });
      expect(e.text).toBe('Alice: Moved 3 yards');
    });

    it('singular yard', () => {
      const e = createMovementLogEntry({
        round: 1, turn: 0, actorInstanceId: 'a', actorName: 'Alice', yardsSpent: 1
      });
      expect(e.text).toBe('Alice: Moved 1 yard');
    });
  });
});
