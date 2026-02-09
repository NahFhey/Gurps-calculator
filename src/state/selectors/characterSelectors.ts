/**
 * Character Selectors
 *
 * Centralized selectors for accessing character data from the campaign state.
 */

import type { CampaignState } from '../campaignReducer';
import type { Character, Id } from '../../types/campaign';

// ============================================================================
// BASIC SELECTORS
// ============================================================================

/**
 * Select all characters as a record (for direct ID lookup)
 */
export const selectCharactersRecord = (state: CampaignState): Record<Id, Character> =>
  state.entities.characters;

/**
 * Select all characters as an array
 */
export const selectAllCharacters = (state: CampaignState): Character[] =>
  Object.values(state.entities.characters);

/**
 * Select a character by ID
 */
export const selectCharacterById = (state: CampaignState, id: Id): Character | undefined =>
  state.entities.characters[id];

/**
 * Select character IDs as an array
 */
export const selectCharacterIds = (state: CampaignState): Id[] =>
  Object.keys(state.entities.characters);

/**
 * Select character count
 */
export const selectCharacterCount = (state: CampaignState): number =>
  Object.keys(state.entities.characters).length;

// ============================================================================
// FILTERED SELECTORS
// ============================================================================

/**
 * Select all player characters
 */
export const selectPlayerCharacters = (state: CampaignState): Character[] =>
  Object.values(state.entities.characters).filter((c) => c.isPlayer);

/**
 * Select all NPC characters
 */
export const selectNpcCharacters = (state: CampaignState): Character[] =>
  Object.values(state.entities.characters).filter((c) => !c.isPlayer);

/**
 * Select characters with work enabled
 */
export const selectWorkEnabledCharacters = (state: CampaignState): Character[] =>
  Object.values(state.entities.characters).filter((c) => c.work?.enabled);

/**
 * Select characters by skill (characters who have a specific skill)
 */
export const selectCharactersBySkill = (state: CampaignState, skillName: string): Character[] =>
  Object.values(state.entities.characters).filter(
    (c) => c.work?.skills && skillName in c.work.skills
  );

// ============================================================================
// UI STATE SELECTORS
// ============================================================================

/**
 * Select the currently selected character ID
 */
export const selectSelectedCharacterId = (state: CampaignState): string | null =>
  state.ui.selectedCharacterId;

/**
 * Select the currently selected character
 */
export const selectSelectedCharacter = (state: CampaignState): Character | undefined => {
  const id = state.ui.selectedCharacterId;
  return id ? state.entities.characters[id] : undefined;
};

/**
 * Select the current character panel view
 */
export const selectCharacterPanelView = (state: CampaignState): string =>
  state.ui.characterPanelView;

// ============================================================================
// DERIVED SELECTORS
// ============================================================================

/**
 * Select character skill level
 */
export const selectCharacterSkillLevel = (
  state: CampaignState,
  characterId: Id,
  skillName: string
): number | undefined => {
  const character = state.entities.characters[characterId];
  return character?.work?.skills?.[skillName];
};

/**
 * Check if a character exists
 */
export const selectCharacterExists = (state: CampaignState, id: Id): boolean =>
  id in state.entities.characters;
