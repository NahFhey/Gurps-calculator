/**
 * Data Migration Script
 * Converts legacy localStorage (42 keys) to unified CampaignState (1 key)
 */

import { createCampaignState } from '../state/campaignReducer';
import type { CampaignState } from '../state/campaignReducer';
import { CHARACTER_TEMPLATE_SEEDS } from '../constants/characterTemplateSeeds';
import { VEHICLE_TYPE_SEEDS } from '../constants/vehicleSeeds';
import { safeDeepClone } from '../utils/helpers';
import {
  normalizeArray,
  mergeCharacters,
  createPartyInventory,
  createCharacterInventories,
  ensureIds
} from '../state/campaignUtils';
import { ensureParticipantConditionVisibility } from '../utils/conditionsEngine';
import { deriveCombatCategory } from '../utils/combatHelpers';
import { isLegacyCombatSession, upgradeCombatHistory } from '../utils/legacyCombatHistory';
import type { Id, Material, Food, Recipe, Craft, CraftDesign, AlchemyReagent, AlchemyFormula, AlchemyBatch, AlchemyLab, GatheringSpecies, GatheringTool, GatheringTable, GatheringEnvironment, GatheringSession, GatheringBait, GatheringCategory, GatheringItem, CombatCharacter, CombatItem, Kitchen, Inventory } from '../types/campaign';
import type { TravelGroup } from '../types/party';
import type { ActiveWeather, Location } from '../types/location';
import { DEFAULT_CALENDAR } from '../utils/timeSystem';

/** Clean Phase 14 location links and attachment references after hydration. */
export function ensureLocationIntegrity(state: CampaignState): CampaignState {
  let locationsChanged = false;
  const locations = { ...state.locations.locations };
  for (const [id, location] of Object.entries(locations)) {
    const legacy = location as Location & Record<string, unknown>;
    // Legacy key is intentionally a plain string literal: the field was removed in 1.5.8.
    if (Object.prototype.hasOwnProperty.call(legacy, 'connections')) {
      const cleaned = { ...legacy };
      delete cleaned['connections'];
      locations[id] = cleaned as Location;
      locationsChanged = true;
    }
  }

  const locationIds = new Set(Object.keys(locations));
  const vehicleIds = new Set(Object.keys(state.entities.vehicles ?? {}));
  const isDanglingAttachment = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const attachment = value as Record<string, unknown>;
    return attachment.kind === 'location'
      ? typeof attachment.locationId !== 'string' || !locationIds.has(attachment.locationId)
      : attachment.kind === 'vehicle'
        ? typeof attachment.vehicleId !== 'string' || !vehicleIds.has(attachment.vehicleId)
        : false;
  };

  let mapsChanged = false;
  const mapsById = { ...state.maps.mapsById };
  for (const [mapId, map] of Object.entries(mapsById)) {
    let markersChanged = false;
    const markersById = { ...map.markersById };
    for (const [markerId, marker] of Object.entries(markersById)) {
      if (marker.locationId && !locationIds.has(marker.locationId)) {
        const { locationId: _locationId, ...cleaned } = marker;
        markersById[markerId] = cleaned;
        markersChanged = true;
      }
    }
    if (markersChanged) {
      mapsById[mapId] = { ...map, markersById };
      mapsChanged = true;
    }
  }

  let entitiesChanged = false;
  const cleanRegistry = <T extends { attachment?: unknown }>(registry: Record<Id, T>): Record<Id, T> => {
    let registryChanged = false;
    const next = { ...registry };
    for (const [id, entity] of Object.entries(next)) {
      if (isDanglingAttachment(entity.attachment)) {
        const { attachment: _attachment, ...cleaned } = entity;
        next[id] = cleaned as T;
        registryChanged = true;
      }
    }
    if (registryChanged) entitiesChanged = true;
    return registryChanged ? next : registry;
  };
  const facilities = cleanRegistry(state.entities.facilities);
  const kitchens = cleanRegistry(state.entities.kitchens);
  const alchemyLabs = cleanRegistry(state.entities.alchemyLabs);

  if (!locationsChanged && !mapsChanged && !entitiesChanged) return state;
  return {
    ...state,
    locations: locationsChanged ? { ...state.locations, locations } : state.locations,
    maps: mapsChanged ? { ...state.maps, mapsById } : state.maps,
    entities: entitiesChanged
      ? { ...state.entities, facilities, kitchens, alchemyLabs }
      : state.entities,
  };
}

