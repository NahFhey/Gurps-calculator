/**
 * Character Management Utilities
 * Functions for creating, duplicating, and exporting characters
 */
import { safeDeepClone } from './helpers';

import type { Character } from '../types/campaign';
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

/**
 * Character template types
 */
export type CharacterTemplateType =
  | 'fighter'
  | 'wizard'
  | 'rogue'
  | 'cleric'
  | 'ranger'
  | 'bard';

/**
 * Character template metadata
 */
export interface CharacterTemplate {
  type: CharacterTemplateType;
  name: string;
  description: string;
  pointValue: number;
}

/**
 * Available character templates
 * Note: These are just metadata - actual template data would be added later
 */
export const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    type: 'fighter',
    name: 'Fighter',
    description: 'A combat-focused warrior with high ST and weapon skills',
    pointValue: 150,
  },
  {
    type: 'wizard',
    name: 'Wizard',
    description: 'A spellcaster with high IQ and magical abilities',
    pointValue: 150,
  },
  {
    type: 'rogue',
    name: 'Rogue',
    description: 'A nimble character with high DX and stealth skills',
    pointValue: 150,
  },
  {
    type: 'cleric',
    name: 'Cleric',
    description: 'A healer with divine magic and support abilities',
    pointValue: 150,
  },
  {
    type: 'ranger',
    name: 'Ranger',
    description: 'An outdoorsman with survival and ranged combat skills',
    pointValue: 150,
  },
  {
    type: 'bard',
    name: 'Bard',
    description: 'A charismatic performer with social and magical skills',
    pointValue: 150,
  },
];

/**
 * Create a character from a template
 * Note: Currently creates a blank character with the template name
 * Template-specific attributes/skills would be added in a future phase
 */
export function createCharacterFromTemplate(templateType: CharacterTemplateType): Character {
  const template = CHARACTER_TEMPLATES.find(t => t.type === templateType);
  const templateName = template?.name || 'New Character';

  // For now, create a blank character with the template name
  // In a future phase, this would populate template-specific attributes/skills
  const character = createBlankCharacter(`New ${templateName}`);

  // Set total points based on template
  if (character.gcsData && template) {
    character.gcsData.totalPoints = template.pointValue;
  }

  return character;
}

/**
 * Duplicate an existing character
 * Creates a deep copy with a new ID and modified name
 */
export function duplicateCharacter(character: Character): Character {
  // Deep clone the character
  const cloned = safeDeepClone(character) as Character;

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
function regenerateGCSDataIds(gcsData: GCSCharacterData): void {
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

  // Regenerate skill IDs
  for (const skill of gcsData.skills) {
    skill.id = generateId('skill');
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
 * Download character as JSON file
 * Triggers a browser download of the character data
 */
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
