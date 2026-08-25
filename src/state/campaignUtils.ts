/**
 * Campaign State Utilities
 * Helper functions for normalizing/denormalizing data and migrating legacy state
 */

import type { Id, Character, CustomTemplates, ToolTemplate, Inventory, MaterialEntry, FoodEntry } from '../types/campaign';

// ============================================================================
// NORMALIZATION UTILITIES
// ============================================================================

/**
 * Convert an array of objects with IDs to a normalized Record<Id, T>
 * @example normalizeArray([{id: '1', name: 'A'}, {id: '2', name: 'B'}]) -> {'1': {id: '1', name: 'A'}, '2': {id: '2', name: 'B'}}
 */
export function normalizeArray<T extends { id: Id }>(arr: T[]): Record<Id, T> {
  if (!Array.isArray(arr)) {
    console.warn('normalizeArray received non-array:', arr);
    return {};
  }
  return arr.reduce((acc, item) => {
    if (item && item.id) {
      acc[item.id] = item;
    }
    return acc;
  }, {} as Record<Id, T>);
}

/**
 * Convert a normalized Record<Id, T> to an array
 * @example denormalizeObject({'1': {id: '1', name: 'A'}, '2': {id: '2', name: 'B'}}) -> [{id: '1', name: 'A'}, {id: '2', name: 'B'}]
 */
export function denormalizeObject<T>(obj: Record<Id, T>): T[] {
  if (!obj || typeof obj !== 'object') {
    console.warn('denormalizeObject received invalid object:', obj);
    return [];
  }
  return Object.values(obj);
}

/**
 * Ensure all items in an array have unique IDs, generating new IDs if missing.
 * Also handles object input by converting to array first.
 */
export function ensureIds<T extends { id?: Id }>(arr: T[] | Record<string, T>): Array<T & { id: Id }> {
  // Handle object input by converting to array
  const items = Array.isArray(arr) ? arr : Object.values(arr || {});
  return items.map((item, index) => ({
    ...item,
    id: item.id || `generated-${Date.now()}-${index}`
  })) as Array<T & { id: Id }>;
}

// ============================================================================
// CHARACTER MIGRATION
// ============================================================================

/**
 * Merge legacy workers with Party Tool characters
 * Workers become characters with standardized structure
 */
export function mergeCharacters(
  workers: Array<{
    id: Id;
    name: string;
    skills: Record<string, number>;
    st?: number;
  }>,
  partyCharacters: Record<Id, Character>
): Record<Id, Character> {
  const result: Record<Id, Character> = { ...partyCharacters };

  workers.forEach((worker) => {
    // If this worker already exists as a character, skip
    if (result[worker.id]) {
      return;
    }

    // Convert worker to character format
    result[worker.id] = {
      id: worker.id,
      name: worker.name,
      isPlayer: false,  // Workers are NPCs by default
      work: {
        enabled: true,
        skills: worker.skills
      },
      st: worker.st
    };
  });

  return result;
}

// ============================================================================
// TEMPLATE MIGRATION
// ============================================================================

/**
 * Convert legacy customTemplates to unified toolTemplates
 * Crafting templates can be used as tools in Party Tool activities
 */
export function migrateLegacyTemplates(customTemplates: CustomTemplates): Record<Id, ToolTemplate> {
  const toolTemplates: Record<Id, ToolTemplate> = {};

  // Process each category
  Object.entries(customTemplates).forEach(([category, templates]) => {
    Object.entries(templates).forEach(([templateName]) => {
      const templateId = `${category}-${templateName}`;

      // Convert to tool template with activity modifiers
      toolTemplates[templateId] = {
        templateId,
        name: `${templateName} (${category})`,
        activityCategories: {
          crafting: {
            skillBonus: 0,
            qualityModifier: 0
          },
          // Future: Add more activity types as needed
        }
      };
    });
  });

  return toolTemplates;
}

// ============================================================================
// INVENTORY MIGRATION
// ============================================================================

/**
 * Create party inventory from legacy materials and foods
 */
export function createPartyInventory(
  materials: MaterialEntry[],
  foods: FoodEntry[]
): Inventory {
  return {
    id: 'party',
    ownerType: 'party',
    ownerId: null,
    currency: {
      gold: 0,
      silver: 0,
      copper: 0
    },
    items: [],
    tools: [],
    materials: materials.map(material => ({ ...material })),
    food: foods.map(food => ({ ...food }))
  };
}

/**
 * Create character inventories for all characters
 */
export function createCharacterInventories(characters: Record<Id, Character>): Record<Id, any> {
  const inventories: Record<Id, any> = {};

  Object.values(characters).forEach((character) => {
    inventories[character.id] = {
      id: character.id,
      ownerType: 'character',
      ownerId: character.id,
      currency: {
        gold: 0,
        silver: 0,
        copper: 0
      },
      items: [],
      tools: [],
      materials: [],
      food: []
    };
  });

  return inventories;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that an ID exists in a normalized object
 */
export function validateId<T>(obj: Record<Id, T>, id: Id, entityName: string): boolean {
  if (!obj[id]) {
    console.warn(`Invalid ${entityName} ID: ${id}`);
    return false;
  }
  return true;
}

/**
 * Get item from normalized object with fallback
 */
export function getOrDefault<T>(obj: Record<Id, T>, id: Id, defaultValue: T): T {
  return obj[id] ?? defaultValue;
}

// ============================================================================
// ARRAY HELPERS
// ============================================================================

/**
 * Safely update an item in a normalized object
 */
export function updateInNormalized<T extends { id: Id }>(
  obj: Record<Id, T>,
  id: Id,
  changes: Partial<T>
): Record<Id, T> {
  if (!obj[id]) {
    console.warn(`Cannot update non-existent item: ${id}`);
    return obj;
  }

  return {
    ...obj,
    [id]: {
      ...obj[id],
      ...changes
    }
  };
}

/**
 * Safely remove an item from a normalized object
 */
export function removeFromNormalized<T>(
  obj: Record<Id, T>,
  id: Id
): Record<Id, T> {
  const { [id]: removed, ...rest } = obj;
  return rest;
}

/**
 * Add an item to a normalized object
 */
export function addToNormalized<T extends { id: Id }>(
  obj: Record<Id, T>,
  item: T
): Record<Id, T> {
  return {
    ...obj,
    [item.id]: item
  };
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Convert legacy currentDay + currentSlot to unified time
 */
export function normalizeTime(day: number, slot: number): { day: number; slot: number } {
  return {
    day: day || 1,
    slot: slot || 0
  };
}

// ============================================================================
// DEEP MERGE UTILITIES
// ============================================================================

/**
 * Deep merge two objects (for settings/config)
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result: Record<string, any> = { ...target };

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key as keyof T];
    const targetValue = result[key];

    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      result[key] = deepMerge(targetValue || {}, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  });

  return result as T;
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Filter sensitive data before export (e.g., remove GM-only info for player exports)
 */
export function filterForPlayerExport(state: any): any {
  // Implementation would filter out GM-only data
  // For now, return as-is
  return state;
}

/**
 * Validate imported campaign state structure
 */
export function validateCampaignState(state: any): boolean {
  if (!state || typeof state !== 'object') {
    return false;
  }

  const requiredKeys = ['ui', 'meta', 'entities', 'time', 'activities'];
  return requiredKeys.every(key => key in state);
}
