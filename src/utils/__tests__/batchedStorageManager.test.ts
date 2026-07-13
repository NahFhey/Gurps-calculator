import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BatchedStorageManager from '../batchedStorageManager';

type StorageApi = NonNullable<Window['storage']>;
type StorageSet = StorageApi['set'];

let originalStorage: Window['storage'];
let setMock: ReturnType<typeof vi.fn<StorageSet>>;

function installMockStorage(setImplementation?: StorageSet): void {
  setMock = vi.fn<StorageSet>(setImplementation ?? (async () => {}));

  window.storage = {
    async get(): Promise<{ value: string } | null> {
      return null;
    },
    set: setMock,
    async remove(): Promise<void> {},
    async clear(): Promise<void> {},
    async keys(): Promise<string[]> {
      return [];
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  originalStorage = window.storage;
  installMockStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  window.storage = originalStorage;
});

describe('BatchedStorageManager', () => {
  it('queues data and reports the scheduled batch in diagnostics', () => {
    const manager = new BatchedStorageManager(125);

    manager.queue('character', { name: 'Mira' });

    expect(manager.getPendingCount()).toBe(1);
    expect(manager.getDiagnostics()).toEqual({
      pendingCount: 1,
      hasScheduledFlush: true,
      pendingKeys: ['character'],
      delay: 125,
    });
  });

  it('batches queued keys into one scheduled flush in insertion order', async () => {
    const delay = 200;
    const manager = new BatchedStorageManager(delay);

    manager.queue('first', 1);
    expect(vi.getTimerCount()).toBe(1);

    manager.queue('second', { ready: true });
    manager.queue('third', ['a', 'b']);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(delay);

    expect(setMock).toHaveBeenCalledTimes(3);
    expect(setMock).toHaveBeenNthCalledWith(1, 'first', '1', true);
    expect(setMock).toHaveBeenNthCalledWith(2, 'second', '{"ready":true}', true);
    expect(setMock).toHaveBeenNthCalledWith(3, 'third', '["a","b"]', true);
    expect(manager.getPendingCount()).toBe(0);
    expect(manager.getDiagnostics().hasScheduledFlush).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(delay);
    expect(setMock).toHaveBeenCalledTimes(3);
  });

  it('JSON-stringifies object values before writing them', async () => {
    const manager = new BatchedStorageManager(50);
    const value = { attributes: { strength: 12 }, advantages: ['Fit'] };

    manager.queue('sheet', value);
    await manager.flush();

    expect(setMock).toHaveBeenCalledExactlyOnceWith(
      'sheet',
      JSON.stringify(value),
      true
    );
  });

  it('explicitly flushes all pending keys and is a no-op when nothing is pending', async () => {
    const manager = new BatchedStorageManager(50);

    manager.queue('one', { value: 1 });
    manager.queue('two', { value: 2 });

    await expect(manager.flush()).resolves.toBeUndefined();

    expect(setMock).toHaveBeenCalledTimes(2);
    expect(setMock).toHaveBeenNthCalledWith(1, 'one', '{"value":1}', true);
    expect(setMock).toHaveBeenNthCalledWith(2, 'two', '{"value":2}', true);
    expect(manager.getPendingCount()).toBe(0);
    expect(manager.getDiagnostics().hasScheduledFlush).toBe(false);

    await expect(manager.flush()).resolves.toBeUndefined();
    expect(setMock).toHaveBeenCalledTimes(2);
  });

  it('keeps only a failed key pending while allowing the flush to resolve', async () => {
    const failure = new Error('write failed');
    installMockStorage(async (key: string): Promise<void> => {
      if (key === 'bad') {
        throw failure;
      }
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const manager = new BatchedStorageManager(50);

    manager.queue('good', { saved: 1 });
    manager.queue('bad', { saved: 2 });
    manager.queue('also-good', { saved: 3 });

    await expect(manager.flush()).resolves.toBeUndefined();

    expect(setMock).toHaveBeenCalledTimes(3);
    expect(manager.getPendingCount()).toBe(1);
    expect(manager.getDiagnostics()).toEqual({
      pendingCount: 1,
      hasScheduledFlush: false,
      pendingKeys: ['bad'],
      delay: 50,
    });
    expect(errorSpy).toHaveBeenCalledExactlyOnceWith(
      'Error writing bad to storage:',
      failure
    );

    errorSpy.mockRestore();
  });

  describe('flushSpecific', () => {
    it('writes a single requested key and leaves other keys pending', async () => {
      const manager = new BatchedStorageManager(50);
      manager.queue('a', 1);
      manager.queue('b', 2);
      manager.queue('c', 3);

      await manager.flushSpecific('a');

      expect(setMock).toHaveBeenCalledExactlyOnceWith('a', '1', true);
      expect(manager.getDiagnostics()).toMatchObject({
        pendingCount: 2,
        hasScheduledFlush: true,
        pendingKeys: ['b', 'c'],
      });
    });

    it('writes requested key arrays in their supplied order', async () => {
      const manager = new BatchedStorageManager(50);
      manager.queue('a', 1);
      manager.queue('b', 2);
      manager.queue('c', 3);

      await manager.flushSpecific(['a', 'b']);

      expect(setMock).toHaveBeenCalledTimes(2);
      expect(setMock).toHaveBeenNthCalledWith(1, 'a', '1', true);
      expect(setMock).toHaveBeenNthCalledWith(2, 'b', '2', true);
      expect(manager.getDiagnostics()).toMatchObject({
        pendingCount: 1,
        hasScheduledFlush: true,
        pendingKeys: ['c'],
      });
    });

    it('flushes every pending key for null and clears the scheduled timer', async () => {
      const manager = new BatchedStorageManager(50);
      manager.queue('a', { id: 'a' });
      manager.queue('b', { id: 'b' });

      await manager.flushSpecific(null);

      expect(setMock).toHaveBeenCalledTimes(2);
      expect(setMock).toHaveBeenNthCalledWith(1, 'a', '{"id":"a"}', true);
      expect(setMock).toHaveBeenNthCalledWith(2, 'b', '{"id":"b"}', true);
      expect(manager.getPendingCount()).toBe(0);
      expect(manager.getDiagnostics().hasScheduledFlush).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('reset clears queued data and cancels the scheduled flush', async () => {
    const manager = new BatchedStorageManager(50);
    manager.queue('discarded', { value: true });

    manager.reset();

    expect(manager.getPendingCount()).toBe(0);
    expect(manager.getDiagnostics().hasScheduledFlush).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(50);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('waitForFlush resolves immediately when idle and after a scheduled flush completes', async () => {
    const delay = 75;
    const manager = new BatchedStorageManager(delay);

    await expect(manager.waitForFlush()).resolves.toBeUndefined();

    manager.queue('queued', { value: true });
    const flushCompletion = manager.waitForFlush();
    let settled = false;
    void flushCompletion.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(delay);

    await expect(flushCompletion).resolves.toBeUndefined();
    expect(settled).toBe(true);
    expect(setMock).toHaveBeenCalledExactlyOnceWith(
      'queued',
      '{"value":true}',
      true
    );
  });
});
