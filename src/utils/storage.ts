/**
 * Key-value storage wrapper with async API.
 *
 * Backend: IndexedDB when available (quota in the GBs — a 162×145 map with
 * image layers burst localStorage's ~5MB cap, 2026-09-02), falling back to
 * localStorage where IndexedDB is missing (jsdom tests, sandboxed contexts).
 * Values already in localStorage are migrated to IndexedDB lazily on first
 * read and the localStorage copy is removed to free the origin quota.
 *
 * Values are opaque strings here. Schema versioning lives with the campaign
 * (`meta.schemaVersion`, shared/campaignVersion.ts), not in this layer.
 */

import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export interface StorageGetResult {
  value: string;
}

export interface Storage {
  get: (key: string) => Promise<StorageGetResult | null>;
  /** Raw stored text; unlike `get`, read failures reject instead of resolving null. */
  readRaw: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
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

/**
 * IndexedDB exists here but could not be opened. The campaign may well be
 * stored in it, so strict reads and revisioned writes refuse to fall back to
 * localStorage, which would look like "no save" and then start a second,
 * separate history. A missing `indexedDB` global is a capability gap, not a
 * failure, and keeps the fallback.
 */
let idbOpenFailed = false;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const fail = (message: string, error: unknown) => {
      idbOpenFailed = true;
      logger.warn(message, error);
      resolve(null);
    };
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
      request.onerror = () =>
        fail('[Storage] IndexedDB unavailable, falling back to localStorage', request.error);
      request.onblocked = () => fail('[Storage] IndexedDB open blocked', null);
    } catch (error) {
      fail('[Storage] IndexedDB open threw, falling back to localStorage', error);
    }
  });
  return dbPromise;
}

export class StorageUnavailableError extends Error {
  constructor() {
    super('IndexedDB could not be opened, so the saved campaign cannot be read or written.');
    this.name = 'StorageUnavailableError';
  }
}

/** Open IndexedDB for an operation that must not silently fall back. */
async function openDatabaseStrict(): Promise<IDBDatabase | null> {
  const db = await openDatabase();
  if (!db && idbOpenFailed) throw new StorageUnavailableError();
  return db;
}

/** Best-effort removal of a stale localStorage copy after an IndexedDB commit. */
function removeLocalCopy(key: string) {
  try {
    if (localStorage.getItem(key) !== null) localStorage.removeItem(key);
  } catch (error) {
    // The IndexedDB commit already succeeded; failing here must not turn it
    // into a reported failure.
    logger.warn(`[Storage] Could not remove the stale localStorage copy of "${key}"`, error);
  }
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

async function backendGet(key: string, strict = false): Promise<string | null> {
  const db = strict ? await openDatabaseStrict() : await openDatabase();
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
      const current = await migrateLocalValue(db, key, legacy);
      removeLocalCopy(key);
      if (current === legacy) {
        logger.log(`[Storage] Migrated "${key}" from localStorage to IndexedDB (${legacy.length} chars)`);
      }
      return current;
    } catch (error) {
      logger.warn(`[Storage] Migration of "${key}" to IndexedDB failed; serving localStorage copy`, error);
    }
    return legacy;
  }
  return null;
}

/**
 * Copy a localStorage value into IndexedDB unless IndexedDB gained a value
 * since the readonly check above (another tab's save): absence is re-checked
 * inside the write transaction, so the old copy can never clobber it.
 * @returns the value IndexedDB holds once the transaction commits.
 */
function migrateLocalValue(db: IDBDatabase, key: string, legacy: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, 'readwrite');
    const store = transaction.objectStore(DB_STORE);
    let current = legacy;
    const existing = store.get(key);
    existing.onsuccess = () => {
      if (typeof existing.result === 'string') {
        current = existing.result;
      } else {
        store.put(legacy, key);
      }
    };
    transaction.oncomplete = () => resolve(current);
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
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
  removeLocalCopy(key);
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

/**
 * Read a raw value, letting backend failures propagate.
 *
 * `storage.get` maps every failure to null, which is indistinguishable from
 * "never saved". Callers that must not mistake an unreadable save for a
 * missing one (campaign load) use this instead.
 */
export async function readRawStrict(key: string): Promise<string | null> {
  return backendGet(key, true);
}

function parseRevision(raw: unknown): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export interface RevisionedWrite {
  valueKey: string;
  value: string;
  revisionKey: string;
  /**
   * Given the revision currently stored, return the revision to stamp, or
   * throw to abort the write. Runs inside the write transaction.
   */
  nextRevision: (storedRevision: number) => number;
  /** Refuse with ValueAlreadyPresentError if `valueKey` already holds a value. */
  requireValueAbsent?: boolean;
}

