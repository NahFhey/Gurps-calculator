/**
 * Data Migration Script
 * Converts legacy localStorage (42 keys) to unified CampaignState (1 key)
 */

import { createCampaignState } from '../state/campaignReducer';
import type { CampaignState } from '../state/campaignReducer';
import {
  normalizeArray,
  mergeCharacters,
  createPartyInventory,
  createCharacterInventories,
  ensureIds
} from '../state/campaignUtils';
import type { Id } from '../types/campaign';

// Legacy localStorage keys to migrate
const LEGACY_KEYS = [
  'materials',
  'foods',
  'recipes',
  'foodTypes',
  'materialTypes',
  'crafts',
  'craftDesigns',
  'customTemplates',
  'workers',
  'alchemyReagents',
  'alchemyFormulas',
  'alchemyBatches',
  'alchemyLabs',
  'alchemySettings',
  'kitchens',
  'cookingSkills',
  'effectFamilyMap',
  'gatheringSpecies',
  'gatheringTools',
  'gatheringTables',
  'gatheringEnvironments',
  'gatheringSessions',
  'gatheringDailyEvents',
  'gatheringBait',
  'gatheringCategories',
  'gatheringItems',
  'currentDay',
  'timeSlots',
  'taskAssignments',
  'pendingDayLedger',
  'currentSlot',
  'combatCharacters',
  'combatActive',
  'combatActiveHistory',
  'combatHistory',
  'combatTombstones',
  'combatRulesPreset',
  'combatReveal',
  'combatItems'
] as const;

const NEW_KEY = 'campaignState';
const BACKUP_KEY = 'campaignState_backup_v1';

/**
 * Check if migration is needed
 * Returns true if legacy data exists but no new campaignState
 */
export async function checkMigrationNeeded(): Promise<boolean> {
  if (!window?.storage?.get) {
    return false;
  }

  try {
    // Check if new state already exists
    const newState = await window.storage.get(NEW_KEY, true);
    if (newState) {
      console.log('[Migration] CampaignState already exists, no migration needed');
      return false;
    }

    // Check if any legacy data exists
    const hasLegacyData = await Promise.all(
      LEGACY_KEYS.slice(0, 5).map(async (key) => {
        const data = await window.storage.get(key, true).catch(() => null);
        return data !== null && data !== undefined;
      })
    );

    const needsMigration = hasLegacyData.some((exists) => exists);

    if (needsMigration) {
      console.log('[Migration] Legacy data detected, migration required');
    } else {
      console.log('[Migration] No legacy data found, fresh start');
    }

    return needsMigration;
  } catch (error) {
    console.error('[Migration] Error checking migration status:', error);
    return false;
  }
}

/**
 * Main migration function
 * Converts all legacy localStorage to unified CampaignState
 */
export async function migrateToV2(): Promise<CampaignState | null> {
  if (!window?.storage?.get || !window?.storage?.set) {
    console.error('[Migration] Storage not available');
    return null;
  }

  console.log('[Migration] Starting migration to CampaignState v2.0...');

  try {
    // Step 1: Load all legacy data
    console.log('[Migration] Step 1/7: Loading legacy data...');
    const legacyData = await loadLegacyData();

    // Step 2: Create base campaign state
    console.log('[Migration] Step 2/7: Creating base campaign state...');
    const campaignState = createCampaignState({});

    // Step 3: Migrate entities
    console.log('[Migration] Step 3/7: Migrating entities...');
    migrateEntities(campaignState, legacyData);

    // Step 4: Migrate time & day planner
    console.log('[Migration] Step 4/7: Migrating time system...');
    migrateTime(campaignState, legacyData);

    // Step 5: Migrate combat state
    console.log('[Migration] Step 5/7: Migrating combat system...');
    migrateCombat(campaignState, legacyData);

    // Step 6: Create backup of legacy data
    console.log('[Migration] Step 6/7: Creating backup...');
    await createBackup(legacyData);

    // Step 7: Save new campaign state
    console.log('[Migration] Step 7/7: Saving new campaign state...');
    await window.storage.set(NEW_KEY, campaignState);

    console.log('[Migration] ✅ Migration complete!');
    console.log('[Migration] Backup saved to:', BACKUP_KEY);

    return campaignState;
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    return null;
  }
}

/**
 * Load all legacy data from localStorage
 */
async function loadLegacyData(): Promise<Record<string, any>> {
  const data: Record<string, any> = {};

  for (const key of LEGACY_KEYS) {
    try {
      const value = await window.storage.get(key, true);
      if (value !== null && value !== undefined) {
        data[key] = value;
        console.log(`[Migration] Loaded ${key}:`, Array.isArray(value) ? `${value.length} items` : typeof value);
      }
    } catch (error) {
      console.warn(`[Migration] Failed to load ${key}:`, error);
      data[key] = getDefaultValue(key);
    }
  }

  return data;
}

/**
 * Get default value for a legacy key
 */
