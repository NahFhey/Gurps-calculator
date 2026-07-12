import { describe, expect, it } from 'vitest';
import { initialCampaignState, type CampaignState } from '../../campaignReducer';
import type { CombatCharacter, CombatItem, CombatSession } from '../../../types/campaign';
import {
  selectCombatCharactersRecord,
  selectAllCombatCharacters,
  selectCombatCharacterById,
  selectCombatCharacterCount,
  selectCombatItemsRecord,
  selectAllCombatItems,
  selectCombatItemById,
  selectIsCombatActive,
  selectCombatEncounterId,
  selectActiveCombatSession,
  selectCombatRulesPreset,
  selectCombatHistory,
  selectCombatTombstones,
  selectCombatHistoryCount,
  selectRevealedTargets,
  selectRevealedHP,
  selectRevealedDefenseValues,
  selectIsTargetRevealed,
  selectIsHPRevealed,
  selectDefenseValuesForTarget,
} from '../combatSelectors';

const cc1: CombatCharacter = {
  id: 'cc1',
  name: 'Hero',
  category: 'player',
  isNPC: false,
  hp: 12,
  maxHP: 12,
  st: 11,
  dx: 12,
  iq: 10,
  ht: 11,
  dodge: 8,
  dr: 0,
  skills: {},
  weapons: [],
};

const cc2: CombatCharacter = {
  id: 'cc2',
  name: 'Goblin',
  category: 'enemy',
  isNPC: true,
  hp: 8,
  maxHP: 8,
  st: 9,
  dx: 11,
  iq: 8,
  ht: 10,
  dodge: 7,
  dr: 1,
  skills: {},
  weapons: [],
};

const item1: CombatItem = {
  id: 'i1',
  name: 'Sword',
  type: 'weapon',
  stats: {},
  quantity: 1,
};

const item2: CombatItem = {
  id: 'i2',
  name: 'Potion',
  type: 'potion',
  stats: {},
  quantity: 3,
};

const session: CombatSession = {
  id: 's1',
  name: 'Skirmish',
  participants: [],
  currentRound: 1,
  currentTurn: 0,
  log: [],
  startDate: '2026-01-01',
};

function buildState(overrides: {
  combatCharacters?: Record<string, CombatCharacter>;
  combatItems?: Record<string, CombatItem>;
  combatHistory?: CombatSession[];
  combatTombstones?: CombatCharacter[];
  combat?: Partial<CampaignState['combat']>;
} = {}): CampaignState {
  const base = initialCampaignState;
  return {
    ...base,
    entities: {
      ...base.entities,
      combatCharacters: overrides.combatCharacters ?? {},
      combatItems: overrides.combatItems ?? {},
      combatHistory: overrides.combatHistory ?? [],
      combatTombstones: overrides.combatTombstones ?? [],
    },
    combat: {
      ...base.combat,
      ...overrides.combat,
      reveal: {
        ...base.combat.reveal,
        ...(overrides.combat?.reveal ?? {}),
      },
    },
  };
}

describe('combatSelectors — combat characters', () => {
  it('selectCombatCharactersRecord returns the record', () => {
    const state = buildState({ combatCharacters: { cc1, cc2 } });
    expect(selectCombatCharactersRecord(state)).toEqual({ cc1, cc2 });
  });

  it('selectAllCombatCharacters returns array', () => {
    const state = buildState({ combatCharacters: { cc1, cc2 } });
    expect(selectAllCombatCharacters(state)).toEqual([cc1, cc2]);
  });

  it('selectAllCombatCharacters returns empty array when none', () => {
    expect(selectAllCombatCharacters(buildState())).toEqual([]);
  });

  it('selectCombatCharacterById returns the character', () => {
    const state = buildState({ combatCharacters: { cc1, cc2 } });
    expect(selectCombatCharacterById(state, 'cc1')).toBe(cc1);
  });

  it('selectCombatCharacterById returns undefined for missing id', () => {
    const state = buildState({ combatCharacters: { cc1 } });
    expect(selectCombatCharacterById(state, 'ghost')).toBeUndefined();
  });

  it('selectCombatCharacterCount returns count', () => {
    expect(selectCombatCharacterCount(buildState({ combatCharacters: { cc1, cc2 } }))).toBe(2);
    expect(selectCombatCharacterCount(buildState())).toBe(0);
  });
});

describe('combatSelectors — combat items', () => {
  it('selectCombatItemsRecord returns the record', () => {
    const state = buildState({ combatItems: { i1: item1, i2: item2 } });
    expect(selectCombatItemsRecord(state)).toEqual({ i1: item1, i2: item2 });
  });

  it('selectAllCombatItems returns array', () => {
    const state = buildState({ combatItems: { i1: item1, i2: item2 } });
    expect(selectAllCombatItems(state)).toEqual([item1, item2]);
  });

  it('selectAllCombatItems returns empty array when none', () => {
    expect(selectAllCombatItems(buildState())).toEqual([]);
  });

  it('selectCombatItemById returns the item', () => {
    const state = buildState({ combatItems: { i1: item1 } });
    expect(selectCombatItemById(state, 'i1')).toBe(item1);
  });

  it('selectCombatItemById returns undefined for missing id', () => {
    expect(selectCombatItemById(buildState(), 'missing')).toBeUndefined();
  });
});

