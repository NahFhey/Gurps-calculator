/**
 * @fileoverview Schema versioning system for application data persistence
 */

import { logger } from './logger';

export interface SchemaMetadataEntry {
  name: string;
  timestamp: string;
  breaking: boolean;
  description: string;
  features: string[];
  migratesFrom?: string[];
}

export const CURRENT_SCHEMA_VERSION = '1.3.0';

export const SCHEMA_METADATA: Record<string, SchemaMetadataEntry> = {
  '1.0.0': {
    name: 'Initial Schema',
    timestamp: '2025-01-01',
    breaking: false,
    description: 'Basic inventory, cooking, crafting systems',
    features: ['inventory', 'cooking', 'crafting'],
  },
  '1.1.0': {
    name: 'Alchemy System',
    timestamp: '2025-06-01',
    breaking: false,
    description: 'Added comprehensive alchemy with reagents, formulas, and batches',
    features: ['alchemy_reagents', 'alchemy_formulas', 'alchemy_batches', 'alchemy_labs'],
    migratesFrom: ['1.0.0'],
  },
  '1.2.0': {
    name: 'Combat System',
    timestamp: '2025-09-01',
    breaking: false,
    description: 'Added combat tracker with turn management and conditions',
    features: ['combat_active', 'combat_history', 'combat_conditions', 'combat_reveal'],
    migratesFrom: ['1.1.0'],
  },
  '1.3.0': {
    name: 'Gathering System',
    timestamp: '2026-01-01',
    breaking: false,
    description: 'Added gathering/fishing system with daily events and yields',
    features: ['gathering_sessions', 'gathering_daily_events', 'gathering_species', 'current_day'],
    migratesFrom: ['1.2.0'],
  },
};

export const SCHEMA_VERSION_KEY = 'app_schema_version';
export const MIGRATION_HISTORY_KEY = 'app_migration_history';

export interface MigrationLogEntry {
  timestamp: string;
  from: string;
  to: string;
  [key: string]: unknown;
}

export function getStoredSchemaVersion(): string {
  try {
    const stored = localStorage.getItem(SCHEMA_VERSION_KEY);
    return stored || '1.0.0';
  } catch (error) {
    logger.error('Failed to read schema version:', error);
    return '1.0.0';
  }
}

export function saveSchemaVersion(version: string = CURRENT_SCHEMA_VERSION): boolean {
  try {
    localStorage.setItem(SCHEMA_VERSION_KEY, version);
    return true;
  } catch (error) {
    logger.error('Failed to save schema version:', error);
    return false;
  }
}

export function compareVersions(v1: string, v2: string): number {
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

export function needsMigration(
  storedVersion: string,
  currentVersion: string = CURRENT_SCHEMA_VERSION
): boolean {
  return compareVersions(storedVersion, currentVersion) < 0;
}

export function getMigrationPath(
  fromVersion: string,
  toVersion: string = CURRENT_SCHEMA_VERSION
): string[] {
  const versions = Object.keys(SCHEMA_METADATA).sort((a, b) => compareVersions(a, b));

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

export function logMigration(
  fromVersion: string,
  toVersion: string,
  metadata: Record<string, unknown> = {}
): void {
  try {
    const history: MigrationLogEntry[] = JSON.parse(
      localStorage.getItem(MIGRATION_HISTORY_KEY) || '[]'
    );

    history.push({
      timestamp: new Date().toISOString(),
      from: fromVersion,
      to: toVersion,
      ...metadata,
    });

    if (history.length > 20) {
      history.shift();
    }

    localStorage.setItem(MIGRATION_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    logger.error('Failed to log migration:', error);
  }
}

export function getMigrationHistory(): MigrationLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(MIGRATION_HISTORY_KEY) || '[]') as MigrationLogEntry[];
  } catch (error) {
    logger.error('Failed to read migration history:', error);
    return [];
  }
}

export function clearMigrationHistory(): void {
  try {
    localStorage.removeItem(MIGRATION_HISTORY_KEY);
  } catch (error) {
    logger.error('Failed to clear migration history:', error);
  }
}

export function isValidSchemaVersion(version: string): boolean {
  return version in SCHEMA_METADATA;
}

export function getFeaturesForVersion(version: string): string[] {
  const metadata = SCHEMA_METADATA[version];
  return metadata ? metadata.features : [];
}

export interface SchemaInfo {
  currentVersion: string;
  storedVersion: string;
  needsMigration: boolean;
  metadata: SchemaMetadataEntry | undefined;
  migrationPath: string[];
  migrationHistory: MigrationLogEntry[];
}

export function getSchemaInfo(): SchemaInfo {
  const storedVersion = getStoredSchemaVersion();

  return {
    currentVersion: CURRENT_SCHEMA_VERSION,
    storedVersion,
    needsMigration: needsMigration(storedVersion),
    metadata: SCHEMA_METADATA[CURRENT_SCHEMA_VERSION],
    migrationPath: getMigrationPath(storedVersion),
    migrationHistory: getMigrationHistory(),
  };
}
