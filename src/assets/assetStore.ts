import type { AssetId } from '../types/map';
import { sha256Hex } from './sha256';
import { toDataUrl } from './dataUrl';

export interface AssetRecord {
  id: AssetId;
  mime: string;
  bytes: Uint8Array;
  size: number;
  createdAt: number;
}

export interface AssetStore {
  /** Idempotent: hashing the bytes gives the id; storing an existing id is a no-op. */
  put(bytes: Uint8Array, mime: string): Promise<AssetId>;
  get(id: AssetId): Promise<AssetRecord | null>;
  has(id: AssetId): Promise<boolean>;
  delete(id: AssetId): Promise<void>;
  list(): Promise<AssetId[]>;
  /** Cached per id; null if missing. Released by releaseObjectUrl/clear. */
  getObjectUrl(id: AssetId): Promise<string | null>;
  releaseObjectUrl(id: AssetId): void;
  /** Remove everything (tests, reset app). */
  clear(): Promise<void>;
}

type Backend = Pick<AssetStore, 'get' | 'delete' | 'list' | 'clear'> & {
  insert(record: AssetRecord): Promise<void>;
};

function withUrls(backend: Backend): AssetStore {
  const urls = new Map<AssetId, string>();
  const pending = new Map<AssetId, Promise<string | null>>();
  const releaseObjectUrl = (id: AssetId) => {
    pending.delete(id);
    const url = urls.get(id);
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    urls.delete(id);
  };
  return {
    async put(bytes, mime) {
      const copy = new Uint8Array(bytes);
      const id = await sha256Hex(copy);
      await backend.insert({ id, mime, bytes: copy, size: copy.byteLength, createdAt: Date.now() });
      return id;
    },
    get: (id) => backend.get(id),
    async has(id) { return (await backend.get(id)) !== null; },
    async delete(id) {
      releaseObjectUrl(id);
      await backend.delete(id);
    },
    list: () => backend.list(),
    getObjectUrl(id) {
      const cached = urls.get(id);
      if (cached) return Promise.resolve(cached);
      const existing = pending.get(id);
      if (existing) return existing;
      const request = backend.get(id).then((record) => {
        if (!record || pending.get(id) !== request) return null;
        const url = typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(new Blob([new Uint8Array(record.bytes).buffer], { type: record.mime }))
          : toDataUrl(record.bytes, record.mime);
        urls.set(id, url);
        return url;
      }).finally(() => {
        if (pending.get(id) === request) pending.delete(id);
      });
      pending.set(id, request);
      return request;
    },
    releaseObjectUrl,
    async clear() {
      for (const id of new Set([...urls.keys(), ...pending.keys()])) releaseObjectUrl(id);
      await backend.clear();
    },
  };
}

function memoryBackend(): Backend {
  const records = new Map<AssetId, AssetRecord>();
  return {
    async insert(record) { if (!records.has(record.id)) records.set(record.id, record); },
    async get(id) {
      const record = records.get(id);
      return record ? { ...record, bytes: new Uint8Array(record.bytes) } : null;
    },
    async delete(id) { records.delete(id); },
    async list() { return [...records.keys()]; },
    async clear() { records.clear(); },
  };
}

export function createMemoryAssetStore(): AssetStore {
  return withUrls(memoryBackend());
}

function indexedDbBackend(): Backend {
  let connection: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open('gurps-vtt-assets', 1);
      let failed = false;
      request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'id' });
      request.onsuccess = () => {
        if (failed) { request.result.close(); return; }
        request.result.onclose = () => { connection = null; };
        resolve(request.result);
      };
      request.onerror = () => { failed = true; reject(request.error); };
      request.onblocked = () => { failed = true; reject(new Error('Asset database open blocked')); };
    });
    return connection;
  }
  async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', mode);
      const request = run(tx.objectStore('assets'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? new Error('Asset transaction aborted'));
      tx.onerror = () => reject(tx.error ?? new Error('Asset transaction failed'));
    });
  }
  return {
    async insert(record) {
      // Read and insert in one write transaction: concurrent puts preserve the first record.
      await transaction('readwrite', (store) => {
        const request: IDBRequest<AssetRecord | undefined> = store.get(record.id);
        request.onsuccess = () => { if (!request.result) store.add(record); };
        return request;
      });
    },
    async get(id) {
      return (await transaction<AssetRecord | undefined>('readonly', (store) => store.get(id))) ?? null;
    },
    async delete(id) { await transaction('readwrite', (store) => store.delete(id)); },
    async list() { return (await transaction('readonly', (store) => store.getAllKeys())).map(String); },
    async clear() { await transaction('readwrite', (store) => store.clear()); },
  };
}

export function createIndexedDbAssetStore(): AssetStore {
  return withUrls(indexedDbBackend());
}

let singleton: AssetStore | null = null;
let testStore: AssetStore | null = null;
let warned = false;
export function getAssetStore(): AssetStore {
  if (testStore) return testStore;
  if (!singleton) {
    // Select once after opening; operational errors after selection must propagate,
    // since silently switching then would hide assets already saved to IndexedDB.
    let selected: Promise<Backend> | null = null;
    const select = () => selected ??= (async () => {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('IndexedDB unavailable');
        const backend = indexedDbBackend();
        await backend.list();
        return backend;
      } catch (error) {
        if (!warned) {
          console.warn('[Assets] IndexedDB unavailable, using memory storage', error);
          warned = true;
        }
        return memoryBackend();
      }
    })();
    singleton = withUrls({
      async insert(record) { await (await select()).insert(record); },
      async get(id) { return (await select()).get(id); },
      async delete(id) { await (await select()).delete(id); },
      async list() { return (await select()).list(); },
      async clear() { await (await select()).clear(); },
    });
  }
  return singleton;
}

export function setAssetStoreForTests(store: AssetStore | null): void {
  testStore = store;
}

export async function getAssetStorageTotal(store: AssetStore = getAssetStore()): Promise<{ count: number; sizeKB: number }> {
  const ids = await store.list();
  let bytes = 0;
  for (const id of ids) bytes += (await store.get(id))?.size ?? 0;
  return { count: ids.length, sizeKB: Math.round(bytes / 1024 * 10) / 10 };
}
