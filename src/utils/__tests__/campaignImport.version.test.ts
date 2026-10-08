/**
 * Schema-version contract at the import boundary (docs/TYPED_BOUNDARIES_PLAN.md §2.1, TB1).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryAssetStore, setAssetStoreForTests } from '../../assets/assetStore';
import { createCampaignState } from '../../state/campaignReducer';
import { prepareCampaignImport, unlockPendingGMLock } from '../campaignImport';
import { exportLocked, exportUnlocked } from '../exportImport';

const PASSWORD = 'correct horse battery';

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});
beforeEach(() => setAssetStoreForTests(createMemoryAssetStore()));
afterEach(() => setAssetStoreForTests(null));

function campaign() {
  const state = createCampaignState();
  state.time.day = 21;
  return state;
}

/** An unlocked export as JSON, with the envelope and inner meta rewritten by `edit`. */
async function unlockedFile(edit: (envelope: Record<string, any>) => void = () => {}) {
  const envelope = JSON.parse(JSON.stringify(await exportUnlocked(campaign())));
  edit(envelope);
  return JSON.stringify(envelope);
}

describe('import: schema-version contract', () => {
  it('exports stamp the contract version on the envelope and the campaign meta', async () => {
    const envelope = await exportUnlocked(campaign());
    expect(envelope.schemaVersion).toBe('1.7.0');
    expect((envelope.gm as { meta: { schemaVersion: string } }).meta.schemaVersion).toBe('1.7.0');
    expect((envelope.public as { meta: { schemaVersion: string } }).meta.schemaVersion).toBe('1.7.0');
  });

  it('round-trips a current export', async () => {
    const result = await prepareCampaignImport(await unlockedFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.time.day).toBe(21);
    expect(result.state.meta.schemaVersion).toBe('1.7.0');
  });

  it('refuses a file from a newer build', async () => {
    const result = await prepareCampaignImport(await unlockedFile((e) => { e.schemaVersion = '1.99.0'; }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Incompatible schema version 1.99.0') });
  });

  it('refuses a malformed envelope version instead of reading it as 1.6.0', async () => {
    const result = await prepareCampaignImport(await unlockedFile((e) => { e.schemaVersion = '1.6.x'; }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Malformed schema version') });
  });

  it('refuses an older version with no migration path instead of relabelling it', async () => {
    const result = await prepareCampaignImport(await unlockedFile((e) => { e.schemaVersion = '0.9.0'; }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('No migration path') });
  });

  it('returns (not throws) a refusal when the campaign inside is from a newer build', async () => {
    const result = await prepareCampaignImport(await unlockedFile((e) => { e.gm.meta.schemaVersion = '1.99.0'; }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('newer version of the app') });
  });

  it('loads a pre-contract export (envelope 1.6.5, meta 1.0.0) and stamps the contract version', async () => {
    const result = await prepareCampaignImport(await unlockedFile((e) => {
      e.schemaVersion = '1.6.5';
      e.gm.meta.schemaVersion = '1.0.0';
      e.public.meta.schemaVersion = '1.0.0';
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join(' ')).toContain('Old schema version 1.6.5');
    expect(result.state.time.day).toBe(21);
    expect(result.state.meta.schemaVersion).toBe('1.7.0');
  });

  it('refuses to unlock GM data whose recorded version is newer than this build', async () => {
    const file = JSON.stringify(await exportLocked(campaign(), PASSWORD, { iterations: 1000 }));
    const prepared = await prepareCampaignImport(file);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok || !prepared.pendingLock) throw new Error('expected a pending lock');

    const current = await unlockPendingGMLock(prepared.pendingLock, PASSWORD);
    expect(current.ok).toBe(true);

    const tampered = { ...prepared.pendingLock, originalSchemaVersion: '1.99.0' };
    const refused = await unlockPendingGMLock(tampered, PASSWORD);
    expect(refused).toEqual({ ok: false, error: expect.stringContaining('Cannot unlock GM data with schema version "1.99.0"') });
  });
});
