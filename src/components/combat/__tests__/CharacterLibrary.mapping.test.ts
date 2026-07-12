import { describe, it, expect } from 'vitest';
import { combatCharacterToLibrary, libraryCharacterToCombat } from '../CharacterLibrary';
import { deriveCombatCategory, isCombatCategory } from '../../../utils/combatHelpers';
import { COMBAT_CATEGORIES } from '../../../constants';
import type { CombatCharacter } from '../../../types/campaign';

// Minimal form-shaped input matching the LibraryCharacter interface
const libraryChar = (category: string) => ({
  id: 'lib-1',
  name: 'Test Character',
  category,
  st: 11,
  dx: 12,
  iq: 10,
  ht: 11,
  hp: 12,
  fp: 10,
  basicSpeed: 5.75,
  dodge: 8,
  parry: 9,
  block: 0,
  dr: 2,
  notes: 'round-trip fixture',
});

describe('CharacterLibrary category mapping', () => {
  it.each(COMBAT_CATEGORIES)('persists %s through save and read-back', (category) => {
    const combat = libraryCharacterToCombat(libraryChar(category));
    expect(combat.category).toBe(category);

    const roundTripped = combatCharacterToLibrary(combat);
    expect(roundTripped.category).toBe(category);
  });

  it('derives isNPC from category: only players are non-NPCs', () => {
    expect(libraryCharacterToCombat(libraryChar('player')).isNPC).toBe(false);
    expect(libraryCharacterToCombat(libraryChar('ally')).isNPC).toBe(true);
    expect(libraryCharacterToCombat(libraryChar('enemy')).isNPC).toBe(true);
    expect(libraryCharacterToCombat(libraryChar('object')).isNPC).toBe(true);
  });

  it('normalizes an unknown form category to player instead of persisting junk', () => {
    const combat = libraryCharacterToCombat(libraryChar('npc'));
    expect(combat.category).toBe('player');
    expect(combat.isNPC).toBe(false);
  });

  it('reads a pre-1.5.1 record (no category) using the isNPC fallback', () => {
    // Records saved before schema 1.5.1 lack category; express the stale shape via cast
    const legacyNPC = { ...libraryCharacterToCombat(libraryChar('player')), isNPC: true };
    delete (legacyNPC as Partial<CombatCharacter>).category;
    expect(combatCharacterToLibrary(legacyNPC as CombatCharacter).category).toBe('enemy');
  });

  it('preserves combat stats across the round trip', () => {
    const combat = libraryCharacterToCombat(libraryChar('enemy'));
    const lib = combatCharacterToLibrary(combat);
    expect(lib).toMatchObject({
      id: 'lib-1',
      name: 'Test Character',
      st: 11,
      dx: 12,
      iq: 10,
      ht: 11,
      hp: 12,
      fp: 10,
      dodge: 8,
      parry: 9,
      dr: 2,
      notes: 'round-trip fixture',
    });
  });
});

describe('deriveCombatCategory', () => {
  it('accepts the four valid categories as-is', () => {
    for (const category of COMBAT_CATEGORIES) {
      expect(deriveCombatCategory(category)).toBe(category);
      expect(deriveCombatCategory(category, true)).toBe(category);
    }
  });

  it('falls back on isNPC when category is missing or invalid', () => {
    expect(deriveCombatCategory(undefined, true)).toBe('enemy');
    expect(deriveCombatCategory(undefined, false)).toBe('player');
    expect(deriveCombatCategory(undefined)).toBe('player');
    expect(deriveCombatCategory('npc', true)).toBe('enemy');
    expect(deriveCombatCategory('PC')).toBe('player');
    expect(deriveCombatCategory(42, true)).toBe('enemy');
  });

  it('isCombatCategory only accepts the four library categories', () => {
    for (const category of COMBAT_CATEGORIES) {
      expect(isCombatCategory(category)).toBe(true);
    }
    expect(isCombatCategory('npc')).toBe(false);
    expect(isCombatCategory('PC')).toBe(false);
    expect(isCombatCategory(undefined)).toBe(false);
    expect(isCombatCategory(1)).toBe(false);
  });
});
