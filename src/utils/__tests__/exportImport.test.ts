import { describe, expect, it, beforeAll } from 'vitest';
import { exportLocked } from '../exportImport';
import { createCampaignState } from '../../state/campaignReducer';

describe('exportImport', () => {
  beforeAll(async () => {
    if (!globalThis.crypto && typeof window !== 'undefined') {
      const { webcrypto } = await import('crypto');
      Object.defineProperty(window, 'crypto', {
        value: webcrypto,
        configurable: true
      });
    }
  });

  it('exportLocked includes encrypted payload', async () => {
    const state = createCampaignState();
    const exported = await exportLocked(state, 'test-password');

    expect(exported.exportType).toBe('locked');
    expect(exported.gmLock).toBeTruthy();
    expect(exported.gmLock.ciphertext).toBeTruthy();
  });
});
