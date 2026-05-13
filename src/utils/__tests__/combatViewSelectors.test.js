import { describe, it, expect } from 'vitest';
import {
  getDefenderDefenseBase,
  getPublicDefenderLabel,
  getPublicDefenseLabel,
} from '../combatViewSelectors';
import { RevealMode } from '../combatReveal';

const mkParticipant = (overrides = {}) => ({
  instanceId: 'enemy-001',
  id: 'goblin',
  name: 'Goblin',
  category: 'enemy',
  dodge: 8,
  parry: 9,
  block: 7,
  ...overrides,
});

const mkCombatState = (participants = []) => ({
  version: 1,
  id: 'combat-1',
  participants,
});

const mkRevealState = (instanceId, reveal) => ({
  byInstanceId: { [instanceId]: reveal },
});

describe('getDefenderDefenseBase', () => {
  it('returns null when combatState is missing', () => {
    expect(getDefenderDefenseBase(null, 'enemy-001', 'dodge')).toBeNull();
  });

  it('returns null when defenderId is missing', () => {
    const state = mkCombatState([mkParticipant()]);
    expect(getDefenderDefenseBase(state, null, 'dodge')).toBeNull();
  });

  it('returns null when type is missing', () => {
    const state = mkCombatState([mkParticipant()]);
    expect(getDefenderDefenseBase(state, 'enemy-001', null)).toBeNull();
  });

  it('returns null when defender is not found', () => {
    const state = mkCombatState([mkParticipant()]);
    expect(getDefenderDefenseBase(state, 'missing-id', 'dodge')).toBeNull();
  });

  it('reads value from defenses object when present', () => {
    const state = mkCombatState([
      mkParticipant({ defenses: { dodge: 10, parry: 12 } }),
    ]);
    expect(getDefenderDefenseBase(state, 'enemy-001', 'dodge')).toBe(10);
    expect(getDefenderDefenseBase(state, 'enemy-001', 'parry')).toBe(12);
  });

  it('falls back to top-level defender field when defenses is missing', () => {
    const state = mkCombatState([mkParticipant()]);
    expect(getDefenderDefenseBase(state, 'enemy-001', 'dodge')).toBe(8);
    expect(getDefenderDefenseBase(state, 'enemy-001', 'parry')).toBe(9);
    expect(getDefenderDefenseBase(state, 'enemy-001', 'block')).toBe(7);
  });

  it('prefers defenses object over top-level field', () => {
    const state = mkCombatState([
      mkParticipant({ defenses: { dodge: 99 }, dodge: 8 }),
    ]);
    expect(getDefenderDefenseBase(state, 'enemy-001', 'dodge')).toBe(99);
  });

  it('returns null when defense value is undefined on both sources', () => {
    const state = mkCombatState([
      mkParticipant({ dodge: undefined, parry: undefined, block: undefined }),
    ]);
    expect(getDefenderDefenseBase(state, 'enemy-001', 'dodge')).toBeNull();
  });
});

describe('getPublicDefenderLabel', () => {
  it('returns "Unknown Foe" when combatState is missing', () => {
    expect(getPublicDefenderLabel(null, null, 'enemy-001')).toBe('Unknown Foe');
  });

  it('returns "Unknown Foe" when defenderId is missing', () => {
    const state = mkCombatState([mkParticipant()]);
    expect(getPublicDefenderLabel(state, null, null)).toBe('Unknown Foe');
  });

  it('returns "Unknown Foe" when defender is not found', () => {
    const state = mkCombatState([mkParticipant()]);
    expect(getPublicDefenderLabel(state, null, 'missing')).toBe('Unknown Foe');
  });

  it('returns full name when reveal mode is NAME_FULL', () => {
    const state = mkCombatState([mkParticipant()]);
    const reveal = mkRevealState('enemy-001', { name: RevealMode.NAME_FULL });
    expect(getPublicDefenderLabel(state, reveal, 'enemy-001')).toBe('Goblin');
  });

  it('returns partial id label when reveal mode is NAME_PARTIAL', () => {
    const state = mkCombatState([mkParticipant({ instanceId: 'enemy-abcd1234' })]);
    const reveal = mkRevealState('enemy-abcd1234', { name: RevealMode.NAME_PARTIAL });
    expect(getPublicDefenderLabel(state, reveal, 'enemy-abcd1234')).toBe('Unknown #1234');
  });

  it('returns "Unknown Foe" when reveal mode is NAME_HIDDEN', () => {
    const state = mkCombatState([mkParticipant({ category: 'enemy' })]);
    const reveal = mkRevealState('enemy-001', { name: RevealMode.NAME_HIDDEN });
    expect(getPublicDefenderLabel(state, reveal, 'enemy-001')).toBe('Unknown Foe');
  });

  it('reveals full name for player-side defenders by default', () => {
    const state = mkCombatState([mkParticipant({ category: 'player', name: 'Alice' })]);
    expect(getPublicDefenderLabel(state, null, 'enemy-001')).toBe('Alice');
  });

  it('hides enemy name by default when no reveal entry exists', () => {
    const state = mkCombatState([mkParticipant({ category: 'enemy' })]);
    const reveal = { byInstanceId: {} };
    expect(getPublicDefenderLabel(state, reveal, 'enemy-001')).toBe('Unknown Foe');
  });

  it('falls back to side field when category is absent', () => {
    const state = mkCombatState([
      mkParticipant({ category: undefined, side: 'player', name: 'Bob' }),
    ]);
    expect(getPublicDefenderLabel(state, null, 'enemy-001')).toBe('Bob');
  });
});

