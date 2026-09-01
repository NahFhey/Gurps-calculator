/**
 * @fileoverview Data migration utilities for schema version transitions
 *
 * This module provides migration handlers for transforming data between
 * different schema versions. Each migration is idempotent and logs its execution.
 *
 * Migration Strategy:
 * 1. Version detected on data load
 * 2. Migration path calculated
 * 3. Each step validated before execution
 * 4. Original data backed up (in localStorage)
 * 5. Migrations applied sequentially
 * 6. New version saved
 *
 * @module utils/dataMigrations
 */

import { logger } from './logger';
import {
  getMigrationPath,
  logMigration,
  compareVersions,
  CURRENT_SCHEMA_VERSION,
} from './schemaVersioning';
import { ensureParticipantConditionVisibility } from './conditionsEngine';
import { deriveCombatCategory } from './combatHelpers';
import { upgradeCombatHistory } from './legacyCombatHistory';
import { DEFAULT_CALENDAR } from './timeSystem';

type MigratableData = Record<string, unknown> & { schemaVersion?: string };

type MigrationHandler = (data: MigratableData) => MigratableData;

export interface BackupEntry {
  version: string;
  timestamp: string;
  data: MigratableData;
}

export interface BackupMetadata {
  key: string;
  version: string;
  timestamp: string;
  dataKeys: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Migration handlers for each version transition
 * Key format: 'from_version:to_version'
 */
const migrationHandlers: Record<string, MigrationHandler> = {
  '1.0.0:1.1.0': migrateTo1_1_0,
  '1.1.0:1.2.0': migrateTo1_2_0,
  '1.2.0:1.3.0': migrateTo1_3_0,
  '1.3.0:1.4.0': migrateTo1_4_0,
  '1.4.0:1.5.0': migrateTo1_5_0,
  '1.5.0:1.5.1': migrateTo1_5_1,
  '1.5.1:1.5.2': migrateTo1_5_2,
  '1.5.2:1.5.3': migrateTo1_5_3,
  '1.5.3:1.5.4': migrateTo1_5_4,
  '1.5.4:1.5.5': migrateTo1_5_5,
  '1.5.5:1.5.6': migrateTo1_5_6,
  '1.5.6:1.5.7': migrateTo1_5_7,
  '1.5.7:1.5.8': migrateTo1_5_8,
  '1.5.8:1.5.9': migrateTo1_5_9,
};

/**
 * Execute all necessary migrations on application data
 */
export function migrateData(
  data: MigratableData,
  fromVersion: string,
  toVersion: string = CURRENT_SCHEMA_VERSION
): MigratableData {
  if (compareVersions(fromVersion, toVersion) >= 0) {
    return { ...data, schemaVersion: toVersion };
  }

  const migrationPath = getMigrationPath(fromVersion, toVersion);

  if (migrationPath.length === 0) {
    logger.warn(`No migration path found from ${fromVersion} to ${toVersion}`);
    return { ...data, schemaVersion: toVersion };
  }

  let migratedData: MigratableData = { ...data };
  let currentVersion = fromVersion;

  try {
    for (const targetVersion of migrationPath) {
      const handlerKey = `${currentVersion}:${targetVersion}`;
      const handler = migrationHandlers[handlerKey];

      if (!handler) {
        throw new Error(`No migration handler found for ${handlerKey}`);
      }

      logger.log(`Migrating data from ${currentVersion} to ${targetVersion}`);

      backupData(migratedData, currentVersion);

      migratedData = handler(migratedData);

      logMigration(currentVersion, targetVersion, {
        success: true,
        dataKeys: Object.keys(migratedData),
      });

      currentVersion = targetVersion;
    }

    migratedData.schemaVersion = toVersion;
    logger.log(`Successfully migrated from ${fromVersion} to ${toVersion}`);

    return migratedData;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Migration failed from ${fromVersion} to ${toVersion}:`, error);

    logMigration(fromVersion, toVersion, {
      success: false,
      error: message,
    });

    throw new Error(
      `Data migration failed: ${message}. ` +
        'Please export your data and contact support.'
    );
  }
}

/**
 * Backup data before migration (for debugging)
 */
function backupData(data: MigratableData, version: string): void {
  try {
    const backupKey = `backup_${version}_${Date.now()}`;
    const backupPayload = JSON.stringify({
      version,
      timestamp: new Date().toISOString(),
      data,
    });

    localStorage.setItem(backupKey, backupPayload);

    const allKeys = Object.keys(localStorage);
    const versionBackups = allKeys
      .filter((k) => k.startsWith(`backup_${version}_`))
      .sort()
      .reverse();

    for (let i = 5; i < versionBackups.length; i++) {
      localStorage.removeItem(versionBackups[i]);
    }
  } catch (error) {
    logger.warn('Could not create backup:', error);
  }
}

/**
 * Migration: 1.0.0 → 1.1.0 (Add Alchemy System)
 */
function migrateTo1_1_0(data: MigratableData): MigratableData {
  const existingSettings =
    (data.alchemySettings as Record<string, unknown> | undefined) ?? {};
  return {
    ...data,
    alchemyReagents: data.alchemyReagents || [],
    alchemyFormulas: data.alchemyFormulas || [],
    alchemyBatches: data.alchemyBatches || [],
    alchemyLabs: data.alchemyLabs || [
      { id: 'default', name: 'Basic Lab', rating: 0, description: 'Standard workspace' },
    ],
    alchemySettings: {
      defaultLabRating: 0,
      workBlockMinutes: 120,
      showObviousRoles: true,
      ...existingSettings,
    },
    effectFamilyMap: data.effectFamilyMap || {},
  };
}

/**
 * Migration: 1.1.0 → 1.2.0 (Add Combat System)
 */
function migrateTo1_2_0(data: MigratableData): MigratableData {
  return {
    ...data,
    combatActive: data.combatActive || null,
    combatActiveHistory: data.combatActiveHistory || null,
    combatHistory: data.combatHistory || [],
    combatRulesPreset: data.combatRulesPreset || 'standard',
    combatReveal: data.combatReveal || null,
    gmMode: data.gmMode || false,
    gmLockData: data.gmLockData || null,
  };
}

/**
 * Migration: 1.2.0 → 1.3.0 (Add Gathering System)
 */
function migrateTo1_3_0(data: MigratableData): MigratableData {
  return {
    ...data,
    gatheringSpecies: data.gatheringSpecies || [],
    gatheringTools: data.gatheringTools || [],
    gatheringTables: data.gatheringTables || [],
    gatheringEnvironments: data.gatheringEnvironments || [],
    gatheringSessions: data.gatheringSessions || [],
    gatheringDailyEvents: data.gatheringDailyEvents || {},
    gatheringBait: data.gatheringBait || [],
    gatheringCategories: data.gatheringCategories || [],
    gatheringItems: data.gatheringItems || [],
    currentDay: data.currentDay || 1,
  };
}

/**
 * Migration: 1.3.0 → 1.4.0 (Inventory Integration Bus)
 *
 * Ensures the inventories record exists. Owner-record backfill (party +
 * per-character Inventory records) happens at hydrate time in
 * src/persistence/dataMigration.ts ensureInventoryRecords(), because the
 * character list lives in the entity state, not in this flat legacy shape.
 */
function migrateTo1_4_0(data: MigratableData): MigratableData {
  return {
    ...data,
    inventories: data.inventories || {},
  };
}

/**
 * Migration: 1.4.0 → 1.5.0 (Combat Condition Visibility, Phase 12a.6)
 *
 * Folds legacy isStunned/isUnconscious participant booleans into
 * conditions[] and backfills the per-instance `revealed` eye state from
 * catalog defaults. Handles the flat legacy `combatActive` key here; the
 * nested campaign-state shape is covered at hydrate time by
 * src/persistence/dataMigration.ts ensureConditionVisibility() (same
 * per-participant helper, so both paths stay in lockstep).
 */
function migrateTo1_5_0(data: MigratableData): MigratableData {
  const combatActive = data.combatActive as
    | { participants?: unknown[] }
    | null
    | undefined;

  if (!combatActive || !Array.isArray(combatActive.participants)) {
    return data;
  }

  return {
    ...data,
    combatActive: {
      ...combatActive,
      participants: combatActive.participants.map((p) =>
        ensureParticipantConditionVisibility(p)
      ),
    },
  };
}

/**
 * Migration: 1.5.0 → 1.5.1 (CombatCharacter category backfill)
 *
 * Library records saved before 1.5.1 dropped the form's `category`, so
 * EncounterSetup's category-grouped lists never showed them. Handles the flat
 * legacy `combatCharacters`/`combatTombstones` keys here; the nested
 * campaign-state shape is covered at hydrate time by
 * src/persistence/dataMigration.ts ensureCombatCharacterCategories() (same
 * deriveCombatCategory helper, so both paths stay in lockstep).
 */
function migrateTo1_5_1(data: MigratableData): MigratableData {
  const backfill = (value: unknown[]): unknown[] =>
    value.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const char = entry as Record<string, unknown>;
      const category = deriveCombatCategory(char.category, char.isNPC);
      const isNPC = category !== 'player';
      if (char.category === category && char.isNPC === isNPC) return entry;
      return { ...char, category, isNPC };
    });

  const next: MigratableData = { ...data };
  if (Array.isArray(data.combatCharacters)) {
    next.combatCharacters = backfill(data.combatCharacters);
  }
  if (Array.isArray(data.combatTombstones)) {
    next.combatTombstones = backfill(data.combatTombstones);
  }
  return next;
}

/** Migration: 1.5.1 → 1.5.2 (Party meal buff) */
function migrateTo1_5_2(data: MigratableData): MigratableData {
  return {
    ...data,
    mealBuff: data.mealBuff ?? null,
  };
}

/**
 * Migration: 1.5.2 → 1.5.3 (Combat history entry shape)
 *
 * Upgrades legacy CombatSession history records (characterId/team
 * participants, startDate strings) to canonical CombatState snapshots.
 * Handles the flat legacy `combatHistory` key here; the nested
 * campaign-state shape is covered at hydrate time by
 * src/persistence/dataMigration.ts ensureCombatHistoryShape() (same
 * upgradeCombatHistory helper, so both paths stay in lockstep).
 */
function migrateTo1_5_3(data: MigratableData): MigratableData {
  if (!Array.isArray(data.combatHistory)) return data;
  return {
    ...data,
    combatHistory: upgradeCombatHistory(data.combatHistory),
  };
}

/**
 * Migration: 1.5.3 → 1.5.4 (owner-attributed material holdings)
 *
 * Legacy global pools become the party's holdings. Existing inventory arrays
 * are provenance refs and are deliberately discarded. Absence of both legacy
 * pools means this migration has already run, making the transform idempotent.
 */
export function migrateTo1_5_4(data: MigratableData): MigratableData {
  const hasMaterials = Object.prototype.hasOwnProperty.call(data, 'materials');
  const hasFoods = Object.prototype.hasOwnProperty.call(data, 'foods');
  if (!hasMaterials && !hasFoods) return data;

  const toEntries = (value: unknown): Record<string, unknown>[] => {
    if (Array.isArray(value)) return value.filter((entry): entry is Record<string, unknown> =>
      !!entry && typeof entry === 'object'
    );
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).filter(
        (entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object'
      );
    }
    return [];
  };

  const rawInventories = data.inventories;
  const inventories: Record<string, Record<string, unknown>> =
    rawInventories && typeof rawInventories === 'object' && !Array.isArray(rawInventories)
      ? { ...(rawInventories as Record<string, Record<string, unknown>>) }
      : {};
  let partyKey = Object.keys(inventories).find(
    (key) => inventories[key]?.ownerType === 'party'
  );
  if (!partyKey) {
    partyKey = 'party';
    inventories[partyKey] = {
      id: 'party', ownerType: 'party', ownerId: null,
      currency: {}, items: [], tools: [], materials: [], food: [],
    };
  }

  const rawCharacters = data.characters;
  const characters = Array.isArray(rawCharacters)
    ? rawCharacters
    : rawCharacters && typeof rawCharacters === 'object'
      ? Object.values(rawCharacters as Record<string, unknown>)
      : [];
  for (const candidate of characters) {
    if (!candidate || typeof candidate !== 'object') continue;
    const character = candidate as Record<string, unknown>;
    if (typeof character.id !== 'string') continue;
    if (Object.values(inventories).some(inventory =>
      inventory.ownerType === 'character' && inventory.ownerId === character.id
    )) continue;
    const inventoryId = inventories[character.id] ? `inv-${character.id}` : character.id;
    inventories[inventoryId] = {
      id: inventoryId, ownerType: 'character', ownerId: character.id,
      currency: {}, items: [], tools: [], materials: [], food: [],
    };
  }

  for (const [key, inventory] of Object.entries(inventories)) {
    inventories[key] = { ...inventory, materials: [], food: [] };
  }
  inventories[partyKey] = {
    ...inventories[partyKey],
    materials: toEntries(data.materials),
    food: toEntries(data.foods),
  };

  const { materials: _materials, foods: _foods, ...withoutPools } = data;
  return { ...withoutPools, inventories };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const omitKeys = (
  record: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> => Object.fromEntries(
  Object.entries(record).filter(([key]) => !keys.includes(key))
);

// Legacy key as a string literal on purpose: the field no longer exists on
// MapModel, but pre-1.5.6 saves still carry it.
const LEGACY_PARTY_POSITION_KEY = 'partyTileId';

/** Remove persisted fields belonging to the retired location-graph travel path. */
export function removeLegacyTravelState<T>(data: T): T {
  if (!isRecord(data)) return data;

  // Legacy key names referenced as strings on purpose: these fields no longer
  // exist on the types, but persisted saves from <=1.5.4 still carry them.
  const locationTravelsKey = 'activeTravels';
  const mapWizardKey = 'travelWizard';
  const connectionKeys = ['travelTime', 'travelDifficulty', 'requirements'];
  const next: Record<string, unknown> = { ...data };

  if (isRecord(data.locations)) {
    const locationsState = omitKeys(data.locations, [locationTravelsKey]);
    if (isRecord(data.locations.locations)) {
      locationsState.locations = Object.fromEntries(
        Object.entries(data.locations.locations).map(([id, location]) => {
          if (!isRecord(location) || !Array.isArray(location.connections)) {
            return [id, location];
          }
          return [id, {
            ...location,
            connections: location.connections.map((connection) =>
              isRecord(connection) ? omitKeys(connection, connectionKeys) : connection
            ),
          }];
        })
      );
    }
    next.locations = locationsState;
  }

  if (isRecord(data.maps)) {
    next.maps = omitKeys(data.maps, [mapWizardKey]);
  }

  return next as T;
}

/** Migration: 1.5.4 → 1.5.5 (retired travel state cleanup) */
function migrateTo1_5_5(data: MigratableData): MigratableData {
  return removeLegacyTravelState(data);
}

/** Migration: 1.5.5 → 1.5.6 (singleton map position to a main travel group). */
export function migrateTo1_5_6(data: MigratableData): MigratableData {
  if (!isRecord(data)) return data;
  const next: MigratableData = { ...data };
  let savedPosition: { mapId: string; tileId: string } | null = null;

  if (isRecord(data.maps) && isRecord(data.maps.mapsById)) {
    const mapsState = data.maps;
    const mapsById = data.maps.mapsById;
    const activeMapId = typeof mapsState.activeMapId === 'string' ? mapsState.activeMapId : null;
    const activeMap = activeMapId ? mapsById[activeMapId] : undefined;
    const activePosition = isRecord(activeMap) ? activeMap[LEGACY_PARTY_POSITION_KEY] : null;
    if (activeMapId && typeof activePosition === 'string') {
      savedPosition = { mapId: activeMapId, tileId: activePosition };
    }

    const cleanedMaps: Record<string, unknown> = {};
    for (const [mapId, map] of Object.entries(mapsById)) {
      if (!isRecord(map)) {
        cleanedMaps[mapId] = map;
        continue;
      }
      const legacyPosition = map[LEGACY_PARTY_POSITION_KEY];
      if (!savedPosition && typeof legacyPosition === 'string') {
        savedPosition = { mapId, tileId: legacyPosition };
      }
      cleanedMaps[mapId] = omitKeys(map, [LEGACY_PARTY_POSITION_KEY]);
    }
    next.maps = { ...mapsState, mapsById: cleanedMaps };
  }

  const entities = isRecord(data.entities) ? { ...data.entities } : {};
  const existingGroups = isRecord(entities.travelGroups) ? entities.travelGroups : {};
  if (Object.keys(existingGroups).length === 0) {
    const characters = isRecord(entities.characters) ? entities.characters : {};
    const groupId = 'travel-group-main';
    entities.travelGroups = {
      [groupId]: {
        id: groupId,
        name: 'The Party',
        memberIds: Object.keys(characters),
        vehicleId: null,
        position: savedPosition,
      },
    };
    const ui = isRecord(data.ui) ? { ...data.ui } : {};
    if (typeof ui.activeTravelGroupId !== 'string') ui.activeTravelGroupId = groupId;
    next.ui = ui;
  }
  next.entities = entities;
  return next;
}

/** Migration: 1.5.6 → 1.5.7 (per-map ambient weather and derived seasons). */
export function migrateTo1_5_7(data: MigratableData): MigratableData {
  const next: MigratableData = { ...data };
  const locationsState = isRecord(data.locations) ? { ...data.locations } : {};
  const rawLocations = isRecord(locationsState.locations) ? locationsState.locations : {};
  const activeLocationId = typeof locationsState.currentLocationId === 'string'
    ? locationsState.currentLocationId
    : null;
  const activeLocation = activeLocationId && isRecord(rawLocations[activeLocationId])
    ? rawLocations[activeLocationId]
    : undefined;
  // Legacy keys are intentionally plain string literals for migration honesty.
  const inheritedWeather = activeLocation?.['currentWeather'];

  const cleanedLocations: Record<string, unknown> = {};
  for (const [locationId, location] of Object.entries(rawLocations)) {
    cleanedLocations[locationId] = isRecord(location)
      ? omitKeys(location, ['currentWeather', 'weatherTableId'])
      : location;
  }
  next.locations = { ...locationsState, locations: cleanedLocations };

  const mapsState = isRecord(data.maps) ? { ...data.maps } : {};
  const rawMaps = isRecord(mapsState.mapsById) ? mapsState.mapsById : {};
  const requestedMapId = typeof mapsState.activeMapId === 'string' ? mapsState.activeMapId : null;
  const activeMapId = requestedMapId && rawMaps[requestedMapId]
    ? requestedMapId
    : Object.keys(rawMaps)[0] ?? null;
  const migratedMaps: Record<string, unknown> = {};
  for (const [mapId, map] of Object.entries(rawMaps)) {
    if (!isRecord(map)) {
      migratedMaps[mapId] = map;
      continue;
    }
    migratedMaps[mapId] = {
      ...map,
      climate: typeof map.climate === 'string' ? map.climate : 'temperate',
      ...(mapId === activeMapId && map.currentWeather === undefined && inheritedWeather !== undefined
        ? { currentWeather: inheritedWeather }
        : {}),
    };
  }
  next.maps = { ...mapsState, mapsById: migratedMaps };

  const time = isRecord(data.time) ? { ...data.time } : {};
  if (!isRecord(time.calendar)) {
    time.calendar = DEFAULT_CALENDAR;
  }
  next.time = time;
  return next;
}

/** Migration: 1.5.7 → 1.5.8 (location pins and attached facilities). */
export function migrateTo1_5_8(data: MigratableData): MigratableData {
  const next: MigratableData = { ...data };
  const locationsState = isRecord(data.locations) ? { ...data.locations } : {};
  const rawLocations = isRecord(locationsState.locations) ? locationsState.locations : {};
  const locationIds = new Set(Object.keys(rawLocations));
  const cleanedLocations: Record<string, unknown> = {};
  for (const [id, location] of Object.entries(rawLocations)) {
    // Legacy key is intentionally a plain string literal: the field was removed in 1.5.8.
    cleanedLocations[id] = isRecord(location) ? omitKeys(location, ['connections']) : location;
  }
  next.locations = { ...locationsState, locations: cleanedLocations };

  const mapsState = isRecord(data.maps) ? { ...data.maps } : {};
  const rawMaps = isRecord(mapsState.mapsById) ? mapsState.mapsById : {};
  const cleanedMaps: Record<string, unknown> = {};
  for (const [mapId, map] of Object.entries(rawMaps)) {
    if (!isRecord(map) || !isRecord(map.markersById)) {
      cleanedMaps[mapId] = map;
      continue;
    }
    const markersById: Record<string, unknown> = {};
    for (const [markerId, marker] of Object.entries(map.markersById)) {
      markersById[markerId] = isRecord(marker)
        && typeof marker.locationId === 'string'
        && !locationIds.has(marker.locationId)
        ? omitKeys(marker, ['locationId'])
        : marker;
    }
    cleanedMaps[mapId] = { ...map, markersById };
  }
  next.maps = { ...mapsState, mapsById: cleanedMaps };

  const entities = isRecord(data.entities) ? { ...data.entities } : {};
  const vehicles = isRecord(entities.vehicles) ? entities.vehicles : {};
  const vehicleIds = new Set(Object.keys(vehicles));
  const cleanRegistry = (value: unknown): unknown => {
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([id, entity]) => {
      if (!isRecord(entity) || !isRecord(entity.attachment)) return [id, entity];
      const attachment = entity.attachment;
      const dangling = attachment.kind === 'location'
        ? typeof attachment.locationId !== 'string' || !locationIds.has(attachment.locationId)
        : attachment.kind === 'vehicle'
          ? typeof attachment.vehicleId !== 'string' || !vehicleIds.has(attachment.vehicleId)
          : false;
      return [id, dangling ? omitKeys(entity, ['attachment']) : entity];
    }));
  };
  entities.facilities = cleanRegistry(entities.facilities);
  entities.kitchens = cleanRegistry(entities.kitchens);
  entities.alchemyLabs = cleanRegistry(entities.alchemyLabs);
  next.entities = entities;
  return next;
}

/** Migration: 1.5.8 → 1.5.9 (defensive journey references). */
export function migrateTo1_5_9(data: MigratableData): MigratableData {
  if (!isRecord(data)) return data;
  const mapsState = isRecord(data.maps) ? data.maps : {};
  const mapsById = isRecord(mapsState.mapsById) ? mapsState.mapsById : {};
  const entities = isRecord(data.entities) ? data.entities : {};
  const travelGroups = isRecord(entities.travelGroups) ? entities.travelGroups : {};
  let changed = false;
  const nextGroups: Record<string, unknown> = {};
  for (const [groupId, value] of Object.entries(travelGroups)) {
    if (!isRecord(value) || !isRecord(value.journey)) {
      nextGroups[groupId] = value;
      continue;
    }
    const journey = value.journey;
    const valid = typeof journey.mapId === 'string'
      && mapsById[journey.mapId] !== undefined
      && Array.isArray(journey.routeTileIds)
      && journey.routeTileIds.length > 0;
    if (valid) {
      nextGroups[groupId] = value;
    } else {
      const cleaned = { ...value };
      delete cleaned.journey;
      nextGroups[groupId] = cleaned;
      changed = true;
    }
  }
  if (!changed) return data;
  return {
    ...data,
    entities: { ...entities, travelGroups: nextGroups },
  };
}

/**
 * Get the last backup for a specific version
 */
export function getLastBackup(version: string): BackupEntry | null {
  try {
    const allKeys = Object.keys(localStorage);
    const backupKey = allKeys
      .filter((k) => k.startsWith(`backup_${version}_`))
      .sort()
      .reverse()[0];

    if (!backupKey) return null;

    const raw = localStorage.getItem(backupKey);
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as BackupEntry;
    } catch (parseError) {
      logger.warn(`Malformed JSON in backup ${backupKey}:`, parseError);
      return null;
    }
  } catch (error) {
    logger.error('Failed to retrieve backup:', error);
    return null;
  }
}

/**
 * Restore data from a backup (emergency recovery)
 */
export function restoreFromBackup(backupKey: string): MigratableData | null {
  try {
    const raw = localStorage.getItem(backupKey);
    if (raw === null) return null;

    let backupData: BackupEntry | null = null;
    try {
      backupData = JSON.parse(raw) as BackupEntry;
    } catch (parseError) {
      logger.warn(`Malformed JSON in backup ${backupKey}:`, parseError);
      return null;
    }

    logger.log(`Restored backup from ${backupKey}`);
    return backupData ? backupData.data : null;
  } catch (error) {
    logger.error(`Failed to restore backup ${backupKey}:`, error);
    return null;
  }
}

/**
 * List all available backups
 */
export function listBackups(): BackupMetadata[] {
  try {
    const allKeys = Object.keys(localStorage);
    const backups = allKeys
      .filter((k) => k.startsWith('backup_'))
      .map((key): BackupMetadata | null => {
        try {
          const raw = localStorage.getItem(key);
          if (raw === null) return null;
          const data = JSON.parse(raw) as BackupEntry;
          return {
            key,
            version: data.version,
            timestamp: data.timestamp,
            dataKeys: Object.keys(data.data),
          };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is BackupMetadata => entry !== null)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    return backups;
  } catch (error) {
    logger.error('Failed to list backups:', error);
    return [];
  }
}

/**
 * Validate that data conforms to a schema version
 */
export function validateDataForVersion(
  data: unknown,
  version: string
): ValidationResult {
  const issues: string[] = [];

  if (!data || typeof data !== 'object') {
    issues.push('Data is not an object');
    return { valid: false, issues };
  }

  const obj = data as Record<string, unknown>;

  if (version >= '1.1.0') {
    if (!Array.isArray(obj.alchemyReagents)) {
      issues.push('Missing or invalid alchemyReagents array');
    }
    if (!Array.isArray(obj.alchemyFormulas)) {
      issues.push('Missing or invalid alchemyFormulas array');
    }
  }

  if (version >= '1.2.0') {
    if (obj.combatActive && typeof obj.combatActive !== 'object') {
      issues.push('Invalid combatActive structure');
    }
  }

  if (version >= '1.3.0') {
    if (typeof obj.currentDay !== 'number') {
      issues.push('Missing or invalid currentDay');
    }
  }

  if (version >= '1.4.0') {
    if (
      obj.inventories !== undefined &&
      (typeof obj.inventories !== 'object' || obj.inventories === null || Array.isArray(obj.inventories))
    ) {
      issues.push('Invalid inventories structure');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
