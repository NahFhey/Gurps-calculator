import type { CampaignState } from '../state/campaignReducer';
import type { AssetId, MapState } from '../types/map';
import type { AssetStore } from './assetStore';
import { getAssetStore } from './assetStore';
import { parseDataUrl } from './dataUrl';

/** References in live maps and all embedded checkpoint snapshots. */
export function collectReferencedAssetIds(state: CampaignState): Set<AssetId> {
  const ids = new Set<AssetId>();
  const collect = (maps: MapState | undefined) => {
    for (const map of Object.values(maps?.mapsById ?? {})) {
      for (const layer of map.imageLayers ?? []) if (layer.assetId) ids.add(layer.assetId);
    }
  };
  collect(state.maps);
  for (const entry of state.checkpoints?.entries ?? []) collect(entry.snapshot.maps);
  return ids;
}

/** Copy on change, preserving legacy URLs when they cannot be decoded. */
export async function ingestInlineImageLayers(
  state: CampaignState, store: AssetStore = getAssetStore(),
): Promise<{ state: CampaignState; ingested: number }> {
  let ingested = 0;
  async function ingestMaps(maps: MapState): Promise<MapState> {
    if (!maps?.mapsById) return maps;
    let result = maps;
    for (const [id, map] of Object.entries(maps.mapsById)) {
      if (!map.imageLayers) continue;
      let layers = map.imageLayers;
      for (const [index, layer] of map.imageLayers.entries()) {
        if (layer.assetId || !layer.src) continue;
        const parsed = parseDataUrl(layer.src);
        if (!parsed) continue;
        const assetId = await store.put(parsed.bytes, parsed.mime);
        if (layers === map.imageLayers) layers = [...layers];
        const { src: _src, ...rest } = layer;
        layers[index] = { ...rest, assetId, mime: parsed.mime };
        ingested++;
      }
      if (layers !== map.imageLayers) {
        if (result === maps) result = { ...maps, mapsById: { ...maps.mapsById } };
        result.mapsById[id] = { ...map, imageLayers: layers };
      }
    }
    return result;
  }
  const maps = await ingestMaps(state.maps);
  let entries = state.checkpoints?.entries;
  for (const [index, entry] of (state.checkpoints?.entries ?? []).entries()) {
    const snapshotMaps = await ingestMaps(entry.snapshot.maps);
    if (snapshotMaps !== entry.snapshot.maps) {
      if (entries === state.checkpoints.entries) entries = [...entries];
      entries![index] = { ...entry, snapshot: { ...entry.snapshot, maps: snapshotMaps } };
    }
  }
  if (ingested === 0) return { state, ingested };
  return {
    state: {
      ...state,
      maps,
      ...(entries && entries !== state.checkpoints.entries
        ? { checkpoints: { ...state.checkpoints, entries } } : {}),
    },
    ingested,
  };
}

/** Remove only assets unused by both current state and checkpoints. */
export async function pruneUnreferencedAssets(
  state: CampaignState, store: AssetStore = getAssetStore(),
): Promise<AssetId[]> {
  const referenced = collectReferencedAssetIds(state);
  const deleted: AssetId[] = [];
  for (const id of await store.list()) {
    if (!referenced.has(id)) {
      await store.delete(id);
      deleted.push(id);
    }
  }
  return deleted;
}
