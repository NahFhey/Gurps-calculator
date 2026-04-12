import { useRef, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';

/**
 * @fileoverview Custom React hook for debounced storage operations
 *
 * Provides keyed debouncing to prevent race conditions when multiple
 * data keys are being saved simultaneously. Includes automatic flush
 * on page unload to prevent data loss.
 */

// Window.storage is declared in batchedStorageManager.ts

/**
 * Type for the debounced save function with flush method
 */
export interface DebouncedSaveFunction {
  (key: string, data: unknown): void;
  flush: (key?: string) => Promise<void>;
}

/**
 * Custom hook for keyed, debounced storage saves with flush support
 *
 * This hook maintains separate debounce timers per storage key, preventing
 * the common issue of rapid saves to different keys interfering with each other.
 *
 * Key features:
 * - Per-key debouncing: Each storage key has its own independent timer
 * - Flush support: Force immediate save of pending data
 * - beforeunload protection: Attempts to save pending data when page closes
 * - Cleanup on unmount: Flushes all pending saves when component unmounts
 *
 * Usage:
 * ```tsx
 * const debouncedSave = useKeyedDebouncedStorageSave(500);
 * debouncedSave('myKey', myData);  // Saves after 500ms of no changes
 * debouncedSave.flush('myKey');    // Force immediate save
 * debouncedSave.flush();           // Flush all pending saves
 * ```
 *
 * @param delay - Debounce delay in milliseconds (default: 500)
 * @returns Debounced save function with flush method attached
 */
export function useKeyedDebouncedStorageSave(delay: number = 500): DebouncedSaveFunction {
  /** Map of key -> timeout ID */
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Map of key -> pending data */
  const pendingDataRef = useRef<Map<string, unknown>>(new Map());

  /**
   * Immediately saves pending data for a specific key or all keys
   * Cancels any pending debounced saves for the flushed keys
   *
   * @param key - Specific key to flush, or undefined to flush all
   */
  const flush = useCallback(async (key?: string): Promise<void> => {
    const timers = timersRef.current;
    const pendingData = pendingDataRef.current;

    if (key) {
      // Flush single key
      if (timers.has(key)) {
        clearTimeout(timers.get(key));
        timers.delete(key);
      }
      if (pendingData.has(key)) {
        const data = pendingData.get(key);
        pendingData.delete(key);
        try {
          // Use localStorage as fallback if window.storage unavailable
          if (window?.storage?.set) {
            await window.storage.set(key, JSON.stringify(data), true);
          } else {
            localStorage.setItem(key, JSON.stringify(data));
          }
        } catch (e) {
          logger.error(`Storage flush failed for ${key}:`, e);
        }
      }
    } else {
      // Flush all keys
      const keys = Array.from(pendingData.keys());
      for (const k of keys) {
        if (timers.has(k)) {
          clearTimeout(timers.get(k));
          timers.delete(k);
        }
        const data = pendingData.get(k);
        pendingData.delete(k);
        try {
          if (window?.storage?.set) {
            await window.storage.set(k, JSON.stringify(data), true);
          } else {
            localStorage.setItem(k, JSON.stringify(data));
          }
        } catch (e) {
          logger.error(`Storage flush failed for ${k}:`, e);
        }
      }
    }
  }, []);

  /**
   * Debounced save function - queues data for saving after delay
   * If called again for the same key before delay expires, timer is reset
   *
   * @param key - Storage key to save to
   * @param data - Data to save (will be JSON stringified)
   */
  const debouncedSave = useCallback((key: string, data: unknown): void => {
    const timers = timersRef.current;
    const pendingData = pendingDataRef.current;

    // Cancel existing timer
    const existingTimer = timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    // Store pending data
    pendingData.set(key, data);

    // Set new timer
    timers.set(key, setTimeout(async () => {
      const dataToSave = pendingData.get(key);
      pendingData.delete(key);
      try {
        // Use localStorage as fallback if window.storage unavailable
        if (window?.storage?.set) {
          await window.storage.set(key, JSON.stringify(dataToSave), true);
        } else {
          localStorage.setItem(key, JSON.stringify(dataToSave));
        }
      } catch (e) {
        console.error(`Storage save failed for ${key}:`, e);
      }
      timers.delete(key);
    }, delay));
  }, [delay]);

  // Setup beforeunload and unmount handlers
  useEffect(() => {
    const handleBeforeUnload = (_e: BeforeUnloadEvent): void => {
      const pendingData = pendingDataRef.current;
      if (pendingData.size > 0) {
        // Flush all pending saves synchronously
        const keys = Array.from(pendingData.keys());
        for (const k of keys) {
          const data = pendingData.get(k);
          try {
            if (window?.storage?.set) {
              // Note: async won't complete, but we try
              window.storage.set(k, JSON.stringify(data), true);
            } else {
              localStorage.setItem(k, JSON.stringify(data));
            }
          } catch (err) {
            logger.error(`Beforeunload save failed for ${k}:`, err);
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup: flush on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flush(); // Flush all pending saves on unmount
    };
  }, [flush]);

  // Create the function with flush attached
  const result = debouncedSave as DebouncedSaveFunction;
  result.flush = flush;
  return result;
}
