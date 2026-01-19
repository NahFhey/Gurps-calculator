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
  getToolYieldBonus
} from './gathering';

/**
 * Resolves a Fishing task and generates inventory deltas
 * @param {Object} task - TaskAssignment object
 * @param {Object} leader - Worker object for the leader
 * @param {Object} environment - Environment object
 * @param {Object[]} tools - Array of selected tool objects
 * @param {Object[]} species - Array of all species
 * @param {Object[]} tables - Array of all tables
 * @returns {Object} { payload, inventoryDelta, notes, warnings }
 */
export function resolveFishingTask({
  task,
  leader,
  environment,
  tools,
  species,
  tables
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

  // Roll 3d6 for fishing attempt
  const roll = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3;

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

  // Roll on catch table
  const tableEntry = rollOnCatchTable(catchTable);

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
      tableEntry
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
 * @returns {Object} { payload, inventoryDelta, notes, warnings }
 */
export function resolveForagingTask({
  task,
  leader,
  environment,
  tools,
  categories,
  items,
  tables
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

  // Calculate effective skill
  const { effectiveSkill } = calculateEffectiveForagingSkill({
    baseForagingSkill,
    toolBonus,
    environmentMod: environment.skillMod || 0,
    isUnfamiliar: task.intent?.isUnfamiliar || false,
    hasMapGuide: task.intent?.hasMapGuide || false,
    isPeakSeason: task.intent?.isPeakSeason || false,
    targetRarity: task.intent?.targetRarity || null
  });

  // Roll 3d6 for foraging attempt
  const roll = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3;

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

  // Determine find
  const targetCategory = task.intent?.targetCategoryId
    ? categories.find(c => c.id === task.intent.targetCategoryId)
    : null;
  const targetItem = task.intent?.targetItemId
    ? items.find(i => i.id === task.intent.targetItemId)
    : null;

  const findResult = determineForageFind({
    rollResult,
    findTable,
    targetCategory,
    targetItem
  });

  const inventoryDelta = [];

  if (findResult.type === 'category' || findResult.type === 'item') {
    const category = findResult.category || categories.find(c => c.id === findResult.categoryId);
    const item = findResult.item || (findResult.itemId ? items.find(i => i.id === findResult.itemId) : null);

    if (category) {
      // Calculate yields
      const selectedToolObjects = tools;
      const yieldDiceBonus = getToolYieldBonus(selectedToolObjects, category.id);

      const yields = calculateForageYields({
        category,
        item,
        yieldMultiplier: rollResult.yieldMultiplier || 1.0,
        yieldDiceBonus,
        yieldDicePenalty: 0
      });

      const itemName = item?.name || category.name;
      notes.push(`Found ${itemName}: ${yields.units} units`);

      // Determine inventory kind and type
      const inventoryKind = category.inventoryOutput?.inventoryKind || 'food';
      const typeId = category.inventoryOutput?.typeId || category.name.toLowerCase().replace(/\s+/g, '_');

      if (inventoryKind === 'food') {
        inventoryDelta.push({
          type: 'food',
          speciesName: itemName,
          foodType: typeId,
          units: yields.units
        });
      } else {
        inventoryDelta.push({
          type: 'material',
          name: itemName,
          materialType: typeId,
          units: yields.units
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
      findResult
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
