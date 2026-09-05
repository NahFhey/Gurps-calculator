import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryAssetStore } from '../assetStore';
import { collectReferencedAssetIds, ingestInlineImageLayers, pruneUnreferencedAssets } from '../assetMigration';
import { imageLayer, imageState } from './fixtures';

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

describe('asset migration', () => {
  it('immutably migrates two maps and checkpoint maps, preserving remote and invalid URLs', async () => {
    const store = createMemoryAssetStore();
    const remote = imageLayer({ id: 'remote', src: 'https://example.com/map.jpg' });
    const { state, map } = imageState([imageLayer(), remote]);
    const { map: second } = imageState();
    state.maps.mapsById[second.id] = second;
    const { state: snapshot, map: historical } = imageState([imageLayer({ src: 'data:image/png;base64,BAUG' })]);
    state.checkpoints.entries = [{ id: 'checkpoint', label: 'Before combat', createdAt: 1, snapshot }];
    const before = JSON.stringify(state);
    const result = await ingestInlineImageLayers(state, store);
    expect(result.ingested).toBe(3);
    expect(result.state).not.toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    const maps = [result.state.maps.mapsById[map.id], result.state.maps.mapsById[second.id], result.state.checkpoints.entries[0].snapshot.maps.mapsById[historical.id]];
    for (const migrated of maps) {
      expect(migrated.imageLayers?.[0]).not.toHaveProperty('src');
      expect(migrated.imageLayers?.[0].assetId).toMatch(/^[a-f0-9]{64}$/);
      expect(await store.has(migrated.imageLayers?.[0].assetId ?? '')).toBe(true);
    }
    expect(maps[0].imageLayers?.[1]).toBe(remote);
    expect(collectReferencedAssetIds(result.state).size).toBe(2);
    expect(await ingestInlineImageLayers(result.state, store)).toEqual({ state: result.state, ingested: 0 });
    expect((await ingestInlineImageLayers(result.state, store)).state).toBe(result.state);
  });

  it('leaves invalid base64 and existing asset references untouched', async () => {
    const { state } = imageState([imageLayer({ src: 'data:image/png;base64,%%' }), imageLayer({ assetId: 'existing' })]);
    const store = createMemoryAssetStore();
    expect((await ingestInlineImageLayers(state, store)).state).toBe(state);
    expect(await store.list()).toEqual([]);
  });

  it('does not partially mutate input when storage fails', async () => {
    const { state } = imageState([imageLayer(), imageLayer({ id: 'second' })]);
    const store = createMemoryAssetStore();
    vi.spyOn(store, 'put').mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('quota'));
    await expect(ingestInlineImageLayers(state, store)).rejects.toThrow('quota');
    expect(Object.values(state.maps.mapsById)[0].imageLayers?.every((layer) => layer.src && !layer.assetId)).toBe(true);
  });

  it('prunes only unreferenced assets, retaining checkpoint-only references', async () => {
    const store = createMemoryAssetStore();
    const { state } = imageState();
    const { state: snapshot } = imageState([imageLayer({ src: 'data:image/png;base64,BAUG' })]);
    state.checkpoints.entries = [{ id: 'checkpoint', label: 'Before combat', createdAt: 1, snapshot }];
    const migrated = (await ingestInlineImageLayers(state, store)).state;
    const orphan = await store.put(new Uint8Array([7]), 'image/jpeg');
    expect(await pruneUnreferencedAssets(migrated, store)).toEqual([orphan]);
    expect(new Set(await store.list())).toEqual(collectReferencedAssetIds(migrated));
  });
});
