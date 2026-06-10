import { describe, expect, it } from 'vitest';
import { initialCampaignState, type CampaignState } from '../../campaignReducer';
import type { Character } from '../../../types/campaign';
import {
  selectCharactersRecord,
  selectAllCharacters,
  selectCharacterById,
  selectCharacterIds,
  selectCharacterCount,
  selectPlayerCharacters,
  selectNpcCharacters,
  selectWorkEnabledCharacters,
  selectCharactersBySkill,
  selectSelectedCharacterId,
  selectSelectedCharacter,
  selectCharacterPanelView,
  selectCharacterSkillLevel,
  selectCharacterExists,
} from '../characterSelectors';

const pc: Character = {
  id: 'c1',
  name: 'Alice',
  isPlayer: true,
  work: {
    enabled: true,
    skills: { Alchemy: 14, Smithing: 12 },
  },
};

const npc: Character = {
  id: 'c2',
  name: 'Goblin',
  isPlayer: false,
  work: {
    enabled: false,
    skills: { Stealth: 10 },
  },
};

const pcNoWork: Character = {
  id: 'c3',
  name: 'Bob',
  isPlayer: true,
  work: {
    skills: {},
  },
};

function buildState(
  characters: Record<string, Character> = { c1: pc, c2: npc, c3: pcNoWork },
  uiOverrides: Partial<CampaignState['ui']> = {}
): CampaignState {
  const base = initialCampaignState;
  return {
    ...base,
    entities: { ...base.entities, characters },
    ui: { ...base.ui, ...uiOverrides },
  };
}

describe('characterSelectors — basic selectors', () => {
  it('selectCharactersRecord returns the characters record', () => {
    const state = buildState();
    expect(selectCharactersRecord(state)).toEqual({ c1: pc, c2: npc, c3: pcNoWork });
  });

  it('selectAllCharacters returns characters as an array', () => {
    const state = buildState();
    expect(selectAllCharacters(state)).toEqual([pc, npc, pcNoWork]);
  });

  it('selectAllCharacters returns empty array when there are no characters', () => {
    const state = buildState({});
    expect(selectAllCharacters(state)).toEqual([]);
  });

  it('selectCharacterById returns the character', () => {
    const state = buildState();
    expect(selectCharacterById(state, 'c1')).toBe(pc);
  });

  it('selectCharacterById returns undefined for missing id', () => {
    const state = buildState();
    expect(selectCharacterById(state, 'missing')).toBeUndefined();
  });

  it('selectCharacterIds returns all ids', () => {
    const state = buildState();
    expect(selectCharacterIds(state)).toEqual(['c1', 'c2', 'c3']);
  });

  it('selectCharacterCount returns the count', () => {
    expect(selectCharacterCount(buildState())).toBe(3);
    expect(selectCharacterCount(buildState({}))).toBe(0);
  });
});

describe('characterSelectors — filtered selectors', () => {
  it('selectPlayerCharacters returns only PCs', () => {
    const state = buildState();
    expect(selectPlayerCharacters(state)).toEqual([pc, pcNoWork]);
  });

  it('selectNpcCharacters returns only NPCs (treats undefined isPlayer as NPC)', () => {
    const ambiguous: Character = { id: 'c4', name: 'Unknown', work: { skills: {} } };
    const state = buildState({ c1: pc, c2: npc, c4: ambiguous });
    expect(selectNpcCharacters(state)).toEqual([npc, ambiguous]);
  });

  it('selectWorkEnabledCharacters returns only characters with work.enabled', () => {
    const state = buildState();
    expect(selectWorkEnabledCharacters(state)).toEqual([pc]);
  });

  it('selectCharactersBySkill returns characters who have the skill', () => {
    const state = buildState();
    expect(selectCharactersBySkill(state, 'Alchemy')).toEqual([pc]);
    expect(selectCharactersBySkill(state, 'Stealth')).toEqual([npc]);
  });

  it('selectCharactersBySkill returns empty array when nobody has the skill', () => {
    const state = buildState();
    expect(selectCharactersBySkill(state, 'Necromancy')).toEqual([]);
  });
});

describe('characterSelectors — UI state selectors', () => {
  it('selectSelectedCharacterId returns null by default', () => {
    expect(selectSelectedCharacterId(buildState())).toBeNull();
  });

  it('selectSelectedCharacterId returns the id when set', () => {
    const state = buildState(undefined, { selectedCharacterId: 'c1' });
    expect(selectSelectedCharacterId(state)).toBe('c1');
  });

  it('selectSelectedCharacter returns the character when selected', () => {
    const state = buildState(undefined, { selectedCharacterId: 'c2' });
    expect(selectSelectedCharacter(state)).toBe(npc);
  });

  it('selectSelectedCharacter returns undefined when no character selected', () => {
    expect(selectSelectedCharacter(buildState())).toBeUndefined();
  });

  it('selectSelectedCharacter returns undefined when selected id no longer exists', () => {
    const state = buildState(undefined, { selectedCharacterId: 'ghost' });
    expect(selectSelectedCharacter(state)).toBeUndefined();
  });

  it('selectCharacterPanelView returns the panel view', () => {
    expect(selectCharacterPanelView(buildState())).toBe('sheet');
  });
});

describe('characterSelectors — derived selectors', () => {
  it('selectCharacterSkillLevel returns the skill level', () => {
    const state = buildState();
    expect(selectCharacterSkillLevel(state, 'c1', 'Alchemy')).toBe(14);
  });

  it('selectCharacterSkillLevel returns undefined for missing skill', () => {
    const state = buildState();
    expect(selectCharacterSkillLevel(state, 'c1', 'Necromancy')).toBeUndefined();
  });

  it('selectCharacterSkillLevel returns undefined for missing character', () => {
    const state = buildState();
    expect(selectCharacterSkillLevel(state, 'ghost', 'Alchemy')).toBeUndefined();
  });

  it('selectCharacterExists reflects character presence', () => {
    const state = buildState();
    expect(selectCharacterExists(state, 'c1')).toBe(true);
    expect(selectCharacterExists(state, 'ghost')).toBe(false);
  });
});
