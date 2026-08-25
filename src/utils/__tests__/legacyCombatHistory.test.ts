import { describe, it, expect } from 'vitest';
import {
  isLegacyCombatSession,
  legacyCombatSessionToCombatState,
  upgradeCombatHistory,
} from '../legacyCombatHistory';
import type { CombatSession } from '../../types/campaign';
import type { CombatState } from '../../types/combatTracker';

const legacySession: CombatSession = {
  id: 'legacy-1',
  name: 'Old Skirmish',
  participants: [
    {
      characterId: 'char-1',
      team: 'ally',
      initiative: 12,
      currentHP: 7,
      currentFP: 9,
      status: 'active',
    },
    {
      characterId: 'char-2',
      team: 'enemy',
      initiative: 9,
      currentHP: 0,
      status: 'dead',
    },
  ],
  currentRound: 4,
  currentTurn: 1,
  log: [
    {
      round: 2,
      turn: 0,
      action: 'Char-1 attacks Char-2',
      actorId: 'char-1',
      targetId: 'char-2',
      damage: 5,
      timestamp: 1756800000000,
    },
  ],
  startDate: '2025-09-01T12:00:00.000Z',
  endDate: '2025-09-01T12:30:00.000Z',
  outcome: 'victory',
};

const modernSession: CombatState = {
  id: 'modern-1',
  name: 'New Battle',
  startTime: 1767225600000,
  participants: [],
  turnOrder: [],
  currentTurnIndex: 0,
  currentRound: 1,
  turnDecisions: {},
  log: [],
};

describe('isLegacyCombatSession', () => {
  it('detects legacy entries by startDate without startTime', () => {
    expect(isLegacyCombatSession(legacySession)).toBe(true);
  });

  it('rejects modern CombatState entries', () => {
    expect(isLegacyCombatSession(modernSession)).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isLegacyCombatSession(null)).toBe(false);
    expect(isLegacyCombatSession('combat')).toBe(false);
    expect(isLegacyCombatSession(42)).toBe(false);
  });
});

describe('legacyCombatSessionToCombatState', () => {
  const upgraded = legacyCombatSessionToCombatState(legacySession);

  it('preserves identity and round/turn counters', () => {
    expect(upgraded.id).toBe('legacy-1');
    expect(upgraded.name).toBe('Old Skirmish');
    expect(upgraded.currentRound).toBe(4);
    expect(upgraded.currentTurnIndex).toBe(1);
  });

  it('converts date strings to epoch times', () => {
    expect(upgraded.startTime).toBe(Date.parse('2025-09-01T12:00:00.000Z'));
    expect(upgraded.endTime).toBe(Date.parse('2025-09-01T12:30:00.000Z'));
  });

  it('maps participants onto the canonical shape with characterId as identity', () => {
    expect(upgraded.participants).toHaveLength(2);
    const [ally, enemy] = upgraded.participants;
    expect(ally.instanceId).toBe('char-1');
    expect(ally.libraryId).toBe('char-1');
    expect(ally.name).toBe('char-1');
    expect(ally.category).toBe('ally');
    expect(ally.currentHP).toBe(7);
    expect(ally.currentFP).toBe(9);
    expect(ally.isDead).toBe(false);
    expect(enemy.category).toBe('enemy');
    expect(enemy.isDead).toBe(true);
  });

  it('builds turnOrder from participants', () => {
    expect(upgraded.turnOrder).toEqual(['char-1', 'char-2']);
  });

  it('converts log actions to note entries and appends the outcome', () => {
    expect(upgraded.log).toHaveLength(2);
    expect(upgraded.log[0].entryType).toBe('note');
    expect(upgraded.log[0].text).toBe('Char-1 attacks Char-2');
    expect(upgraded.log[0].timestamp).toBe(1756800000000);
    expect(upgraded.log[1].text).toBe('Outcome: victory');
  });

  it('falls back to epoch 0 for unparseable start dates', () => {
    const mangled = legacyCombatSessionToCombatState({
      ...legacySession,
      startDate: 'not-a-date',
      endDate: undefined,
    });
    expect(mangled.startTime).toBe(0);
    expect(mangled.endTime).toBeUndefined();
  });
});

describe('upgradeCombatHistory', () => {
  it('upgrades legacy entries and passes modern entries through untouched', () => {
    const result = upgradeCombatHistory([legacySession, modernSession]);
    expect(result).toHaveLength(2);
    expect(result[0].startTime).toBe(Date.parse('2025-09-01T12:00:00.000Z'));
    expect(result[1]).toBe(modernSession);
  });

  it('is idempotent', () => {
    const once = upgradeCombatHistory([legacySession]);
    const twice = upgradeCombatHistory(once);
    expect(twice).toEqual(once);
    expect(twice[0]).toBe(once[0]);
  });

  it('drops non-object garbage and tolerates non-array input', () => {
    expect(upgradeCombatHistory([legacySession, null, 'junk'])).toHaveLength(1);
    expect(upgradeCombatHistory(undefined)).toEqual([]);
    expect(upgradeCombatHistory({ not: 'an array' })).toEqual([]);
  });
});
