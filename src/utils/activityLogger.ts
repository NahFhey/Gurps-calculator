import type { LogEntry, LogEntryMeta, LogVisibility } from '../state/campaignReducer';

type ActivityLogDetails = {
  message: string;
  maskedMessage?: string;
  characterName?: string;
  itemName?: string;
  quantity?: number;
  characterIds?: string[];
  characterNames?: string[];
  itemNames?: string[];
  taskId?: string;
};

const mergeMetaNames = (names?: string[], name?: string): string[] | undefined => {
  const merged = [...(names ?? []), ...(name ? [name] : [])];
  return merged.length > 0 ? [...new Set(merged)] : undefined;
};

/**
 * Creates a log entry for activity-related events
 *
 * Part of Phase 4: Populate Changelog
 */
export function createActivityLogEntry(
  activityType: 'alchemy' | 'cooking' | 'crafting' | 'gathering' | 'inventory' | 'combat' | 'rest' | 'trading' | 'study' | 'social' | 'character',
  action: string,
  details: ActivityLogDetails,
  visibility: LogVisibility = 'player'
): LogEntry {
  const type = `${activityType}.${action}`;
  const characterNames = mergeMetaNames(details.characterNames, details.characterName);
  const itemNames = mergeMetaNames(details.itemNames, details.itemName);
  const meta: LogEntryMeta = {
    ...(details.characterIds?.length ? { characterIds: details.characterIds } : {}),
    ...(characterNames ? { characterNames } : {}),
    ...(itemNames ? { itemNames } : {}),
    ...(details.quantity !== undefined ? { quantity: details.quantity } : {}),
    ...(details.taskId ? { taskId: details.taskId } : {}),
  };
  const hasMeta = Object.keys(meta).length > 0;

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    type,
    visibility,
    payload: {
      message: details.message,
      maskedMessage: details.maskedMessage,
      title: `${activityType.charAt(0).toUpperCase() + activityType.slice(1)}: ${action}`
    },
    ...(hasMeta ? { meta } : {}),
  };
}

