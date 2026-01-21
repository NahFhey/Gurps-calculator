/**
 * @fileoverview Task Resolution Utilities for Day Planner
 *
 * This module provides functions to resolve gathering tasks and generate
 * inventory deltas for the Day Planner system.
 */

import {
  calculateEffectiveFishingSkill,
  evaluateFishingRoll,
  rollOnCatchTable,
  calculateFishYields,
  calculateEffectiveForagingSkill,
  evaluateForagingRoll,
  determineForageFind,
  calculateForageYields,
  getToolYieldBonus,
  determineDynamicEventType
} from './gathering';

/**
 * Helper to roll on a table with manual or automatic roll
 */
function rollOnTableWithManualValue(table, manualRoll = null) {
  if (manualRoll !== null) {
    // Use manual roll - find matching entry
    const entry = table.entries?.find(e => e.rollValue === manualRoll);
    if (entry) {
      return { ...entry, rawRoll: manualRoll, modifiedRoll: manualRoll, rollBonus: 0 };
    }
    // Fallback to first entry if no match
    return { ...table.entries[0], rawRoll: manualRoll, modifiedRoll: manualRoll, rollBonus: 0 };
  }
  // Auto-roll
  return rollOnCatchTable(table);
}

/**
 * Resolves a Fishing task and generates inventory deltas
 * @param {Object} task - TaskAssignment object
 * @param {Object} leader - Worker object for the leader
 * @param {Object} environment - Environment object
 * @param {Object[]} tools - Array of selected tool objects
 * @param {Object[]} species - Array of all species
 * @param {Object[]} tables - Array of all tables
 * @param {Object} manualRolls - Manual roll values { skillRoll, eventCheckRoll, eventTableRoll, tableRoll }
 * @returns {Object} { payload, inventoryDelta, notes, warnings }
 */
export function resolveFishingTask({
  task,
  leader,
  environment,
  tools,
  species,
  tables,
  manualRolls = null
}) {
  const warnings = [];
  const notes = [];

  // Get method from task intent
  const method = task.method || 'Line';

  // Calculate tool bonus
  const toolBonus = tools.reduce((sum, tool) => {
    const skillBonus = tool.bonuses?.find(b => b.type === 'skill_bonus');
    return sum + (skillBonus?.value || 0);
  }, 0);

  // Get base fishing skill
  const baseFishingSkill = leader.skills?.fishing || 10;

  // Calculate effective skill
  const { effectiveSkill } = calculateEffectiveFishingSkill({
    baseFishingSkill,
    toolBonus,
    environmentMod: environment.skillMod || 0
  });

  // Use manual roll if provided, otherwise auto-roll
  const roll = manualRolls?.skillRoll ||
    (Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3);

  // Evaluate roll
  const rollResult = evaluateFishingRoll(roll, effectiveSkill, method);

  notes.push(`Fishing roll: ${roll} vs ${effectiveSkill} - ${rollResult.outcome}`);

  // Get catch table
  const fishingDefaults = environment.defaultsByMode?.Fishing || {};
  const catchTable = tables.find(t => t.id === fishingDefaults.randomCatchTableId);

  if (!catchTable) {
    warnings.push('No catch table configured for this environment');
    return {
      payload: { method, roll, rollResult, effectiveSkill },
      inventoryDelta: [],
      notes: notes.join('. '),
      warnings
    };
  }

  // Roll on catch table (with manual roll if provided)
  notes.push(`Rolling on table: ${catchTable.name}`);
  const tableEntry = rollOnTableWithManualValue(catchTable, manualRolls?.tableRoll);
  notes.push(`Table roll: ${tableEntry.modifiedRoll || 'unknown'} → ${tableEntry.resultType}`);

  // Check for dynamic events based on separate event check roll
  const eventCheckRoll = manualRolls?.eventCheckRoll ||
    (Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3);
  const eventType = determineDynamicEventType(eventCheckRoll);
  let eventResult = null;

  notes.push(`Event check roll: ${eventCheckRoll} → ${eventType}`);

  if (eventType !== 'none') {
    const eventTableId = eventType === 'rare'
      ? fishingDefaults.rareEventTableId
      : fishingDefaults.mildEventTableId;

    const eventTable = tables.find(t => t.id === eventTableId);

    if (eventTable) {
      eventResult = rollOnTableWithManualValue(eventTable, manualRolls?.eventTableRoll);
      notes.push(`${eventType === 'rare' ? 'Rare' : 'Mild'} event: ${eventResult.text || 'Something happened'}`);
      if (eventResult.text) {
        warnings.push(eventResult.text);
      }
    } else {
      notes.push(`${eventType === 'rare' ? 'Rare' : 'Mild'} event triggered but no table configured`);
    }
  }

  const inventoryDelta = [];

  if (tableEntry.resultType === 'species' && tableEntry.speciesId) {
    const caughtSpecies = species.find(s => s.id === tableEntry.speciesId);

    if (caughtSpecies) {
      // Calculate yields
      const yields = calculateFishYields(caughtSpecies);

      // Apply yield multiplier from roll result
      const meatUnits = Math.floor(yields.meatUnits * (rollResult.yieldMultiplier || 1.0));
      const secondaryUnits = Math.floor(yields.secondaryUnits * (rollResult.yieldMultiplier || 1.0));

      notes.push(`Caught ${caughtSpecies.name}: ${meatUnits} meat`);

      // Add to inventory delta
      inventoryDelta.push({
        type: 'food',
        speciesName: caughtSpecies.name,
        foodType: caughtSpecies.foodType || 'fish',
        units: meatUnits
      });

      // Add secondary material if any
      if (secondaryUnits > 0 && yields.secondaryType) {
        const secondaryName = caughtSpecies.secondaryNameOverride || `${caughtSpecies.name} ${yields.secondaryType}`;
        inventoryDelta.push({
          type: 'material',
          name: secondaryName,
          materialType: yields.secondaryType,
          units: secondaryUnits
        });
        notes.push(`Also collected ${secondaryUnits} ${secondaryName}`);
      }
    }
  } else if (tableEntry.resultType === 'nothing') {
    notes.push('Caught nothing');
  }

  return {
    payload: {
      method,
      roll,
      rollResult,
      effectiveSkill,
      tableEntry,
      eventCheckRoll,
      eventType,
      eventResult
    },
    inventoryDelta,
    notes: notes.join('. '),
    warnings
  };
}

