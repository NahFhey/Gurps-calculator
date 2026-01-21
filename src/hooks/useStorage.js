import React from 'react';
import { logger } from '../utils/logger';

/**
 * @fileoverview Custom React hook for debounced storage operations
 *
 * Provides keyed debouncing to prevent race conditions when multiple
 * data keys are being saved simultaneously. Includes automatic flush
 * on page unload to prevent data loss.
 */

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
 * ```jsx
 * const debouncedSave = useKeyedDebouncedStorageSave(500);
 * debouncedSave('myKey', myData);  // Saves after 500ms of no changes
 * debouncedSave.flush('myKey');    // Force immediate save
 * debouncedSave.flush();           // Flush all pending saves
 * ```
 *
 * @param {number} [delay=500] - Debounce delay in milliseconds
 * @returns {Function} Debounced save function with flush method attached
 * @property {Function} flush - Force immediate save of pending data
 */
export function useKeyedDebouncedStorageSave(delay = 500) {
  /** @type {React.MutableRefObject<Map<string, number>>} Map of key -> timeout ID */
  const timersRef = React.useRef(new Map());
  /** @type {React.MutableRefObject<Map<string, any>>} Map of key -> pending data */
  const pendingDataRef = React.useRef(new Map());

  /**
   * Immediately saves pending data for a specific key or all keys
   * Cancels any pending debounced saves for the flushed keys
   *
   * @param {string} [key] - Specific key to flush, or undefined to flush all
   * @returns {Promise<void>}
   */
  const flush = React.useCallback(async (key) => {
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
   * @param {string} key - Storage key to save to
   * @param {*} data - Data to save (will be JSON stringified)
   */
  const debouncedSave = React.useCallback((key, data) => {
    const timers = timersRef.current;
    const pendingData = pendingDataRef.current;

    // Cancel existing timer
    if (timers.has(key)) clearTimeout(timers.get(key));

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
  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
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

  // Return both the debounced save function and flush function
  debouncedSave.flush = flush;
  return debouncedSave;
}
