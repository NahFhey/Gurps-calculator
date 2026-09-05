import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAssetStore, setAssetStoreForTests } from '../assetStore';
import { useAssetUrl } from '../useAssetUrl';
import type { MapImageLayer } from '../../types/map';

afterEach(() => { setAssetStoreForTests(null); vi.restoreAllMocks(); });

describe('useAssetUrl', () => {
  it('returns legacy src synchronously', () => {
    const { result } = renderHook(() => useAssetUrl({ src: 'data:image/jpeg;base64,AQID' }));
    expect(result.current).toBe('data:image/jpeg;base64,AQID');
  });
  it('resolves asset URLs and ignores stale resolutions after the layer changes', async () => {
    const store = createMemoryAssetStore();
    setAssetStoreForTests(store);
    let finishFirst!: (value: string) => void;
    const first = new Promise<string>((resolve) => { finishFirst = resolve; });
    vi.spyOn(store, 'getObjectUrl').mockReturnValueOnce(first).mockResolvedValue('blob:second');
    const { result, rerender } = renderHook((layer: Pick<MapImageLayer, 'assetId' | 'src'>) => useAssetUrl(layer), { initialProps: { assetId: 'first' } as Pick<MapImageLayer, 'assetId' | 'src'> });
    expect(result.current).toBeNull();
    rerender({ assetId: 'second' });
    await waitFor(() => expect(result.current).toBe('blob:second'));
    await act(async () => { finishFirst('blob:first'); await first; });
    expect(result.current).toBe('blob:second');
    rerender({ assetId: undefined, src: 'legacy' });
    expect(result.current).toBe('legacy');
  });
});
