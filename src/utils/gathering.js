/**
 * @fileoverview Gathering System Utilities
 *
 * This module provides utility functions for the gathering system including:
 * - Dice formula parsing and evaluation (XdY+Z format)
 * - Fishing roll resolution
 * - Dynamic event determination
 * - Large fish struggle resolution
 * - Yield calculations
 */

import {
  DYNAMIC_EVENT_THRESHOLDS,
  FISHING_METHODS,
  FISHING_OUTCOMES,
  BAIT_MODIFIERS,
  LARGE_FISH_TARGETING_PENALTY,
  MAX_NET_REROLL_ATTEMPTS,
  DEFAULT_FISH_ST,
  FORAGING_OUTCOMES,
  FORAGING_CONTEXT_MODIFIERS,
  FORAGING_RARITIES,
  FORAGING_HAZARDS
} from '../constants';

/**
 * Parses a dice formula string and returns its components
 * Supports formats: "2d6+1", "3d+2" (3d6+2), "1d8", "2d6-1", "4"
 *
 * @param {string} formula - Dice formula (e.g., "2d6+1", "3d+2", "1d8")
 * @returns {{count: number, sides: number, modifier: number}} Parsed components
 *
 * @example
 * parseDiceFormula("2d6+1") // { count: 2, sides: 6, modifier: 1 }
 * parseDiceFormula("3d+2")  // { count: 3, sides: 6, modifier: 2 }
 * parseDiceFormula("1d8")   // { count: 1, sides: 8, modifier: 0 }
 * parseDiceFormula("5")     // { count: 0, sides: 0, modifier: 5 }
 */
export function parseDiceFormula(formula) {
  if (!formula || typeof formula !== 'string') {
    return { count: 0, sides: 0, modifier: 0 };
  }

  const trimmed = formula.trim().toLowerCase();

  // Check for pure number (no dice)
  if (/^[+-]?\d+$/.test(trimmed)) {
    return { count: 0, sides: 0, modifier: parseInt(trimmed, 10) };
  }

  // Match dice patterns: XdY+Z, XdY-Z, XdY, Xd+Z, Xd-Z, Xd
  // Where X = count, Y = sides (optional, defaults to 6), Z = modifier
  const diceRegex = /^(\d+)d(\d+)?([+-]\d+)?$/;
  const match = trimmed.match(diceRegex);

  if (!match) {
    console.warn(`Invalid dice formula: ${formula}`);
    return { count: 0, sides: 0, modifier: 0 };
  }

  const count = parseInt(match[1], 10) || 0;
  const sides = match[2] ? parseInt(match[2], 10) : 6; // Default to d6
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  return { count, sides, modifier };
}

/**
 * Evaluates a dice formula and returns the rolled result
 *
 * @param {string} formula - Dice formula (e.g., "2d6+1")
 * @returns {{total: number, rolls: number[], formula: string}} Result with breakdown
 *
 * @example
 * evaluateDiceFormula("2d6+1") // { total: 8, rolls: [3, 4], formula: "2d6+1" }
 */
export function evaluateDiceFormula(formula) {
  const { count, sides, modifier } = parseDiceFormula(formula);

  const rolls = [];
  let sum = 0;

  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    sum += roll;
  }

  return {
    total: sum + modifier,
    rolls,
    modifier,
    formula
  };
}

/**
 * Rolls 3d6 for standard GURPS skill checks
 *
 * @returns {{total: number, rolls: number[]}} The 3d6 result
 */
export function roll3d6() {
  const rolls = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];
  return {
    total: rolls.reduce((a, b) => a + b, 0),
    rolls
  };
}

/**
 * Determines if a roll is a critical success
 * GURPS: roll <= 4, or 5 with skill >= 15, or 6 with skill >= 16
 *
 * @param {number} roll - The 3d6 roll result
 * @param {number} effectiveSkill - The effective skill level
 * @returns {boolean} True if critical success
 */
export function isCriticalSuccess(roll, effectiveSkill) {
  if (roll <= 4) return true;
  if (roll === 5 && effectiveSkill >= 15) return true;
  if (roll === 6 && effectiveSkill >= 16) return true;
  return false;
}

