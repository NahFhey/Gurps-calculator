import { describe, it, expect } from 'vitest';
import { filterManeuvers } from '../maneuverFilter';

const maneuvers = [
  { id: 'do_nothing', label: 'Do Nothing', group: 'basic' },
  { id: 'attack', label: 'Attack', group: 'offense' },
  { id: 'all_out_defense_increased', label: 'AoD: Increased', group: 'defense' },
  { id: 'all_out_defense_dodge', label: 'AoD: Dodge', group: 'defense' },
  { id: 'change_posture', label: 'Change Posture', group: 'basic' },
  { id: 'move', label: 'Move', group: 'basic', requires: { notUnconscious: false } }
];

const byId = (results, id) => results.find(r => r.id === id);

describe('filterManeuvers', () => {
  it('returns all maneuvers enabled with no flags when context is empty', () => {
    const result = filterManeuvers(maneuvers, {});
    const attack = byId(result, 'attack');
    expect(attack.disabled).toBe(false);
    expect(attack.reason).toBeNull();
    expect(attack.warning).toBeNull();
    expect(attack.recommended).toBe(false);
  });

  it('preserves shape: id, label, group, notes, prompts', () => {
    const input = [{ id: 'x', label: 'X', group: 'g', notes: 'n', prompts: ['p'] }];
    const result = filterManeuvers(input, {});
    expect(result[0]).toEqual({
      id: 'x',
      label: 'X',
      group: 'g',
      disabled: false,
      reason: null,
      warning: null,
      recommended: false,
      notes: 'n',
      prompts: ['p']
    });
  });

  it('handles null turnContext as empty context', () => {
    const result = filterManeuvers(maneuvers, null);
    expect(byId(result, 'attack').disabled).toBe(false);
  });

  describe('unconscious', () => {
    it('disables everything except do_nothing when isUnconscious', () => {
      const result = filterManeuvers(maneuvers, { isUnconscious: true });
      expect(byId(result, 'do_nothing').disabled).toBe(false);
      expect(byId(result, 'attack').disabled).toBe(true);
      expect(byId(result, 'attack').reason).toBe('Unconscious: cannot act.');
      expect(byId(result, 'change_posture').disabled).toBe(true);
    });

    it('treats canAct=false as unconscious', () => {
      const result = filterManeuvers(maneuvers, { canAct: false });
      expect(byId(result, 'attack').disabled).toBe(true);
      expect(byId(result, 'attack').reason).toBe('Unconscious: cannot act.');
      expect(byId(result, 'do_nothing').disabled).toBe(false);
    });
  });

  describe('stunned', () => {
    it('disables maneuvers not in the stunned-allowed set', () => {
      const result = filterManeuvers(maneuvers, { isStunned: true });
      expect(byId(result, 'attack').disabled).toBe(true);
      expect(byId(result, 'attack').reason).toBe('Stunned: must recover before taking other actions.');
    });

    it('allows do_nothing, AoD increased, AoD dodge, and change_posture while stunned', () => {
      const result = filterManeuvers(maneuvers, { isStunned: true });
      expect(byId(result, 'do_nothing').disabled).toBe(false);
      expect(byId(result, 'all_out_defense_increased').disabled).toBe(false);
      expect(byId(result, 'all_out_defense_dodge').disabled).toBe(false);
      expect(byId(result, 'change_posture').disabled).toBe(false);
    });

    it('unconscious takes precedence over stunned', () => {
      const result = filterManeuvers(maneuvers, { isUnconscious: true, isStunned: true });
      expect(byId(result, 'all_out_defense_dodge').disabled).toBe(true);
      expect(byId(result, 'all_out_defense_dodge').reason).toBe('Unconscious: cannot act.');
    });
  });

  describe('grappled', () => {
    it('attaches the standard grapple warning when grappled', () => {
      const result = filterManeuvers(maneuvers, { isGrappled: true });
      expect(byId(result, 'attack').warning).toBe('Grappled: actions may be restricted; resolve manually.');
    });

    it('uses the lite warning when preset is lite', () => {
      const result = filterManeuvers(maneuvers, { isGrappled: true }, 'lite');
      expect(byId(result, 'attack').warning).toBe('Grappled: resolve manually.');
    });

    it('does not warn for disabled maneuvers (unconscious branch)', () => {
      const result = filterManeuvers(maneuvers, { isUnconscious: true, isGrappled: true });
      expect(byId(result, 'attack').warning).toBeNull();
    });
  });

  describe('prone', () => {
    it('recommends change_posture when prone', () => {
      const result = filterManeuvers(maneuvers, { isProne: true });
      expect(byId(result, 'change_posture').recommended).toBe(true);
      expect(byId(result, 'attack').recommended).toBe(false);
    });

    it('does not recommend change_posture when disabled', () => {
      const result = filterManeuvers(maneuvers, { isProne: true, isUnconscious: true });
      expect(byId(result, 'change_posture').recommended).toBe(false);
    });
  });

  describe('requires.notUnconscious', () => {
    it('emits default warning when maneuver requires.notUnconscious === false and no other warning set', () => {
      const result = filterManeuvers(maneuvers, {});
      expect(byId(result, 'move').warning).toBe('Resolve manually based on table adjudication.');
    });

    it('does not overwrite an existing grapple warning', () => {
      const result = filterManeuvers(maneuvers, { isGrappled: true });
      expect(byId(result, 'move').warning).toBe('Grappled: actions may be restricted; resolve manually.');
    });
  });

  describe('preset defaulting', () => {
    it('defaults to standard preset when third arg omitted', () => {
      const result = filterManeuvers(maneuvers, { isGrappled: true });
      expect(byId(result, 'attack').warning).toContain('actions may be restricted');
    });

    it('defaults to standard when preset is empty string', () => {
      const result = filterManeuvers(maneuvers, { isGrappled: true }, '');
      expect(byId(result, 'attack').warning).toContain('actions may be restricted');
    });
  });

  it('returns empty array for empty input', () => {
    expect(filterManeuvers([], { isStunned: true })).toEqual([]);
  });
});
