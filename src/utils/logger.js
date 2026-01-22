/* eslint-disable no-console */
/**
 * Logger utility for consistent logging across the application
 *
 * - In development mode: All logs are output to console
 * - In production mode: Only warnings and errors are output
 *
 * @module logger
 */

const isDev = import.meta.env.DEV;

/**
 * Logger object with environment-aware methods
 */
export const logger = {
  /**
   * Log informational messages (dev only)
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log warning messages (always shown)
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    console.warn(...args);
  },

  /**
   * Log error messages (always shown)
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Log debug messages (dev only)
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (isDev) {
      console.debug(...args);
    }
  }
};
