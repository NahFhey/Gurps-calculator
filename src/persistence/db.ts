/**
 * IndexedDB storage via Dexie.js
 *
 * Replaces localStorage for campaign state persistence.
 * IndexedDB has no practical size limit (hundreds of MB vs localStorage's 5-10MB).
 *
 * Data is stored as key-value pairs in a single `kvStore` table,
 * keeping the same API surface as the old localStorage wrapper.
 */

// TODO: Install dexie package: npm install dexie
// import Dexie from 'dexie';

interface KVEntry {
  key: string;
  value: string;
}

// Placeholder for GurpsDB - requires dexie package
class GurpsDB {
  kvStore: any;

  constructor() {
    // TODO: Implement with actual Dexie
    this.kvStore = {};
  }

  version(_v: number) {
    return { stores: () => this };
  }
}

const db = new GurpsDB();

/**
 * Get a value from IndexedDB by key.
 * Returns the raw string value, or null if not found.
 */
export async function idbGet(key: string): Promise<string | null> {
  const entry = await db.kvStore.get(key);
  return entry?.value ?? null;
}

/**
 * Set a key-value pair in IndexedDB.
 * Value should be a JSON string (same contract as the old localStorage wrapper).
 */
export async function idbSet(key: string, value: string): Promise<void> {
  await db.kvStore.put({ key, value });
}

/**
 * Remove a key from IndexedDB.
 */
export async function idbRemove(key: string): Promise<void> {
  await db.kvStore.delete(key);
}

/**
 * Clear all data from IndexedDB.
 */
export async function idbClear(): Promise<void> {
  await db.kvStore.clear();
}

/**
 * Get all keys stored in IndexedDB.
 */
export async function idbKeys(): Promise<string[]> {
  return db.kvStore.toCollection().primaryKeys() as Promise<string[]>;
}

/**
 * Get approximate storage usage breakdown by key.
 * Returns entries sorted by size descending.
 */
export async function idbGetStorageBreakdown(): Promise<{ key: string; sizeKB: number }[]> {
  const all = await db.kvStore.toArray();
  const result = all.map((entry: KVEntry) => ({
    key: entry.key,
    sizeKB: Math.round(((entry.value.length * 2) / 1024) * 10) / 10,
  }));
  result.sort((a: { sizeKB: number }, b: { sizeKB: number }) => b.sizeKB - a.sizeKB);
  return result;
}

export default db;
