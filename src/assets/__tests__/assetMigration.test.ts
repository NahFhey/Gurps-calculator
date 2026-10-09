import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryAssetStore } from '../assetStore';
import { collectReferencedAssetIds, ingestInlineImageLayers, pruneUnreferencedAssets } from '../assetMigration';
import { imageLayer, imageState } from './fixtures';
import { toSnapshotDTO } from '../../persistence/campaignCodec';

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
    state.checkpoints.entries = [{ id: 'checkpoint', label: 'Before combat', createdAt: 1, snapshot: toSnapshotDTO(snapshot) }];
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
    state.checkpoints.entries = [{ id: 'checkpoint', label: 'Before combat', createdAt: 1, snapshot: toSnapshotDTO(snapshot) }];
    const migrated = (await ingestInlineImageLayers(state, store)).state;
    const orphan = await store.put(new Uint8Array([7]), 'image/jpeg');
    expect(await pruneUnreferencedAssets(migrated, store)).toEqual([orphan]);
    expect(new Set(await store.list())).toEqual(collectReferencedAssetIds(migrated));
  });

  it('spares unreferenced assets younger than minAgeMs', async () => {
    const store = createMemoryAssetStore();
    const { state } = imageState([]);
    const orphan = await store.put(new Uint8Array([8]), 'image/jpeg');
    const createdAt = (await store.get(orphan))!.createdAt;
    const hour = 60 * 60 * 1000;

    // Another tab may have stored it for a campaign it has not committed yet.
    expect(await pruneUnreferencedAssets(state, store, { minAgeMs: hour, now: createdAt + hour - 1 })).toEqual([]);
    expect(await store.has(orphan)).toBe(true);

    expect(await pruneUnreferencedAssets(state, store, { minAgeMs: hour, now: createdAt + hour })).toEqual([orphan]);
    expect(await store.has(orphan)).toBe(false);
  });

  it('keeps an old asset that another tab stores again while the prune runs', async () => {
    const store = createMemoryAssetStore();
    const { state } = imageState([]);
    const hour = 60 * 60 * 1000;
    const bytes = new Uint8Array([9]);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() - 2 * hour);
    const old = await store.put(bytes, 'image/jpeg');
    clock.mockRestore();

    // Another tab re-imports the same image (same id) after this prune listed
    // the store, then commits a campaign that references it.
    const racing = {
      ...store,
      async list() {
        const ids = await store.list();
        await store.put(bytes, 'image/jpeg');
        return ids;
      },
    };
    expect(await pruneUnreferencedAssets(state, racing, { minAgeMs: hour })).toEqual([]);
    expect(await store.has(old)).toBe(true);
  });

  it('decides the age and deletes in one step, not read-then-delete', async () => {
    const store = createMemoryAssetStore();
    const { state } = imageState([]);
    const hour = 60 * 60 * 1000;
    const bytes = new Uint8Array([10]);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() - 2 * hour);
    const old = await store.put(bytes, 'image/jpeg');
    clock.mockRestore();

    // A re-import landing right after a separate age read must still win.
    // (Deciding inside the delete leaves no such gap: no read, no re-import.)
    let reimported = false;
    const racing = {
      ...store,
      async get(id: string) {
        const record = await store.get(id);
        await store.put(bytes, 'image/jpeg');
        reimported = true;
        return record;
      },
    };
    const deleted = await pruneUnreferencedAssets(state, racing, { minAgeMs: hour });
    expect({ reimported, kept: await store.has(old) }).toEqual(
      reimported ? { reimported, kept: true } : { reimported, kept: false },
    );
    expect(deleted).toEqual(reimported ? [] : [old]);
  });
});

it('collects and retains live and checkpoint stamp assets even without any image layers', async () => {
  const store = createMemoryAssetStore();
  const liveId = await store.put(new Uint8Array([11]), 'image/jpeg');
  const checkpointId = await store.put(new Uint8Array([12]), 'image/jpeg');
  const orphanId = await store.put(new Uint8Array([13]), 'image/jpeg');
  const { state } = imageState([]);
  const { state: snapshot } = imageState([]);
  const stamp = { id: 'stamp', name: 'Room', category: 'room' as const, assetId: liveId, width: 4, height: 3, placement: 'underlay' as const, createdAt: 1 };
  state.maps.stamps = { stamp };
  snapshot.maps.stamps = { stamp: { ...stamp, assetId: checkpointId } };
  state.checkpoints.entries = [{ id: 'checkpoint', label: 'Before combat', createdAt: 1, snapshot: toSnapshotDTO(snapshot) }];
  expect(collectReferencedAssetIds(state)).toEqual(new Set([liveId, checkpointId]));
  expect(await pruneUnreferencedAssets(state, store)).toEqual([orphanId]);
  expect(new Set(await store.list())).toEqual(new Set([liveId, checkpointId]));
});
