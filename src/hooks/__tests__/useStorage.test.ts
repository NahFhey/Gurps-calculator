import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeyedDebouncedStorageSave } from '../useStorage';

const SAVE_DELAY = 500;

describe('useKeyedDebouncedStorageSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('saves once after the debounce delay', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useKeyedDebouncedStorageSave(SAVE_DELAY));
    const data = { a: 1 };

    act(() => {
      result.current('someKey', data);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAVE_DELAY - 1);
    });
    expect(setItemSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith('someKey', JSON.stringify(data));
  });

  it('coalesces rapid saves for the same key and persists only the last value', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useKeyedDebouncedStorageSave(SAVE_DELAY));
    const lastData = { hp: 8 };

    act(() => {
      result.current('combatant', { hp: 10 });
      result.current('combatant', { hp: 9 });
      result.current('combatant', lastData);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAVE_DELAY);
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith('combatant', JSON.stringify(lastData));
  });

  it('logs a failed debounced save without rethrowing it', async () => {
    const quotaError = new Error('quota');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError;
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useKeyedDebouncedStorageSave(SAVE_DELAY));

    act(() => {
      result.current('limitedKey', { value: 'too large' });
    });

    await expect(
      act(async () => {
        await vi.advanceTimersByTimeAsync(SAVE_DELAY);
      }),
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Storage save failed for limitedKey:',
      quotaError,
    );
  });
});
