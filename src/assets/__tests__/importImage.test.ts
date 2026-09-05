import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryAssetStore, setAssetStoreForTests } from '../assetStore';
import { importImage } from '../importImage';

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setAssetStoreForTests(null); });

function mockImageDecode() {
  vi.stubGlobal('Image', class {
    width = 4096;
    height = 2048;
    onload: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  return drawImage;
}

describe('image upload encoding', () => {
  it('downscales to 2048, encodes JPEG at 0.85 and stores bytes without inline src', async () => {
    const store = createMemoryAssetStore();
    setAssetStoreForTests(store);
    const drawImage = mockImageDecode();
    const bytes = new Uint8Array([1, 2, 3]);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    Object.defineProperty(blob, 'arrayBuffer', { value: async () => bytes.buffer });
    const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
      expect(this.width).toBe(2048);
      expect(this.height).toBe(1024);
      callback(blob);
    });
    const result = await importImage(new File([bytes], 'map.png', { type: 'image/png' }));
    expect(encode).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1024);
    expect(result).toEqual({ assetId: expect.stringMatching(/^[a-f0-9]{64}$/), mime: 'image/jpeg', aspect: 0.5 });
    expect(Array.from((await store.get(result.assetId))!.bytes)).toEqual([1, 2, 3]);
  });

  it('rejects failed canvas encoding without storing an asset', async () => {
    const store = createMemoryAssetStore();
    setAssetStoreForTests(store);
    mockImageDecode();
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null));
    await expect(importImage(new File(['x'], 'map.png'))).rejects.toThrow('Failed to encode image');
    expect(await store.list()).toEqual([]);
  });
});
