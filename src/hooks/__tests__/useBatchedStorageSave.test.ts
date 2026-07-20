import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { batchedStorageManager } from '../../utils/batchedStorageManager';
import { logger } from '../../utils/logger';
import { useBatchedStorageSave } from '../useBatchedStorageSave';

type StorageApi = NonNullable<Window['storage']>;
type StorageSet = StorageApi['set'];

let originalStorage: Window['storage'];

function installMockStorage(): void {
  window.storage = {
    async get(): Promise<{ value: string } | null> {
      return null;
    },
    set: vi.fn<StorageSet>(async () => {}),
    async remove(): Promise<void> {},
    async clear(): Promise<void> {},
    async keys(): Promise<string[]> {
      return [];
    },
  };
}

describe('useBatchedStorageSave', () => {
  beforeEach(() => {
    originalStorage = window.storage;
    installMockStorage();
    vi.spyOn(batchedStorageManager, 'queue').mockImplementation(() => {});
    vi.spyOn(batchedStorageManager, 'flush').mockResolvedValue(undefined);
    vi.spyOn(batchedStorageManager, 'flushSpecific').mockResolvedValue(undefined);
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.storage = originalStorage;
  });

  it('delegates saves to the batched storage manager', () => {
    const { result } = renderHook(() => useBatchedStorageSave());
    const value = { a: 1 };

    act(() => {
      result.current('someKey', value);
    });

    expect(batchedStorageManager.queue).toHaveBeenCalledExactlyOnceWith(
      'someKey',
      value,
    );
  });

  it('logs a failed queue operation without rethrowing it', () => {
    const queueError = new Error('queue failed');
    vi.mocked(batchedStorageManager.queue).mockImplementation(() => {
      throw queueError;
    });
    const { result } = renderHook(() => useBatchedStorageSave());

    expect(() => {
      act(() => {
        result.current('someKey', { a: 1 });
      });
    }).not.toThrow();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('someKey'),
      queueError,
    );
  });

  it('warns and does not queue when storage is unavailable', () => {
    window.storage = undefined;
    const { result } = renderHook(() => useBatchedStorageSave());

    act(() => {
      result.current('someKey', { a: 1 });
    });

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Storage not available');
    expect(batchedStorageManager.queue).not.toHaveBeenCalled();
  });

  it('flushes all pending saves when no key is provided', async () => {
    const { result } = renderHook(() => useBatchedStorageSave());

    await act(async () => {
      await result.current.flush();
    });

    expect(batchedStorageManager.flush).toHaveBeenCalledTimes(1);
    expect(batchedStorageManager.flushSpecific).not.toHaveBeenCalled();
  });

  it('flushes only the requested key when a key is provided', async () => {
    const { result } = renderHook(() => useBatchedStorageSave());

    await act(async () => {
      await result.current.flush('k');
    });

    expect(batchedStorageManager.flushSpecific).toHaveBeenCalledExactlyOnceWith('k');
    expect(batchedStorageManager.flush).not.toHaveBeenCalled();
  });

  it('logs a failed flush without rejecting', async () => {
    const flushError = new Error('flush failed');
    vi.mocked(batchedStorageManager.flush).mockRejectedValue(flushError);
    const { result } = renderHook(() => useBatchedStorageSave());

    await expect(
      act(async () => {
        await result.current.flush();
      }),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      'Error flushing storage:',
      flushError,
    );
  });
});
