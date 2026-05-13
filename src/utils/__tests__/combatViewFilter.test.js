import { describe, it, expect } from 'vitest';
import { getCombatView, hasHiddenInfo, ViewMode } from '../combatViewFilter';
import { RevealMode } from '../combatReveal';

const mkParticipant = (overrides = {}) => ({
  instanceId: 'enemy-001',
  id: 'goblin',
  name: 'Goblin',
  category: 'enemy',
  basicSpeed: 5,
  dx: 11,
  currentHP: 10,
  maxHP: 10,
  currentFP: 8,
  maxFP: 8,
  dodge: 8,
  parry: 9,
  block: 0,
  dr: 2,
  drByLocation: { torso: 2, head: 4 },
  attacks: [{ name: 'Sword', damage: '1d+2' }],
  notes: 'Wields a rusty blade',
  tags: ['goblinoid', 'humanoid'],
  conditions: [],
  ...overrides,
});

const mkCombatState = (overrides = {}) => ({
  version: 1,
  id: 'combat-1',
  name: 'Test Combat',
  startTime: 1000,
  currentTurnIndex: 0,
  currentRound: 1,
  turnOrder: [],
  participants: [],
  log: [],
  ...overrides,
});

const mkRevealForInstance = (instanceId, reveal) => ({
  byInstanceId: { [instanceId]: reveal },
});

