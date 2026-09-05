import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MapScene } from '../MapScene';
import type { MapSceneFrameData } from '../MapScene';
import { createMemoryAssetStore, setAssetStoreForTests } from '../../../../assets/assetStore';
import { imageLayer, imageState } from '../../../../assets/__tests__/fixtures';

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>();
  return {
    ...original,
    WebGLRenderer: class {
      setClearColor() {}
      setPixelRatio() {}
      setSize() {}
      render() {}
      dispose() {}
    },
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup() {
  const store = createMemoryAssetStore();
  setAssetStoreForTests(store);
  const canvas = document.createElement('canvas');
  const scene = new MapScene(canvas, {
    onTileClick: vi.fn(), onTileContextMenu: vi.fn(), onTilePaintStart: vi.fn(),
    onTilePaintEnter: vi.fn(), onHoverTile: vi.fn(),
  });
  const { map } = imageState([imageLayer({ src: undefined, assetId: 'asset-a' })]);
  const frame: MapSceneFrameData = {
    map, fog: 'gm', visibleTileIds: null, selectedTileIds: null, routeTileIds: null,
    reachableTileIds: null, tokens: null, paintModeActive: false, placingToken: false, alignMode: null,
  };
  return { store, scene, frame };
}

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); setAssetStoreForTests(null); });

describe('MapScene asset textures', () => {
  it('skips pending layers, rebuilds when resolved, and disposes/revokes on removal', async () => {
    const { store, scene, frame } = setup();
    const pending = deferred<string | null>();
    const resolve = vi.spyOn(store, 'getObjectUrl').mockReturnValue(pending.promise);
    const release = vi.spyOn(store, 'releaseObjectUrl');
    const texture = new THREE.Texture<HTMLImageElement>();
    const dispose = vi.spyOn(texture, 'dispose');
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(texture);
    const add = vi.spyOn(THREE.Scene.prototype, 'add');
    scene.update(frame);
    expect(load).not.toHaveBeenCalled();
    pending.resolve('blob:map');
    await pending.promise;
    await Promise.resolve();
    expect(load).toHaveBeenCalledWith('blob:map', expect.any(Function));
    const imageGroups = add.mock.calls.flat().filter((object) => object instanceof THREE.Group && object.children.some((child) => child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial && child.material.map === texture));
    expect(imageGroups).toHaveLength(1);
    scene.update({ ...frame, map: { ...frame.map } });
    expect(resolve).toHaveBeenCalledTimes(1);
    scene.update({ ...frame, map: { ...frame.map, imageLayers: [] } });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith('asset-a');
    scene.dispose();
  });

  it.each(['remove', 'replace', 'dispose'] as const)('ignores a late URL after %s', async (action) => {
    const { store, scene, frame } = setup();
    const pending = deferred<string | null>();
    vi.spyOn(store, 'getObjectUrl').mockReturnValueOnce(pending.promise).mockResolvedValue(null);
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load');
    const release = vi.spyOn(store, 'releaseObjectUrl');
    scene.update(frame);
    if (action === 'dispose') scene.dispose();
    else scene.update({ ...frame, map: { ...frame.map, imageLayers: action === 'remove' ? [] : [imageLayer({ src: undefined, assetId: 'asset-b', visible: false })] } });
    pending.resolve('blob:stale');
    await pending.promise;
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith('asset-a');
    scene.dispose();
  });

  it('warns once for a missing asset shared by multiple layers and skips its meshes', async () => {
    const { store, scene, frame } = setup();
    vi.spyOn(store, 'getObjectUrl').mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load');
    const layers = [imageLayer({ id: 'one', src: undefined, assetId: 'missing' }), imageLayer({ id: 'two', src: undefined, assetId: 'missing' })];
    scene.update({ ...frame, map: { ...frame.map, imageLayers: layers } });
    await Promise.resolve();
    scene.update({ ...frame, map: { ...frame.map, imageLayers: layers } });
    expect(warn).toHaveBeenCalledExactlyOnceWith('[MapScene] Missing image asset', 'missing');
    expect(load).not.toHaveBeenCalled();
    scene.dispose();
  });

  it('keeps legacy src loading synchronous and disposes textures on a source change', () => {
    const { scene, frame } = setup();
    const texture = new THREE.Texture<HTMLImageElement>();
    const dispose = vi.spyOn(texture, 'dispose');
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(texture);
    scene.update({ ...frame, map: { ...frame.map, imageLayers: [imageLayer()] } });
    expect(load).toHaveBeenCalledWith('data:image/jpeg;base64,AQID', expect.any(Function));
    scene.update({ ...frame, map: { ...frame.map, imageLayers: [imageLayer({ src: 'https://example.com/map' })] } });
    expect(dispose).toHaveBeenCalledTimes(1);
    scene.dispose();
  });
});
