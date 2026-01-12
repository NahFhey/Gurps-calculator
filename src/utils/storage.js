/**
 * localStorage wrapper with async API
 * Designed to be easily swappable with a backend API later
 *
 * Migration path: Replace this implementation with fetch() calls to Express backend
 */

const storage = {
  /**
   * Get a value from localStorage
   * @param {string} key - Storage key
   * @param {boolean} _ - Unused parameter (kept for API compatibility)
   * @returns {Promise<{value: string}|null>}
   */
  async get(key, _ = true) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) {
        return null;
      }
      return { value };
    } catch (error) {
      console.error(`localStorage.get error for key "${key}":`, error);
      return null;
    }
  },

  /**
   * Set a value in localStorage
   * @param {string} key - Storage key
   * @param {string} value - Value to store (should be JSON string)
   * @param {boolean} _ - Unused parameter (kept for API compatibility)
   * @returns {Promise<void>}
   */
  async set(key, value, _ = true) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Handle quota exceeded errors gracefully
      if (error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded. Consider clearing old data.');
        alert('Storage quota exceeded. Please export your data and clear old entries.');
      } else {
        console.error(`localStorage.set error for key "${key}":`, error);
      }
      throw error;
    }
  },

  /**
   * Remove a value from localStorage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`localStorage.remove error for key "${key}":`, error);
      throw error;
    }
  },

  /**
   * Clear all localStorage data
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('localStorage.clear error:', error);
      throw error;
    }
  },

  /**
   * Get all keys in localStorage
   * @returns {Promise<string[]>}
   */
  async keys() {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.error('localStorage.keys error:', error);
      return [];
    }
  }
};

export default storage;