describe('combatSelectors — combat session', () => {
  it('selectIsCombatActive defaults to false', () => {
    expect(selectIsCombatActive(buildState())).toBe(false);
  });

  it('selectIsCombatActive reflects active state', () => {
    expect(selectIsCombatActive(buildState({ combat: { active: true } }))).toBe(true);
  });

  it('selectCombatEncounterId returns null by default', () => {
    expect(selectCombatEncounterId(buildState())).toBeNull();
  });

  it('selectCombatEncounterId returns the id when set', () => {
    const state = buildState({ combat: { encounterId: 'enc-1' } });
    expect(selectCombatEncounterId(state)).toBe('enc-1');
  });

  it('selectActiveCombatSession returns null by default', () => {
    expect(selectActiveCombatSession(buildState())).toBeNull();
  });

  it('selectActiveCombatSession returns session when set', () => {
    const state = buildState({ combat: { activeSession: session } });
    expect(selectActiveCombatSession(state)).toBe(session);
  });

  it('selectCombatRulesPreset returns default preset', () => {
    expect(selectCombatRulesPreset(buildState())).toBe('standard');
  });

  it('selectCombatRulesPreset reflects override', () => {
    const state = buildState({ combat: { rulesPreset: 'cinematic' } });
    expect(selectCombatRulesPreset(state)).toBe('cinematic');
  });
});

describe('combatSelectors — combat history', () => {
  it('selectCombatHistory returns the history array', () => {
    const state = buildState({ combatHistory: [session] });
    expect(selectCombatHistory(state)).toEqual([session]);
  });

  it('selectCombatHistory returns empty array by default', () => {
    expect(selectCombatHistory(buildState())).toEqual([]);
  });

  it('selectCombatTombstones returns the tombstones array', () => {
    const state = buildState({ combatTombstones: [cc2] });
    expect(selectCombatTombstones(state)).toEqual([cc2]);
  });

  it('selectCombatHistoryCount returns count', () => {
    expect(selectCombatHistoryCount(buildState({ combatHistory: [session, session] }))).toBe(2);
    expect(selectCombatHistoryCount(buildState())).toBe(0);
  });
});

describe('combatSelectors — combat reveal', () => {
  it('selectRevealedTargets returns empty Set by default', () => {
    const result = selectRevealedTargets(buildState());
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('selectRevealedTargets returns the set when populated', () => {
    const targets = new Set(['t1', 't2']);
    const state = buildState({ combat: { reveal: { revealedTargets: targets, revealedHP: new Set(), revealedDefenseValues: {} } } });
    expect(selectRevealedTargets(state)).toBe(targets);
  });

  it('selectRevealedHP returns the set', () => {
    const hp = new Set(['t1']);
    const state = buildState({ combat: { reveal: { revealedTargets: new Set(), revealedHP: hp, revealedDefenseValues: {} } } });
    expect(selectRevealedHP(state)).toBe(hp);
  });

  it('selectRevealedDefenseValues returns the record', () => {
    const dv = { t1: { dodge: 9 } };
    const state = buildState({ combat: { reveal: { revealedTargets: new Set(), revealedHP: new Set(), revealedDefenseValues: dv } } });
    expect(selectRevealedDefenseValues(state)).toBe(dv);
  });

  it('selectIsTargetRevealed reflects membership', () => {
    const state = buildState({ combat: { reveal: { revealedTargets: new Set(['t1']), revealedHP: new Set(), revealedDefenseValues: {} } } });
    expect(selectIsTargetRevealed(state, 't1')).toBe(true);
    expect(selectIsTargetRevealed(state, 't2')).toBe(false);
  });

  it('selectIsHPRevealed reflects membership', () => {
    const state = buildState({ combat: { reveal: { revealedTargets: new Set(), revealedHP: new Set(['t1']), revealedDefenseValues: {} } } });
    expect(selectIsHPRevealed(state, 't1')).toBe(true);
    expect(selectIsHPRevealed(state, 'ghost')).toBe(false);
  });

  it('selectDefenseValuesForTarget returns values when set', () => {
    const state = buildState({
      combat: { reveal: { revealedTargets: new Set(), revealedHP: new Set(), revealedDefenseValues: { t1: { dodge: 8 } } } },
    });
    expect(selectDefenseValuesForTarget(state, 't1')).toEqual({ dodge: 8 });
  });

  it('selectDefenseValuesForTarget returns undefined for missing target', () => {
    expect(selectDefenseValuesForTarget(buildState(), 'ghost')).toBeUndefined();
  });
});
