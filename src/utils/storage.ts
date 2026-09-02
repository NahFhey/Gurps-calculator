/**
 * Key-value storage wrapper with async API.
 *
 * Backend: IndexedDB when available (quota in the GBs — a 162×145 map with
 * image layers burst localStorage's ~5MB cap, 2026-09-02), falling back to
 * localStorage where IndexedDB is missing (jsdom tests, sandboxed contexts).
 * Values already in localStorage are migrated to IndexedDB lazily on first
 * read and the localStorage copy is removed to free the origin quota.
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
// IndexedDB backend (localStorage fallback)
// ============================================================================

const DB_NAME = 'gurps-vtt-storage';
const DB_STORE = 'kv';

/** Memoized connection; resolves null when IndexedDB is unusable → localStorage fallback. */
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        // If the connection dies (e.g. user clears site data), reconnect lazily.
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        logger.warn('[Storage] IndexedDB unavailable, falling back to localStorage', request.error);
        resolve(null);
      };
      request.onblocked = () => resolve(null);
    } catch (error) {
      logger.warn('[Storage] IndexedDB open threw, falling back to localStorage', error);
      resolve(null);
    }
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/** Resolves when the request's transaction has durably completed. */
function writeToPromise(request: IDBRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = request.transaction;
    if (!transaction) {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('IndexedDB write failed'));
      return;
    }
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

async function backendGet(key: string): Promise<string | null> {
  const db = await openDatabase();
  if (!db) return localStorage.getItem(key);
  const stored = await requestToPromise(
    db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key)
  );
  if (typeof stored === 'string') return stored;
  // Lazy one-time migration of a pre-IndexedDB value. The localStorage copy is
  // removed only after the IndexedDB write has durably committed.
  const legacy = localStorage.getItem(key);
  if (legacy !== null) {
    try {
      await writeToPromise(
        db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(legacy, key)
      );
      localStorage.removeItem(key);
      logger.log(`[Storage] Migrated "${key}" from localStorage to IndexedDB (${legacy.length} chars)`);
    } catch (error) {
      logger.warn(`[Storage] Migration of "${key}" to IndexedDB failed; serving localStorage copy`, error);
    }
    return legacy;
  }
  return null;
}

async function backendSet(key: string, value: string): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    localStorage.setItem(key, value);
    return;
  }
  await writeToPromise(
    db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(value, key)
  );
  // A stale pre-migration copy must not shadow newer IndexedDB data if the
  // database is ever cleared, and it wastes the origin's localStorage quota.
  if (localStorage.getItem(key) !== null) localStorage.removeItem(key);
}

async function backendRemove(key: string): Promise<void> {
  const db = await openDatabase();
  if (db) {
    await writeToPromise(
      db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(key)
    );
  }
  localStorage.removeItem(key);
}

async function backendClear(): Promise<void> {
  const db = await openDatabase();
  if (db) {
    await writeToPromise(
      db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).clear()
    );
  }
  localStorage.clear();
}

async function backendKeys(): Promise<string[]> {
  const db = await openDatabase();
  const local = Object.keys(localStorage);
  if (!db) return local;
  const idbKeys = await requestToPromise(
    db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAllKeys()
  );
  return Array.from(new Set([...idbKeys.map(String), ...local]));
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
      const value = await backendGet(key);
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
      console.error(`storage.get error for key "${key}":`, error);
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
      await backendSet(key, value);

      // Track schema version when saving main state
      if (trackVersion && (key === 'appState' || key === 'gmState')) {
        saveSchemaVersion(CURRENT_SCHEMA_VERSION);
      }
    } catch (error) {
      // Handle quota exceeded errors gracefully
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Consider clearing old data.');
        if (!quotaAlertShown) {
          quotaAlertShown = true;
          // Dispatch a custom event so the UI can show a proper banner
          window.dispatchEvent(new CustomEvent('storage-quota-exceeded'));
        }
      } else {
        console.error(`storage.set error for key "${key}":`, error);
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
      await backendRemove(key);
    } catch (error) {
      console.error(`storage.remove error for key "${key}":`, error);
      throw error;
    }
  },

  /**
   * Clear all localStorage data
   */
  async clear(): Promise<void> {
    try {
      await backendClear();
    } catch (error) {
      console.error('storage.clear error:', error);
      throw error;
    }
  },

  /**
   * Get all keys in localStorage
   * @returns Array of storage keys
   */
  async keys(): Promise<string[]> {
    try {
      return await backendKeys();
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
