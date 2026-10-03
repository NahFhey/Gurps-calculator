/**
 * Normalized exports: the public half is the player projection (review claim D).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryAssetStore, setAssetStoreForTests } from '../../assets/assetStore';
import { ingestInlineImageLayers } from '../../assets/assetMigration';
import type { CampaignState } from '../../state/campaignReducer';
import { exportLocked, exportUnlocked, importFile, splitState, unlockGMData } from '../exportImport';
import { gmSecretsCampaign, secretPaths } from './fixtures/gmSecretsCampaign';

const PASSWORD = 'correct horse battery';

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});
beforeEach(() => setAssetStoreForTests(createMemoryAssetStore()));
afterEach(() => setAssetStoreForTests(null));

async function storedCampaign() {
  const { state, map } = gmSecretsCampaign();
  const migrated = (await ingestInlineImageLayers(state)).state;
  const [publicLayer, gmLayer] = migrated.maps.mapsById[map.id].imageLayers!;
  return { state: migrated, publicAsset: publicLayer.assetId!, gmAsset: gmLayer.assetId! };
}

describe('player-safe normalized exports', () => {
  it('splitState public carries no GM secret; gm keeps them all', () => {
    const { state } = gmSecretsCampaign();
    const { public: pub, gm } = splitState(state);
    expect(secretPaths(pub)).toEqual([]);
    expect(gm.entities.alchemyReagents.unknown.notes).toBe('SECRET harvested under a new moon');
    expect(gm.checkpoints.entries).toHaveLength(1);
    expect(gm.ui.gmModeEnabled).toBe(true);
  });

  it('a locked export ships only player-visible asset bytes in plaintext', async () => {
    const { state, publicAsset, gmAsset } = await storedCampaign();
    const envelope = await exportLocked(state, PASSWORD, { iterations: 1000 });
    expect(secretPaths(envelope.public)).toEqual([]);
    expect(Object.keys(envelope.assets ?? {})).toEqual([publicAsset]);
    expect(gmAsset).not.toBe(publicAsset);
  });

  it('a locked export does not ship the bytes of the GM stamp library', async () => {
    const { state, publicAsset, gmAsset } = await storedCampaign();
    state.maps = { ...state.maps, stamps: { 'stamp-1': { id: 'stamp-1', name: 'Lair entrance', category: 'room',
      assetId: gmAsset, width: 1, height: 1, placement: 'overlay', createdAt: 1 } } };
    const envelope = await exportLocked(state, PASSWORD, { iterations: 1000 });
    expect(Object.keys(envelope.assets ?? {})).toEqual([publicAsset]);
  });

  it('an unlocked (GM) export still carries everything', async () => {
    const { state, publicAsset, gmAsset } = await storedCampaign();
    const envelope = await exportUnlocked(state);
    expect(Object.keys(envelope.assets ?? {}).sort()).toEqual([publicAsset, gmAsset].sort());
    expect(JSON.stringify(envelope.gm)).toContain('SECRET harvested under a new moon');
  });

  it('a locked import exposes no secrets until the GM unlocks it', async () => {
    const { state } = await storedCampaign();
    const result = await importFile(JSON.stringify(await exportLocked(state, PASSWORD, { iterations: 1000 })));
    if (!result.ok || !result.isLocked) throw new Error('expected a locked import');
    expect(secretPaths(result.data.public)).toEqual([]);

    const unlocked = await unlockGMData(result.data, PASSWORD);
    if (!unlocked.ok) throw new Error(unlocked.error);
    const gm = unlocked.gmData as unknown as CampaignState;
    expect(gm.entities.alchemyReagents.unknown.notes).toBe('SECRET harvested under a new moon');
  });
});
