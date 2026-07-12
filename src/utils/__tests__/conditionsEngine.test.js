import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createConditionInstance,
  applyCondition,
  removeCondition,
  removeConditionType,
  updateConditionDuration,
  tickConditionsTurn,
  tickConditionsRound,
  clearEndOfCombatConditions,
  getActiveConditions,
  hasCondition,
  getConditionInstances,
  formatConditionDuration,
  formatConditionTooltip,
  cycleRevealed,
  cycleConditionRevealed,
  ensureParticipantConditionVisibility,
} from '../conditionsEngine';
import { ConditionId, DurationType } from '../../constants/conditions';

const mkCombatant = (overrides = {}) => ({
  instanceId: 'goblin-001',
  name: 'Goblin',
  conditions: [],
  ...overrides,
});

describe('createConditionInstance', () => {
  it('returns null and warns for unknown condition id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = createConditionInstance('not-a-real-condition');
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('builds a stunned instance with default 1-turn duration', () => {
    const instance = createConditionInstance(ConditionId.STUNNED, { round: 2, turn: 3 });
    expect(instance).toMatchObject({
      conditionId: ConditionId.STUNNED,
      label: 'Stunned',
      startedAtRound: 2,
      startedAtTurn: 3,
      duration: { type: 'turns', value: 1 },
      expiresAt: { type: 'turn', turnsRemaining: 1 },
    });
    expect(instance.instanceId).toBeTruthy();
  });

  it('builds a rounds-based instance with computed expiry round', () => {
    const instance = createConditionInstance(ConditionId.BLINDED, { round: 5 });
    // BLINDED defaults to 3 rounds
    expect(instance.expiresAt).toEqual({ type: 'round', round: 8 });
  });

  it('builds a permanent instance with null expiresAt', () => {
    const instance = createConditionInstance(ConditionId.PRONE);
    expect(instance.expiresAt).toBeNull();
  });

  it('builds an untilEndOfCombat instance', () => {
    const instance = createConditionInstance(ConditionId.BLEEDING);
    expect(instance.expiresAt).toEqual({ type: 'endOfCombat' });
  });

  it('honours an explicit duration override', () => {
    const instance = createConditionInstance(ConditionId.STUNNED, {
      round: 1,
      duration: { type: DurationType.ROUNDS, value: 4 },
    });
    expect(instance.expiresAt).toEqual({ type: 'round', round: 5 });
  });

  it('carries severity, source, and notes through to the instance', () => {
    const instance = createConditionInstance(ConditionId.POISONED, {
      severity: 2,
      source: 'Spider Venom',
      notes: 'save vs HT next round',
    });
    expect(instance.severity).toBe(2);
    expect(instance.source).toBe('Spider Venom');
    expect(instance.notes).toBe('save vs HT next round');
  });

  it('seeds revealed from the catalog: obvious → open', () => {
    expect(createConditionInstance(ConditionId.BLEEDING).revealed).toBe('open');
    expect(createConditionInstance(ConditionId.STUNNED).revealed).toBe('open');
  });

  it('seeds revealed from the catalog: concealed → closed', () => {
    expect(createConditionInstance(ConditionId.POISONED).revealed).toBe('closed');
    expect(createConditionInstance(ConditionId.BLINDED).revealed).toBe('closed');
  });

  it('honours an explicit revealed override (half is never a default)', () => {
    const instance = createConditionInstance(ConditionId.POISONED, { revealed: 'half' });
    expect(instance.revealed).toBe('half');
  });
});

describe('cycleRevealed (12a.6 eye control)', () => {
  it('cycles closed → half → open → closed', () => {
    expect(cycleRevealed('closed')).toBe('half');
    expect(cycleRevealed('half')).toBe('open');
    expect(cycleRevealed('open')).toBe('closed');
  });

  it('treats unknown/legacy values as visible so the first click hides', () => {
    expect(cycleRevealed(undefined)).toBe('closed');
    expect(cycleRevealed('garbage')).toBe('closed');
  });
});

describe('cycleConditionRevealed', () => {
  it('cycles only the targeted instance', () => {
    const combatant = mkCombatant({
      conditions: [
        { instanceId: 'c1', conditionId: ConditionId.POISONED, revealed: 'closed' },
        { instanceId: 'c2', conditionId: ConditionId.PRONE, revealed: 'open' },
      ],
    });
    const next = cycleConditionRevealed(combatant, 'c1');
    expect(next.conditions[0].revealed).toBe('half');
    expect(next.conditions[1].revealed).toBe('open');
  });

  it('returns the same combatant reference when the instance is missing', () => {
    const combatant = mkCombatant({
      conditions: [{ instanceId: 'c1', conditionId: ConditionId.PRONE, revealed: 'open' }],
    });
    expect(cycleConditionRevealed(combatant, 'nope')).toBe(combatant);
  });

  it('does not mutate the original combatant', () => {
    const combatant = mkCombatant({
      conditions: [{ instanceId: 'c1', conditionId: ConditionId.PRONE, revealed: 'open' }],
    });
    cycleConditionRevealed(combatant, 'c1');
    expect(combatant.conditions[0].revealed).toBe('open');
  });
});

describe('ensureParticipantConditionVisibility (12a.6 migration helper)', () => {
  it('folds isStunned: true into a permanent Stunned condition and drops the bool', () => {
    const legacy = mkCombatant({ isStunned: true });
    const migrated = ensureParticipantConditionVisibility(legacy);

    expect(migrated.isStunned).toBeUndefined();
    expect('isStunned' in migrated).toBe(false);
    expect(migrated.conditions).toHaveLength(1);
    expect(migrated.conditions[0]).toMatchObject({
      conditionId: ConditionId.STUNNED,
      expiresAt: null,     // permanent — matches sticky bool semantics
      revealed: 'open',    // Stunned is catalog-obvious
    });
  });

  it('folds isUnconscious: true into an Unconscious condition', () => {
    const migrated = ensureParticipantConditionVisibility(mkCombatant({ isUnconscious: true }));
    expect(hasCondition(migrated, ConditionId.UNCONSCIOUS)).toBe(true);
    expect('isUnconscious' in migrated).toBe(false);
  });

  it('drops false bools without inserting conditions', () => {
    const migrated = ensureParticipantConditionVisibility(
      mkCombatant({ isStunned: false, isUnconscious: false })
    );
    expect(migrated.conditions).toHaveLength(0);
    expect('isStunned' in migrated).toBe(false);
    expect('isUnconscious' in migrated).toBe(false);
  });

  it('mixed legacy: bool true AND existing condition → one condition, no double-insert', () => {
    const legacy = mkCombatant({
      isStunned: true,
      conditions: [{ instanceId: 'c1', conditionId: ConditionId.STUNNED, label: 'Stunned', revealed: 'open' }],
    });
    const migrated = ensureParticipantConditionVisibility(legacy);
    expect(migrated.conditions).toHaveLength(1);
    expect(migrated.conditions[0].instanceId).toBe('c1');
  });

  it('backfills revealed on legacy instances from catalog defaults', () => {
    const legacy = mkCombatant({
      conditions: [
        { instanceId: 'c1', conditionId: ConditionId.PRONE, label: 'Prone' },
        { instanceId: 'c2', conditionId: ConditionId.POISONED, label: 'Poisoned' },
      ],
    });
    const migrated = ensureParticipantConditionVisibility(legacy);
    expect(migrated.conditions[0].revealed).toBe('open');
    expect(migrated.conditions[1].revealed).toBe('closed');
  });

  it('preserves an already-set eye state during backfill', () => {
    const legacy = mkCombatant({
      isStunned: true,
      conditions: [{ instanceId: 'c1', conditionId: ConditionId.POISONED, revealed: 'half' }],
    });
    const migrated = ensureParticipantConditionVisibility(legacy);
    const poisoned = migrated.conditions.find(c => c.conditionId === ConditionId.POISONED);
    expect(poisoned.revealed).toBe('half');
  });

  it('is idempotent — a second run returns the same reference', () => {
    const once = ensureParticipantConditionVisibility(
      mkCombatant({ isStunned: true, isUnconscious: true })
    );
    const twice = ensureParticipantConditionVisibility(once);
    expect(twice).toBe(once);
  });

  it('returns the same reference for already-migrated participants', () => {
    const clean = mkCombatant({
      conditions: [{ instanceId: 'c1', conditionId: ConditionId.PRONE, revealed: 'open' }],
    });
    expect(ensureParticipantConditionVisibility(clean)).toBe(clean);
  });

  it('handles participants with no conditions field', () => {
    const legacy = { instanceId: 'x', name: 'Bare', isStunned: true };
    const migrated = ensureParticipantConditionVisibility(legacy);
    expect(migrated.conditions).toHaveLength(1);
  });

  it('passes through null/non-object input untouched', () => {
    expect(ensureParticipantConditionVisibility(null)).toBeNull();
    expect(ensureParticipantConditionVisibility(undefined)).toBeUndefined();
  });
});

describe('applyCondition', () => {
  it('returns combatant unchanged for unknown condition', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = mkCombatant();
    const result = applyCondition(c, 'not-a-condition');
    expect(result).toBe(c);
    warn.mockRestore();
  });

  it('replace rule removes any existing instance of the same id', () => {
    const c = mkCombatant();
    let updated = applyCondition(c, ConditionId.STUNNED);
    updated = applyCondition(updated, ConditionId.STUNNED);
    const stunned = updated.conditions.filter(x => x.conditionId === ConditionId.STUNNED);
    expect(stunned).toHaveLength(1);
  });

  it('stack rule allows multiple instances', () => {
    const c = mkCombatant();
    let updated = applyCondition(c, ConditionId.BLEEDING);
    updated = applyCondition(updated, ConditionId.BLEEDING);
    const bleeds = updated.conditions.filter(x => x.conditionId === ConditionId.BLEEDING);
    expect(bleeds).toHaveLength(2);
  });

  it('max rule keeps existing when its remaining duration is longer', () => {
    const c = mkCombatant();
    // First apply at round 0 — expires at round 3
    let updated = applyCondition(c, ConditionId.BLINDED, { round: 0 });
    // Apply again with shorter duration override
    updated = applyCondition(updated, ConditionId.BLINDED, {
      round: 0,
      duration: { type: DurationType.ROUNDS, value: 1 },
    });
    const blinded = updated.conditions.filter(x => x.conditionId === ConditionId.BLINDED);
    expect(blinded).toHaveLength(1);
    expect(blinded[0].expiresAt.round).toBe(3);
  });

  it('max rule replaces existing when new instance lasts longer', () => {
    const c = mkCombatant();
    let updated = applyCondition(c, ConditionId.BLINDED, {
      round: 0,
      duration: { type: DurationType.ROUNDS, value: 1 },
    });
    updated = applyCondition(updated, ConditionId.BLINDED, {
      round: 0,
      duration: { type: DurationType.ROUNDS, value: 5 },
    });
    const blinded = updated.conditions.filter(x => x.conditionId === ConditionId.BLINDED);
    expect(blinded).toHaveLength(1);
    expect(blinded[0].expiresAt.round).toBe(5);
  });

  it('max rule adds first instance when none present', () => {
    const c = mkCombatant();
    const updated = applyCondition(c, ConditionId.BLINDED);
    expect(updated.conditions).toHaveLength(1);
  });

  it('handles combatants with no conditions array', () => {
    const c = { instanceId: 'x' };
    const updated = applyCondition(c, ConditionId.STUNNED);
    expect(updated.conditions).toHaveLength(1);
  });
});

