import type { Character, Inventory } from '../../types/campaign';

export function getCharacterPackLabel(character: Character): string {
  return `${character.name}'s Pack`;
}

export function getInventoryLabel(
  inventory: Inventory | undefined,
  characters: Record<string, Character>
): string {
  if (inventory?.ownerType === 'party') {
    return 'Party Stash';
  }
  if (inventory?.ownerId && characters[inventory.ownerId]) {
    return getCharacterPackLabel(characters[inventory.ownerId]);
  }
  return 'Unknown Inventory';
}
