import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAssetStore, getAssetStorageTotal, getAssetStore, setAssetStoreForTests } from '../assetStore';
import { sha256Hex } from '../sha256';

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setAssetStoreForTests(null); });

describe('memory asset store', () => {
  it('put hashes the exact byte range and is idempotent, preserving the first metadata', async () => {
    const store = createMemoryAssetStore();
    const bytes = new TextEncoder().encode('abc');
    const id = await store.put(bytes, 'image/jpeg');
    expect(id).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(id).toBe(await sha256Hex(bytes));
    const first = await store.get(id);
    expect(await store.put(bytes, 'image/png')).toBe(id);
    expect(await store.get(id)).toEqual(first);
    expect(first).toMatchObject({ id, mime: 'image/jpeg', size: 3, createdAt: expect.any(Number) });
    expect(Array.from(first?.bytes ?? [])).toEqual(Array.from(bytes));
    expect(await store.put(new Uint8Array([0, 97, 98, 99, 0]).subarray(1, 4), 'image/jpeg')).toBe(id);
    expect(await store.list()).toEqual([id]);
  });

  it('get/has/delete/list/clear and defensive byte copies', async () => {
    const store = createMemoryAssetStore();
    const bytes = new Uint8Array([1, 2, 3]);
    const id = await store.put(bytes, 'image/jpeg');
    bytes[0] = 99;
    const record = await store.get(id);
    expect(record?.bytes[0]).toBe(1);
    if (record) record.bytes[0] = 88;
    expect((await store.get(id))?.bytes[0]).toBe(1);
    expect(await store.has(id)).toBe(true);
    await store.delete(id);
    expect(await store.get(id)).toBeNull();
    expect(await store.has(id)).toBe(false);
    expect(await store.getObjectUrl(id)).toBeNull();
    await store.put(bytes, 'image/jpeg');
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it('caches concurrent object URL requests, revokes on release/delete/clear', async () => {
    const createObjectURL = vi.fn(() => `blob:image-${Math.random()}`);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const store = createMemoryAssetStore();
    const id = await store.put(new Uint8Array([1]), 'image/jpeg');
    const [first, second] = await Promise.all([store.getObjectUrl(id), store.getObjectUrl(id)]);
    expect(first).toBe(second);
    expect(await store.getObjectUrl(id)).toBe(first);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    store.releaseObjectUrl(id);
    expect(revokeObjectURL).toHaveBeenCalledWith(first);
    expect(await store.getObjectUrl(id)).not.toBe(first);
    await store.delete(id);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    const other = await store.put(new Uint8Array([2]), 'image/jpeg');
    await store.getObjectUrl(other);
    await store.clear();
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it('cancels pending URL creation on release or clear', async () => {
    const createObjectURL = vi.fn(() => 'blob:image');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const store = createMemoryAssetStore();
    const id = await store.put(new Uint8Array([1]), 'image/jpeg');
    const pending = store.getObjectUrl(id);
    store.releaseObjectUrl(id);
    expect(await pending).toBeNull();
    const next = store.getObjectUrl(id);
    await store.clear();
    expect(await next).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('returns a usable data URL without createObjectURL and reports storage totals', async () => {
    vi.stubGlobal('URL', {});
    const store = createMemoryAssetStore();
    const id = await store.put(new Uint8Array([1, 2, 3]), 'image/jpeg');
    expect(await store.getObjectUrl(id)).toBe('data:image/jpeg;base64,AQID');
    await store.put(new Uint8Array(1024), 'image/png');
    expect(await getAssetStorageTotal(store)).toEqual({ count: 2, sizeKB: 1 });
    setAssetStoreForTests(store);
    expect(getAssetStore()).toBe(store);
  });
});


describe('singleton fallback', () => {
  it.each(['unavailable', 'open throws', 'open fails', 'open blocked'])('uses memory and warns once when IndexedDB is %s', async (failure) => {
    vi.resetModules();
    if (failure === 'unavailable') vi.stubGlobal('indexedDB', undefined);
    else if (failure === 'open throws') vi.stubGlobal('indexedDB', { open() { throw new Error('denied'); } });
    else {
      vi.stubGlobal('indexedDB', {
        open() {
          const request: { onerror?: () => void; onblocked?: () => void; error: Error } = { error: new Error('denied') };
          queueMicrotask(() => failure === 'open fails' ? request.onerror?.() : request.onblocked?.());
          return request;
        },
      });
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getAssetStore: singleton } = await import('../assetStore');
    const store = singleton();
    const id = await store.put(new Uint8Array([1]), 'image/jpeg');
    expect(await store.has(id)).toBe(true);
    expect(singleton()).toBe(store);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