describe('removeCondition', () => {
  it('removes a single instance by id', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.BLEEDING);
    c = applyCondition(c, ConditionId.BLEEDING);
    const target = c.conditions[0];
    const updated = removeCondition(c, target.instanceId);
    expect(updated.conditions).toHaveLength(1);
    expect(updated.conditions[0].instanceId).not.toBe(target.instanceId);
  });

  it('with removeAll=true removes every instance of the same conditionId', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.BLEEDING);
    c = applyCondition(c, ConditionId.BLEEDING);
    c = applyCondition(c, ConditionId.STUNNED);
    const bleedInstanceId = c.conditions.find(x => x.conditionId === ConditionId.BLEEDING).instanceId;
    const updated = removeCondition(c, bleedInstanceId, true);
    expect(updated.conditions.some(x => x.conditionId === ConditionId.BLEEDING)).toBe(false);
    expect(updated.conditions.some(x => x.conditionId === ConditionId.STUNNED)).toBe(true);
  });

  it('returns combatant unchanged when removeAll points at unknown instance', () => {
    const c = mkCombatant({ conditions: [{ instanceId: 'a', conditionId: 'x' }] });
    const updated = removeCondition(c, 'missing', true);
    expect(updated).toBe(c);
  });

  it('handles combatant with no conditions array', () => {
    const c = { instanceId: 'x' };
    const updated = removeCondition(c, 'whatever');
    expect(updated.conditions).toEqual([]);
  });
});