/**
 * Determines if a roll is a critical failure
 * GURPS: roll = 18, or 17 with skill <= 15, or margin >= 10
 *
 * @param {number} roll - The 3d6 roll result
 * @param {number} effectiveSkill - The effective skill level
 * @returns {boolean} True if critical failure
 */
export function isCriticalFailure(roll, effectiveSkill) {
  if (roll === 18) return true;
  if (roll === 17 && effectiveSkill <= 15) return true;
  if (roll - effectiveSkill >= 10) return true;
  return false;
}

/**
 * Evaluates a fishing roll and returns the outcome
 *
 * @param {number} roll - The 3d6 roll result
 * @param {number} effectiveSkill - Fishing skill + modifiers
 * @param {string} method - Fishing method (Line/Net/Spear)
 * @returns {Object} Outcome with fish count and description
 */
export function evaluateFishingRoll(roll, effectiveSkill, method) {
  const margin = effectiveSkill - roll;
  const critSuccess = isCriticalSuccess(roll, effectiveSkill);
  const critFailure = isCriticalFailure(roll, effectiveSkill);
  const success = roll <= effectiveSkill && !critFailure;

  if (critFailure) {
    return {
      outcome: 'critFailure',
      success: false,
      critFailure: true,
      critSuccess: false,
      margin,
      fish: 0,
      description: FISHING_OUTCOMES.critFailure.description
    };
  }

  if (critSuccess) {
    return {
      outcome: 'critSuccess',
      success: true,
      critFailure: false,
      critSuccess: true,
      margin,
      fish: FISHING_OUTCOMES.critSuccess.fish,
      description: FISHING_OUTCOMES.critSuccess.description
    };
  }

  if (success) {
    // Net fishing: 1 fish + 1 per 3 MoS
    let fishCount = 1;
    if (method === 'Net' && margin >= 3) {
      fishCount += Math.floor(margin / 3);
    }
    return {
      outcome: 'success',
      success: true,
      critFailure: false,
      critSuccess: false,
      margin,
      fish: fishCount,
      description: method === 'Net' && fishCount > 1
        ? `Success - Caught ${fishCount} fish (MoS: ${margin})`
        : FISHING_OUTCOMES.success.description
    };
  }

  return {
    outcome: 'failure',
    success: false,
    critFailure: false,
    critSuccess: false,
    margin,
    fish: 0,
    description: FISHING_OUTCOMES.failure.description
  };
}

/**
 * Calculates effective fishing skill with all modifiers
 *
 * @param {Object} params - Calculation parameters
 * @param {number} params.baseFishingSkill - Worker's base fishing skill
 * @param {number} params.toolBonus - Bonus from selected tools
 * @param {boolean} params.hasCorrectBait - Whether bait matches target
 * @param {boolean} params.hasInappropriateBait - Whether bait is wrong for target
 * @param {boolean} params.targetingLargeFish - Whether targeting a large fish
 * @param {number} params.retryPenalty - Cumulative retry penalty (0, -1, -2, -3)
 * @param {number} params.environmentMod - Environment-specific modifier
 * @returns {{effectiveSkill: number, breakdown: Object}} Calculated skill with breakdown
 */
export function calculateEffectiveFishingSkill({
  baseFishingSkill,
  toolBonus = 0,
  hasCorrectBait = false,
  hasInappropriateBait = false,
  targetingLargeFish = false,
  retryPenalty = 0,
  environmentMod = 0
}) {
  let baitMod = 0;
  if (hasCorrectBait) baitMod = BAIT_MODIFIERS.correctBait;
  else if (hasInappropriateBait) baitMod = BAIT_MODIFIERS.inappropriateBait;

  const largeFishPenalty = targetingLargeFish ? LARGE_FISH_TARGETING_PENALTY : 0;

  const effectiveSkill = baseFishingSkill + toolBonus + baitMod + largeFishPenalty + retryPenalty + environmentMod;

  return {
    effectiveSkill,
    breakdown: {
      base: baseFishingSkill,
      tool: toolBonus,
      bait: baitMod,
      largeFish: largeFishPenalty,
      retry: retryPenalty,
      environment: environmentMod
    }
  };
}

