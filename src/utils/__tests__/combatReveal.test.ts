import { describe, it, expect } from 'vitest';
import {
  HPBand,
  RevealMode,
  addCombatantToReveal,
  calculateHPBand,
  createDefaultRevealForInstance,
  createInitialRevealState,
  getHPBandText,
  getRevealForInstance,
  hasAnyReveals,
  removeCombatantFromReveal,
  revealDefenseForInstance,
  revealHPAtZero,
  revealNameForInstance,
  setRevealForInstance,
  syncRevealStateForParticipants,
  updateReveal,
} from '../combatReveal';
import type { RevealState, RevealEntry } from '../../types/combatTracker';

describe('combatReveal', () => {
  describe('calculateHPBand', () => {
    it('returns dead at zero and for negative HP regardless of max HP', () => {
      expect(calculateHPBand(0, 10)).toBe(HPBand.DEAD);
      expect(calculateHPBand(-5, 10)).toBe(HPBand.DEAD);
      expect(calculateHPBand(0, 0)).toBe(HPBand.DEAD);
    });

    it('uses the healthy, injured, and critical ratio bands', () => {
      expect(calculateHPBand(75, 100)).toBe(HPBand.HEALTHY);
      expect(calculateHPBand(33, 100)).toBe(HPBand.INJURED);
      expect(calculateHPBand(32, 100)).toBe(HPBand.CRITICAL);
    });

    it('treats HP above max and positive HP over zero max as healthy', () => {
      expect(calculateHPBand(15, 10)).toBe(HPBand.HEALTHY);
      expect(calculateHPBand(5, 0)).toBe(HPBand.HEALTHY);
    });
  });

  describe('getHPBandText', () => {
    it('maps every known band to its display label', () => {
      expect(getHPBandText(HPBand.HEALTHY)).toBe('Healthy');
      expect(getHPBandText(HPBand.INJURED)).toBe('Wounded');
      expect(getHPBandText(HPBand.CRITICAL)).toBe('Badly Wounded');
      expect(getHPBandText(HPBand.DEAD)).toBe('Down');
    });

    it('returns Unknown for an unrecognized band', () => {
      expect(getHPBandText('garbage')).toBe('Unknown');
    });
  });

  describe('createDefaultRevealForInstance', () => {
    it.each(['player', 'ally', 'object'])('fully reveals the %s side', side => {
      const reveal = createDefaultRevealForInstance('unit-1', side);

      expect(reveal.name).toBe(RevealMode.NAME_FULL);
      expect(reveal.hp.mode).toBe(RevealMode.NUMERIC_EXACT);
      expect(reveal.defenses.dodge).toBe(RevealMode.DEFENSE_EXACT);
      expect(reveal.attacks).toBe(RevealMode.ATTACKS_FULL);
    });

    it.each(['enemy', 'neutral', ''])('hides the %s side', side => {
      const reveal = createDefaultRevealForInstance('unit-1', side);

      expect(reveal.name).toBe(RevealMode.NAME_HIDDEN);
      expect(reveal.hp.mode).toBe(RevealMode.NUMERIC_UNKNOWN);
      expect(reveal.defenses.dodge).toBe(RevealMode.DEFENSE_UNKNOWN);
      expect(reveal.attacks).toBe(RevealMode.ATTACKS_HIDDEN);
    });
  });

  describe('createInitialRevealState', () => {
    it('keys participants by instance id and derives side by category, side, then enemy', () => {
      const state = createInitialRevealState('encounter-1', [
        { instanceId: 'category-wins', category: 'ally', side: 'enemy' },
        { instanceId: 'side-fallback', side: 'player' },
        { instanceId: 'enemy-fallback' },
      ]);

      expect(state.version).toBe(1);
      expect(state.encounterId).toBe('encounter-1');
      expect(Object.keys(state.byInstanceId)).toEqual([
        'category-wins',
        'side-fallback',
        'enemy-fallback',
      ]);
      expect(state.byInstanceId['category-wins'].name).toBe(RevealMode.NAME_FULL);
      expect(state.byInstanceId['side-fallback'].hp.mode).toBe(RevealMode.NUMERIC_EXACT);
      expect(state.byInstanceId['enemy-fallback'].name).toBe(RevealMode.NAME_HIDDEN);
    });
  });

  describe('getRevealForInstance', () => {
    it('returns fresh enemy defaults for null or undefined state', () => {
      const fromNull = getRevealForInstance(null, 'missing');
      const fromUndefined = getRevealForInstance(undefined, 'missing');

      expect(fromNull).toEqual(createDefaultRevealForInstance('missing', 'enemy'));
      expect(fromUndefined).toEqual(fromNull);
      expect(fromUndefined).not.toBe(fromNull);
    });

    it('returns a default when byInstanceId or the requested id is absent', () => {
      const withoutMap = getRevealForInstance({ version: 1 } as RevealState, 'missing', 'player');
      const emptyMap = getRevealForInstance({ byInstanceId: {} }, 'missing');

      expect(withoutMap.name).toBe(RevealMode.NAME_FULL);
      expect(emptyMap.name).toBe(RevealMode.NAME_HIDDEN);
      expect(emptyMap.hp.mode).toBe(RevealMode.NUMERIC_UNKNOWN);
    });

    it('returns the stored reveal object by reference when present', () => {
      const stored = createDefaultRevealForInstance('present', 'ally');
      const state = { byInstanceId: { present: stored } };

      expect(getRevealForInstance(state, 'present')).toBe(stored);
      expect(getRevealForInstance(state, 'present')).toEqual(stored);
    });
  });

  describe('updateReveal', () => {
    it('updates nested paths on a clone without mutating the input', () => {
      const original = createInitialRevealState('encounter-1', [
        { instanceId: 'enemy-1', side: 'enemy' },
      ]);
      const updatedHP = updateReveal(original, 'enemy-1', 'hp.mode', RevealMode.NUMERIC_EXACT);
      const updatedDefense = updateReveal(
        updatedHP,
        'enemy-1',
        'defenses.dodge',
        RevealMode.DEFENSE_EXACT
      );

      expect(updatedDefense.byInstanceId['enemy-1'].hp.mode).toBe(RevealMode.NUMERIC_EXACT);
      expect(updatedDefense.byInstanceId['enemy-1'].defenses.dodge).toBe(
        RevealMode.DEFENSE_EXACT
      );
      expect(original.byInstanceId['enemy-1'].hp.mode).toBe(RevealMode.NUMERIC_UNKNOWN);
      expect(original.byInstanceId['enemy-1'].defenses.dodge).toBe(
        RevealMode.DEFENSE_UNKNOWN
      );
      expect(updatedHP).not.toBe(original);
    });

    it('creates a default missing entry and absent intermediate objects', () => {
      const original = { encounterId: 'encounter-1', byInstanceId: {} };
      const withEntry = updateReveal(original, 'new-enemy', 'hp.mode', RevealMode.NUMERIC_BAND);
      const withNestedPath = updateReveal(withEntry, 'new-enemy', 'custom.deep.value', 42);

      expect(withEntry.byInstanceId['new-enemy'].name).toBe(RevealMode.NAME_HIDDEN);
      expect(withEntry.byInstanceId['new-enemy'].hp.mode).toBe(RevealMode.NUMERIC_BAND);
      expect((withNestedPath.byInstanceId['new-enemy'] as unknown as { custom: { deep: { value: number } } }).custom.deep.value).toBe(42);
      expect(original.byInstanceId).toEqual({});
    });
  });

  describe('entry collection helpers', () => {
    it('setRevealForInstance replaces an entry, creates the map, and preserves input', () => {
      const original = { version: 1 } as RevealState;
      const replacement = createDefaultRevealForInstance('ally-1', 'ally');
      const updated = setRevealForInstance(original, 'ally-1', replacement);

      expect(updated.byInstanceId['ally-1']).toEqual(replacement);
      expect(updated.byInstanceId['ally-1'].name).toBe(RevealMode.NAME_FULL);
      expect(original).toEqual({ version: 1 });
      expect(updated).not.toBe(original);
    });

    it('addCombatantToReveal adds the requested side without mutating input', () => {
      const original = { byInstanceId: { existing: { marker: 'kept' } } } as unknown as RevealState;
      const updated = addCombatantToReveal(original, 'player-1', 'player');

      expect(updated.byInstanceId['player-1'].hp.mode).toBe(RevealMode.NUMERIC_EXACT);
      expect(updated.byInstanceId.existing).toEqual({ marker: 'kept' });
      expect(original.byInstanceId).toEqual({ existing: { marker: 'kept' } });
      expect(updated).not.toBe(original);
    });

    it('removeCombatantFromReveal deletes only the requested entry on a clone', () => {
      const original = {
        byInstanceId: {
          remove: { marker: 'remove' },
          keep: { marker: 'keep' },
        },
      } as unknown as RevealState;
      const updated = removeCombatantFromReveal(original, 'remove');

      expect(updated.byInstanceId).toEqual({ keep: { marker: 'keep' } });
      expect(original.byInstanceId.remove).toEqual({ marker: 'remove' });
      expect(updated).not.toBe(original);
    });
  });

  describe('progressive reveal helpers', () => {
    it('revealDefenseForInstance guards invalid input and promotes a defense to exact', () => {
      const state = createInitialRevealState('encounter-1', [
        { instanceId: 'enemy-1', side: 'enemy' },
      ]);

      expect(revealDefenseForInstance(null, 'enemy-1', 'dodge')).toBeNull();
      expect(revealDefenseForInstance(state, '', 'dodge')).toBe(state);
      expect(revealDefenseForInstance(state, 'enemy-1', '' as unknown as 'dodge')).toBe(state);

      const revealed = revealDefenseForInstance(state, 'enemy-1', 'dodge');
      expect(revealed?.byInstanceId['enemy-1'].defenses.dodge).toBe(
        RevealMode.DEFENSE_EXACT
      );
      expect(state.byInstanceId['enemy-1'].defenses.dodge).toBe(
        RevealMode.DEFENSE_UNKNOWN
      );
      expect(revealDefenseForInstance(revealed, 'enemy-1', 'dodge')).toBe(revealed);
    });

    it('revealNameForInstance guards invalid input and promotes the name to full', () => {
      const state = createInitialRevealState('encounter-1', [
        { instanceId: 'enemy-1', side: 'enemy' },
      ]);

      expect(revealNameForInstance(undefined, 'enemy-1')).toBeUndefined();
      expect(revealNameForInstance(state, '')).toBe(state);

      const revealed = revealNameForInstance(state, 'enemy-1');
      expect(revealed?.byInstanceId['enemy-1'].name).toBe(RevealMode.NAME_FULL);
      expect(state.byInstanceId['enemy-1'].name).toBe(RevealMode.NAME_HIDDEN);
      expect(revealNameForInstance(revealed, 'enemy-1')).toBe(revealed);
    });

    it('revealHPAtZero guards invalid input and promotes HP mode to exact', () => {
      const state = createInitialRevealState('encounter-1', [
        { instanceId: 'enemy-1', side: 'enemy' },
      ]);

      expect(revealHPAtZero(null, 'enemy-1')).toBeNull();
      expect(revealHPAtZero(state, '')).toBe(state);

      const revealed = revealHPAtZero(state, 'enemy-1');
      expect(revealed?.byInstanceId['enemy-1'].hp.mode).toBe(RevealMode.NUMERIC_EXACT);
      expect(state.byInstanceId['enemy-1'].hp.mode).toBe(RevealMode.NUMERIC_UNKNOWN);
      expect(revealHPAtZero(revealed, 'enemy-1')).toBe(revealed);
    });
  });

  describe('syncRevealStateForParticipants', () => {
    it('returns a null or undefined state unchanged', () => {
      expect(syncRevealStateForParticipants(null, [])).toBeNull();
      expect(syncRevealStateForParticipants(undefined, [])).toBeUndefined();
    });

    it('removes absent entries, preserves existing entries, and defaults new entries', () => {
      const original = {
        version: 1,
        encounterId: 'encounter-1',
        byInstanceId: {
          A: { marker: 'remove-me' },
          B: { marker: 'keep-me', name: RevealMode.NAME_PARTIAL },
        },
      } as unknown as RevealState;
      const snapshot = structuredClone(original);
      const updated = syncRevealStateForParticipants(original, [
        { instanceId: 'B', side: 'enemy' },
        { instanceId: 'C', category: 'ally', side: 'enemy' },
      ]);

      expect(updated?.byInstanceId.A).toBeUndefined();
      expect(updated?.byInstanceId.B).toEqual(original.byInstanceId.B);
      expect(updated?.byInstanceId.C.name).toBe(RevealMode.NAME_FULL);
      expect(updated?.byInstanceId.C.hp.mode).toBe(RevealMode.NUMERIC_EXACT);
      expect(updated).not.toBe(original);
      expect(updated?.byInstanceId.B).not.toBe(original.byInstanceId.B);
      expect(original).toEqual(snapshot);
    });
  });

  describe('hasAnyReveals', () => {
    it('returns false for null and undefined', () => {
      expect(hasAnyReveals(null)).toBe(false);
      expect(hasAnyReveals(undefined)).toBe(false);
    });

    it('treats an empty object as revealed because missing fields are not hidden values', () => {
      expect(hasAnyReveals({} as RevealEntry)).toBe(true);
    });

    it('distinguishes a fully hidden enemy default from a player default', () => {
      expect(hasAnyReveals(createDefaultRevealForInstance('enemy-1', 'enemy'))).toBe(false);
      expect(hasAnyReveals(createDefaultRevealForInstance('player-1', 'player'))).toBe(true);
    });
  });
});