/** Move legacy location weather to maps and fill Phase 14 ambient defaults. */
export function ensureAmbientWeather(state: CampaignState): CampaignState {
  let mapsChanged = false;
  let locationsChanged = false;
  const mapsById = { ...state.maps.mapsById };
  const locations = { ...state.locations.locations };
  const requestedMapId = state.maps.activeMapId;
  const activeMapId = requestedMapId && mapsById[requestedMapId]
    ? requestedMapId
    : Object.keys(mapsById)[0] ?? null;
  const activeLocation = state.locations.currentLocationId
    ? locations[state.locations.currentLocationId]
    : undefined;
  // Legacy keys are intentionally plain string literals for migration honesty.
  const legacyActive = activeLocation as (Location & Record<string, unknown>) | undefined;
  const inheritedWeather = legacyActive?.['currentWeather'];

  for (const [mapId, map] of Object.entries(mapsById)) {
    let nextMap = map;
    if (!map.climate) {
      nextMap = { ...nextMap, climate: 'temperate' };
    }
    if (mapId === activeMapId && !map.currentWeather && inheritedWeather && typeof inheritedWeather === 'object') {
      nextMap = { ...nextMap, currentWeather: inheritedWeather as ActiveWeather };
    }
    if (nextMap !== map) {
      mapsById[mapId] = nextMap;
      mapsChanged = true;
    }
  }

  for (const [locationId, location] of Object.entries(locations)) {
    const legacy = location as Location & Record<string, unknown>;
    // Legacy keys are intentionally plain string literals for migration honesty.
    if (Object.prototype.hasOwnProperty.call(legacy, 'currentWeather')
      || Object.prototype.hasOwnProperty.call(legacy, 'weatherTableId')) {
      const cleaned = { ...legacy };
      delete cleaned['currentWeather'];
      delete cleaned['weatherTableId'];
      locations[locationId] = cleaned as Location;
      locationsChanged = true;
    }
  }

  const calendarChanged = state.time.calendar === undefined;
  if (!mapsChanged && !locationsChanged && !calendarChanged) return state;
  return {
    ...state,
    maps: mapsChanged ? { ...state.maps, mapsById } : state.maps,
    locations: locationsChanged ? { ...state.locations, locations } : state.locations,
    time: calendarChanged ? { ...state.time, calendar: DEFAULT_CALENDAR } : state.time,
  };
}

/** Seed missing built-in character templates while honoring persisted deletions and edits. */
export function ensureCharacterTemplates(state: CampaignState): CampaignState {
  const templates = { ...(state.entities.characterTemplates ?? {}) };
  const deleted = new Set(state.entities.deletedBuiltinTemplateIds ?? []);
  let changed = state.entities.characterTemplates === undefined || state.entities.deletedBuiltinTemplateIds === undefined;
  for (const seed of CHARACTER_TEMPLATE_SEEDS) {
    if (!templates[seed.id] && !deleted.has(seed.id)) {
      templates[seed.id] = safeDeepClone(seed);
      changed = true;
    }
  }
  if (!changed) return state;
  return {
    ...state,
    entities: {
      ...state.entities,
      characterTemplates: templates,
      deletedBuiltinTemplateIds: [...deleted],
    },
  };
}

