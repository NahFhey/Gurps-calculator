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

  describe('Player view — conditions filtering (12a.6 eye state)', () => {
    it('shows all conditions for player side regardless of eye state', () => {
      const p = mkParticipant({
        category: 'player',
        conditions: [
          { conditionId: 'poisoned', revealed: 'closed' },
          { conditionId: 'blinded' },
        ],
      });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].conditions).toHaveLength(2);
    });

    it('drops closed-eye enemy conditions even when catalog-obvious', () => {
      const p = mkParticipant({
        conditions: [{ instanceId: 'c1', conditionId: 'bleeding', label: 'Bleeding', revealed: 'closed' }],
      });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].conditions).toEqual([]);
    });

    it('passes open-eye enemy conditions through even when catalog-concealed', () => {
      const p = mkParticipant({
        conditions: [{ instanceId: 'c1', conditionId: 'poisoned', label: 'Poisoned', revealed: 'open' }],
      });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].conditions).toHaveLength(1);
      expect(view.participants[0].conditions[0].conditionId).toBe('poisoned');
    });

    it('replaces half-eye enemy conditions with an anonymous placeholder that leaks nothing', () => {
      const p = mkParticipant({
        conditions: [{
          instanceId: 'c1',
          conditionId: 'poisoned',
          label: 'Poisoned',
          severity: 3,
          source: 'Assassin blade',
          expiresAt: { type: 'round', round: 9 },
          notes: 'deadly',
          revealed: 'half',
        }],
      });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      const [placeholder] = view.participants[0].conditions;
      expect(placeholder).toEqual({
        instanceId: 'c1',
        conditionId: '__concealed__',
        label: 'Afflicted',
        placeholder: true,
      });
    });

    it('emits one placeholder per half-eye instance (count is deliberately exposed)', () => {
      const p = mkParticipant({
        conditions: [
          { instanceId: 'c1', conditionId: 'poisoned', revealed: 'half' },
          { instanceId: 'c2', conditionId: 'blinded', revealed: 'half' },
          { instanceId: 'c3', conditionId: 'slowed', revealed: 'closed' },
        ],
      });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      const conditions = view.participants[0].conditions;
      expect(conditions).toHaveLength(2);
      expect(conditions.every(c => c.placeholder)).toBe(true);
    });

    it('falls back to catalog obviousness for legacy instances without an eye state', () => {
      const p = mkParticipant({
        conditions: [
          { conditionId: 'prone' },     // obvious → treated as open
          { conditionId: 'poisoned' },  // not obvious → treated as closed
          { conditionId: 'bleeding' },  // obvious → treated as open
        ],
      });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      const ids = view.participants[0].conditions.map(c => c.conditionId);
      expect(ids).toContain('prone');
      expect(ids).toContain('bleeding');
      expect(ids).not.toContain('poisoned');
    });

    it('no longer reveals concealed conditions when HP is fully revealed (eye state is authoritative)', () => {
      const p = mkParticipant({
        conditions: [
          { conditionId: 'poisoned', revealed: 'closed' },
          { conditionId: 'blinded', revealed: 'closed' },
        ],
      });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT }, defenses: {}, dr: {},
        attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });
      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].conditions).toEqual([]);
    });

    it('GM view sees every condition unfiltered, with eye state intact', () => {
      const p = mkParticipant({
        conditions: [
          { instanceId: 'c1', conditionId: 'poisoned', revealed: 'closed' },
          { instanceId: 'c2', conditionId: 'blinded', revealed: 'half' },
        ],
      });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.GM);
      const conditions = view.participants[0].conditions;
      expect(conditions).toHaveLength(2);
      expect(conditions[0].revealed).toBe('closed');
      expect(conditions[1].conditionId).toBe('blinded');
    });

    it('returns empty array for missing/non-array conditions', () => {
      const p = mkParticipant({ conditions: undefined });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].conditions).toEqual([]);
    });
  });

  describe('Player view — injury fields', () => {
    it('exposes injury fields when HP exact (stun flows through conditions, not a bool)', () => {
      const p = mkParticipant({ shockPenalty: -2, bleeding: true, crippled: { leftArm: true } });
      const combat = mkCombatState({ participants: [p] });
      const reveal = mkRevealForInstance('enemy-001', {
        name: RevealMode.NAME_FULL, tags: RevealMode.NOTES_HIDDEN,
        hp: { mode: RevealMode.NUMERIC_EXACT }, defenses: {}, dr: {},
        attacks: RevealMode.ATTACKS_HIDDEN, notes: RevealMode.NOTES_HIDDEN,
      });
      const view = getCombatView(combat, reveal, ViewMode.PLAYER);
      expect(view.participants[0].shockPenalty).toBe(-2);
      expect(view.participants[0].isStunned).toBeUndefined();
      expect(view.participants[0].bleeding).toBe(true);
    });

    it('hides injury fields when HP not exact, but always reports the dead flag', () => {
      const p = mkParticipant({ shockPenalty: -3, isDead: false });
      const combat = mkCombatState({ participants: [p] });
      const view = getCombatView(combat, { byInstanceId: {} }, ViewMode.PLAYER);
      expect(view.participants[0].shockPenalty).toBeUndefined();
      expect(view.participants[0].isStunned).toBeUndefined();
      expect(view.participants[0].isUnconscious).toBeUndefined();
      expect(view.participants[0].isDead).toBe(false);
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
