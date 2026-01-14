import React from 'react';

// Keyed debounce hook - maintains separate timers per key to prevent dropped saves
// Now includes flush support and beforeunload protection
export function useKeyedDebouncedStorageSave(delay = 500) {
  const timersRef = React.useRef(new Map());
  const pendingDataRef = React.useRef(new Map());

  // Flush function - immediately saves pending data for a key (or all keys)
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
          console.error(`Storage flush failed for ${key}:`, e);
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
          console.error(`Storage flush failed for ${k}:`, e);
        }
      }
    }
  }, []);

  // Debounced save function
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
            console.error(`Beforeunload save failed for ${k}:`, err);
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