function getDefaultValue(key: string): any {
  if (key === 'foodTypes') {
    return [
      { name: 'fish', color: '#60A5FA' },
      { name: 'poultry', color: '#F59E0B' },
      { name: 'meat', color: '#EF4444' },
      { name: 'fruit', color: '#EC4899' },
      { name: 'vegetable', color: '#10B981' }
    ];
  }
  if (key === 'materialTypes') {
    return [
      { name: 'wood', difficulty: -2, effects: '', ht: 10, drShift: 0, weightMod: -10, hpMod: 0 },
      { name: 'metal', difficulty: 0, effects: '', ht: 12, drShift: 0, weightMod: 0, hpMod: 0 },
      { name: 'leather', difficulty: -1, effects: '', ht: 8, drShift: 0, weightMod: -20, hpMod: -10 },
      { name: 'cloth', difficulty: -1, effects: '', ht: 6, drShift: 0, weightMod: -30, hpMod: -20 },
      { name: 'stone', difficulty: 1, effects: '', ht: 14, drShift: 0, weightMod: 50, hpMod: 10 }
    ];
  }
  if (key === 'customTemplates') {
    return { weapons: {}, armor: {}, ranged: {}, explosives: {} };
  }
  if (key === 'alchemySettings') {
    return { defaultLabRating: 0, workBlockMinutes: 120 };
  }
  if (key === 'currentDay') {
    return 1;
  }
  if (key === 'currentSlot') {
    return 0;
  }
  if (key === 'combatRulesPreset') {
    return 'standard';
  }
  if (key === 'gatheringDailyEvents') {
    return {};
  }
  if (key === 'effectFamilyMap') {
    return {};
  }

  // Default to array for most keys
  return [];
}

/**
 * Migrate all entities to normalized format
 */
function migrateEntities(state: CampaignState, legacy: Record<string, any>): void {
  // Characters (merge workers with party tool characters)
  const workers = legacy.workers || [];
  state.entities.characters = mergeCharacters(workers, state.entities.characters);
  console.log(`[Migration] Migrated ${Object.keys(state.entities.characters).length} characters`);

  // Materials
  const materials = ensureIds(legacy.materials || []);
  state.entities.materials = normalizeArray(materials);
  console.log(`[Migration] Migrated ${materials.length} materials`);

  // Foods
  const foods = ensureIds(legacy.foods || []);
  state.entities.foods = normalizeArray(foods);
  console.log(`[Migration] Migrated ${foods.length} foods`);

  // Recipes
  const recipes = ensureIds(legacy.recipes || []);
  state.entities.recipes = normalizeArray(recipes);
  console.log(`[Migration] Migrated ${recipes.length} recipes`);

  // Food Types & Material Types (already arrays)
  state.entities.foodTypes = legacy.foodTypes || getDefaultValue('foodTypes');
  state.entities.materialTypes = legacy.materialTypes || getDefaultValue('materialTypes');

  // Crafts
  const crafts = ensureIds(legacy.crafts || []);
  state.entities.crafts = normalizeArray(crafts);
  console.log(`[Migration] Migrated ${crafts.length} crafts`);

  // Craft Designs
  const craftDesigns = ensureIds(legacy.craftDesigns || []);
  state.entities.craftDesigns = normalizeArray(craftDesigns);
  console.log(`[Migration] Migrated ${craftDesigns.length} craft designs`);

  // Custom Templates
  state.entities.customTemplates = legacy.customTemplates || getDefaultValue('customTemplates');

  // Alchemy
  const alchemyReagents = ensureIds(legacy.alchemyReagents || []);
  state.entities.alchemyReagents = normalizeArray(alchemyReagents);
  const alchemyFormulas = ensureIds(legacy.alchemyFormulas || []);
  state.entities.alchemyFormulas = normalizeArray(alchemyFormulas);
  const alchemyBatches = ensureIds(legacy.alchemyBatches || []);
  state.entities.alchemyBatches = normalizeArray(alchemyBatches);
  const alchemyLabs = ensureIds(legacy.alchemyLabs || []);
  state.entities.alchemyLabs = normalizeArray(alchemyLabs);
  state.entities.alchemySettings = legacy.alchemySettings || getDefaultValue('alchemySettings');
  console.log(`[Migration] Migrated alchemy: ${alchemyReagents.length} reagents, ${alchemyFormulas.length} formulas, ${alchemyBatches.length} batches`);

  // Gathering
  const gatheringSpecies = ensureIds(legacy.gatheringSpecies || []);
  state.entities.gatheringSpecies = normalizeArray(gatheringSpecies);
  const gatheringTools = ensureIds(legacy.gatheringTools || []);
  state.entities.gatheringTools = normalizeArray(gatheringTools);
  const gatheringTables = ensureIds(legacy.gatheringTables || []);
  state.entities.gatheringTables = normalizeArray(gatheringTables);
  const gatheringEnvironments = ensureIds(legacy.gatheringEnvironments || []);
  state.entities.gatheringEnvironments = normalizeArray(gatheringEnvironments);
  const gatheringSessions = ensureIds(legacy.gatheringSessions || []);
  state.entities.gatheringSessions = normalizeArray(gatheringSessions);
  const gatheringBait = ensureIds(legacy.gatheringBait || []);
  state.entities.gatheringBait = normalizeArray(gatheringBait);
  const gatheringCategories = ensureIds(legacy.gatheringCategories || []);
  state.entities.gatheringCategories = normalizeArray(gatheringCategories);
  const gatheringItems = ensureIds(legacy.gatheringItems || []);
  state.entities.gatheringItems = normalizeArray(gatheringItems);
  state.entities.gatheringDailyEvents = legacy.gatheringDailyEvents || {};
  console.log(`[Migration] Migrated gathering: ${gatheringSpecies.length} species, ${gatheringSessions.length} sessions`);

  // Combat
  const combatCharacters = ensureIds(legacy.combatCharacters || []);
  state.entities.combatCharacters = normalizeArray(combatCharacters);
  const combatItems = ensureIds(legacy.combatItems || []);
  state.entities.combatItems = normalizeArray(combatItems);
  state.entities.combatHistory = legacy.combatHistory || [];
  state.entities.combatTombstones = legacy.combatTombstones || [];
  console.log(`[Migration] Migrated combat: ${combatCharacters.length} characters, ${state.entities.combatHistory.length} history`);

  // Config/Facilities
  const kitchens = ensureIds(legacy.kitchens || [{ id: 'default', name: 'Basic Kitchen', rating: 0, description: 'Standard cooking area' }]);
  state.entities.kitchens = normalizeArray(kitchens);
  state.entities.cookingSkills = legacy.cookingSkills || [];
  state.entities.effectFamilyMap = legacy.effectFamilyMap || {};

  // Create unified inventories
  const partyInventory = createPartyInventory(materials, foods);
  const characterInventories = createCharacterInventories(state.entities.characters);

  state.entities.inventories = {
    ...state.entities.inventories, // Keep Party Tool inventories
    party: partyInventory,
    ...characterInventories
  };
  console.log(`[Migration] Created ${Object.keys(state.entities.inventories).length} inventories`);
}

