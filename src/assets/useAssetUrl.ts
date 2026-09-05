import { useEffect, useState } from 'react';
import type { MapImageLayer } from '../types/map';
import { getAssetStore } from './assetStore';

/** The store owns shared URLs; consumers do not revoke URLs still used by other layers/views. */
export function useAssetUrl(layer: Pick<MapImageLayer, 'assetId' | 'src'>): string | null {
  const { assetId, src } = layer;
  const [resolved, setResolved] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    void getAssetStore().getObjectUrl(assetId).then((url) => {
      if (!cancelled) setResolved({ id: assetId, url });
    }).catch((error: unknown) => {
      console.warn('[Assets] Failed to resolve image', assetId, error);
    });
    return () => { cancelled = true; };
  }, [assetId]);
  return assetId ? (resolved?.id === assetId ? resolved.url : null) : src ?? null;
}