/** Rest and recovery-specific log entry creators. */
export const restLog = {
  taskCreated: (characterName: string, restType: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('rest', 'task_created', {
      message: `${characterName} scheduled ${restType}`,
      characterName,
      ...meta,
    }),

  recoveryResolved: (
    characterName: string,
    hpRestored: number,
    fpRestored: number,
    meta: LogEntryMeta = {}
  ) => {
    const recovered = [
      hpRestored > 0 ? `${hpRestored} HP` : '',
      fpRestored > 0 ? `${fpRestored} FP` : '',
    ].filter(Boolean).join(' and ') || 'nothing';
    return createActivityLogEntry('rest', 'recovery_resolved', {
      message: `${characterName} recovered ${recovered}`,
      characterName,
      ...meta,
    });
  },
};

export const tradingLog = {
  tripCreated: (leaderName: string, merchantName: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('trading', 'trip_created', {
      message: `${leaderName} scheduled a market trip to ${merchantName}`,
      characterName: leaderName,
      ...meta,
    }),

  tripResolved: (
    leaderName: string,
    merchantName: string,
    summary: string,
    meta: LogEntryMeta = {}
  ) => createActivityLogEntry('trading', 'trip_resolved', {
    message: `${leaderName} traded with ${merchantName}: ${summary}`,
    characterName: leaderName,
    ...meta,
  }),
};

export const studyLog = {
  sessionLogged: (
    characterName: string,
    skillName: string,
    hours: number,
    totalHours: number,
    meta: LogEntryMeta = {}
  ) => createActivityLogEntry('study', 'session_logged', {
    message: `${characterName} studied ${skillName} for ${hours}h (${totalHours}h total)`,
    characterName,
    itemName: skillName,
    quantity: hours,
    ...meta,
  }),

  pointAwarded: (
    characterName: string,
    skillName: string,
    newLevel: number,
    meta: LogEntryMeta = {}
  ) => createActivityLogEntry('study', 'point_awarded', {
    message: `${characterName} gained 1 point in ${skillName} (level ${newLevel})`,
    characterName,
    itemName: skillName,
    quantity: 1,
    ...meta,
  }),
};

export const socialLog = {
  attemptResolved: (
    characterName: string,
    contactName: string,
    outcome: string,
    newModifier: number,
    meta: LogEntryMeta = {}
  ) => createActivityLogEntry('social', 'attempt_resolved', {
    message: outcome || `${characterName} adjusted ${contactName} to ${newModifier >= 0 ? '+' : ''}${newModifier}`,
    characterName,
    itemName: contactName,
    ...meta,
  }),

  contactAdjusted: (
    contactName: string,
    newModifier: number,
    meta: LogEntryMeta = {}
  ) => createActivityLogEntry('social', 'contact_adjusted', {
    message: `${contactName} standing adjusted to ${newModifier >= 0 ? '+' : ''}${newModifier}`,
    itemName: contactName,
    ...meta,
  }),
};

export const characterLog = {
  pointsAwarded: (
    names: string[],
    amount: number,
    note: string,
    meta: LogEntryMeta = {}
  ) => createActivityLogEntry('character', 'points_awarded', {
    message: `Awarded ${amount} point${amount === 1 ? '' : 's'} to ${names.join(', ')}${note.trim() ? `: ${note.trim()}` : ''}`,
    characterNames: names,
    quantity: amount,
    ...meta,
  }),

  pointsSpent: (
    characterName: string,
    amount: number,
    summary: string,
    meta: LogEntryMeta = {}
  ) => createActivityLogEntry('character', 'points_spent', {
    message: amount >= 0
      ? `${characterName} spent ${amount} point${amount === 1 ? '' : 's'}: ${summary}`
      : `${characterName} gained ${Math.abs(amount)} point${amount === -1 ? '' : 's'} through point spending: ${summary}`,
    characterName,
    quantity: amount,
    ...meta,
  }),
};

/**
 * Alchemy-specific log entry creators
 */
export const alchemyLog = {
  batchStarted: (batchName: string, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('alchemy', 'batch_started', {
      message: workerName
        ? `${workerName} started brewing "${batchName}"`
        : `Started brewing "${batchName}"`,
      itemName: batchName,
      characterName: workerName,
      ...meta,
    }),

  batchCompleted: (batchName: string, quality: string, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('alchemy', 'batch_completed', {
      message: workerName
        ? `${workerName} completed "${batchName}" with ${quality} quality`
        : `Completed "${batchName}" with ${quality} quality`,
      itemName: batchName,
      characterName: workerName,
      ...meta,
    }),

  batchFailed: (batchName: string, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('alchemy', 'batch_failed', {
      message: workerName
        ? `${workerName}'s batch "${batchName}" failed - Mishap occurred`
        : `Batch "${batchName}" failed - Mishap occurred`,
      itemName: batchName,
      characterName: workerName,
      ...meta,
    }),

  reagentAnalyzed: (reagentName: string, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('alchemy', 'reagent_analyzed', {
      message: workerName
        ? `${workerName} analyzed reagent "${reagentName}"`
        : `Analyzed reagent "${reagentName}"`,
      itemName: reagentName,
      characterName: workerName,
      ...meta,
    }),

  reagentProcessed: (reagentName: string, processType: string, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('alchemy', 'reagent_processed', {
      message: workerName
        ? `${workerName} ${processType} reagent "${reagentName}"`
        : `${processType} reagent "${reagentName}"`,
      itemName: reagentName,
      characterName: workerName,
      ...meta,
    }),

  reagentPromoted: (reagentName: string, quantity: number, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('alchemy', 'reagent_promoted', {
      message: `${quantity} ${reagentName} promoted to lab stock`,
      itemName: reagentName,
      quantity,
      ...meta,
    })
};

/**
 * Cooking-specific log entry creators
 */
export const cookingLog = {
  mealPrepared: (mealName: string, quality: string, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('cooking', 'meal_prepared', {
      message: workerName
        ? `${workerName} prepared "${mealName}" (${quality})`
        : `Prepared "${mealName}" (${quality})`,
      itemName: mealName,
      characterName: workerName,
      ...meta,
    }),

  rationCreated: (quantity: number, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('cooking', 'ration_created', {
      message: workerName
        ? `${workerName} created ${quantity} ration(s)`
        : `Created ${quantity} ration(s)`,
      itemName: 'Ration',
      characterName: workerName,
      quantity,
      ...meta,
    })
};

/**
 * Crafting-specific log entry creators
 */
export const craftingLog = {
  projectStarted: (itemName: string, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('crafting', 'project_started', {
      message: workerName
        ? `${workerName} started crafting "${itemName}"`
        : `Started crafting "${itemName}"`,
      itemName,
      characterName: workerName,
      ...meta,
    }),

  projectCompleted: (itemName: string, quality: string, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('crafting', 'project_completed', {
      message: workerName
        ? `${workerName} completed "${itemName}" (${quality})`
        : `Completed "${itemName}" (${quality})`,
      itemName,
      characterName: workerName,
      ...meta,
    }),

  workApplied: (itemName: string, hoursWorked: number, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('crafting', 'work_applied', {
      message: workerName
        ? `${workerName} worked on "${itemName}" for ${hoursWorked} hour(s)`
        : `Worked on "${itemName}" for ${hoursWorked} hour(s)`,
      itemName,
      characterName: workerName,
      quantity: hoursWorked,
      ...meta,
    })
};

/**
 * Gathering-specific log entry creators
 */
export const gatheringLog = {
  sessionStarted: (location: string, method: string, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('gathering', 'session_started', {
      message: workerName
        ? `${workerName} began ${method} at ${location}`
        : `Began ${method} at ${location}`,
      characterName: workerName,
      ...meta,
    }),

  itemGathered: (itemName: string, quantity: number, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('gathering', 'item_gathered', {
      message: workerName
        ? `${workerName} gathered ${quantity}x ${itemName}`
        : `Gathered ${quantity}x ${itemName}`,
      itemName,
      characterName: workerName,
      quantity,
      ...meta,
    }),

  sessionCompleted: (itemsGathered: number, workerName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('gathering', 'session_completed', {
      message: workerName
        ? `${workerName} finished gathering (${itemsGathered} items)`
        : `Finished gathering (${itemsGathered} items)`,
      characterName: workerName,
      quantity: itemsGathered,
      ...meta,
    })
};

/**
 * Inventory-specific log entry creators
 */
export const inventoryLog = {
  itemTransferred: (itemName: string, fromInventory: string, toInventory: string, quantity?: number, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('inventory', 'item_transferred', {
      message: quantity
        ? `Transferred ${quantity}x "${itemName}" from ${fromInventory} to ${toInventory}`
        : `Transferred "${itemName}" from ${fromInventory} to ${toInventory}`,
      itemName,
      quantity,
      ...meta,
    }),

  stackableTransferred: (kind: 'material' | 'food', name: string, quantity: number, fromInventory: string, toInventory: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('inventory', `${kind}_transferred`, {
      message: `Transferred ${quantity} ${name} from ${fromInventory} to ${toInventory}`,
      itemName: name,
      quantity,
      ...meta,
    }),

  currencyTransferred: (amount: number, currency: string, fromInventory: string, toInventory: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('inventory', 'currency_transferred', {
      message: `Transferred ${amount} ${currency} from ${fromInventory} to ${toInventory}`,
      quantity: amount,
      ...meta,
    }),

  itemAdded: (itemName: string, inventoryName: string, quantity?: number, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('inventory', 'item_added', {
      message: quantity
        ? `Added ${quantity}x "${itemName}" to ${inventoryName}`
        : `Added "${itemName}" to ${inventoryName}`,
      itemName,
      quantity,
      ...meta,
    }),

  itemRemoved: (itemName: string, inventoryName: string, quantity?: number, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('inventory', 'item_removed', {
      message: quantity
        ? `Removed ${quantity}x "${itemName}" from ${inventoryName}`
        : `Removed "${itemName}" from ${inventoryName}`,
      itemName,
      quantity,
      ...meta,
    }),

  itemConsumed: (itemName: string, characterName: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('inventory', 'item_consumed', {
      message: `${characterName} used "${itemName}"`,
      itemName,
      characterName,
      ...meta,
    }),

  itemConsumptionReverted: (itemName: string, characterName: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('inventory', 'item_consumption_reverted', {
      message: `Restored "${itemName}" to ${characterName}`,
      itemName,
      characterName,
      ...meta,
    })
};

/**
 * Combat-specific log entry creators
 */
export const combatLog = {
  combatStarted: (encounterName?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('combat', 'started', {
      message: encounterName
        ? `Combat started: ${encounterName}`
        : 'Combat started',
      ...meta,
    }),

  combatEnded: (result?: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('combat', 'ended', {
      message: result
        ? `Combat ended: ${result}`
        : 'Combat ended',
      ...meta,
    }),

  characterDamaged: (characterName: string, damage: number, currentHp: number, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('combat', 'damage', {
      message: `${characterName} took ${damage} damage (HP: ${currentHp})`,
      maskedMessage: 'A combatant was injured',
      characterName,
      quantity: damage,
      ...meta,
    }, 'mixed'),

  characterDefeated: (characterName: string, meta: LogEntryMeta = {}) =>
    createActivityLogEntry('combat', 'defeated', {
      message: `${characterName} was defeated`,
      maskedMessage: 'A combatant was defeated',
      characterName,
      ...meta,
    }, 'mixed')
};
