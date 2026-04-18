/**
 * Storage wrapper with async API — backed by IndexedDB via Dexie.js
 *
 * Provides the same interface as the old localStorage wrapper so existing
 * consumers (campaignStorage, dataMigration, etc.) work without changes.
 *
 * Benefits over localStorage:
 * - No 5-10 MB size limit (IndexedDB supports hundreds of MB)
 * - Truly async (localStorage blocks the main thread on large values)
 *
 * Migration path: Replace this implementation with fetch() calls to Express backend
 *
 * Schema Versioning:
 * - Automatically handles data migrations on load
 * - Tracks schema version in IndexedDB
 * - Supports upgrading from v1.0.0 to current version
 */

import { getStoredSchemaVersion, saveSchemaVersion, CURRENT_SCHEMA_VERSION } from './schemaVersioning';
import { migrateData, validateDataForVersion } from './dataMigrations';
import { logger } from './logger';
import { idbGet, idbSet, idbRemove, idbClear, idbKeys, idbGetStorageBreakdown } from '../persistence/db';

// ============================================================================
// Types
// ============================================================================

export interface StorageGetResult {
  value: string;
}

export interface Storage {
  get: (key: string, migrations?: boolean) => Promise<StorageGetResult | null>;
  set: (key: string, value: string, trackVersion?: boolean) => Promise<void>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  keys: () => Promise<string[]>;
}

// ============================================================================
// localStorage → IndexedDB Migration (runs once)
// ============================================================================

let localStorageMigrationDone = false;

/**
 * One-time migration: copies all localStorage entries into IndexedDB,
 * then clears localStorage. Subsequent calls are no-ops.
 */
async function ensureLocalStorageMigrated(): Promise<void> {
  if (localStorageMigrationDone) return;
  localStorageMigrationDone = true;

  try {
    if (typeof localStorage === 'undefined' || localStorage.length === 0) return;

    // Check if IndexedDB already has the main key — if so, skip migration
    const existing = await idbGet('campaignState');
    if (existing) return;

    // Check if there's anything worth migrating in localStorage
    const lsValue = localStorage.getItem('campaignState');
    if (!lsValue) {
      // Also check legacy keys
      const hasLegacy = localStorage.getItem('materials') || localStorage.getItem('workers');
      if (!hasLegacy) return;
    }

    logger.log('[Storage] Migrating localStorage → IndexedDB...');

    // Copy every localStorage entry into IndexedDB
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      if (val !== null) {
        await idbSet(key, val);
      }
    }

    // Clear localStorage to free space, but keep schema version keys
    // (they're tiny and used synchronously by the schema migration layer)
    const schemaVersion = localStorage.getItem('app_schema_version');
    const migrationHistory = localStorage.getItem('app_migration_history');
    localStorage.clear();
    if (schemaVersion) localStorage.setItem('app_schema_version', schemaVersion);
    if (migrationHistory) localStorage.setItem('app_migration_history', migrationHistory);
    logger.log('[Storage] Migration complete — localStorage cleared (kept schema keys)');
  } catch (error) {
    // Non-fatal: we'll just use whatever is in IndexedDB or start fresh
    logger.error('[Storage] localStorage migration error (non-fatal):', error);
  }
}

// ============================================================================
// Storage Implementation
// ============================================================================

/** Prevent alert() from firing on every failed save (debounce). */
let quotaAlertShown = false;

const storage: Storage = {
  /**
   * Get a value from IndexedDB
   * Automatically handles schema migrations for application state
   *
   * @param key - Storage key
   * @param migrations - If true, apply schema migrations (default: true)
   * @returns Object with value string or null if not found
   */
  async get(key: string, migrations: boolean = true): Promise<StorageGetResult | null> {
    try {
      await ensureLocalStorageMigrated();

      const value = await idbGet(key);
      if (value === null) {
        return null;
      }

      // Apply migrations for main state keys
      if (migrations && (key === 'appState' || key === 'gmState')) {
        try {
          const data = JSON.parse(value) as Record<string, unknown>;
          const storedVersion = getStoredSchemaVersion() || '1.0.0';

          if (storedVersion !== CURRENT_SCHEMA_VERSION) {
            logger.log(
              `Migrating ${key} from v${storedVersion} to v${CURRENT_SCHEMA_VERSION}`
            );

            const migratedData = migrateData(data, storedVersion, CURRENT_SCHEMA_VERSION);

            // Validate migrated data
            const validation = validateDataForVersion(
              migratedData,
              CURRENT_SCHEMA_VERSION
            ) as { valid: boolean; issues: string[] };

            if (!validation.valid) {
              logger.warn(
                `Data validation issues for ${key}:`,
                validation.issues
              );
            }

            // Save updated version and return migrated data
            saveSchemaVersion(CURRENT_SCHEMA_VERSION);
            return { value: JSON.stringify(migratedData) };
          }
        } catch (migrationError) {
          logger.error(`Migration failed for ${key}:`, migrationError);
          // Return original value if migration fails
          return { value };
        }
      }

      return { value };
    } catch (error) {
      console.error(`storage.get error for key "${key}":`, error);
      return null;
    }
  },


  /**
   * Set a value in IndexedDB
   * Automatically tracks schema version on state saves
   *
   * @param key - Storage key
   * @param value - Value to store (should be JSON string)
   * @param trackVersion - If true, update schema version (default: true)
   */
  async set(key: string, value: string, trackVersion: boolean = true): Promise<void> {
    try {
      await idbSet(key, value);

      // Track schema version when saving main state
      if (trackVersion && (key === 'appState' || key === 'gmState')) {
        saveSchemaVersion(CURRENT_SCHEMA_VERSION);
      }
    } catch (error) {
      // IndexedDB can also throw quota errors in extreme cases
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('IndexedDB quota exceeded. Consider clearing old data.');
        if (!quotaAlertShown) {
          quotaAlertShown = true;
          window.dispatchEvent(new CustomEvent('storage-quota-exceeded'));
        }
      } else {
        console.error(`storage.set error for key "${key}":`, error);
      }
      throw error;
    }
  },

  /**
   * Remove a value from IndexedDB
   * @param key - Storage key
   */
  async remove(key: string): Promise<void> {
    try {
      await idbRemove(key);
    } catch (error) {
      console.error(`storage.remove error for key "${key}":`, error);
      throw error;
    }
  },

  /**
   * Clear all IndexedDB data
   */
  async clear(): Promise<void> {
    try {
      await idbClear();
    } catch (error) {
      console.error('storage.clear error:', error);
      throw error;
    }
  },

  /**
   * Get all keys in IndexedDB
   * @returns Array of storage keys
   */
  async keys(): Promise<string[]> {
    try {
      return await idbKeys();
    } catch (error) {
      console.error('storage.keys error:', error);
      return [];
    }
  }
};

/** Reset the quota-exceeded flag (call after a successful cleanup). */
export function resetQuotaAlert() {
  quotaAlertShown = false;
}

/**
 * Return a breakdown of storage usage by key.
 * Now reads from IndexedDB instead of localStorage.
 */
export async function getStorageBreakdown(): Promise<{ key: string; sizeKB: number }[]> {
  return idbGetStorageBreakdown();
}

export default storage;
