/**
 * localStorage wrapper with async API
 * Designed to be easily swappable with a backend API later
 *
 * Migration path: Replace this implementation with fetch() calls to Express backend
 *
 * Schema Versioning:
 * - Automatically handles data migrations on load
 * - Tracks schema version in localStorage
 * - Supports upgrading from v1.0.0 to current version
 */

import { getStoredSchemaVersion, saveSchemaVersion, CURRENT_SCHEMA_VERSION } from './schemaVersioning';
import { migrateData, validateDataForVersion } from './dataMigrations';
import { logger } from './logger';

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
// Storage Implementation
// ============================================================================

/** Prevent alert() from firing on every failed save (debounce). */
let quotaAlertShown = false;

const storage: Storage = {
  /**
   * Get a value from localStorage
   * Automatically handles schema migrations for application state
   *
   * @param key - Storage key
   * @param migrations - If true, apply schema migrations (default: true)
   * @returns Object with value string or null if not found
   */
  async get(key: string, migrations: boolean = true): Promise<StorageGetResult | null> {
    try {
      const value = localStorage.getItem(key);
      if (value === null) {
        return null;
      }

      // Apply migrations for main state keys
      if (migrations && (key === 'appState' || key === 'gmState')) {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(value) as Record<string, unknown>;
        } catch (parseError) {
          logger.warn(
            `Malformed JSON in localStorage for key "${key}"; returning null.`,
            parseError
          );
          return null;
        }
        try {
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
      console.error(`localStorage.get error for key "${key}":`, error);
      return null;
    }
  },


  /**
   * Set a value in localStorage
   * Automatically tracks schema version on state saves
   *
   * @param key - Storage key
   * @param value - Value to store (should be JSON string)
   * @param trackVersion - If true, update schema version (default: true)
   */
  async set(key: string, value: string, trackVersion: boolean = true): Promise<void> {
    try {
      localStorage.setItem(key, value);

      // Track schema version when saving main state
      if (trackVersion && (key === 'appState' || key === 'gmState')) {
        saveSchemaVersion(CURRENT_SCHEMA_VERSION);
      }
    } catch (error) {
      // Handle quota exceeded errors gracefully
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded. Consider clearing old data.');
        if (!quotaAlertShown) {
          quotaAlertShown = true;
          // Dispatch a custom event so the UI can show a proper banner
          window.dispatchEvent(new CustomEvent('storage-quota-exceeded'));
        }
      } else {
        console.error(`localStorage.set error for key "${key}":`, error);
      }
      throw error;
    }
  },

  /**
   * Remove a value from localStorage
   * @param key - Storage key
   */
  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`localStorage.remove error for key "${key}":`, error);
      throw error;
    }
  },

  /**
   * Clear all localStorage data
   */
  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('localStorage.clear error:', error);
      throw error;
    }
  },

  /**
   * Get all keys in localStorage
   * @returns Array of storage keys
   */
  async keys(): Promise<string[]> {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.error('localStorage.keys error:', error);
      return [];
    }
  }
};

/** Reset the quota-exceeded flag (call after a successful cleanup). */
export function resetQuotaAlert() {
  quotaAlertShown = false;
}

/**
 * Return a breakdown of localStorage usage by key.
 * Sizes are in bytes (each JS char ≈ 2 bytes in UTF-16, but localStorage
 * implementations count in UTF-16 code units, so .length is the relevant metric).
 */
export function getStorageBreakdown(): { key: string; sizeKB: number }[] {
  const result: { key: string; sizeKB: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const val = localStorage.getItem(key) ?? '';
    result.push({ key, sizeKB: Math.round((val.length * 2) / 1024 * 10) / 10 });
  }
  result.sort((a, b) => b.sizeKB - a.sizeKB);
  return result;
}

export default storage;
