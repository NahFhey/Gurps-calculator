/**
 * Character Actions
 *
 * Action type constants and type definitions for character-related state changes.
 */

import type { Id, Character } from '../../types/campaign';

// ============================================================================
// ACTION TYPE CONSTANTS
// ============================================================================

export const CHARACTER_ADD = 'addCharacter' as const;
export const CHARACTER_UPDATE = 'updateCharacter' as const;
export const CHARACTER_REMOVE = 'removeCharacter' as const;
export const CHARACTERS_SET = 'setCharacters' as const;

// ============================================================================
// ACTION TYPES
// ============================================================================

export type AddCharacterAction = { type: typeof CHARACTER_ADD; payload: Character };
export type UpdateCharacterAction = {
  type: typeof CHARACTER_UPDATE;
  payload: { id: Id; changes: Partial<Character> };
};
export type RemoveCharacterAction = { type: typeof CHARACTER_REMOVE; payload: Id };
export type SetCharactersAction = {
  type: typeof CHARACTERS_SET;
  payload: Record<Id, Character>;
};

// ============================================================================
// UNION TYPE
// ============================================================================

export type CharacterAction =
  | AddCharacterAction
  | UpdateCharacterAction
  | RemoveCharacterAction
  | SetCharactersAction;

// ============================================================================
// TYPE GUARD
// ============================================================================

const CHARACTER_ACTION_TYPES = new Set([
  CHARACTER_ADD,
  CHARACTER_UPDATE,
  CHARACTER_REMOVE,
  CHARACTERS_SET
]);

export function isCharacterAction(action: { type: string }): action is CharacterAction {
  return CHARACTER_ACTION_TYPES.has(action.type as typeof CHARACTER_ADD);
}