export class ValueAlreadyPresentError extends Error {
  constructor(key: string) {
    super(`Refusing to write "${key}": a value is already stored there.`);
    this.name = 'ValueAlreadyPresentError';
  }
}

/**
 * Compare-and-write: read the stored revision, decide, then write the value
 * and the new revision together. On IndexedDB all three steps share one
 * readwrite transaction, so a second tab cannot slip a save in between the
 * check and the write, and value and revision commit or fail as a unit.
 *
 * @returns the revision that was stamped.
 */
export async function writeWithRevision(write: RevisionedWrite): Promise<number> {
  const { valueKey, value, revisionKey, nextRevision, requireValueAbsent = false } = write;
  try {
    const db = await openDatabaseStrict();
    if (!db) return writeWithRevisionLocal(write);

    const next = await new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, 'readwrite');
      const store = transaction.objectStore(DB_STORE);
      let stamped = 0;
      let rejection: unknown = null;

      // Requests in one transaction complete in order, so this has its result
      // by the time the revision request's success handler runs.
      const valueRequest = requireValueAbsent ? store.get(valueKey) : null;
      const revisionRequest = store.get(revisionKey);
      revisionRequest.onsuccess = () => {
        // A revision that has not yet been lazily migrated out of
        // localStorage still counts.
        const raw = revisionRequest.result ?? localStorage.getItem(revisionKey);
        try {
          if (
            valueRequest &&
            (valueRequest.result !== undefined || localStorage.getItem(valueKey) !== null)
          ) {
            throw new ValueAlreadyPresentError(valueKey);
          }
          stamped = nextRevision(parseRevision(raw));
        } catch (error) {
          rejection = error;
          transaction.abort();
          return;
        }
        store.put(value, valueKey);
        store.put(String(stamped), revisionKey);
      };

      transaction.oncomplete = () => resolve(stamped);
      transaction.onabort = () =>
        reject(rejection ?? transaction.error ?? new Error('IndexedDB transaction aborted'));
      transaction.onerror = () => {
        if (rejection === null) rejection = transaction.error;
      };
    });

    // Stale pre-migration copies must not shadow the committed values.
    removeLocalCopy(valueKey);
    removeLocalCopy(revisionKey);
    return next;
  } catch (error) {
    reportWriteError(valueKey, error);
    throw error;
  }
}

/**
 * localStorage has no transactions. The revision is written first: if the
 * (large) value write then fails, the revision is put back, and until then a
 * revision ahead of its value only makes other sessions refuse to save. The
 * reverse order could leave a new value under the old revision, which another
 * session on that revision would overwrite.
 */
function writeWithRevisionLocal(write: RevisionedWrite): number {
  const { valueKey, value, revisionKey, nextRevision, requireValueAbsent = false } = write;
  if (requireValueAbsent && localStorage.getItem(valueKey) !== null) {
    throw new ValueAlreadyPresentError(valueKey);
  }
  const previousRevision = localStorage.getItem(revisionKey);
  const next = nextRevision(parseRevision(previousRevision));
  localStorage.setItem(revisionKey, String(next));
  try {
    localStorage.setItem(valueKey, value);
  } catch (error) {
    try {
      if (previousRevision === null) localStorage.removeItem(revisionKey);
      else localStorage.setItem(revisionKey, previousRevision);
    } catch (restoreError) {
      logger.warn('[Storage] Could not restore the previous revision after a failed write', restoreError);
    }
    throw error;
  }
  return next;
}

// ============================================================================
// Storage Implementation
// ============================================================================

/** Prevent alert() from firing on every failed save (debounce). */
let quotaAlertShown = false;

function reportWriteError(key: string, error: unknown) {
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    console.error('Storage quota exceeded. Consider clearing old data.');
    if (!quotaAlertShown) {
      quotaAlertShown = true;
      // Dispatch a custom event so the UI can show a proper banner
      window.dispatchEvent(new CustomEvent('storage-quota-exceeded'));
    }
  } else if (!(error instanceof Error && error.name === 'CampaignStateConflictError')) {
    console.error(`storage write error for key "${key}":`, error);
  }
}

const storage: Storage = {
  /**
   * Get a value. Read failures resolve null (use `readRaw` to see them).
   * @param key - Storage key
   * @returns Object with value string or null if not found
   */
  async get(key: string): Promise<StorageGetResult | null> {
    try {
      const value = await backendGet(key);
      return value === null ? null : { value };
    } catch (error) {
      console.error(`storage.get error for key "${key}":`, error);
      return null;
    }
  },


  readRaw: readRawStrict,

  /**
   * Set a value
   * @param key - Storage key
   * @param value - Value to store (should be JSON string)
   */
  async set(key: string, value: string): Promise<void> {
    try {
      await backendSet(key, value);
    } catch (error) {
      reportWriteError(key, error);
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
