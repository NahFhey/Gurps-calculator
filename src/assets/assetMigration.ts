import type { CampaignState } from '../state/campaignReducer';
import type { AssetId, MapModel, MapState } from '../types/map';
import type { AssetStore } from './assetStore';
import { getAssetStore } from './assetStore';
import { parseDataUrl } from './dataUrl';

type ImageLayers = NonNullable<MapModel['imageLayers']>;
/** The parts of a map state (live or checkpoint DTO) that hold asset references. */
type AssetBearingMaps = {
  stamps?: MapState['stamps'];
  mapsById?: Record<string, { imageLayers?: ImageLayers }>;
};

/** The parts of a campaign (runtime state or DTO) that hold asset references. */
type AssetBearingState = {
  maps: AssetBearingMaps & { mapsById: Record<string, { imageLayers?: ImageLayers }> };
  checkpoints: { entries: { snapshot: { maps: AssetBearingMaps & { mapsById: Record<string, { imageLayers?: ImageLayers }> } } }[] };
};

/** References in live maps and all embedded checkpoint snapshots. */
export function collectReferencedAssetIds(state: AssetBearingState): Set<AssetId> {
  const ids = new Set<AssetId>();
  const collect = (maps: AssetBearingMaps | undefined) => {
    for (const stamp of Object.values(maps?.stamps ?? {})) ids.add(stamp.assetId);
    for (const map of Object.values(maps?.mapsById ?? {})) {
      for (const layer of map.imageLayers ?? []) if (layer.assetId) ids.add(layer.assetId);
    }
  };
  collect(state.maps);
  for (const entry of state.checkpoints?.entries ?? []) collect(entry.snapshot.maps);
  return ids;
}

/**
 * Copy on change, preserving legacy URLs when they cannot be decoded. Works on
 * runtime state and on DTOs: it only swaps image layers, so the result keeps
 * the input's shape (the overload states that; the body is typed structurally).
 */
export async function ingestInlineImageLayers<S extends AssetBearingState>(
  state: S, store?: AssetStore,
): Promise<{ state: S; ingested: number }>;
export async function ingestInlineImageLayers(
  state: AssetBearingState, store: AssetStore = getAssetStore(),
): Promise<{ state: AssetBearingState; ingested: number }> {
  let ingested = 0;
  // Generic over the map record: live maps hold Sets, checkpoint snapshots hold DTOs.
  async function ingestMapsById<M extends { imageLayers?: ImageLayers }>(
    mapsById: Record<string, M>,
  ): Promise<Record<string, M>> {
    let result = mapsById;
    for (const [id, map] of Object.entries(mapsById)) {
      const original: ImageLayers | undefined = map.imageLayers;
      if (!original) continue;
      let layers = original;
      for (const [index, layer] of original.entries()) {
        if (layer.assetId || !layer.src) continue;
        const parsed = parseDataUrl(layer.src);
        if (!parsed) continue;
        const assetId = await store.put(parsed.bytes, parsed.mime);
        if (layers === original) layers = [...layers];
        const { src: _src, ...rest } = layer;
        layers[index] = { ...rest, assetId, mime: parsed.mime };
        ingested++;
      }
      if (layers !== original) {
        if (result === mapsById) result = { ...mapsById };
        result[id] = { ...map, imageLayers: layers };
      }
    }
    return result;
  }
  async function ingestMaps<S extends { mapsById: Record<string, { imageLayers?: ImageLayers }> }>(maps: S): Promise<S> {
    if (!maps?.mapsById) return maps;
    const mapsById = await ingestMapsById(maps.mapsById);
    return mapsById === maps.mapsById ? maps : { ...maps, mapsById };
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

/**
 * Remove only assets unused by both current state and checkpoints.
 * `minAgeMs` spares unreferenced assets stored more recently than that: a
 * campaign that will reference them may not have been saved yet. The age is
 * checked inside the delete transaction, and a re-import refreshes it, so
 * another tab storing the same image mid-prune keeps it.
 */
export async function pruneUnreferencedAssets(
  state: CampaignState,
  store: AssetStore = getAssetStore(),
  { minAgeMs = 0, now = Date.now() }: { minAgeMs?: number; now?: number } = {},
): Promise<AssetId[]> {
  const referenced = collectReferencedAssetIds(state);
  const deleted: AssetId[] = [];
  for (const id of await store.list()) {
    if (referenced.has(id)) continue;
    if (minAgeMs > 0) {
      if (await store.deleteIfStoredBefore(id, now - minAgeMs + 1)) deleted.push(id);
      continue;
    }
    await store.delete(id);
    deleted.push(id);
  }
  return deleted;
}
