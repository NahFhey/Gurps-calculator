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

const storage = {
  /**
   * Get a value from localStorage
   * Automatically handles schema migrations for application state
   *
   * @param {string} key - Storage key
   * @param {boolean} migrations - If true, apply schema migrations (default: true)
   * @returns {Promise<{value: string}|null>}
   */
  async get(key, migrations = true) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) {
        return null;
      }

      // Apply migrations for main state keys
      if (migrations && (key === 'appState' || key === 'gmState')) {
        try {
          const data = JSON.parse(value);
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
            );

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
   * @param {string} key - Storage key
   * @param {string} value - Value to store (should be JSON string)
   * @param {boolean} trackVersion - If true, update schema version (default: true)
   * @returns {Promise<void>}
   */
  async set(key, value, trackVersion = true) {
    try {
      localStorage.setItem(key, value);

      // Track schema version when saving main state
      if (trackVersion && (key === 'appState' || key === 'gmState')) {
        saveSchemaVersion(CURRENT_SCHEMA_VERSION);
      }
    } catch (error) {
      // Handle quota exceeded errors gracefully
      if (error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded. Consider clearing old data.');
        alert('Storage quota exceeded. Please export your data and clear old entries.');
      } else {
        console.error(`localStorage.set error for key "${key}":`, error);
      }
      throw error;
    }
  },

  /**
   * Remove a value from localStorage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`localStorage.remove error for key "${key}":`, error);
      throw error;
    }
  },

  /**
   * Clear all localStorage data
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('localStorage.clear error:', error);
      throw error;
    }
  },

  /**
   * Get all keys in localStorage
   * @returns {Promise<string[]>}
   */
  async keys() {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.error('localStorage.keys error:', error);
      return [];
    }
  }
};

export default storage;