/** Repair travel membership and seed vehicle catalogs after hydration. */
export function ensureTravelGroups(state: CampaignState): CampaignState {
  const originalGroups = state.entities.travelGroups;
  const groups: Record<Id, TravelGroup> = {};
  let changed = originalGroups === undefined
    || state.entities.vehicles === undefined
    || state.entities.vehicleTypes === undefined;

  for (const [id, group] of Object.entries(originalGroups ?? {})) {
    groups[id] = group;
  }
  if (Object.keys(groups).length === 0) {
    const id = 'travel-group-main';
    groups[id] = {
      id,
      name: 'The Party',
      memberIds: [],
      vehicleId: null,
      position: null,
    };
    changed = true;
  }

  const seen = new Set<Id>();
  for (const group of Object.values(groups)) {
    const memberIds = group.memberIds.filter((id) => {
      if (!state.entities.characters[id] || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (memberIds.length !== group.memberIds.length
      || memberIds.some((id, index) => id !== group.memberIds[index])) {
      groups[group.id] = { ...group, memberIds };
      changed = true;
    }
  }
  const firstGroup = Object.values(groups)[0];
  const strays = Object.keys(state.entities.characters).filter((id) => !seen.has(id));
  if (strays.length > 0) {
    const repairedFirst = groups[firstGroup.id];
    groups[firstGroup.id] = {
      ...repairedFirst,
      memberIds: [...repairedFirst.memberIds, ...strays],
    };
    changed = true;
  }

  const vehicleTypes = { ...(state.entities.vehicleTypes ?? {}) };
  const deleted = new Set(state.entities.deletedBuiltinVehicleTypeIds ?? []);
  for (const seed of VEHICLE_TYPE_SEEDS) {
    if (!vehicleTypes[seed.id] && !deleted.has(seed.id)) {
      vehicleTypes[seed.id] = safeDeepClone(seed);
      changed = true;
    }
  }

  const activeId = state.ui.activeTravelGroupId;
  const activeTravelGroupId = activeId && groups[activeId] ? activeId : Object.keys(groups)[0];
  if (activeTravelGroupId !== activeId) changed = true;
  if (!changed) return state;
  return {
    ...state,
    ui: { ...state.ui, activeTravelGroupId },
    entities: {
      ...state.entities,
      travelGroups: groups,
      vehicles: state.entities.vehicles ?? {},
      vehicleTypes,
    },
  };
}

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
        const data = await window.storage?.get(key, true).catch(() => null);
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
    await window.storage?.set(NEW_KEY, JSON.stringify(campaignState));

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
      const value = await window.storage?.get(key, true);
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
  // Handle workers being either an array or an object (Record<Id, Worker>)
  let workers = legacy.workers || [];
  if (workers && !Array.isArray(workers)) {
    // Convert object to array
    workers = Object.values(workers);
  }
  state.entities.characters = mergeCharacters(workers, state.entities.characters);
  console.log(`[Migration] Migrated ${Object.keys(state.entities.characters).length} characters`);

  // Materials and foods become authoritative party holdings.
  const materials = ensureIds(legacy.materials || []);
  const foods = ensureIds(legacy.foods || []);
  console.log(`[Migration] Migrated ${materials.length} materials`);
  console.log(`[Migration] Migrated ${foods.length} foods`);

  // Recipes
  const recipes = ensureIds(legacy.recipes || []);
  state.entities.recipes = normalizeArray(recipes) as Record<Id, Recipe>;
  console.log(`[Migration] Migrated ${recipes.length} recipes`);

  // Food Types & Material Types (already arrays)
  state.entities.foodTypes = legacy.foodTypes || getDefaultValue('foodTypes');
  state.entities.materialTypes = legacy.materialTypes || getDefaultValue('materialTypes');

  // Crafts
  const crafts = ensureIds(legacy.crafts || []);
  state.entities.crafts = normalizeArray(crafts) as Record<Id, Craft>;
  console.log(`[Migration] Migrated ${crafts.length} crafts`);

  // Craft Designs
  const craftDesigns = ensureIds(legacy.craftDesigns || []);
  state.entities.craftDesigns = normalizeArray(craftDesigns) as Record<Id, CraftDesign>;
  console.log(`[Migration] Migrated ${craftDesigns.length} craft designs`);

  // Custom Templates
  state.entities.customTemplates = legacy.customTemplates || getDefaultValue('customTemplates');

  // Alchemy
  const alchemyReagents = ensureIds(legacy.alchemyReagents || []);
  state.entities.alchemyReagents = normalizeArray(alchemyReagents) as Record<Id, AlchemyReagent>;
  const alchemyFormulas = ensureIds(legacy.alchemyFormulas || []);
  state.entities.alchemyFormulas = normalizeArray(alchemyFormulas) as Record<Id, AlchemyFormula>;
  const alchemyBatches = ensureIds(legacy.alchemyBatches || []);
  state.entities.alchemyBatches = normalizeArray(alchemyBatches) as Record<Id, AlchemyBatch>;
  const alchemyLabs = ensureIds(legacy.alchemyLabs || []);
  state.entities.alchemyLabs = normalizeArray(alchemyLabs) as Record<Id, AlchemyLab>;
  state.entities.alchemySettings = legacy.alchemySettings || getDefaultValue('alchemySettings');
  console.log(`[Migration] Migrated alchemy: ${alchemyReagents.length} reagents, ${alchemyFormulas.length} formulas, ${alchemyBatches.length} batches`);

  // Gathering
  const gatheringSpecies = ensureIds(legacy.gatheringSpecies || []);
  state.entities.gatheringSpecies = normalizeArray(gatheringSpecies) as Record<Id, GatheringSpecies>;
  const gatheringTools = ensureIds(legacy.gatheringTools || []);
  state.entities.gatheringTools = normalizeArray(gatheringTools) as Record<Id, GatheringTool>;
  const gatheringTables = ensureIds(legacy.gatheringTables || []);
  state.entities.gatheringTables = normalizeArray(gatheringTables) as Record<Id, GatheringTable>;
  const gatheringEnvironments = ensureIds(legacy.gatheringEnvironments || []);
  state.entities.gatheringEnvironments = normalizeArray(gatheringEnvironments) as Record<Id, GatheringEnvironment>;
  const gatheringSessions = ensureIds(legacy.gatheringSessions || []);
  state.entities.gatheringSessions = normalizeArray(gatheringSessions) as Record<Id, GatheringSession>;
  const gatheringBait = ensureIds(legacy.gatheringBait || []);
  state.entities.gatheringBait = normalizeArray(gatheringBait) as Record<Id, GatheringBait>;
  const gatheringCategories = ensureIds(legacy.gatheringCategories || []);
  state.entities.gatheringCategories = normalizeArray(gatheringCategories) as Record<Id, GatheringCategory>;
  const gatheringItems = ensureIds(legacy.gatheringItems || []);
  state.entities.gatheringItems = normalizeArray(gatheringItems) as Record<Id, GatheringItem>;
  state.entities.gatheringDailyEvents = legacy.gatheringDailyEvents || {};
  console.log(`[Migration] Migrated gathering: ${gatheringSpecies.length} species, ${gatheringSessions.length} sessions`);

  // Combat
  const combatCharacters = ensureIds(legacy.combatCharacters || []);
  state.entities.combatCharacters = normalizeArray(combatCharacters) as Record<Id, CombatCharacter>;
  const combatItems = ensureIds(legacy.combatItems || []);
  state.entities.combatItems = normalizeArray(combatItems) as Record<Id, CombatItem>;
  state.entities.combatHistory = upgradeCombatHistory(legacy.combatHistory || []);
  state.entities.combatTombstones = legacy.combatTombstones || [];
  console.log(`[Migration] Migrated combat: ${combatCharacters.length} characters, ${state.entities.combatHistory.length} history`);

  // Config/Facilities
  const kitchens = ensureIds(legacy.kitchens || [{ id: 'default', name: 'Basic Kitchen', rating: 0, description: 'Standard cooking area' }]);
  state.entities.kitchens = normalizeArray(kitchens) as Record<Id, Kitchen>;
  state.entities.cookingSkills = legacy.cookingSkills || [];
  state.entities.effectFamilyMap = legacy.effectFamilyMap || {};

  // Create unified inventories
  const partyInventory = createPartyInventory(
    [],
    []
  );
  partyInventory.materials = materials as Material[];
  partyInventory.food = foods as Food[];
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
  const backup: Record<string, unknown> = {
    timestamp: Date.now(),
    version: '1.0.0',
    data: legacyData
  };

  await window.storage?.set(BACKUP_KEY, JSON.stringify(backup));
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
    const backup = await window.storage?.get(BACKUP_KEY, true);
    if (!backup || typeof backup !== 'object' || !('data' in backup)) {
      console.error('[Migration] No backup found');
      return false;
    }

    // Restore all legacy keys
    const backupData = (backup as Record<string, unknown>).data as Record<string, unknown>;
    for (const [key, value] of Object.entries(backupData)) {
      await window.storage?.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }

    // Remove new campaign state
    await window.storage?.remove(NEW_KEY);

    console.log('[Migration] ✅ Rollback complete');
    return true;
  } catch (error) {
    console.error('[Migration] ❌ Rollback failed:', error);
    return false;
  }
}

/**
 * Schema 1.4.0 (Phase 12a.5): guarantee owner Inventory records exist.
 *
 * Ownership in this codebase lives on Inventory records (ownerType/ownerId),
 * not as a per-item field, so the 12a.5 "owner backfill" is record-existence:
 * one party record plus one record per character. Items already inside a
 * record keep their owner. Pure and idempotent — safe to run on every load.
 */
export function ensureInventoryRecords(state: CampaignState): CampaignState {
  const inventories: Record<Id, Inventory> = { ...state.entities.inventories };
  const existing = Object.values(inventories);
  let changed = false;

  const emptyRecord = (id: Id, ownerType: Inventory['ownerType'], ownerId: Id | null): Inventory => ({
    id,
    ownerType,
    ownerId,
    currency: {},
    items: [],
    tools: [],
    materials: [],
    food: []
  });

  if (!existing.some((inv) => inv.ownerType === 'party')) {
    inventories['party'] = emptyRecord('party', 'party', null);
    changed = true;
  }

  for (const character of Object.values(state.entities.characters)) {
    const hasRecord = existing.some(
      (inv) => inv.ownerType === 'character' && inv.ownerId === character.id
    );
    if (!hasRecord) {
      const id = inventories[character.id] ? `inv-${character.id}` : character.id;
      inventories[id] = emptyRecord(id, 'character', character.id);
      changed = true;
    }
  }

  if (!changed) return state;
  return {
    ...state,
    entities: {
      ...state.entities,
      inventories
    }
  };
}

/**
 * Schema 1.5.4: promote legacy global pools to authoritative party holdings.
 * Existing per-owner arrays were advisory refs and are discarded. Pure and
 * idempotent: once the legacy keys are absent, the state is returned unchanged.
 */
export function ensureOwnerAttributedHoldings(state: CampaignState): CampaignState {
  type LegacyEntities = CampaignState['entities'] & {
    materials?: Record<Id, Material>;
    foods?: Record<Id, Food>;
  };
  const migrateEntities = (entities: LegacyEntities): CampaignState['entities'] => {
    const hasMaterials = Object.prototype.hasOwnProperty.call(entities, 'materials');
    const hasFoods = Object.prototype.hasOwnProperty.call(entities, 'foods');
    if (!hasMaterials && !hasFoods) return entities;

    const inventories: Record<Id, Inventory> = {};
    for (const [id, inventory] of Object.entries(entities.inventories ?? {})) {
      inventories[id] = { ...inventory, materials: [], food: [] };
    }
    let party = Object.values(inventories).find((inventory) => inventory.ownerType === 'party');
    if (!party) {
      party = {
        id: 'party', ownerType: 'party', ownerId: null, currency: {}, items: [], tools: [],
        materials: [], food: [],
      };
      inventories.party = party;
    }
    for (const character of Object.values(entities.characters ?? {})) {
      if (!Object.values(inventories).some(inventory =>
        inventory.ownerType === 'character' && inventory.ownerId === character.id
      )) {
        const id = inventories[character.id] ? `inv-${character.id}` : character.id;
        inventories[id] = {
          id, ownerType: 'character', ownerId: character.id, currency: {}, items: [], tools: [],
          materials: [], food: [],
        };
      }
    }
    party.materials = Object.values(entities.materials ?? {});
    party.food = Object.values(entities.foods ?? {});
    const { materials: _materials, foods: _foods, ...currentEntities } = entities;
    return { ...currentEntities, inventories };
  };

  const entities = migrateEntities(state.entities as LegacyEntities);
  let checkpointsChanged = false;
  const checkpointEntries = state.checkpoints.entries.map((entry) => {
    const snapshotEntities = entry.snapshot.entities as LegacyEntities;
    const migratedEntities = migrateEntities(snapshotEntities);
    if (migratedEntities === snapshotEntities) return entry;
    checkpointsChanged = true;
    return { ...entry, snapshot: { ...entry.snapshot, entities: migratedEntities } };
  });
  if (entities === state.entities && !checkpointsChanged) return state;
  return {
    ...state,
    entities,
    checkpoints: checkpointsChanged
      ? { ...state.checkpoints, entries: checkpointEntries }
      : state.checkpoints,
  };
}

/**
 * Schema 1.5.0 (Phase 12a.6): combat condition visibility shape.
 *
 * Walks the live combat session's participants and (a) folds legacy
 * isStunned/isUnconscious booleans into conditions[], (b) backfills the
 * per-instance `revealed` eye state from catalog defaults. Combat history
 * and post-combat ParticipantSummary snapshots are frozen records and are
 * deliberately left untouched. Pure and idempotent — safe to run on every
 * load.
 */
export function ensureConditionVisibility(state: CampaignState): CampaignState {
  const session = state.combat.activeSession;
  if (!session || !Array.isArray(session.participants)) return state;

  let changed = false;
  const participants = session.participants.map((participant) => {
    const migrated = ensureParticipantConditionVisibility(participant);
    if (migrated !== participant) changed = true;
    return migrated;
  });

  if (!changed) return state;
  return {
    ...state,
    combat: {
      ...state.combat,
      activeSession: {
        ...session,
        participants
      }
    }
  };
}

/**
 * Schema 1.5.1 (library/encounter data-flow fix): CombatCharacter category.
 *
 * Records saved before 1.5.1 have no `category` — the library form's value was
 * dropped on save — so EncounterSetup's category-grouped "Add from Library"
 * lists never showed them. Backfills `category` (isNPC true → 'enemy', else
 * 'player'; the buggy mapping wrote isNPC false for everything, so most
 * records land in 'player' where they are at least visible and re-taggable)
 * and recomputes `isNPC` to stay consistent (category !== 'player'). Covers
 * live library records and tombstones, which share the CombatCharacter type.
 * Pure and idempotent — safe to run on every load.
 */
export function ensureCombatCharacterCategories(state: CampaignState): CampaignState {
  let changed = false;

  const withCategory = (char: CombatCharacter): CombatCharacter => {
    const category = deriveCombatCategory(char.category, char.isNPC);
    const isNPC = category !== 'player';
    if (char.category === category && char.isNPC === isNPC) return char;
    changed = true;
    return { ...char, category, isNPC };
  };

  const combatCharacters: Record<Id, CombatCharacter> = {};
  for (const [id, char] of Object.entries(state.entities.combatCharacters)) {
    combatCharacters[id] = withCategory(char);
  }

  const tombstones = state.entities.combatTombstones;
  const combatTombstones = Array.isArray(tombstones) ? tombstones.map(withCategory) : tombstones;

  if (!changed) return state;
  return {
    ...state,
    entities: {
      ...state.entities,
      combatCharacters,
      combatTombstones
    }
  };
}

/**
 * Schema 1.5.3: combat history entry shape.
 *
 * End-of-combat has archived canonical CombatState snapshots since the
 * tracker rewrite, but pre-rewrite saves hold legacy CombatSession records
 * (characterId/team participants, startDate strings). Upgrades any legacy
 * entry to CombatState so consumers see a single shape. Handles the nested
 * campaign-state shape here; the flat legacy `combatHistory` key is covered
 * by migrateTo1_5_3() in src/utils/dataMigrations.ts (same
 * upgradeCombatHistory helper, so both paths stay in lockstep). Pure and
 * idempotent — safe to run on every load.
 */
export function ensureCombatHistoryShape(state: CampaignState): CampaignState {
  const history = state.entities.combatHistory;
  if (!Array.isArray(history) || !history.some(isLegacyCombatSession)) return state;
  return {
    ...state,
    entities: {
      ...state.entities,
      combatHistory: upgradeCombatHistory(history)
    }
  };
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
      await window.storage?.remove(key);
    } catch (error) {
      console.warn(`[Migration] Failed to remove ${key}:`, error);
    }
  }

  console.log('[Migration] ✅ Cleanup complete');
}
