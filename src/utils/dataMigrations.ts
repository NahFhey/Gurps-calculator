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