describe('removeConditionType', () => {
  it('removes all instances of the given conditionId', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.BLEEDING);
    c = applyCondition(c, ConditionId.BLEEDING);
    c = applyCondition(c, ConditionId.STUNNED);
    const updated = removeConditionType(c, ConditionId.BLEEDING);
    expect(updated.conditions).toHaveLength(1);
    expect(updated.conditions[0].conditionId).toBe(ConditionId.STUNNED);
  });

  it('is a no-op when conditionId is not present', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.STUNNED);
    const updated = removeConditionType(c, ConditionId.BLEEDING);
    expect(updated.conditions).toHaveLength(1);
  });
});

describe('updateConditionDuration', () => {
  it('updates duration and recalculates expiresAt for the matching instance', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.STUNNED, { round: 0 });
    const id = c.conditions[0].instanceId;
    const updated = updateConditionDuration(
      c,
      id,
      { type: DurationType.ROUNDS, value: 5 },
      2,
      0,
    );
    expect(updated.conditions[0].duration).toEqual({ type: DurationType.ROUNDS, value: 5 });
    expect(updated.conditions[0].expiresAt).toEqual({ type: 'round', round: 7 });
  });

  it('leaves non-matching instances untouched', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.STUNNED);
    const original = c.conditions[0];
    const updated = updateConditionDuration(c, 'other', { type: DurationType.ROUNDS, value: 1 }, 0, 0);
    expect(updated.conditions[0]).toEqual(original);
  });
});