describe('getCombatView', () => {
  it('returns null for null combat state', () => {
    expect(getCombatView(null, {}, ViewMode.GM)).toBeNull();
  });

  describe('GM view', () => {
    it('returns truth state with reveal metadata attached', () => {
      const p = mkParticipant();
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL,
        hp: { mode: RevealMode.NUMERIC_EXACT },
      });

      const view = getCombatView(combat, reveal, ViewMode.GM);

      expect(view._viewMode).toBe(ViewMode.GM);
      expect(view._revealState).toBe(reveal);
      expect(view.participants[0].name).toBe('Goblin');
      expect(view.participants[0].currentHP).toBe(10);
      expect(view.participants[0]._reveal).toBeDefined();
    });
  });

  describe('Player view — name filtering', () => {
    it('shows full name when NAME_FULL', () => {
      const p = mkParticipant({ instanceId: 'enemy-1234abcd' });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-1234abcd', {
        name: RevealMode.NAME_FULL,
        tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_BAND },
        defenses: {}, dr: {}, attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });

      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].name).toBe('Goblin');
    });

    it('returns "Unknown #<last4>" for NAME_PARTIAL', () => {
      const p = mkParticipant({ instanceId: 'enemy-1234abcd' });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-1234abcd', {
        name: RevealMode.NAME_PARTIAL,
        tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_UNKNOWN },
        defenses: {}, dr: {}, attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });

      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].name).toBe('Unknown #abcd');
    });

    it('returns "Unknown Foe" for NAME_HIDDEN (default enemy reveal)', () => {
      const p = mkParticipant();
      const combat = mkCombatState({ participants: [p] });
      // No reveal entry → default enemy reveal (everything hidden)
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].name).toBe('Unknown Foe');
    });
  });

  describe('Player view — HP filtering', () => {
    it('exposes exact HP when NUMERIC_EXACT', () => {
      const p = mkParticipant({ currentHP: 7, maxHP: 10 });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL,
        tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT },
        defenses: {}, dr: {}, attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });

      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].hp).toEqual({ mode: RevealMode.NUMERIC_EXACT, current: 7, max: 10 });
    });

    it('returns band info for NUMERIC_BAND', () => {
      const p = mkParticipant({ currentHP: 3, maxHP: 10 });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_HIDDEN,
        tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_BAND },
        defenses: {}, dr: {}, attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });

      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].hp.mode).toBe(RevealMode.NUMERIC_BAND);
      expect(view.participants[0].hp.bandText).toBeTruthy();
    });

    it('returns NUMERIC_UNKNOWN with no other data leaked', () => {
      const p = mkParticipant({ currentHP: 1, maxHP: 100 });
      const combat = mkCombatState({ participants: [p] });
      // Default enemy reveal sets hp to NUMERIC_UNKNOWN
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].hp).toEqual({ mode: RevealMode.NUMERIC_UNKNOWN });
    });
  });

  describe('Player view — defenses, DR, attacks, notes', () => {
    it('hides defenses by default for enemies', () => {
      const p = mkParticipant();
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].defenses.dodge.mode).toBe(RevealMode.DEFENSE_UNKNOWN);
      expect(view.participants[0].defenses.parry.mode).toBe(RevealMode.DEFENSE_UNKNOWN);
      expect(view.participants[0].defenses.block.mode).toBe(RevealMode.DEFENSE_UNKNOWN);
    });

    it('exposes exact defense values when DEFENSE_EXACT', () => {
      const p = mkParticipant({ dodge: 9 });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT },
        defenses: { dodge: RevealMode.DEFENSE_EXACT, parry: RevealMode.DEFENSE_UNKNOWN, block: RevealMode.DEFENSE_UNKNOWN },
        dr: {}, attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });
      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].defenses.dodge).toEqual({ mode: RevealMode.DEFENSE_EXACT, value: 9 });
    });

    it('returns DEFENSE_APPROX with provided approxValue', () => {
      const p = mkParticipant({ parry: 11 });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT },
        defenses: { dodge: RevealMode.DEFENSE_UNKNOWN, parry: RevealMode.DEFENSE_APPROX, block: RevealMode.DEFENSE_UNKNOWN, approxValue: { parry: 10 } },
        dr: {}, attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });
      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].defenses.parry).toEqual({ mode: RevealMode.DEFENSE_APPROX, value: 10 });
    });

    it('filters DR per-location based on reveal', () => {
      const p = mkParticipant({ dr: 4, drByLocation: { torso: 4, head: 6 } });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT }, defenses: {},
        dr: {
          general: RevealMode.DR_EXACT,
          byLocation: {
            torso: { mode: RevealMode.DR_EXACT },
            head: { mode: RevealMode.DR_MIN_KNOWN, min: 4 },
          },
        },
        attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });
      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].dr.general).toEqual({ mode: RevealMode.DR_EXACT, value: 4 });
      expect(view.participants[0].dr.byLocation.torso).toEqual({ mode: RevealMode.DR_EXACT, value: 4 });
      expect(view.participants[0].dr.byLocation.head).toEqual({ mode: RevealMode.DR_MIN_KNOWN, min: 4 });
    });

    it('returns names-only attacks for ATTACKS_NAMES_ONLY', () => {
      const p = mkParticipant({ attacks: [{ name: 'Bite', damage: '1d-1' }, { name: 'Claw', damage: '1d' }] });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT }, defenses: {}, dr: {},
        attacks: RevealMode.ATTACKS_NAMES_ONLY, notes: RevealMode.NOTES_HIDDEN,
      });
      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].attacks).toEqual([
        { name: 'Bite', _hidden: true },
        { name: 'Claw', _hidden: true },
      ]);
    });

    it('returns empty attacks array for ATTACKS_HIDDEN', () => {
      const p = mkParticipant();
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].attacks).toEqual([]);
    });

    it('returns empty array for participant with no attacks', () => {
      const p = mkParticipant({ attacks: [] });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT }, defenses: {}, dr: {},
        attacks: RevealMode.ATTACKS_FULL, notes: RevealMode.NOTES_HIDDEN,
      });
      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].attacks).toEqual([]);
    });

    it('hides notes by default and exposes them on NOTES_FULL', () => {
      const p = mkParticipant();
      const combat = mkCombatState({ participants: [p] });
      const hidden = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(hidden.participants[0].notes).toBe('');

      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_FULL,
        hp: { mode: RevealMode.NUMERIC_EXACT }, defenses: {}, dr: {},
        attacks: RevealMode.ATTACKS_FULL, notes: RevealMode.NOTES_FULL,
      });
      const shown = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(shown.participants[0].notes).toBe('Wields a rusty blade');
      expect(shown.participants[0].tags).toEqual(['goblinoid', 'humanoid']);
    });
  });

  describe('Player view — conditions filtering', () => {
    it('shows all conditions for player side regardless of HP reveal', () => {
      const p = mkParticipant({
        category: 'player',
        conditions: [{ conditionId: 'poisoned' }, { conditionId: 'blinded' }],
      });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].conditions).toHaveLength(2);
    });

    it('shows only obvious conditions for enemy when HP not revealed', () => {
      const p = mkParticipant({
        conditions: [
          { conditionId: 'prone' },     // obvious
          { conditionId: 'poisoned' },  // not obvious
          { conditionId: 'bleeding' },  // obvious
        ],
      });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      const ids = view.participants[0].conditions.map(c => c.conditionId);
      expect(ids).toContain('prone');
      expect(ids).toContain('bleeding');
      expect(ids).not.toContain('poisoned');
    });

    it('shows all conditions for enemy when HP fully revealed', () => {
      const p = mkParticipant({
        conditions: [{ conditionId: 'poisoned' }, { conditionId: 'blinded' }],
      });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT }, defenses: {}, dr: {},
        attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });
      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].conditions).toHaveLength(2);
    });

    it('returns empty array for missing/non-array conditions', () => {
      const p = mkParticipant({ conditions: undefined });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].conditions).toEqual([]);
    });
  });

  describe('Player view — injury fields', () => {
    it('exposes injury fields when HP exact', () => {
      const p = mkParticipant({ shockPenalty: -2, isStunned: true, bleeding: true, crippled: { leftArm: true } });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT }, defenses: {}, dr: {},
        attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });
      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].shockPenalty).toBe(-2);
      expect(view.participants[0].isStunned).toBe(true);
      expect(view.participants[0].bleeding).toBe(true);
    });

    it('hides injury fields when HP not exact, but always reports dead/unconscious flags', () => {
      const p = mkParticipant({ shockPenalty: -3, isStunned: true, isDead: false, isUnconscious: false });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].shockPenalty).toBeUndefined();
      expect(view.participants[0].isStunned).toBeUndefined();
      expect(view.participants[0].isDead).toBe(false);
      expect(view.participants[0].isUnconscious).toBe(false);
    });
  });
});

