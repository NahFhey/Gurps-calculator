import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../logger';

/**
 * Note on the dev-only branch: `logger.log` / `logger.debug` are gated on
 * `isDev = import.meta.env.DEV`, which Vite/esbuild inlines as a compile-time
 * literal. Under Vitest that literal is `true` (MODE === 'test'), so the
 * suppression (production) branch is not reachable from a normal in-process
 * import — flipping it would require re-transforming the module through a
 * separate Vite pipeline. These tests therefore assert the reachable behavior:
 * every method forwards its arguments to the matching console method.
 */
describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards warn to console.warn with all arguments', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn('warned', 1, { detail: true });

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith('warned', 1, { detail: true });
  });

  it('forwards error to console.error with all arguments', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');

    logger.error('failed', err);

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith('failed', err);
  });

  it('forwards log to console.log with all arguments (dev mode)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.log('info', 42, 'extra');

    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenCalledWith('info', 42, 'extra');
  });

  it('forwards debug to console.debug with all arguments (dev mode)', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    logger.debug('trace', { step: 2 });

    expect(debugSpy).toHaveBeenCalledOnce();
    expect(debugSpy).toHaveBeenCalledWith('trace', { step: 2 });
  });

  it('forwards a call with no arguments without throwing', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => {
      logger.log();
      logger.warn();
    }).not.toThrow();

    expect(logSpy).toHaveBeenCalledWith();
    expect(warnSpy).toHaveBeenCalledWith();
  });

  it('forwards nullish and mixed argument types without throwing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      logger.error('ctx', null, undefined, 0, false);
    }).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith('ctx', null, undefined, 0, false);
  });
});
