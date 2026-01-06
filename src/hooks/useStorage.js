import React from 'react';

// Keyed debounce hook - maintains separate timers per key to prevent dropped saves
export function useKeyedDebouncedStorageSave(delay = 500) {
  const timersRef = React.useRef(new Map());

  return React.useCallback((key, data) => {
    const timers = timersRef.current;
    if (timers.has(key)) clearTimeout(timers.get(key));

    timers.set(key, setTimeout(async () => {
      try {
        await window.storage.set(key, JSON.stringify(data), true);
      } catch (e) {
        console.error(`Storage save failed for ${key}:`, e);
      }
      timers.delete(key);
    }, delay));
  }, [delay]);
}