describe('tickConditionsTurn', () => {
  it('decrements turnsRemaining and expires at zero', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.STUNNED); // 1 turn default
    const result = tickConditionsTurn(c, 0);
    expect(result.combatant.conditions).toHaveLength(0);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].conditionId).toBe(ConditionId.STUNNED);
  });

  it('keeps turn-based conditions with turns remaining and decrements them', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.STUNNED, {
      duration: { type: DurationType.TURNS, value: 3 },
    });
    const result = tickConditionsTurn(c, 0);
    expect(result.combatant.conditions).toHaveLength(1);
    expect(result.combatant.conditions[0].expiresAt.turnsRemaining).toBe(2);
    expect(result.expired).toHaveLength(0);
  });

  it('preserves permanent and non-turn-based conditions', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.PRONE);
    c = applyCondition(c, ConditionId.BLEEDING);
    const result = tickConditionsTurn(c, 0);
    expect(result.combatant.conditions).toHaveLength(2);
    expect(result.expired).toHaveLength(0);
  });

  it('handles combatant with no conditions array', () => {
    const result = tickConditionsTurn({ instanceId: 'x' }, 0);
    expect(result.combatant.conditions).toEqual([]);
    expect(result.expired).toEqual([]);
  });
});

describe('tickConditionsRound', () => {
  it('expires round-based conditions when current round reaches expiry', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.BLINDED, { round: 0 }); // expires round 3
    const result = tickConditionsRound(c, 3);
    expect(result.combatant.conditions).toHaveLength(0);
    expect(result.expired).toHaveLength(1);
  });

  it('keeps round-based conditions still in the future', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.BLINDED, { round: 0 }); // expires round 3
    const result = tickConditionsRound(c, 1);
    expect(result.combatant.conditions).toHaveLength(1);
    expect(result.expired).toHaveLength(0);
  });

  it('preserves permanent and non-round conditions', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.PRONE);
    c = applyCondition(c, ConditionId.STUNNED);
    const result = tickConditionsRound(c, 99);
    expect(result.combatant.conditions).toHaveLength(2);
    expect(result.expired).toHaveLength(0);
  });
});