/**
 * Determines the dynamic event type based on a 3d6 roll
 * Used once per day per gathering group
 *
 * @param {number} roll - The 3d6 roll result
 * @returns {'rare' | 'mild' | 'none'} Event type
 */
export function determineDynamicEventType(roll) {
  const { rare, mild } = DYNAMIC_EVENT_THRESHOLDS;

  if (roll >= rare.min && roll <= rare.max) return 'rare';
  if (roll >= mild.min && roll <= mild.max) return 'mild';
  return 'none';
}

/**
 * Rolls on a catch table and returns the result
 * Handles 2d6 roll tables with weighted entries
 *
 * @param {Object} table - The catch table with entries
 * @param {Array} table.entries - Array of table entries
 * @param {string} table.rollMethod - Roll method (e.g., "2d6")
 * @param {number} [rollBonus=0] - Bonus to add to the roll (e.g., from bait)
 * @returns {Object} The selected entry result with raw roll info
 */
export function rollOnCatchTable(table, rollBonus = 0) {
  if (!table || !table.entries || table.entries.length === 0) {
    return { resultType: 'nothing', text: 'Empty table' };
  }

  // Default to 2d6 for catch tables
  const rollMethod = table.rollMethod || '2d6';
  const { total: rawTotal } = evaluateDiceFormula(rollMethod);

  // Apply roll bonus (capped at table max)
  const range = getRollMethodRange(rollMethod);
  const modifiedTotal = Math.min(range.max, rawTotal + rollBonus);

  // Find matching entry
  const entry = table.entries.find(e => e.rollValue === modifiedTotal);

  if (!entry) {
    // Fallback to closest or first entry
    return { ...table.entries[0], rawRoll: rawTotal, modifiedRoll: modifiedTotal, rollBonus };
  }

  return { ...entry, rawRoll: rawTotal, modifiedRoll: modifiedTotal, rollBonus };
}

/**
 * Helper to get roll method range
 */
function getRollMethodRange(rollMethod) {
  switch (rollMethod) {
    case '1d6': return { min: 1, max: 6 };
    case '2d6': return { min: 2, max: 12 };
    case '3d6': return { min: 3, max: 18 };
    default: return { min: 2, max: 12 };
  }
}

/**
 * Rolls on a catch table for Net fishing, rerolling large fish
 *
 * @param {Object} table - The catch table
 * @param {Array<Object>} species - Array of species definitions to check LargeFish tag
 * @returns {Object} Entry that is not a large fish
 * @throws {Error} If max reroll attempts exceeded
 */
export function rollNetCatch(table, species) {
  let attempts = 0;

  while (attempts < MAX_NET_REROLL_ATTEMPTS) {
    const entry = rollOnCatchTable(table);
    attempts++;

    // If not a species result, return it
    if (entry.resultType !== 'species') {
      return { ...entry, rerollCount: attempts - 1 };
    }

    // Check if species is large
    const speciesData = species.find(s => s.id === entry.speciesId);
    if (!speciesData || !speciesData.tags?.includes('LargeFish')) {
      return { ...entry, rerollCount: attempts - 1 };
    }

    // Large fish - reroll
  }

  throw new Error(`Net catch reroll limit (${MAX_NET_REROLL_ATTEMPTS}) exceeded. Check table configuration.`);
}

/**
 * Resolves a large fish struggle using quick contest
 * ST vs Fish ST (or Fishing vs Fish ST based on config)
 *
 * @param {number} characterST - Character's ST or Fishing skill
 * @param {number} fishST - Fish's ST (uses DEFAULT_FISH_ST if not provided)
 * @returns {Object} Struggle result
 */
export function resolveLargeFishStruggle(characterST, fishST = DEFAULT_FISH_ST) {
  const characterRoll = roll3d6();
  const fishRoll = roll3d6();

  const characterMargin = characterST - characterRoll.total;
  const fishMargin = fishST - fishRoll.total;

  const success = characterMargin > fishMargin ||
    (characterMargin === fishMargin && characterST >= fishST);

  return {
    success,
    characterRoll: characterRoll.total,
    characterMargin,
    fishRoll: fishRoll.total,
    fishMargin,
    characterST,
    fishST,
    description: success
      ? `Success! Character (${characterMargin}) beats Fish (${fishMargin})`
      : `Failed! Fish (${fishMargin}) escapes (Character: ${characterMargin})`
  };
}