describe('hasHiddenInfo', () => {
  it('returns false when reveal metadata is missing', () => {
    expect(hasHiddenInfo({})).toBe(false);
  });

  it('returns false when everything is fully revealed', () => {
    const participant = {
      _reveal: {
        name: RevealMode.NAME_FULL,
        hp: { mode: RevealMode.NUMERIC_EXACT },
        defenses: { dodge: RevealMode.DEFENSE_EXACT },
        dr: { general: RevealMode.DR_EXACT },
        attacks: RevealMode.ATTACKS_FULL,
      },
    };
    expect(hasHiddenInfo(participant)).toBe(false);
  });

  it('returns true when name is hidden', () => {
    const participant = {
      _reveal: {
        name: RevealMode.NAME_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT },
        defenses: { dodge: RevealMode.DEFENSE_EXACT },
        dr: { general: RevealMode.DR_EXACT },
        attacks: RevealMode.ATTACKS_FULL,
      },
    };
    expect(hasHiddenInfo(participant)).toBe(true);
  });

  it('returns true when HP is not exact', () => {
    const participant = {
      _reveal: {
        name: RevealMode.NAME_FULL,
        hp: { mode: RevealMode.NUMERIC_BAND },
        defenses: { dodge: RevealMode.DEFENSE_EXACT },
        dr: { general: RevealMode.DR_EXACT },
        attacks: RevealMode.ATTACKS_FULL,
      },
    };
    expect(hasHiddenInfo(participant)).toBe(true);
  });
});
