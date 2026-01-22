/**
 * Phase 6: Item Tagging Utilities
 *
 * Utilities for managing tags on inventory items without schema refactoring.
 * Supports backwards compatibility with items that don't have tags.
 */

/**
 * Normalize tags array
 *
 * Ensures tags are lowercase, unique, and trimmed.
 *
 * @param {array|undefined} tags - Tags array (may be undefined)
 * @returns {array} Normalized tags array
 */
export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  const clean = tags
    .map(t => String(t).trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(clean));
}

/**
 * Check if an item has a specific tag
 *
 * @param {object} item - Inventory item
 * @param {string} tag - Tag to check for
 * @returns {boolean} True if item has tag
 */
export function hasTag(item, tag) {
  const tags = normalizeTags(item?.tags);
  return tags.includes(String(tag).toLowerCase());
}

/**
 * Add a tag to an item (immutable)
 *
 * Returns a new item object with the tag added.
 *
 * @param {object} item - Inventory item
 * @param {string} tag - Tag to add
 * @returns {object} New item with tag added
 */
export function addTag(item, tag) {
  const tags = normalizeTags([...(item?.tags || []), tag]);
  return { ...item, tags };
}

/**
 * Remove a tag from an item (immutable)
 *
 * Returns a new item object with the tag removed.
 *
 * @param {object} item - Inventory item
 * @param {string} tag - Tag to remove
 * @returns {object} New item with tag removed
 */
export function removeTag(item, tag) {
  const t = String(tag).toLowerCase();
  const tags = normalizeTags(item?.tags).filter(x => x !== t);
  return { ...item, tags };
}

/**
 * Set multiple tags on an item (immutable)
 *
 * Replaces all tags with the provided array.
 *
 * @param {object} item - Inventory item
 * @param {array} tags - Tags to set
 * @returns {object} New item with tags set
 */
export function setTags(item, tags) {
  const normalized = normalizeTags(tags);
  return { ...item, tags: normalized };
}

/**
 * Check if an item has any of the provided tags
 *
 * @param {object} item - Inventory item
 * @param {array} tagsToCheck - Array of tags to check
 * @returns {boolean} True if item has at least one of the tags
 */
export function hasAnyTag(item, tagsToCheck) {
  const itemTags = normalizeTags(item?.tags);
  const checkTags = tagsToCheck.map(t => String(t).toLowerCase());

  return checkTags.some(tag => itemTags.includes(tag));
}

/**
 * Check if an item has all of the provided tags
 *
 * @param {object} item - Inventory item
 * @param {array} tagsToCheck - Array of tags to check
 * @returns {boolean} True if item has all of the tags
 */
export function hasAllTags(item, tagsToCheck) {
  const itemTags = normalizeTags(item?.tags);
  const checkTags = tagsToCheck.map(t => String(t).toLowerCase());

  return checkTags.every(tag => itemTags.includes(tag));
}

/**
 * Common tag constants for Phase 6
 */
export const ItemTag = {
  COMBAT_USABLE: 'combat-usable',
  CONSUMABLE: 'consumable',
  THROWABLE: 'throwable',
  ACTIVATE: 'activate',
  EQUIPPABLE: 'equippable',
  POTION: 'potion',
  FOOD: 'food',
  SCROLL: 'scroll',
  WAND: 'wand'
};