/**
 * Calculates fish yields (meat and secondary materials)
 *
 * @param {Object} species - The fish species data
 * @param {string} species.yieldMeatFormula - Dice formula for meat yield
 * @param {string} species.yieldSecondaryFormula - Dice formula for secondary yield
 * @param {string} species.secondaryMaterialType - Type of secondary material
 * @returns {Object} Yield results
 */
export function calculateFishYields(species) {
  if (!species) {
    return { meatUnits: 0, secondaryUnits: 0, secondaryType: null };
  }

  const meatResult = species.yieldMeatFormula
    ? evaluateDiceFormula(species.yieldMeatFormula)
    : { total: 1 };

  const secondaryResult = species.yieldSecondaryFormula && species.secondaryMaterialType
    ? evaluateDiceFormula(species.yieldSecondaryFormula)
    : { total: 0 };

  return {
    meatUnits: Math.max(0, meatResult.total),
    meatRolls: meatResult.rolls,
    meatFormula: species.yieldMeatFormula,
    secondaryUnits: Math.max(0, secondaryResult.total),
    secondaryRolls: secondaryResult.rolls,
    secondaryFormula: species.yieldSecondaryFormula,
    secondaryType: species.secondaryMaterialType,
    foodType: species.foodType || 'fish'
  };
}

/**
 * Generates a unique group key for tracking daily events
 * Based on leader + helpers composition
 *
 * @param {string} leaderId - Leader character ID
 * @param {string[]} helperIds - Array of helper IDs
 * @returns {string} Unique group key
 */
export function generateGroupKey(leaderId, helperIds = []) {
  const sortedHelpers = [...helperIds].sort();
  return `${leaderId}:${sortedHelpers.join(',')}`;
}

/**
 * Checks if daily event has been rolled for a group on a given day
 *
 * @param {Object} dailyEventLog - Log of rolled events by day and group
 * @param {number|string} currentDay - Current campaign day
 * @param {string} groupKey - Group identifier from generateGroupKey
 * @returns {boolean} True if already rolled today
 */
export function hasDailyEventBeenRolled(dailyEventLog, currentDay, groupKey) {
  const dayKey = String(currentDay);
  return dailyEventLog?.[dayKey]?.[groupKey]?.rolled === true;
}

/**
 * Gets tools filtered by gathering mode and method
 *
 * @param {Array<Object>} tools - All available gathering tools
 * @param {string} mode - Gathering mode (e.g., "Fishing")
 * @param {string} method - Method within mode (e.g., "Line", "Net", "Spear")
 * @returns {Array<Object>} Filtered tools
 */
export function filterToolsForMethod(tools, mode, method) {
  if (!tools || !Array.isArray(tools)) return [];

  const methodConfig = FISHING_METHODS[method];
  if (!methodConfig) return [];

  return tools.filter(tool => {
    // Must include the mode
    if (!tool.allowedModes?.includes(mode)) return false;

    // If tool has specific methods, must include this method (or be empty for all)
    if (tool.allowedMethods && tool.allowedMethods.length > 0) {
      if (!tool.allowedMethods.includes(method)) return false;
    }

    // Tool type must match method's allowed types
    if (methodConfig.toolTypes && !methodConfig.toolTypes.includes(tool.toolType)) {
      return false;
    }

    return true;
  });
}

/**
 * Creates a new gathering session record
 *
 * @param {Object} params - Session parameters
 * @returns {Object} New session record
 */
export function createGatheringSession({
  mode,
  environmentId,
  method,
  leaderCharacterId,
  helperCharacterIds = [],
  intent = {},
  selectedToolIds = [],
  selectedConsumableIds = [],
  currentDay
}) {
  return {
    id: crypto.randomUUID(),
    dateKey: currentDay,
    mode,
    environmentId,
    method,
    leaderCharacterId,
    helperCharacterIds,
    intent: {
      targetedSpeciesId: intent.targetedSpeciesId || null,
      randomCatch: intent.randomCatch ?? true
    },
    selectedToolIds,
    selectedConsumableIds,
    modifiers: null, // Computed when session starts
    tablesResolved: {
      randomCatchTableId: null,
      mildEventTableId: null,
      rareEventTableId: null
    },
    dailyEvent: {
      rolled: false,
      resultType: null,
      eventEntryId: null,
      eventText: null
    },
    resolution: {
      fishingRoll: null,
      fishCaught: [],
      yields: [],
      inventoryDelta: []
    },
    committedToInventory: false,
    createdAt: new Date().toISOString()
  };
}

