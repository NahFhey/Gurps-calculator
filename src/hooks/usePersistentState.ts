import { useState, useCallback } from 'react';
import type { DebouncedSaveFunction } from './useStorage';

/**
 * Custom hook that combines useState with debounced storage persistence
 *
 * This hook eliminates the need for duplicate save functions by providing
 * a state setter that automatically saves to storage via the provided
 * debounced save function.
 *
 * @param key - Storage key for this state
 * @param initialValue - Initial state value
 * @param debouncedSave - Debounced save function from useKeyedDebouncedStorageSave
 * @returns Tuple of [state, save function]
 *
 * @example
 * ```tsx
 * const debouncedStorageSave = useKeyedDebouncedStorageSave();
 * const [materials, saveMaterials] = usePersistentState('materials', [], debouncedStorageSave);
 *
 * // Use like regular setState:
 * saveMaterials([...materials, newMaterial]);
 * ```
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
  debouncedSave: DebouncedSaveFunction
): [T, (newValue: T) => void] {
  const [state, setState] = useState<T>(initialValue);

  /**
   * Save function that updates state and triggers debounced storage save
   * @param newValue - New state value
   */
  const save = useCallback((newValue: T): void => {
    setState(newValue);
    debouncedSave(key, newValue);
  }, [key, debouncedSave]);

  return [state, save];
}