/**
 * Migrate time and day planner data
 */
function migrateTime(state: CampaignState, legacy: Record<string, any>): void {
  const currentDay = legacy.currentDay || 1;
  const currentSlot = legacy.currentSlot || 0;

  state.time.day = currentDay;
  state.time.slot = currentSlot;

  // Day planner
  state.dayPlanner.timeSlots = legacy.timeSlots || [];
  state.dayPlanner.taskAssignments = legacy.taskAssignments || [];
  state.dayPlanner.pendingDayLedger = legacy.pendingDayLedger || null;
  state.dayPlanner.currentSlot = currentSlot;

  console.log(`[Migration] Migrated time: Day ${currentDay}, Slot ${currentSlot}`);
}

/**
 * Migrate combat system data
 */
function migrateCombat(state: CampaignState, legacy: Record<string, any>): void {
  const combatActive = legacy.combatActive;
  const combatRulesPreset = legacy.combatRulesPreset || 'standard';
  const combatReveal = legacy.combatReveal;

  if (combatActive) {
    state.combat.active = true;
    state.combat.activeSession = combatActive;
  }

  state.combat.rulesPreset = combatRulesPreset;

  if (combatReveal) {
    state.combat.reveal = {
      revealedTargets: new Set(combatReveal.revealedTargets || []),
      revealedHP: new Set(combatReveal.revealedHP || []),
      revealedDefenseValues: combatReveal.revealedDefenseValues || {}
    };
  }

  console.log('[Migration] Migrated combat state');
}

/**
 * Create backup of all legacy data
 */
async function createBackup(legacyData: Record<string, any>): Promise<void> {
  const backup = {
    timestamp: Date.now(),
    version: '1.0.0',
    data: legacyData
  };

  await window.storage.set(BACKUP_KEY, backup);
  console.log('[Migration] Backup created with', Object.keys(legacyData).length, 'keys');
}

/**
 * Rollback migration (restore from backup)
 */
export async function rollbackMigration(): Promise<boolean> {
  if (!window?.storage?.get || !window?.storage?.set) {
    console.error('[Migration] Storage not available');
    return false;
  }

  try {
    console.log('[Migration] Rolling back to legacy data...');

    // Load backup
    const backup = await window.storage.get(BACKUP_KEY, true);
    if (!backup || !backup.data) {
      console.error('[Migration] No backup found');
      return false;
    }

    // Restore all legacy keys
    for (const [key, value] of Object.entries(backup.data)) {
      await window.storage.set(key, value);
    }

    // Remove new campaign state
    await window.storage.remove(NEW_KEY);

    console.log('[Migration] ✅ Rollback complete');
    return true;
  } catch (error) {
    console.error('[Migration] ❌ Rollback failed:', error);
    return false;
  }
}

/**
 * Clean up old legacy keys (optional - use after confirming migration worked)
 */
export async function cleanupLegacyData(): Promise<void> {
  if (!window?.storage?.remove) {
    console.error('[Migration] Storage not available');
    return;
  }

  console.log('[Migration] Cleaning up legacy data...');

  for (const key of LEGACY_KEYS) {
    try {
      await window.storage.remove(key);
    } catch (error) {
      console.warn(`[Migration] Failed to remove ${key}:`, error);
    }
  }

  console.log('[Migration] ✅ Cleanup complete');
}