// ============================================================================
// FORAGING SYSTEM UTILITIES
// ============================================================================

/**
 * Calculates effective foraging skill with all modifiers
 *
 * @param {Object} params - Calculation parameters
 * @param {number} params.baseForagingSkill - Worker's base foraging skill
 * @param {number} params.toolBonus - Bonus from selected tools
 * @param {boolean} params.hasMapGuide - Whether character has map/local guide (+1)
 * @param {boolean} params.isUnfamiliar - Whether region is unfamiliar/hostile (-2)
 * @param {boolean} params.isPeakSeason - Whether it's peak season (+2)
 * @param {string} params.targetRarity - Target rarity (Common/Uncommon/Rare/VeryRare/Legendary)
 * @param {number} params.environmentMod - Environment-specific modifier
 * @returns {{effectiveSkill: number, breakdown: Object}} Calculated skill with breakdown
 */
export function calculateEffectiveForagingSkill({
  baseForagingSkill,
  toolBonus = 0,
  hasMapGuide = false,
  isUnfamiliar = false,
  isPeakSeason = false,
  targetRarity = null,
  environmentMod = 0
}) {
  let contextMod = 0;
  if (hasMapGuide) contextMod += FORAGING_CONTEXT_MODIFIERS.mapGuide.modifier;
  if (isUnfamiliar) contextMod += FORAGING_CONTEXT_MODIFIERS.unfamiliar.modifier;
  if (isPeakSeason) contextMod += FORAGING_CONTEXT_MODIFIERS.peakSeason.modifier;

  const rarityPenalty = targetRarity && FORAGING_RARITIES[targetRarity]
    ? FORAGING_RARITIES[targetRarity].penalty
    : 0;

  const effectiveSkill = baseForagingSkill + toolBonus + contextMod + rarityPenalty + environmentMod;

  return {
    effectiveSkill,
    breakdown: {
      base: baseForagingSkill,
      tool: toolBonus,
      context: contextMod,
      rarity: rarityPenalty,
      environment: environmentMod
    }
  };
}

/**
 * Evaluates a foraging roll and returns the outcome
 *
 * @param {number} roll - The 3d6 roll result
 * @param {number} effectiveSkill - Foraging skill + modifiers
 * @param {boolean} isTargeted - Whether this is a targeted search
 * @returns {Object} Outcome with yield multiplier and description
 */
export function evaluateForagingRoll(roll, effectiveSkill, isTargeted = false) {
  const margin = effectiveSkill - roll;
  const critSuccess = isCriticalSuccess(roll, effectiveSkill);
  const critFailure = isCriticalFailure(roll, effectiveSkill);
  const success = roll <= effectiveSkill && !critFailure;

  if (critFailure) {
    // Random hazard on critical failure
    const hazard = FORAGING_HAZARDS[Math.floor(Math.random() * FORAGING_HAZARDS.length)];
    return {
      outcome: 'critFailure',
      success: false,
      critFailure: true,
      critSuccess: false,
      margin,
      yieldMultiplier: FORAGING_OUTCOMES.critFailure.yieldMultiplier,
      hazard,
      randomFallback: isTargeted,
      description: FORAGING_OUTCOMES.critFailure.description + ` (${hazard})`
    };
  }

  if (critSuccess) {
    return {
      outcome: 'critSuccess',
      success: true,
      critFailure: false,
      critSuccess: true,
      margin,
      yieldMultiplier: FORAGING_OUTCOMES.critSuccess.yieldMultiplier,
      bonusFind: true,
      description: FORAGING_OUTCOMES.critSuccess.description
    };
  }

  if (success) {
    return {
      outcome: 'success',
      success: true,
      critFailure: false,
      critSuccess: false,
      margin,
      yieldMultiplier: FORAGING_OUTCOMES.success.yieldMultiplier,
      description: FORAGING_OUTCOMES.success.description
    };
  }

  return {
    outcome: 'failure',
    success: false,
    critFailure: false,
    critSuccess: false,
    margin,
    yieldMultiplier: FORAGING_OUTCOMES.failure.yieldMultiplier,
    randomFallback: isTargeted,
    description: FORAGING_OUTCOMES.failure.description
  };
}

