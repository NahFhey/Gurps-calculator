/**
 * Character Management Utilities
 * Functions for creating, duplicating, and exporting characters
 */
import { safeDeepClone } from './helpers';
import { exportCharacterText } from './characterExport';

import type { Character, CharacterTemplateEntity } from '../types/campaign';
import type { GCSCharacterData } from '../types/characterSheet';
import { createDefaultGCSData, syncWorkSkillsFromGCS } from '../types/characterSheet';

/**
 * Generate a unique character ID
 */
function generateCharacterId(): string {
  return `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a blank character with default values
 */
export function createBlankCharacter(name: string = 'New Character'): Character {
  const gcsData = createDefaultGCSData();
  const workSkills = syncWorkSkillsFromGCS(gcsData);

  return {
    id: generateCharacterId(),
    name,
    isPlayer: true,
    work: {
      enabled: true,
      skills: workSkills,
    },
    st: gcsData.attributes.ST,
    gcsData,
  };
}

/** Create a full character from a persisted template snapshot. */
export function createCharacterFromTemplateEntity(
  template: CharacterTemplateEntity,
  name: string = `New ${template.name}`
): Character {
  const gcsData = safeDeepClone(template.gcsData);
  regenerateGCSDataIds(gcsData);
  return {
    id: generateCharacterId(),
    name,
    isPlayer: true,
    work: { enabled: true, skills: syncWorkSkillsFromGCS(gcsData) },
    st: gcsData.attributes.ST,
    gcsData,
  };
}

/** Snapshot a character as an images-free build rather than a career record. */
export function createCharacterTemplateSnapshot(
  character: Character,
  name: string,
  description: string,
  now: number = Date.now()
): CharacterTemplateEntity {
  const gcsData = safeDeepClone(character.gcsData ?? createDefaultGCSData());
  gcsData.unspentPoints = 0;
  gcsData.pointLedger = [];
  return {
    id: `character-template-${now}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    description,
    builtin: false,
    gcsData,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Duplicate an existing character
 * Creates a deep copy with a new ID and modified name
 */
export function duplicateCharacter(character: Character): Character {
  // Deep clone the character
  const cloned = safeDeepClone(character);

  // Generate new ID
  cloned.id = generateCharacterId();

  // Modify name to indicate it's a copy
  cloned.name = `${character.name} (Copy)`;

  // Regenerate IDs for nested items in gcsData
  if (cloned.gcsData) {
    regenerateGCSDataIds(cloned.gcsData);
  }

  return cloned;
}

/**
 * Regenerate all IDs within GCS data to avoid duplicates
 */
export function regenerateGCSDataIds(gcsData: GCSCharacterData): void {
  const generateId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Regenerate trait IDs
  for (const advantage of gcsData.advantages) {
    advantage.id = generateId('advantage');
  }
  for (const perk of gcsData.perks) {
    perk.id = generateId('perk');
  }
  for (const disadvantage of gcsData.disadvantages) {
    disadvantage.id = generateId('disadvantage');
  }
  for (const quirk of gcsData.quirks) {
    quirk.id = generateId('quirk');
  }

  // Regenerate skill IDs and preserve history references to them.
  const skillIdMap = new Map<string, string>();
  for (const skill of gcsData.skills) {
    const oldId = skill.id;
    const newId = generateId('skill');
    skillIdMap.set(oldId, newId);
    skill.id = newId;
  }
  for (const entry of gcsData.skillHistory ?? []) {
    entry.skillId = skillIdMap.get(entry.skillId) ?? entry.skillId;
  }

  // Regenerate spell IDs
  for (const spell of gcsData.spells) {
    spell.id = generateId('spell');
  }

  // Regenerate equipment IDs
  for (const equip of gcsData.equipment) {
    equip.id = generateId('equip');
  }
}

/**
 * Export character to JSON format
 * Returns a formatted JSON string that can be saved to a file
 */
export function exportCharacterJSON(character: Character): string {
  // Create an export-friendly version
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    character: {
      name: character.name,
      isPlayer: character.isPlayer,
      st: character.st,
      work: character.work,
      gcsData: character.gcsData,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import character from JSON format
 * Parses a JSON string and returns a Character object
 */
export function importCharacterJSON(jsonString: string): Character {
  // Reject oversized inputs (50MB limit)
  const MAX_IMPORT_SIZE = 50 * 1024 * 1024;
  if (jsonString.length > MAX_IMPORT_SIZE) {
    throw new Error('Character data exceeds maximum import size (50MB)');
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`Invalid character JSON: ${err instanceof Error ? err.message : 'parse failed'}`);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid character data: expected a JSON object');
  }

  // Handle both direct character format and wrapped export format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const characterData = (data.character || data) as any;

  // Validate required name field
  if (typeof characterData.name !== 'string' && characterData.name !== undefined) {
    throw new Error('Invalid character data: name must be a string');
  }

  // Create new character with fresh ID
  const character: Character = {
    id: generateCharacterId(),
    name: (characterData.name as string) || 'Imported Character',
    isPlayer: characterData.isPlayer ?? true,
    st: characterData.st,
    work: characterData.work || { enabled: true, skills: {} },
    gcsData: characterData.gcsData,
  };

  // Regenerate IDs to avoid conflicts
  if (character.gcsData) {
    regenerateGCSDataIds(character.gcsData);
  }

  // Sync work skills if gcsData exists
  if (character.gcsData) {
    character.work.skills = syncWorkSkillsFromGCS(character.gcsData);
  }

  return character;
}

/**
 * Import either a single JSON character or a top-level array of characters.
 * Each imported entry goes through the existing single-character path so IDs
 * are regenerated and work skills stay synchronized exactly as before.
 */
export function importCharactersJSON(jsonString: string): Character[] {
  const MAX_IMPORT_SIZE = 50 * 1024 * 1024;
  if (jsonString.length > MAX_IMPORT_SIZE) {
    throw new Error('Character data exceeds maximum import size (50MB)');
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`Invalid character JSON: ${err instanceof Error ? err.message : 'parse failed'}`);
  }

  if (!Array.isArray(data)) {
    return [importCharacterJSON(jsonString)];
  }
  if (data.length === 0) {
    throw new Error('Invalid character data: expected at least one character');
  }

  return data.map((entry, index) => {
    try {
      return importCharacterJSON(JSON.stringify(entry));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid character data';
      throw new Error(`Invalid character at index ${index}: ${message}`);
    }
  });
}

/**
 * Download character as JSON file
 * Triggers a browser download of the character data
 */
export function downloadCharacterText(character: Character): void {
  const text = exportCharacterText(character);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${character.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function downloadCharacterJSON(character: Character): void {
  const jsonString = exportCharacterJSON(character);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${character.name.replace(/[^a-z0-9]/gi, '_')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
