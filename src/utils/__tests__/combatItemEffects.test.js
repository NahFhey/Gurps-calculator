import { describe, it, expect } from 'vitest';
import {
  EffectTarget,
  createEffect,
  CommonItemEffects,
  getItemEffects,
  hasItemEffects,
  parseManualEffect,
  formatEffect
} from '../combatItemEffects';
import { ConditionId, DurationType } from '../../constants/conditions';

describe('combatItemEffects', () => {
  describe('EffectTarget', () => {
    it('exposes the canonical target keys', () => {
      expect(EffectTarget).toEqual({ SELF: 'self', TARGET: 'target', AREA: 'area' });
    });
  });

  describe('createEffect', () => {
    it('fills resourceDeltas with nulls when not provided', () => {
      const e = createEffect({ id: 'x', label: 'X' });
      expect(e.id).toBe('x');
      expect(e.label).toBe('X');
      expect(e.appliesTo).toBe(EffectTarget.SELF);
      expect(e.resourceDeltas).toEqual({ HP: null, FP: null, MP: null });
      expect(e.addConditions).toEqual([]);
      expect(e.removeConditions).toEqual([]);
      expect(e.notes).toBe('');
    });

    it('preserves provided resource deltas and normalizes conditions', () => {
      const e = createEffect({
        id: 'y',
        label: 'Y',
        appliesTo: EffectTarget.TARGET,
        resourceDeltas: { HP: 5, FP: -2 },
        addConditions: [{ conditionId: 'stunned' }],
        removeConditions: [{ conditionId: 'poisoned', all: true }],
        notes: 'hi'
      });
      expect(e.resourceDeltas).toEqual({ HP: 5, FP: -2, MP: null });
      expect(e.addConditions).toEqual([
        { conditionId: 'stunned', severity: null, duration: null }
      ]);
      expect(e.removeConditions).toEqual([
        { conditionId: 'poisoned', all: true }
      ]);
      expect(e.notes).toBe('hi');
    });

    it('treats zero resource values as falsy and converts to null', () => {
      // documents current behavior: 0 || null === null
      const e = createEffect({ id: 'z', label: 'Z', resourceDeltas: { HP: 0 } });
      expect(e.resourceDeltas.HP).toBeNull();
    });
  });

  describe('CommonItemEffects catalog', () => {
    it('contains expected healing potion definitions', () => {
      expect(CommonItemEffects['minor-healing-potion'].resourceDeltas.HP).toBe(5);
      expect(CommonItemEffects['healing-potion'].resourceDeltas.HP).toBe(10);
      expect(CommonItemEffects['major-healing-potion'].resourceDeltas.HP).toBe(20);
    });

    it('antidote removes all poison', () => {
      const e = CommonItemEffects['antidote'];
      expect(e.removeConditions).toEqual([
        { conditionId: ConditionId.POISONED, all: true }
      ]);
    });

    it('haste-potion adds HASTE for 5 rounds', () => {
      const e = CommonItemEffects['haste-potion'];
      expect(e.addConditions[0].conditionId).toBe(ConditionId.HASTE);
      expect(e.addConditions[0].duration).toEqual({
        type: DurationType.ROUNDS,
        value: 5
      });
    });
  });

  describe('getItemEffects', () => {
    it('returns item.effects when provided as array', () => {
      const effects = [{ id: 'a' }, { id: 'b' }];
      expect(getItemEffects({ effects })).toBe(effects);
    });

    it('wraps a single item.effect in an array', () => {
      const effect = { id: 'solo' };
      expect(getItemEffects({ effect })).toEqual([effect]);
    });

    it('looks up by lowercased, hyphenated id/name in CommonItemEffects', () => {
      const result = getItemEffects({ name: 'Healing Potion' });
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(CommonItemEffects['healing-potion']);
    });

    it('prefers id over name when both present', () => {
      const result = getItemEffects({ id: 'antidote', name: 'Healing Potion' });
      expect(result[0]).toBe(CommonItemEffects['antidote']);
    });

    it('returns an empty array when no match found', () => {
      expect(getItemEffects({ name: 'unknown trinket' })).toEqual([]);
    });

    it('returns an empty array for an empty/blank item', () => {
      expect(getItemEffects({})).toEqual([]);
    });
  });

  describe('hasItemEffects', () => {
    it('returns true when effects resolve', () => {
      expect(hasItemEffects({ name: 'Healing Potion' })).toBe(true);
    });

    it('returns false when no effects resolve', () => {
      expect(hasItemEffects({ name: 'rock' })).toBe(false);
    });
  });

  describe('parseManualEffect', () => {
    it('returns null for empty/whitespace input', () => {
      expect(parseManualEffect('')).toBeNull();
      expect(parseManualEffect('   ')).toBeNull();
    });

    it('parses positive resource delta', () => {
      const e = parseManualEffect('+10 HP');
      expect(e.resourceDeltas).toEqual({ HP: 10, FP: null, MP: null });
      expect(e.appliesTo).toBe(EffectTarget.TARGET);
      expect(e.id).toBe('manual-resource');
    });

    it('parses negative resource delta', () => {
      const e = parseManualEffect('-5 FP');
      expect(e.resourceDeltas.FP).toBe(-5);
    });

    it('parses unsigned resource delta as positive', () => {
      const e = parseManualEffect('3 MP');
      expect(e.resourceDeltas.MP).toBe(3);
    });

    it('parses condition-add via "Apply"', () => {
      const e = parseManualEffect('Apply Stunned');
      expect(e.id).toBe('manual-condition-add');
      expect(e.addConditions[0].conditionId).toBe('stunned');
    });

    it('parses condition-add via "Add"', () => {
      const e = parseManualEffect('add Poisoned');
      expect(e.addConditions[0].conditionId).toBe('poisoned');
    });

    it('parses condition-remove via "Remove" with all=true', () => {
      const e = parseManualEffect('Remove Stunned');
      expect(e.id).toBe('manual-condition-remove');
      expect(e.removeConditions).toEqual([
        { conditionId: 'stunned', all: true }
      ]);
    });

    it('parses condition-remove via "Clear"', () => {
      const e = parseManualEffect('Clear Bleeding');
      expect(e.removeConditions[0].conditionId).toBe('bleeding');
    });

    it('falls back to a note-only effect for unparseable input', () => {
      const e = parseManualEffect('something weird');
      expect(e.id).toBe('manual-note');
      expect(e.notes).toBe('Manual: something weird');
      expect(e.resourceDeltas).toEqual({ HP: null, FP: null, MP: null });
      expect(e.addConditions).toEqual([]);
      expect(e.removeConditions).toEqual([]);
    });
  });

  describe('formatEffect', () => {
    it('formats positive resource deltas with leading +', () => {
      const e = createEffect({ id: 'a', label: 'a', resourceDeltas: { HP: 5, FP: 2, MP: 3 } });
      expect(formatEffect(e)).toBe('+5 HP, +2 FP, +3 MP');
    });

    it('formats negative resource deltas without extra sign', () => {
      const e = createEffect({ id: 'a', label: 'a', resourceDeltas: { HP: -4 } });
      expect(formatEffect(e)).toBe('-4 HP');
    });

    it('includes added conditions with severity in parentheses', () => {
      const e = createEffect({
        id: 'a',
        label: 'a',
        addConditions: [{ conditionId: 'shielded', severity: 2 }]
      });
      expect(formatEffect(e)).toBe('Apply shielded (2)');
    });

    it('formats added conditions without severity when null', () => {
      const e = createEffect({
        id: 'a',
        label: 'a',
        addConditions: [{ conditionId: 'stunned' }]
      });
      expect(formatEffect(e)).toBe('Apply stunned');
    });

    it('formats removed conditions and marks (all)', () => {
      const e = createEffect({
        id: 'a',
        label: 'a',
        removeConditions: [
          { conditionId: 'poisoned', all: true },
          { conditionId: 'bleeding', all: false }
        ]
      });
      expect(formatEffect(e)).toBe('Remove poisoned (all), Remove bleeding');
    });

    it('falls back to notes when no other parts are present', () => {
      const e = createEffect({ id: 'a', label: 'a', notes: 'just a note' });
      expect(formatEffect(e)).toBe('just a note');
    });

    it('returns "No effect" when nothing renders', () => {
      const e = createEffect({ id: 'a', label: 'a' });
      expect(formatEffect(e)).toBe('No effect');
    });

    it('combines deltas and conditions in order', () => {
      const e = createEffect({
        id: 'a',
        label: 'a',
        resourceDeltas: { HP: 10 },
        addConditions: [{ conditionId: 'haste' }],
        removeConditions: [{ conditionId: 'fatigued', all: true }]
      });
      expect(formatEffect(e)).toBe('+10 HP, Apply haste, Remove fatigued (all)');
    });
  });
});