/**
 * Determines what was found during foraging
 *
 * @param {Object} params - Find determination parameters
 * @param {Object} params.rollResult - Result from evaluateForagingRoll
 * @param {Object} params.findTable - The biome find table
 * @param {Object} params.targetCategory - Target category if targeted search
 * @param {Object} params.targetItem - Target item if targeted search
 * @returns {Object} Find result with category/item information
 */
export function determineForageFind({
  rollResult,
  findTable,
  targetCategory = null,
  targetItem = null
}) {
  // If targeted search and successful, return target
  if ((targetCategory || targetItem) && rollResult.success && !rollResult.randomFallback) {
    return {
      type: targetItem ? 'item' : 'category',
      categoryId: targetItem ? targetItem.categoryId : targetCategory?.id,
      itemId: targetItem?.id,
      category: targetCategory,
      item: targetItem,
      source: 'targeted'
    };
  }

  // Otherwise roll on random table
  if (!findTable || !findTable.entries || findTable.entries.length === 0) {
    return {
      type: 'nothing',
      source: 'random',
      text: 'No find table configured'
    };
  }

  const tableEntry = rollOnCatchTable(findTable);

  return {
    type: tableEntry.resultType,
    categoryId: tableEntry.categoryId || null,
    itemId: tableEntry.itemId || null,
    tableEntry,
    source: 'random',
    text: tableEntry.text
  };
}

/**
 * Calculates foraging yields with modifiers
 *
 * @param {Object} params - Yield calculation parameters
 * @param {Object} params.category - The foraging category
 * @param {Object} params.item - The forageable item (overrides category if present)
 * @param {number} params.yieldMultiplier - Multiplier from roll outcome (0.5, 1.0, 1.5)
 * @param {number} params.yieldDiceBonus - Bonus dice from tools/conditions (+1d, etc.)
 * @param {number} params.yieldDicePenalty - Penalty dice from conditions (-1d, etc.)
 * @returns {Object} Yield result with units
 */
export function calculateForageYields({
  category,
  item = null,
  yieldMultiplier = 1.0,
  yieldDiceBonus = 0,
  yieldDicePenalty = 0
}) {
  if (!category && !item) {
    return { units: 0, formula: null, rolls: [] };
  }

  // Use item's yield formula if present, otherwise category's
  let baseFormula = item?.yieldOverrideFormula || category?.yieldFormula || '1d';

  // Parse and modify formula with bonuses/penalties
  const parsed = parseDiceFormula(baseFormula);
  const modifiedCount = Math.max(1, parsed.count + yieldDiceBonus - yieldDicePenalty);
  const modifiedFormula = `${modifiedCount}d${parsed.sides !== 6 ? parsed.sides : ''}${parsed.modifier >= 0 ? '+' : ''}${parsed.modifier || ''}`;

  // Roll the dice
  const result = evaluateDiceFormula(modifiedFormula);

  // Apply multiplier (round down)
  const finalUnits = Math.floor(result.total * yieldMultiplier);

  return {
    units: Math.max(0, finalUnits),
    baseFormula,
    modifiedFormula,
    rolls: result.rolls,
    rawTotal: result.total,
    multiplier: yieldMultiplier,
    finalUnits
  };
}

/**
 * Gets tool yield bonuses for a specific category
 *
 * @param {Array<Object>} tools - Selected tools
 * @param {string} categoryId - Category to check for bonuses
 * @returns {number} Total yield dice bonus for this category
 */
export function getToolYieldBonus(tools, categoryId) {
  if (!tools || !Array.isArray(tools) || !categoryId) return 0;

  return tools.reduce((total, tool) => {
    if (!tool.bonuses) return total;

    const yieldBonus = tool.bonuses.find(
      b => b.type === 'yield_bonus' && b.categoryId === categoryId
    );

    return total + (yieldBonus?.dice || 0);
  }, 0);
}
