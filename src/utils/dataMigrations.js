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
  CURRENT_SCHEMA_VERSION
} from './schemaVersioning';

/**
 * Migration handlers for each version transition
 * Key format: 'from_version:to_version'
 */
const migrationHandlers = {
  '1.0.0:1.1.0': migrateTo1_1_0,
  '1.1.0:1.2.0': migrateTo1_2_0,
  '1.2.0:1.3.0': migrateTo1_3_0
};

/**
 * Execute all necessary migrations on application data
 *
 * @param {object} data - Application state to migrate
 * @param {string} fromVersion - Current data version
 * @param {string} toVersion - Target version (defaults to CURRENT_SCHEMA_VERSION)
 * @returns {object} Migrated data with version updated
 * @throws {Error} If migration fails with detailed error info
 */
export function migrateData(data, fromVersion, toVersion = CURRENT_SCHEMA_VERSION) {
  if (compareVersions(fromVersion, toVersion) >= 0) {
    // Data is already at target version or newer
    return { ...data, schemaVersion: toVersion };
  }

  const migrationPath = getMigrationPath(fromVersion, toVersion);

  if (migrationPath.length === 0) {
    logger.warn(
      `No migration path found from ${fromVersion} to ${toVersion}`
    );
    return { ...data, schemaVersion: toVersion };
  }

  let migratedData = { ...data };
  let currentVersion = fromVersion;

  try {
    for (const targetVersion of migrationPath) {
      const handlerKey = `${currentVersion}:${targetVersion}`;
      const handler = migrationHandlers[handlerKey];

      if (!handler) {
        throw new Error(
          `No migration handler found for ${handlerKey}`
        );
      }

      logger.log(`Migrating data from ${currentVersion} to ${targetVersion}`);

      // Create backup before migration
      backupData(migratedData, currentVersion);

      // Execute migration
      migratedData = handler(migratedData);

      // Log successful migration
      logMigration(currentVersion, targetVersion, {
        success: true,
        dataKeys: Object.keys(migratedData)
      });

      currentVersion = targetVersion;
    }

    migratedData.schemaVersion = toVersion;
    logger.log(`Successfully migrated from ${fromVersion} to ${toVersion}`);

    return migratedData;
  } catch (error) {
    logger.error(
      `Migration failed from ${fromVersion} to ${toVersion}:`,
      error
    );

    logMigration(fromVersion, toVersion, {
      success: false,
      error: error.message
    });

    throw new Error(
      `Data migration failed: ${error.message}. ` +
      'Please export your data and contact support.'
    );
  }
}

/**
 * Backup data before migration (for debugging)
 * @param {object} data - Data to backup
 * @param {string} version - Version being backed up
 * @private
 */
function backupData(data, version) {
  try {
    const backupKey = `backup_${version}_${Date.now()}`;
    const backupData = JSON.stringify({
      version,
      timestamp: new Date().toISOString(),
      data
    });

    localStorage.setItem(backupKey, backupData);

    // Keep only last 5 backups per version
    const allKeys = Object.keys(localStorage);
    const versionBackups = allKeys
      .filter(k => k.startsWith(`backup_${version}_`))
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
 * Initializes alchemy-related fields with empty defaults
 */
function migrateTo1_1_0(data) {
  return {
    ...data,
    alchemyReagents: data.alchemyReagents || [],
    alchemyFormulas: data.alchemyFormulas || [],
    alchemyBatches: data.alchemyBatches || [],
    alchemyLabs: data.alchemyLabs || [
      { id: 'default', name: 'Basic Lab', rating: 0, description: 'Standard workspace' }
    ],
    alchemySettings: {
      defaultLabRating: 0,
      workBlockMinutes: 120,
      showObviousRoles: true,
      ...data.alchemySettings
    },
    effectFamilyMap: data.effectFamilyMap || {}
  };
}

/**
 * Migration: 1.1.0 → 1.2.0 (Add Combat System)
 * Initializes combat-related fields with empty defaults
 */
function migrateTo1_2_0(data) {
  return {
    ...data,
    combatActive: data.combatActive || null,
    combatActiveHistory: data.combatActiveHistory || null,
    combatHistory: data.combatHistory || [],
    combatRulesPreset: data.combatRulesPreset || 'standard',
    combatReveal: data.combatReveal || null,
    gmMode: data.gmMode || false,
    gmLockData: data.gmLockData || null
  };
}

/**
 * Migration: 1.2.0 → 1.3.0 (Add Gathering System)
 * Initializes gathering-related fields with empty defaults
 */
function migrateTo1_3_0(data) {
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
    currentDay: data.currentDay || 1
  };
}

/**
 * Get the last backup for a specific version
 * @param {string} version - Version to get backup for
 * @returns {object|null} Backup data or null if not found
 */
export function getLastBackup(version) {
  try {
    const allKeys = Object.keys(localStorage);
    const backupKey = allKeys
      .filter(k => k.startsWith(`backup_${version}_`))
      .sort()
      .reverse()[0];

    if (!backupKey) return null;

    const backupData = JSON.parse(localStorage.getItem(backupKey));
    return backupData;
  } catch (error) {
    logger.error('Failed to retrieve backup:', error);
    return null;
  }
}

/**
 * Restore data from a backup (emergency recovery)
 * @param {string} backupKey - Backup key to restore from
 * @returns {object|null} Restored data or null if failed
 */
export function restoreFromBackup(backupKey) {
  try {
    const backupData = JSON.parse(localStorage.getItem(backupKey));
    logger.log(`Restored backup from ${backupKey}`);
    return backupData ? backupData.data : null;
  } catch (error) {
    logger.error(`Failed to restore backup ${backupKey}:`, error);
    return null;
  }
}

/**
 * List all available backups
 * @returns {array} Array of backup metadata
 */
export function listBackups() {
  try {
    const allKeys = Object.keys(localStorage);
    const backups = allKeys
      .filter(k => k.startsWith('backup_'))
      .map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          return {
            key,
            version: data.version,
            timestamp: data.timestamp,
            dataKeys: Object.keys(data.data)
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return backups;
  } catch (error) {
    logger.error('Failed to list backups:', error);
    return [];
  }
}

/**
 * Validate that data conforms to a schema version
 * @param {object} data - Data to validate
 * @param {string} version - Expected version
 * @returns {object} Validation result with valid boolean and issues array
 */
export function validateDataForVersion(data, version) {
  const issues = [];

  // Basic structure checks
  if (!data || typeof data !== 'object') {
    issues.push('Data is not an object');
    return { valid: false, issues };
  }

  // Version-specific validation
  if (version >= '1.1.0') {
    if (!Array.isArray(data.alchemyReagents)) {
      issues.push('Missing or invalid alchemyReagents array');
    }
    if (!Array.isArray(data.alchemyFormulas)) {
      issues.push('Missing or invalid alchemyFormulas array');
    }
  }

  if (version >= '1.2.0') {
    if (data.combatActive && typeof data.combatActive !== 'object') {
      issues.push('Invalid combatActive structure');
    }
  }

  if (version >= '1.3.0') {
    if (typeof data.currentDay !== 'number') {
      issues.push('Missing or invalid currentDay');
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
