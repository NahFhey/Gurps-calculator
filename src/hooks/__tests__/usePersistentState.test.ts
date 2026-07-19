import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from '../usePersistentState';
import type { DebouncedSaveFunction } from '../useStorage';

function createDebouncedSave(): DebouncedSaveFunction {
  return Object.assign(vi.fn(), {
    flush: vi.fn(async () => {}),
  }) as unknown as DebouncedSaveFunction;
}

describe('usePersistentState', () => {
  it('returns primitive and non-primitive initial values', () => {
    const primitiveSave = createDebouncedSave();
    const { result: primitiveResult } = renderHook(() =>
      usePersistentState('k', 42, primitiveSave),
    );

    expect(primitiveResult.current[0]).toBe(42);

    const initialValue = ['broadsword', 'shield'];
    const objectSave = createDebouncedSave();
    const { result: objectResult } = renderHook(() =>
      usePersistentState('equipment', initialValue, objectSave),
    );

    expect(objectResult.current[0]).toBe(initialValue);
  });

  it('updates state through the returned setter', () => {
    const debouncedSave = createDebouncedSave();
    const { result } = renderHook(() =>
      usePersistentState('k', 42, debouncedSave),
    );

    act(() => {
      result.current[1](84);
    });

    expect(result.current[0]).toBe(84);
  });

  it('forwards the key and new value to debouncedSave', () => {
    const debouncedSave = createDebouncedSave();
    const newValue = { hp: 9, condition: 'stunned' };
    const { result } = renderHook(() =>
      usePersistentState('combatant-state', { hp: 12, condition: 'ready' }, debouncedSave),
    );

    act(() => {
      result.current[1](newValue);
    });

    expect(result.current[0]).toBe(newValue);
    expect(debouncedSave).toHaveBeenCalledTimes(1);
    expect(debouncedSave).toHaveBeenCalledWith('combatant-state', newValue);
  });

  it('forwards successive saves and keeps the last value in state', () => {
    const debouncedSave = createDebouncedSave();
    const { result } = renderHook(() =>
      usePersistentState('k', 'initial', debouncedSave),
    );

    act(() => {
      result.current[1]('first');
      result.current[1]('second');
    });

    expect(result.current[0]).toBe('second');
    expect(debouncedSave).toHaveBeenCalledTimes(2);
    expect(debouncedSave).toHaveBeenNthCalledWith(1, 'k', 'first');
    expect(debouncedSave).toHaveBeenNthCalledWith(2, 'k', 'second');
  });
});
