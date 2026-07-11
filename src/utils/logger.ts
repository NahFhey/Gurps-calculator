/* eslint-disable no-console */
/// <reference types="vite/client" />
/**
 * Logger utility for consistent logging across the application
 *
 * - In development mode: All logs are output to console
 * - In production mode: Only warnings and errors are output
 *
 * @module logger
 */

const isDev = import.meta.env.DEV;

export interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/**
 * Logger object with environment-aware methods
 */
export const logger: Logger = {
  /**
   * Log informational messages (dev only)
   * @param args - Arguments to log
   */
  log: (...args: unknown[]): void => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log warning messages (always shown)
   * @param args - Arguments to log
   */
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },

  /**
   * Log error messages (always shown)
   * @param args - Arguments to log
   */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },

  /**
   * Log debug messages (dev only)
   * @param args - Arguments to log
   */
  debug: (...args: unknown[]): void => {
    if (isDev) {
      console.debug(...args);
    }
  }
};
