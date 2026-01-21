import { useState, useCallback } from 'react';

/**
 * Custom hook that combines useState with debounced storage persistence
 *
 * This hook eliminates the need for duplicate save functions by providing
 * a state setter that automatically saves to storage via the provided
 * debounced save function.
 *
 * @param {string} key - Storage key for this state
 * @param {*} initialValue - Initial state value
 * @param {Function} debouncedSave - Debounced save function from useKeyedDebouncedStorageSave
 * @returns {[*, Function]} Tuple of [state, save function]
 *
 * @example
 * const debouncedStorageSave = useKeyedDebouncedStorageSave();
 * const [materials, saveMaterials] = usePersistentState('materials', [], debouncedStorageSave);
 *
 * // Use like regular setState:
 * saveMaterials([...materials, newMaterial]);
 */
export function usePersistentState(key, initialValue, debouncedSave) {
  const [state, setState] = useState(initialValue);

  /**
   * Save function that updates state and triggers debounced storage save
   * @param {*} newValue - New state value
   */
  const save = useCallback((newValue) => {
    setState(newValue);
    debouncedSave(key, newValue);
  }, [key, debouncedSave]);

  return [state, save];
}
