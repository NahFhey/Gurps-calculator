import type { CampaignState } from '../state/campaignReducer';
import type { AssetId } from '../types/map';
import type { AssetStore } from '../assets/assetStore';
import { getAssetStore } from '../assets/assetStore';
import { collectReferencedAssetIds } from '../assets/assetMigration';
import { sha256Hex } from '../assets/sha256';
import { connectionManager } from './ConnectionManager';

export interface AssetSyncProgress { total: number; done: number; failed: AssetId[] }
export type AssetSyncConnection = Pick<typeof connectionManager, 'uploadAsset' | 'fetchAsset' | 'listRemoteAssets'>;
interface AssetSyncOptions { onProgress?: (progress: AssetSyncProgress) => void }

/** done counts processed references, including skipped and failed assets. */
async function syncReferences(
  ids: AssetId[],
  sync: (id: AssetId) => Promise<boolean>,
  opts?: AssetSyncOptions,
): Promise<AssetSyncProgress> {
  const progress: AssetSyncProgress = { total: ids.length, done: 0, failed: [] };
  const report = () => opts?.onProgress?.({ ...progress, failed: [...progress.failed] });
  report();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        if (!await sync(id)) progress.failed.push(id);
      } catch {
        progress.failed.push(id);
      }
      progress.done++;
      report();
    }
  }));
  return progress;
}

/** Upload referenced assets absent from a single remote inventory. */
export async function pushReferencedAssets(
  state: CampaignState,
  opts?: AssetSyncOptions,
  connection: AssetSyncConnection = connectionManager,
  store: AssetStore = getAssetStore(),
): Promise<AssetSyncProgress> {
  const ids = [...collectReferencedAssetIds(state)];
  let remote: Set<AssetId>;
  try {
    remote = new Set((await connection.listRemoteAssets()).map((asset) => asset.id));
  } catch {
    return syncReferences(ids, async () => false, opts);
  }
  return syncReferences(ids, async (id) => {
    if (remote.has(id)) return true;
    const asset = await store.get(id);
    if (!asset) return false;
    await connection.uploadAsset(id, asset.bytes, asset.mime);
    return true;
  }, opts);
}

/** Pull missing references with at most four transfers in flight. */
export async function pullMissingAssets(
  state: CampaignState,
  opts?: AssetSyncOptions,
  connection: AssetSyncConnection = connectionManager,
  store: AssetStore = getAssetStore(),
): Promise<AssetSyncProgress> {
  return syncReferences([...collectReferencedAssetIds(state)], async (id) => {
    if (await store.has(id)) return true;
    const asset = await connection.fetchAsset(id);
    if (!asset) return false;
    // The store always computes the key from bytes; never trust a remote label.
    // Verify before storing so a wrong remote payload never lands in the local store.
    if (await sha256Hex(asset.bytes) !== id) return false;
    await store.put(asset.bytes, asset.mime);
    return true;
  }, opts);
}
