/**
 * Phase 6: Combat Item Filter Utilities
 *
 * Filters inventory items for use in combat based on tags.
 */

import { hasTag, ItemTag } from './itemTags';

/**
 * Check if an item is combat-usable
 *
 * @param {object} item - Inventory item
 * @returns {boolean} True if item is tagged as combat-usable
 */
export function isCombatUsable(item) {
  return hasTag(item, ItemTag.COMBAT_USABLE);
}

/**
 * Filter items for combat use
 *
 * @param {array} items - Array of inventory items
 * @param {object} options - Filter options
 * @param {boolean} options.showAll - If true, show all items regardless of tags
 * @param {string} options.search - Search query to filter by name/tags
 * @returns {array} Filtered items
 */
export function filterCombatItems(items, { showAll = false, search = '' } = {}) {
  const q = String(search).trim().toLowerCase();

  return (items || [])
    .filter(it => (showAll ? true : isCombatUsable(it)))
    .filter(it => {
      if (!q) return true;

      // Search in name and tags
      const hay = `${it.name || ''} ${(it.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
}

/**
 * Group combat items by category or type
 *
 * @param {array} items - Array of inventory items
 * @returns {object} Items grouped by category
 */
export function groupCombatItems(items) {
  const grouped = {
    potions: [],
    consumables: [],
    throwables: [],
    other: []
  };

  for (const item of items) {
    if (hasTag(item, ItemTag.POTION)) {
      grouped.potions.push(item);
    } else if (hasTag(item, ItemTag.CONSUMABLE)) {
      grouped.consumables.push(item);
    } else if (hasTag(item, ItemTag.THROWABLE)) {
      grouped.throwables.push(item);
    } else {
      grouped.other.push(item);
    }
  }

  return grouped;
}

/**
 * Sort items by name
 *
 * @param {array} items - Array of items
 * @returns {array} Sorted items
 */
export function sortItemsByName(items) {
  return [...items].sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
}
