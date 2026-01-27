import type { LogEntry } from '../state/campaignReducer';

type LogVisibility = 'gmOnly' | 'mixed' | 'public' | 'player';

/**
 * Creates a log entry for activity-related events
 *
 * Part of Phase 4: Populate Changelog
 */
export function createActivityLogEntry(
  activityType: 'alchemy' | 'cooking' | 'crafting' | 'gathering' | 'inventory' | 'combat',
  action: string,
  details: {
    message: string;
    maskedMessage?: string;
    characterName?: string;
    itemName?: string;
    quantity?: number;
  },
  visibility: LogVisibility = 'player'
): LogEntry {
  const type = `${activityType}.${action}`;

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    type,
    visibility,
    payload: {
      message: details.message,
      maskedMessage: details.maskedMessage,
      title: `${activityType.charAt(0).toUpperCase() + activityType.slice(1)}: ${action}`
    }
  };
}

/**
 * Alchemy-specific log entry creators
 */
export const alchemyLog = {
  batchStarted: (batchName: string, workerName?: string) =>
    createActivityLogEntry('alchemy', 'batch_started', {
      message: workerName
        ? `${workerName} started brewing "${batchName}"`
        : `Started brewing "${batchName}"`
    }),

  batchCompleted: (batchName: string, quality: string, workerName?: string) =>
    createActivityLogEntry('alchemy', 'batch_completed', {
      message: workerName
        ? `${workerName} completed "${batchName}" with ${quality} quality`
        : `Completed "${batchName}" with ${quality} quality`
    }),

  batchFailed: (batchName: string, workerName?: string) =>
    createActivityLogEntry('alchemy', 'batch_failed', {
      message: workerName
        ? `${workerName}'s batch "${batchName}" failed - Mishap occurred`
        : `Batch "${batchName}" failed - Mishap occurred`
    }),

  reagentAnalyzed: (reagentName: string, workerName?: string) =>
    createActivityLogEntry('alchemy', 'reagent_analyzed', {
      message: workerName
        ? `${workerName} analyzed reagent "${reagentName}"`
        : `Analyzed reagent "${reagentName}"`
    }),

  reagentProcessed: (reagentName: string, processType: string, workerName?: string) =>
    createActivityLogEntry('alchemy', 'reagent_processed', {
      message: workerName
        ? `${workerName} ${processType} reagent "${reagentName}"`
        : `${processType} reagent "${reagentName}"`
    })
};

/**
 * Cooking-specific log entry creators
 */
export const cookingLog = {
  mealPrepared: (mealName: string, quality: string, workerName?: string) =>
    createActivityLogEntry('cooking', 'meal_prepared', {
      message: workerName
        ? `${workerName} prepared "${mealName}" (${quality})`
        : `Prepared "${mealName}" (${quality})`
    }),

  rationCreated: (quantity: number, workerName?: string) =>
    createActivityLogEntry('cooking', 'ration_created', {
      message: workerName
        ? `${workerName} created ${quantity} ration(s)`
        : `Created ${quantity} ration(s)`
    })
};

/**
 * Crafting-specific log entry creators
 */
export const craftingLog = {
  projectStarted: (itemName: string, workerName?: string) =>
    createActivityLogEntry('crafting', 'project_started', {
      message: workerName
        ? `${workerName} started crafting "${itemName}"`
        : `Started crafting "${itemName}"`
    }),

  projectCompleted: (itemName: string, quality: string, workerName?: string) =>
    createActivityLogEntry('crafting', 'project_completed', {
      message: workerName
        ? `${workerName} completed "${itemName}" (${quality})`
        : `Completed "${itemName}" (${quality})`
    }),

  workApplied: (itemName: string, hoursWorked: number, workerName?: string) =>
    createActivityLogEntry('crafting', 'work_applied', {
      message: workerName
        ? `${workerName} worked on "${itemName}" for ${hoursWorked} hour(s)`
        : `Worked on "${itemName}" for ${hoursWorked} hour(s)`
    })
};

/**
 * Gathering-specific log entry creators
 */
export const gatheringLog = {
  sessionStarted: (location: string, method: string, workerName?: string) =>
    createActivityLogEntry('gathering', 'session_started', {
      message: workerName
        ? `${workerName} began ${method} at ${location}`
        : `Began ${method} at ${location}`
    }),

  itemGathered: (itemName: string, quantity: number, workerName?: string) =>
    createActivityLogEntry('gathering', 'item_gathered', {
      message: workerName
        ? `${workerName} gathered ${quantity}x ${itemName}`
        : `Gathered ${quantity}x ${itemName}`
    }),

  sessionCompleted: (itemsGathered: number, workerName?: string) =>
    createActivityLogEntry('gathering', 'session_completed', {
      message: workerName
        ? `${workerName} finished gathering (${itemsGathered} items)`
        : `Finished gathering (${itemsGathered} items)`
    })
};

/**
 * Inventory-specific log entry creators
 */
export const inventoryLog = {
  itemTransferred: (itemName: string, fromInventory: string, toInventory: string, quantity?: number) =>
    createActivityLogEntry('inventory', 'item_transferred', {
      message: quantity
        ? `Transferred ${quantity}x "${itemName}" from ${fromInventory} to ${toInventory}`
        : `Transferred "${itemName}" from ${fromInventory} to ${toInventory}`
    }),

  currencyTransferred: (amount: number, currency: string, fromInventory: string, toInventory: string) =>
    createActivityLogEntry('inventory', 'currency_transferred', {
      message: `Transferred ${amount} ${currency} from ${fromInventory} to ${toInventory}`
    }),

  itemAdded: (itemName: string, inventoryName: string, quantity?: number) =>
    createActivityLogEntry('inventory', 'item_added', {
      message: quantity
        ? `Added ${quantity}x "${itemName}" to ${inventoryName}`
        : `Added "${itemName}" to ${inventoryName}`
    }),

  itemRemoved: (itemName: string, inventoryName: string, quantity?: number) =>
    createActivityLogEntry('inventory', 'item_removed', {
      message: quantity
        ? `Removed ${quantity}x "${itemName}" from ${inventoryName}`
        : `Removed "${itemName}" from ${inventoryName}`
    })
};

/**
 * Combat-specific log entry creators
 */
export const combatLog = {
  combatStarted: (encounterName?: string) =>
    createActivityLogEntry('combat', 'started', {
      message: encounterName
        ? `Combat started: ${encounterName}`
        : 'Combat started'
    }),

  combatEnded: (result?: string) =>
    createActivityLogEntry('combat', 'ended', {
      message: result
        ? `Combat ended: ${result}`
        : 'Combat ended'
    }),

  characterDamaged: (characterName: string, damage: number, currentHp: number) =>
    createActivityLogEntry('combat', 'damage', {
      message: `${characterName} took ${damage} damage (HP: ${currentHp})`,
      maskedMessage: 'A combatant was injured'
    }, 'mixed'),

  characterDefeated: (characterName: string) =>
    createActivityLogEntry('combat', 'defeated', {
      message: `${characterName} was defeated`,
      maskedMessage: 'A combatant was defeated'
    }, 'mixed')
};