/**
 * Resolves a Foraging task and generates inventory deltas
 * @param {Object} task - TaskAssignment object
 * @param {Object} leader - Worker object for the leader
 * @param {Object} environment - Environment object
 * @param {Object[]} tools - Array of selected tool objects
 * @param {Object[]} categories - Array of all foraging categories
 * @param {Object[]} items - Array of all forageable items
 * @param {Object[]} tables - Array of all tables
 * @param {Object} manualRolls - Manual roll values { skillRoll, eventCheckRoll, eventTableRoll, tableRoll }
 * @returns {Object} { payload, inventoryDelta, notes, warnings }
 */
export function resolveForagingTask({
  task,
  leader,
  environment,
  tools,
  categories,
  items,
  tables,
  manualRolls = null
}) {
  const warnings = [];
  const notes = [];

  // Get skill from task intent (default to Survival)
  const skillName = task.intent?.skill || 'Survival';
  const skillKey = skillName.toLowerCase().replace(/\s+/g, '');

  // Calculate tool bonus
  const toolBonus = tools.reduce((sum, tool) => {
    const skillBonus = tool.bonuses?.find(b => b.type === 'skill_bonus');
    return sum + (skillBonus?.value || 0);
  }, 0);

  // Get base foraging skill
  const baseForagingSkill = leader.skills?.[skillKey] || 10;

  // Get target item rarity if targeting
  const targetItem = task.intent?.targetItemId ? items.find(i => i.id === task.intent.targetItemId) : null;
  const targetRarity = targetItem?.rarity || null;

  // Calculate effective skill
  const { effectiveSkill } = calculateEffectiveForagingSkill({
    baseForagingSkill,
    toolBonus,
    environmentMod: environment.skillMod || 0,
    isUnfamiliar: task.intent?.isUnfamiliar || false,
    hasMapGuide: task.intent?.hasMapGuide || false,
    isPeakSeason: task.intent?.isPeakSeason || false,
    targetRarity
  });

  // Use manual roll if provided, otherwise auto-roll
  const roll = manualRolls?.skillRoll ||
    (Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3);

  // Evaluate roll
  const isTargeted = task.intent?.targetCategoryId || task.intent?.targetItemId;
  const rollResult = evaluateForagingRoll(roll, effectiveSkill, isTargeted);

  notes.push(`Foraging roll: ${roll} vs ${effectiveSkill} - ${rollResult.outcome}`);

  if (rollResult.hazard) {
    warnings.push(rollResult.hazard);
  }

  // Get find table
  const foragingDefaults = environment.defaultsByMode?.Foraging || {};
  const findTable = tables.find(t => t.id === foragingDefaults.randomCatchTableId);

  if (!findTable) {
    warnings.push('No find table configured for this environment');
    return {
      payload: { skill: skillName, roll, rollResult, effectiveSkill },
      inventoryDelta: [],
      notes: notes.join('. '),
      warnings
    };
  }

  notes.push(`Rolling on find table: ${findTable.name}`);

  // Check for dynamic events based on separate event check roll
  const eventCheckRoll = manualRolls?.eventCheckRoll ||
    (Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3);
  const eventType = determineDynamicEventType(eventCheckRoll);
  let eventResult = null;

  notes.push(`Event check roll: ${eventCheckRoll} → ${eventType}`);

  if (eventType !== 'none') {
    const eventTableId = eventType === 'rare'
      ? foragingDefaults.rareEventTableId
      : foragingDefaults.mildEventTableId;

    const eventTable = tables.find(t => t.id === eventTableId);

    if (eventTable) {
      eventResult = rollOnTableWithManualValue(eventTable, manualRolls?.eventTableRoll);
      notes.push(`${eventType === 'rare' ? 'Rare' : 'Mild'} event: ${eventResult.text || 'Something happened'}`);
      if (eventResult.text) {
        warnings.push(eventResult.text);
      }
    } else {
      notes.push(`${eventType === 'rare' ? 'Rare' : 'Mild'} event triggered but no table configured`);
    }
  }

  // Determine find (targetItem already declared above for rarity check)
  // Roll on find table manually if provided, otherwise determineForageFind will auto-roll
  let findResult;
  if (manualRolls?.tableRoll) {
    const tableEntry = rollOnTableWithManualValue(findTable, manualRolls.tableRoll);
    notes.push(`Find table roll: ${manualRolls.tableRoll} → ${tableEntry.resultType}`);
    findResult = {
      type: tableEntry.resultType,
      itemId: tableEntry.itemId || null,
      tableEntry,
      source: 'random',
      text: tableEntry.text
    };
  } else {
    findResult = determineForageFind({
      rollResult,
      findTable,
      targetCategory: null,
      targetItem
    });
  }

  notes.push(`Find result: ${findResult.type} (source: ${findResult.source || 'unknown'})`);

  const inventoryDelta = [];

  if (findResult.type === 'item') {
    const item = findResult.item || (findResult.itemId ? items.find(i => i.id === findResult.itemId) : null);

    if (item) {
      // Attach the full item to findResult for display later
      findResult.item = item;

      // Calculate yields using item's yield formula
      const selectedToolObjects = tools;
      const yieldDiceBonus = getToolYieldBonus(selectedToolObjects, item.typeId);

      // Ensure item has a valid yield formula
      const itemWithFormula = {
        ...item,
        yieldFormula: item.yieldFormula || '1d'
      };

      const yields = calculateForageYields({
        category: null,
        item: itemWithFormula,
        yieldMultiplier: rollResult.yieldMultiplier || 1.0,
        yieldDiceBonus,
        yieldDicePenalty: 0
      });

      // Ensure minimum 1 unit on success (when finding an actual item)
      const finalUnits = rollResult.success && yields.units === 0 ? 1 : yields.units;

      notes.push(`Found ${item.name}: ${finalUnits} units`);

      // Use item's direct inventory properties
      const inventoryKind = item.inventoryKind || 'food';
      const typeId = item.typeId || item.name.toLowerCase().replace(/\s+/g, '_');

      if (inventoryKind === 'food') {
        inventoryDelta.push({
          type: 'food',
          speciesName: item.name,
          foodType: typeId,
          units: finalUnits
        });
      } else {
        inventoryDelta.push({
          type: 'material',
          name: item.name,
          materialType: typeId,
          units: finalUnits
        });
      }
    }
  } else if (findResult.type === 'nothing') {
    notes.push('Found nothing');
  }

  return {
    payload: {
      skill: skillName,
      roll,
      rollResult,
      effectiveSkill,
      findResult,
      eventCheckRoll,
      eventType,
      eventResult
    },
    inventoryDelta,
    notes: notes.join('. '),
    warnings
  };
}

/**
 * Main task resolution dispatcher
 * @param {Object} params - Resolution parameters
 * @returns {Object} { payload, inventoryDelta, notes, warnings }
 */
export function resolveTask(params) {
  const { task } = params;

  switch (task.mode) {
    case 'Fishing':
      return resolveFishingTask(params);
    case 'Foraging':
      return resolveForagingTask(params);
    default:
      return {
        payload: null,
        inventoryDelta: [],
        notes: `Unsupported mode: ${task.mode}`,
        warnings: [`Mode ${task.mode} is not yet implemented`]
      };
  }
}