describe('getPublicDefenseLabel', () => {
  it('returns "Not set" when defender has no defense value', () => {
    const state = mkCombatState([
      mkParticipant({ dodge: undefined, parry: undefined, block: undefined }),
    ]);
    expect(getPublicDefenseLabel(state, null, 'enemy-001', 'dodge')).toBe('Not set');
  });

  it('returns "Not set" when defender does not exist', () => {
    const state = mkCombatState([mkParticipant()]);
    expect(getPublicDefenseLabel(state, null, 'missing', 'dodge')).toBe('Not set');
  });

  it('returns "Base: N" when revealState is null', () => {
    const state = mkCombatState([mkParticipant()]);
    expect(getPublicDefenseLabel(state, null, 'enemy-001', 'dodge')).toBe('Base: 8');
  });

  it('returns "Base: N" when defense reveal mode is DEFENSE_EXACT', () => {
    const state = mkCombatState([mkParticipant()]);
    const reveal = mkRevealState('enemy-001', {
      defenses: { dodge: RevealMode.DEFENSE_EXACT },
    });
    expect(getPublicDefenseLabel(state, reveal, 'enemy-001', 'dodge')).toBe('Base: 8');
  });

  it('returns "Base: N" when defense reveal mode is DEFENSE_APPROX', () => {
    const state = mkCombatState([mkParticipant()]);
    const reveal = mkRevealState('enemy-001', {
      defenses: { dodge: RevealMode.DEFENSE_APPROX },
    });
    expect(getPublicDefenseLabel(state, reveal, 'enemy-001', 'dodge')).toBe('Base: 8');
  });

  it('returns "Base: ?" when defense reveal mode is DEFENSE_UNKNOWN', () => {
    const state = mkCombatState([mkParticipant()]);
    const reveal = mkRevealState('enemy-001', {
      defenses: { dodge: RevealMode.DEFENSE_UNKNOWN },
    });
    expect(getPublicDefenseLabel(state, reveal, 'enemy-001', 'dodge')).toBe('Base: ?');
  });

  it('defaults to DEFENSE_UNKNOWN when no defense entry exists for type', () => {
    const state = mkCombatState([mkParticipant({ category: 'enemy' })]);
    const reveal = mkRevealState('enemy-001', { defenses: {} });
    expect(getPublicDefenseLabel(state, reveal, 'enemy-001', 'dodge')).toBe('Base: ?');
  });

  it('uses player default reveal (DEFENSE_EXACT) when no reveal entry for player side', () => {
    const state = mkCombatState([mkParticipant({ category: 'player' })]);
    const reveal = { byInstanceId: {} };
    expect(getPublicDefenseLabel(state, reveal, 'enemy-001', 'dodge')).toBe('Base: 8');
  });

  it('reads from defenses object when present', () => {
    const state = mkCombatState([
      mkParticipant({ defenses: { parry: 11 } }),
    ]);
    const reveal = mkRevealState('enemy-001', {
      defenses: { parry: RevealMode.DEFENSE_EXACT },
    });
    expect(getPublicDefenseLabel(state, reveal, 'enemy-001', 'parry')).toBe('Base: 11');
  });
});
