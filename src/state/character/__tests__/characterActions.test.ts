import { describe, expect, it } from 'vitest';
import {
  CHARACTER_ADD,
  CHARACTER_UPDATE,
  CHARACTER_REMOVE,
  CHARACTERS_SET,
  isCharacterAction,
  type CharacterAction
} from '../characterActions';
import type { Character } from '../../../types/campaign';

const mockCharacter = (overrides?: Partial<Character>): Character => ({
  id: 'char-1',
  name: 'Test Hero',
  work: { skills: {} },
  ...overrides
});

describe('characterActions', () => {
  describe('action type constants', () => {
    it('exposes stable string literals', () => {
      expect(CHARACTER_ADD).toBe('addCharacter');
      expect(CHARACTER_UPDATE).toBe('updateCharacter');
      expect(CHARACTER_REMOVE).toBe('removeCharacter');
      expect(CHARACTERS_SET).toBe('setCharacters');
    });

    it('constants are all unique', () => {
      const values = [CHARACTER_ADD, CHARACTER_UPDATE, CHARACTER_REMOVE, CHARACTERS_SET];
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('isCharacterAction', () => {
    it('returns true for CHARACTER_ADD action', () => {
      const action: CharacterAction = { type: CHARACTER_ADD, payload: mockCharacter() };
      expect(isCharacterAction(action)).toBe(true);
    });

    it('returns true for CHARACTER_UPDATE action', () => {
      const action: CharacterAction = {
        type: CHARACTER_UPDATE,
        payload: { id: 'char-1', changes: { name: 'Renamed' } }
      };
      expect(isCharacterAction(action)).toBe(true);
    });

    it('returns true for CHARACTER_REMOVE action', () => {
      const action: CharacterAction = { type: CHARACTER_REMOVE, payload: 'char-1' };
      expect(isCharacterAction(action)).toBe(true);
    });

    it('returns true for CHARACTERS_SET action', () => {
      const action: CharacterAction = {
        type: CHARACTERS_SET,
        payload: { 'char-1': mockCharacter() }
      };
      expect(isCharacterAction(action)).toBe(true);
    });

    it('returns false for unrelated action type', () => {
      expect(isCharacterAction({ type: 'addInventoryItem' })).toBe(false);
      expect(isCharacterAction({ type: 'startCombat' })).toBe(false);
    });

    it('returns false for empty string type', () => {
      expect(isCharacterAction({ type: '' })).toBe(false);
    });

    it('returns false for type that is a substring of a character action', () => {
      expect(isCharacterAction({ type: 'add' })).toBe(false);
      expect(isCharacterAction({ type: 'Character' })).toBe(false);
    });

    it('narrows the action type for TypeScript consumers', () => {
      const unknownAction: { type: string; payload?: unknown } = {
        type: CHARACTER_ADD,
        payload: mockCharacter()
      };
      if (isCharacterAction(unknownAction)) {
        // Inside this branch, the type guard narrows to CharacterAction.
        // Use a runtime assertion to confirm the narrowed shape is still intact.
        expect([CHARACTER_ADD, CHARACTER_UPDATE, CHARACTER_REMOVE, CHARACTERS_SET]).toContain(
          unknownAction.type
        );
      } else {
        throw new Error('expected type guard to accept CHARACTER_ADD');
      }
    });
  });
});
