import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryAssetStore, getAssetStore, setAssetStoreForTests } from '../../assets/assetStore';
import { imageLayer, imageState } from '../../assets/__tests__/fixtures';
import { ingestInlineImageLayers } from '../../assets/assetMigration';
import { collectExportAssets, exportLocked, exportUnlocked, importFile, SCHEMA_VERSION, unlockGMData } from '../exportImport';
import { CampaignImportSchema } from '../importSchemas';
import type { CampaignState } from '../../state/campaignReducer';

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});
beforeEach(() => setAssetStoreForTests(createMemoryAssetStore()));
afterEach(() => setAssetStoreForTests(null));

describe('campaign assets in exports', () => {
  it('exports bytes once for both halves and restores them into an empty store', async () => {
    const { state, map } = imageState();
    const migrated = (await ingestInlineImageLayers(state)).state;
    const id = migrated.maps.mapsById[map.id].imageLayers![0].assetId!;
    const envelope = await exportUnlocked(migrated);
    expect(envelope.assets).toEqual({ [id]: { mime: 'image/jpeg', base64: 'AQID' } });
    expect(CampaignImportSchema.safeParse(envelope).success).toBe(true);
    setAssetStoreForTests(createMemoryAssetStore());
    const result = await importFile(JSON.stringify(envelope));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const imported = result.data.public as unknown as CampaignState;
    expect(imported.maps.mapsById[map.id].imageLayers![0].assetId).toBe(id);
    expect(await getAssetStore().has(id)).toBe(true);
    expect(await getAssetStore().getObjectUrl(id)).toMatch(/^(blob:|data:image\/jpeg;base64,)/);
    expect(Array.from((await getAssetStore().get(id))!.bytes)).toEqual([1, 2, 3]);
  });

  it('includes checkpoint-only assets, deduplicates references, and skips missing bytes', async () => {
    const { state } = imageState();
    const { state: snapshot } = imageState([imageLayer({ src: 'data:image/png;base64,BAUG' })]);
    state.checkpoints.entries = [{ id: 'checkpoint', label: 'Snapshot', createdAt: 1, snapshot }];
    const migrated = (await ingestInlineImageLayers(state)).state;
    expect(Object.keys(await collectExportAssets(migrated))).toHaveLength(2);
    await getAssetStore().clear();
    expect(await collectExportAssets(migrated)).toEqual({});
  });

  it('skips corrupt hashes and invalid base64 without storing either entry or throwing', async () => {
    const id = 'a'.repeat(64);
    const { state, map } = imageState([imageLayer({ assetId: id, src: undefined })]);
    const envelope = await exportUnlocked(state);
    envelope.assets = {
      [id]: { mime: 'image/jpeg', base64: 'AQID' },
      ['b'.repeat(64)]: { mime: 'image/jpeg', base64: '%%%' },
    };
    const result = await importFile(envelope);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect((result.data.public as unknown as CampaignState).maps.mapsById[map.id].imageLayers![0].assetId).toBe(id);
    expect(await getAssetStore().list()).toEqual([]);
    expect(await getAssetStore().getObjectUrl(id)).toBeNull();
  });

  it('ingests legacy inline src in both public and GM halves with no assets envelope', async () => {
    const { state, map } = imageState();
    const result = await importFile({ schemaVersion: SCHEMA_VERSION, exportType: 'unlocked', public: state, gm: state });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    for (const payload of [result.data.public, result.data.gm]) {
      const layer = (payload as unknown as CampaignState).maps.mapsById[map.id].imageLayers![0];
      expect(layer).not.toHaveProperty('src');
      expect(layer.mime).toBe('image/jpeg');
      expect(await getAssetStore().has(layer.assetId!)).toBe(true);
    }
    expect(map.imageLayers![0].src).toBe('data:image/jpeg;base64,AQID');
  });

  it('bundles locked export assets and ingests legacy GM data after decrypting', async () => {
    const { state } = imageState();
    const migrated = (await ingestInlineImageLayers(state)).state;
    const envelope = await exportLocked(migrated, 'password');
    expect(Object.keys(envelope.assets ?? {})).toHaveLength(1);
    setAssetStoreForTests(createMemoryAssetStore());
    const imported = await importFile(envelope);
    expect(imported.ok && imported.isLocked).toBe(true);
    expect(await getAssetStore().list()).toHaveLength(1);
    const legacyLocked = await exportLocked(state, 'password');
    setAssetStoreForTests(createMemoryAssetStore());
    const unlocked = await unlockGMData(legacyLocked, 'password');
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) throw new Error(unlocked.error);
    const layers = Object.values((unlocked.gmData as CampaignState).maps.mapsById)[0].imageLayers!;
    expect(layers[0]).not.toHaveProperty('src');
    expect(await getAssetStore().has(layers[0].assetId!)).toBe(true);
  });
});
