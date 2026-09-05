import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryAssetStore } from '../../assets/assetStore';
import { sha256Hex } from '../../assets/sha256';
import { imageLayer, imageState } from '../../assets/__tests__/fixtures';
import { pullMissingAssets, pushReferencedAssets } from '../assetSync';
import type { AssetSyncConnection, AssetSyncProgress } from '../assetSync';
import type { AssetId } from '../../types/map';

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

function connection() {
  return {
    uploadAsset: vi.fn<AssetSyncConnection['uploadAsset']>().mockResolvedValue({ created: true }),
    fetchAsset: vi.fn<AssetSyncConnection['fetchAsset']>().mockResolvedValue(null),
    listRemoteAssets: vi.fn<AssetSyncConnection['listRemoteAssets']>().mockResolvedValue([]),
  };
}

function references(ids: AssetId[]) {
  return imageState(ids.map((assetId, i) => imageLayer({ id: String(i), assetId, src: undefined }))).state;
}

describe('asset synchronization', () => {
  it('push lists once, skips remote ids, deduplicates, and reports locally missing ids', async () => {
    const store = createMemoryAssetStore();
    const bytes = new Uint8Array([1, 2, 3]);
    const local = await store.put(bytes, 'image/png');
    const remote = 'a'.repeat(64);
    const missing = 'b'.repeat(64);
    const transport = connection();
    transport.listRemoteAssets.mockResolvedValue([{ id: remote, mime: 'image/png', size: 1 }]);
    const reports: AssetSyncProgress[] = [];
    const result = await pushReferencedAssets(references([remote, local, missing, local]), {
      onProgress: (p) => reports.push(p),
    }, transport, store);
    expect(transport.listRemoteAssets).toHaveBeenCalledOnce();
    expect(transport.uploadAsset).toHaveBeenCalledExactlyOnceWith(local, bytes, 'image/png');
    expect(result).toEqual({ total: 3, done: 3, failed: [missing] });
    expect(reports[0]).toEqual({ total: 3, done: 0, failed: [] });
    expect(reports.map((p) => p.done)).toEqual([0, 1, 2, 3]);
    expect(reports[reports.length - 1]).toEqual(result);
  });

  it('counts inventory and upload network errors as failures without throwing', async () => {
    const store = createMemoryAssetStore();
    const id = await store.put(new Uint8Array([1]), 'image/jpeg');
    const transport = connection();
    transport.listRemoteAssets.mockRejectedValueOnce(new Error('offline'));
    expect(await pushReferencedAssets(references([id]), undefined, transport, store)).toEqual({ total: 1, done: 1, failed: [id] });
    expect(transport.uploadAsset).not.toHaveBeenCalled();
    transport.uploadAsset.mockRejectedValueOnce(new Error('quota'));
    expect((await pushReferencedAssets(references([id]), undefined, transport, store)).failed).toEqual([id]);
  });

  it('pull fetches only absent assets, includes checkpoint references, and reports 404', async () => {
    const store = createMemoryAssetStore();
    const local = await store.put(new Uint8Array([1]), 'image/png');
    const bytes = new Uint8Array([2, 3]);
    const remote = await sha256Hex(bytes);
    const missing = 'c'.repeat(64);
    const transport = connection();
    transport.fetchAsset.mockImplementation(async (id) => id === remote ? { bytes, mime: 'image/webp' } : null);
    const state = references([local, missing]);
    state.checkpoints.entries = [{ id: 'checkpoint', label: 'Earlier', createdAt: 1, snapshot: references([remote]) }];
    expect(await pullMissingAssets(state, undefined, transport, store)).toEqual({ total: 3, done: 3, failed: [missing] });
    expect(transport.fetchAsset.mock.calls.map(([id]) => id).sort()).toEqual([remote, missing].sort());
    expect(await store.get(remote)).toMatchObject({ bytes, mime: 'image/webp', id: remote });
    expect(transport.listRemoteAssets).not.toHaveBeenCalled();
  });

  it('stores by the actual returned bytes hash and flags a mismatched remote id', async () => {
    const store = createMemoryAssetStore();
    const requested = 'd'.repeat(64);
    const bytes = new Uint8Array([8, 9]);
    const transport = connection();
    transport.fetchAsset.mockResolvedValue({ bytes, mime: 'image/png' });
    expect(await pullMissingAssets(references([requested]), undefined, transport, store)).toEqual({ total: 1, done: 1, failed: [requested] });
    expect(await store.list()).toEqual([]);
    expect(await store.has(requested)).toBe(false);
  });

  it('continues after network and local store failures', async () => {
    const store = createMemoryAssetStore();
    const ids = ['a'.repeat(64), 'b'.repeat(64)];
    const transport = connection();
    transport.fetchAsset.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ bytes: new Uint8Array([5]), mime: 'image/png' });
    vi.spyOn(store, 'put').mockRejectedValueOnce(new Error('disk full'));
    const result = await pullMissingAssets(references(ids), undefined, transport, store);
    expect(result.done).toBe(2);
    expect(result.failed.sort()).toEqual(ids);
  });

  it('keeps at most four downloads in flight and finishes all references', async () => {
    const store = createMemoryAssetStore();
    const transport = connection();
    const values = Array.from({ length: 9 }, (_, i) => new Uint8Array([i]));
    const ids = await Promise.all(values.map(sha256Hex));
    const releases: Array<() => void> = [];
    let active = 0;
    let maximum = 0;
    transport.fetchAsset.mockImplementation(async (id) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      return { bytes: values[ids.indexOf(id)], mime: 'image/png' };
    });
    const pending = pullMissingAssets(references(ids), undefined, transport, store);
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    expect(transport.fetchAsset).toHaveBeenCalledTimes(4);
    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(releases).toHaveLength(1));
    releases.splice(0).forEach((release) => release());
    expect(await pending).toEqual({ total: 9, done: 9, failed: [] });
    expect(maximum).toBe(4);
    expect(await store.list()).toHaveLength(9);
  });

  it('reports completion for a state with no assets', async () => {
    const store = createMemoryAssetStore();
    const transport = connection();
    const onProgress = vi.fn();
    expect(await pullMissingAssets(references([]), { onProgress }, transport, store)).toEqual({ total: 0, done: 0, failed: [] });
    expect(onProgress).toHaveBeenCalledExactlyOnceWith({ total: 0, done: 0, failed: [] });
    expect(transport.fetchAsset).not.toHaveBeenCalled();
  });
});
