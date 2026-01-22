/**
 * Phase 6: Combat Inventory Bridge
 *
 * Bridges combat system and inventory system.
 * Handles item consumption during combat with undo/redo support.
 */

/**
 * Find item in inventory by ID
 *
 * @param {array} items - Inventory items array
 * @param {string} itemId - Item ID to find
 * @returns {object|null} Item or null if not found
 */
export function findItem(items, itemId) {
  return items.find(it => it.id === itemId) || null;
}

/**
 * Consume item from inventory (decrement quantity)
 *
 * Returns new inventory array and the quantity consumed.
 * If quantity reaches 0, item remains with quantity 0.
 *
 * @param {array} items - Current inventory array
 * @param {string} itemId - Item ID to consume
 * @param {number} quantity - Quantity to consume (default 1)
 * @returns {object} { inventory: updated array, consumed: actual quantity consumed, item: item that was consumed }
 */
export function consumeItem(items, itemId, quantity = 1) {
  const item = findItem(items, itemId);
  if (!item) {
    return {
      inventory: items,
      consumed: 0,
      item: null
    };
  }

  const actualConsumed = Math.min(quantity, item.quantity || 0);

  const newInventory = items.map(it => {
    if (it.id === itemId) {
      return {
        ...it,
        quantity: Math.max(0, (it.quantity || 0) - actualConsumed)
      };
    }
    return it;
  });

  return {
    inventory: newInventory,
    consumed: actualConsumed,
    item: {
      ...item,
      quantity: Math.max(0, (item.quantity || 0) - actualConsumed)
    }
  };
}

/**
 * Restore item to inventory (increment quantity)
 *
 * Used for undo operations.
 *
 * @param {array} items - Current inventory array
 * @param {string} itemId - Item ID to restore
 * @param {number} quantity - Quantity to restore
 * @returns {array} Updated inventory array
 */
export function restoreItem(items, itemId, quantity = 1) {
  const item = findItem(items, itemId);
  if (!item) {
    // Item doesn't exist - this shouldn't happen in normal undo flow
    console.warn(`Cannot restore item ${itemId} - not found in inventory`);
    return items;
  }

  return items.map(it => {
    if (it.id === itemId) {
      return {
        ...it,
        quantity: (it.quantity || 0) + quantity
      };
    }
    return it;
  });
}

/**
 * Create inventory delta for undo/redo system
 *
 * This represents a change to inventory that can be reversed.
 *
 * @param {string} itemId - Item ID
 * @param {number} quantityChange - Quantity change (negative for consumption)
 * @param {object} itemSnapshot - Snapshot of item before change
 * @returns {object} Inventory delta
 */
export function createInventoryDelta(itemId, quantityChange, itemSnapshot) {
  return {
    itemId,
    quantityChange,
    itemSnapshot: {
      ...itemSnapshot
    }
  };
}

/**
 * Apply inventory delta forward (for redo)
 *
 * @param {array} items - Current inventory
 * @param {object} delta - Inventory delta
 * @returns {array} Updated inventory
 */
export function applyInventoryDelta(items, delta) {
  if (delta.quantityChange < 0) {
    // Consumption
    const result = consumeItem(items, delta.itemId, Math.abs(delta.quantityChange));
    return result.inventory;
  } else {
    // Restoration
    return restoreItem(items, delta.itemId, delta.quantityChange);
  }
}

/**
 * Reverse inventory delta (for undo)
 *
 * @param {array} items - Current inventory
 * @param {object} delta - Inventory delta
 * @returns {array} Updated inventory
 */
export function reverseInventoryDelta(items, delta) {
  if (delta.quantityChange < 0) {
    // Undo consumption = restore
    return restoreItem(items, delta.itemId, Math.abs(delta.quantityChange));
  } else {
    // Undo restoration = consume
    const result = consumeItem(items, delta.itemId, delta.quantityChange);
    return result.inventory;
  }
}

/**
 * Check if item can be used (has quantity > 0)
 *
 * @param {object} item - Item to check
 * @returns {boolean} True if item can be used
 */
export function canUseItem(item) {
  return item && (item.quantity || 0) > 0;
}

/**
 * Get item quantity
 *
 * @param {array} items - Inventory array
 * @param {string} itemId - Item ID
 * @returns {number} Item quantity
 */
export function getItemQuantity(items, itemId) {
  const item = findItem(items, itemId);
  return item ? (item.quantity || 0) : 0;
}

/**
 * Update item tags (for marking as combat-usable)
 *
 * @param {array} items - Current inventory
 * @param {string} itemId - Item ID
 * @param {array} newTags - New tags array
 * @returns {array} Updated inventory
 */
export function updateItemTags(items, itemId, newTags) {
  return items.map(it => {
    if (it.id === itemId) {
      return {
        ...it,
        tags: [...newTags]
      };
    }
    return it;
  });
}