describe('clearEndOfCombatConditions', () => {
  it('removes only endOfCombat-typed conditions', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.BLEEDING); // endOfCombat
    c = applyCondition(c, ConditionId.PRONE);    // permanent
    c = applyCondition(c, ConditionId.STUNNED);  // turn
    const updated = clearEndOfCombatConditions(c);
    expect(updated.conditions.some(x => x.conditionId === ConditionId.BLEEDING)).toBe(false);
    expect(updated.conditions).toHaveLength(2);
  });

  it('handles missing conditions array', () => {
    const updated = clearEndOfCombatConditions({ instanceId: 'x' });
    expect(updated.conditions).toEqual([]);
  });
});

describe('query helpers', () => {
  it('getActiveConditions returns conditions or empty array', () => {
    expect(getActiveConditions({ instanceId: 'x' })).toEqual([]);
    const c = mkCombatant({ conditions: [{ instanceId: 'a' }] });
    expect(getActiveConditions(c)).toHaveLength(1);
  });

  it('hasCondition reports presence by conditionId', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.STUNNED);
    expect(hasCondition(c, ConditionId.STUNNED)).toBe(true);
    expect(hasCondition(c, ConditionId.PRONE)).toBe(false);
    expect(hasCondition({ instanceId: 'x' }, ConditionId.STUNNED)).toBe(false);
  });

  it('getConditionInstances returns all instances of the given id', () => {
    let c = mkCombatant();
    c = applyCondition(c, ConditionId.BLEEDING);
    c = applyCondition(c, ConditionId.BLEEDING);
    c = applyCondition(c, ConditionId.STUNNED);
    expect(getConditionInstances(c, ConditionId.BLEEDING)).toHaveLength(2);
    expect(getConditionInstances(c, ConditionId.PRONE)).toHaveLength(0);
  });
});

describe('formatConditionDuration', () => {
  it('returns Permanent when expiresAt is null', () => {
    expect(formatConditionDuration({ expiresAt: null })).toBe('Permanent');
  });

  it('formats turn durations with pluralization', () => {
    expect(formatConditionDuration({ expiresAt: { type: 'turn', turnsRemaining: 1 } })).toBe('1 turn');
    expect(formatConditionDuration({ expiresAt: { type: 'turn', turnsRemaining: 3 } })).toBe('3 turns');
  });

  it('formats round durations relative to currentRound and clamps at 0', () => {
    expect(formatConditionDuration({ expiresAt: { type: 'round', round: 5 } }, 2)).toBe('3 rounds');
    expect(formatConditionDuration({ expiresAt: { type: 'round', round: 1 } }, 5)).toBe('0 rounds');
    expect(formatConditionDuration({ expiresAt: { type: 'round', round: 4 } }, 3)).toBe('1 round');
  });

  it('formats endOfCombat', () => {
    expect(formatConditionDuration({ expiresAt: { type: 'endOfCombat' } })).toBe('Until end of combat');
  });

  it('returns Unknown for unrecognized type', () => {
    expect(formatConditionDuration({ expiresAt: { type: 'mystery' } })).toBe('Unknown');
  });
});

describe('formatConditionTooltip', () => {
  it('falls back to label/Unknown for unknown condition id', () => {
    expect(formatConditionTooltip({ conditionId: 'nope', label: 'Custom' })).toBe('Custom');
    expect(formatConditionTooltip({ conditionId: 'nope' })).toBe('Unknown');
  });

  it('includes label, duration, and description for a known condition', () => {
    const instance = createConditionInstance(ConditionId.STUNNED, { round: 0 });
    const text = formatConditionTooltip(instance);
    expect(text).toContain('Stunned');
    expect(text).toContain('Duration:');
    expect(text).toContain('Cannot take actions');
  });

  it('includes severity, source, and notes when present', () => {
    const instance = createConditionInstance(ConditionId.POISONED, {
      severity: 3,
      source: 'Wyvern Venom',
      notes: 'roll HT each round',
    });
    const text = formatConditionTooltip(instance);
    expect(text).toContain('(3)');
    expect(text).toContain('Source: Wyvern Venom');
    expect(text).toContain('Notes: roll HT each round');
  });
});
