/**
 * @fileoverview Schema versioning system for application data persistence
 *
 * This module manages schema versions and provides migration utilities for
 * handling data structure changes across application updates.
 *
 * Schema Version History:
 * - v1.0 (Initial): Basic inventory, cooking, crafting
 * - v1.1: Added Alchemy system with reagents, formulas, batches
 * - v1.2: Added Combat system with turn tracking and conditions
 * - v1.3: Added Gathering system with fishing and foraging
 * - v2.0: (Planned) Backend API migration
 *
 * @module utils/schemaVersioning
 */

import { logger } from './logger';

/**
 * Current application data schema version
 * Increment MINOR for backwards-compatible changes (new fields)
 * Increment MAJOR for breaking changes requiring migration
 */
export const CURRENT_SCHEMA_VERSION = '1.3.0';

/**
 * Schema metadata tracking structure versions
 * Used to validate and migrate data on import
 */
export const SCHEMA_METADATA = {
  '1.0.0': {
    name: 'Initial Schema',
    timestamp: '2025-01-01',
    breaking: false,
    description: 'Basic inventory, cooking, crafting systems',
    features: ['inventory', 'cooking', 'crafting']
  },
  '1.1.0': {
    name: 'Alchemy System',
    timestamp: '2025-06-01',
    breaking: false,
    description: 'Added comprehensive alchemy with reagents, formulas, and batches',
    features: ['alchemy_reagents', 'alchemy_formulas', 'alchemy_batches', 'alchemy_labs'],
    migratesFrom: ['1.0.0']
  },
  '1.2.0': {
    name: 'Combat System',
    timestamp: '2025-09-01',
    breaking: false,
    description: 'Added combat tracker with turn management and conditions',
    features: ['combat_active', 'combat_history', 'combat_conditions', 'combat_reveal'],
    migratesFrom: ['1.1.0']
  },
  '1.3.0': {
    name: 'Gathering System',
    timestamp: '2026-01-01',
    breaking: false,
    description: 'Added gathering/fishing system with daily events and yields',
    features: ['gathering_sessions', 'gathering_daily_events', 'gathering_species', 'current_day'],
    migratesFrom: ['1.2.0']
  }
};

/**
 * Storage key for schema version tracking
 */
export const SCHEMA_VERSION_KEY = 'app_schema_version';

/**
 * Storage key for data migration history (debug only)
 */
export const MIGRATION_HISTORY_KEY = 'app_migration_history';

/**
 * Get the schema version from localStorage
 * @returns {string} Current stored schema version or '1.0.0' if not found
 */
export function getStoredSchemaVersion() {
  try {
    const stored = localStorage.getItem(SCHEMA_VERSION_KEY);
    return stored || '1.0.0';
  } catch (error) {
    logger.error('Failed to read schema version:', error);
    return '1.0.0';
  }
}

/**
 * Save the current schema version to localStorage
 * @param {string} version - Schema version to save
 * @returns {boolean} Success status
 */
export function saveSchemaVersion(version = CURRENT_SCHEMA_VERSION) {
  try {
    localStorage.setItem(SCHEMA_VERSION_KEY, version);
    return true;
  } catch (error) {
    logger.error('Failed to save schema version:', error);
    return false;
  }
}

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 *
 * @param {string} v1 - First version (e.g., '1.2.0')
 * @param {string} v2 - Second version (e.g., '1.3.0')
 * @returns {number} Comparison result
 */
export function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

/**
 * Check if data needs migration
 * @param {string} storedVersion - Version from storage
 * @param {string} currentVersion - Current application version
 * @returns {boolean} True if migration needed
 */
export function needsMigration(storedVersion, currentVersion = CURRENT_SCHEMA_VERSION) {
  return compareVersions(storedVersion, currentVersion) < 0;
}

/**
 * Get migration path from one version to another
 * @param {string} fromVersion - Starting version
 * @param {string} toVersion - Target version
 * @returns {string[]} Array of intermediate versions to migrate through
 */
export function getMigrationPath(fromVersion, toVersion = CURRENT_SCHEMA_VERSION) {
  const versions = Object.keys(SCHEMA_METADATA).sort((a, b) =>
    compareVersions(a, b)
  );

  const fromIndex = versions.indexOf(fromVersion);
  const toIndex = versions.indexOf(toVersion);

  if (fromIndex === -1) {
    logger.warn(`Unknown version: ${fromVersion}`);
    return [];
  }

  if (fromIndex >= toIndex) {
    return [];
  }

  return versions.slice(fromIndex + 1, toIndex + 1);
}

/**
 * Log migration event for debugging
 * @param {string} fromVersion - Version migrating from
 * @param {string} toVersion - Version migrating to
 * @param {object} metadata - Additional metadata
 */
export function logMigration(fromVersion, toVersion, metadata = {}) {
  try {
    const history = JSON.parse(
      localStorage.getItem(MIGRATION_HISTORY_KEY) || '[]'
    );

    history.push({
      timestamp: new Date().toISOString(),
      from: fromVersion,
      to: toVersion,
      ...metadata
    });

    // Keep only last 20 migrations
    if (history.length > 20) {
      history.shift();
    }

    localStorage.setItem(MIGRATION_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    logger.error('Failed to log migration:', error);
  }
}

/**
 * Get migration history for debugging
 * @returns {array} Array of migration events
 */
export function getMigrationHistory() {
  try {
    return JSON.parse(localStorage.getItem(MIGRATION_HISTORY_KEY) || '[]');
  } catch (error) {
    logger.error('Failed to read migration history:', error);
    return [];
  }
}

/**
 * Clear migration history (debug only)
 */
export function clearMigrationHistory() {
  try {
    localStorage.removeItem(MIGRATION_HISTORY_KEY);
  } catch (error) {
    logger.error('Failed to clear migration history:', error);
  }
}

/**
 * Validate schema metadata
 * @param {string} version - Version to validate
 * @returns {boolean} True if version metadata is valid
 */
export function isValidSchemaVersion(version) {
  return version in SCHEMA_METADATA;
}

/**
 * Get features available in a schema version
 * @param {string} version - Version to check
 * @returns {string[]} Array of feature names
 */
export function getFeaturesForVersion(version) {
  const metadata = SCHEMA_METADATA[version];
  return metadata ? metadata.features : [];
}

/**
 * Export current schema information for debugging
 * @returns {object} Schema information
 */
export function getSchemaInfo() {
  const storedVersion = getStoredSchemaVersion();

  return {
    currentVersion: CURRENT_SCHEMA_VERSION,
    storedVersion,
    needsMigration: needsMigration(storedVersion),
    metadata: SCHEMA_METADATA[CURRENT_SCHEMA_VERSION],
    migrationPath: getMigrationPath(storedVersion),
    migrationHistory: getMigrationHistory()
  };
}
