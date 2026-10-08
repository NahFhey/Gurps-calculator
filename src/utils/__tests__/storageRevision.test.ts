import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readRawStrict,
  writeWithRevision,
  ValueAlreadyPresentError,
  type RevisionedWrite,
} from '../storage';

const write = (overrides: Partial<RevisionedWrite> = {}): RevisionedWrite => ({
  valueKey: 'value',
  value: 'new',
  revisionKey: 'rev',
  nextRevision: (stored) => stored + 1,
  ...overrides,
});

function failSetItemFor(failingKey: string, error: Error) {
  const realSetItem = Storage.prototype.setItem;
  const calls: string[] = [];
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    calls.push(key);
    if (key === failingKey) throw error;
    return realSetItem.call(this, key, value);
  });
  return calls;
}

const quotaError = () => Object.assign(new Error('full'), { name: 'QuotaExceededError' });

describe('writeWithRevision (localStorage fallback)', () => {
  beforeEach(() => { localStorage.clear(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('writes the revision before the value', async () => {
    const calls = failSetItemFor('__none__', quotaError());
    await expect(writeWithRevision(write())).resolves.toBe(1);
    expect(calls).toEqual(['rev', 'value']);
  });

  it('puts the previous revision back when the value write fails', async () => {
    localStorage.setItem('value', 'old');
    localStorage.setItem('rev', '4');
    failSetItemFor('value', quotaError());
    await expect(writeWithRevision(write())).rejects.toThrow('full');
    expect(localStorage.getItem('value')).toBe('old');
    expect(localStorage.getItem('rev')).toBe('4');
  });

  it('removes the revision when the failed write was the first one', async () => {
    failSetItemFor('value', quotaError());
    await expect(writeWithRevision(write())).rejects.toThrow('full');
    expect(localStorage.getItem('rev')).toBeNull();
  });

  it('writes nothing when nextRevision refuses', async () => {
    localStorage.setItem('rev', '7');
    const refusal = new Error('conflict');
    await expect(writeWithRevision(write({ nextRevision: () => { throw refusal; } }))).rejects.toBe(refusal);
    expect(localStorage.getItem('rev')).toBe('7');
    expect(localStorage.getItem('value')).toBeNull();
  });

  describe('requireValueAbsent', () => {
    it('refuses when a value is already stored, touching nothing', async () => {
      localStorage.setItem('value', 'theirs');
      localStorage.setItem('rev', '3');
      const nextRevision = vi.fn((stored: number) => stored + 1);
      await expect(writeWithRevision(write({ requireValueAbsent: true, nextRevision })))
        .rejects.toBeInstanceOf(ValueAlreadyPresentError);
      expect(nextRevision).not.toHaveBeenCalled();
      expect(localStorage.getItem('value')).toBe('theirs');
      expect(localStorage.getItem('rev')).toBe('3');
    });
    it('counts an empty string as present', async () => {
      localStorage.setItem('value', '');
      await expect(writeWithRevision(write({ requireValueAbsent: true }))).rejects.toBeInstanceOf(ValueAlreadyPresentError);
    });
    it('writes and stamps from the stored revision when absent', async () => {
      localStorage.setItem('rev', '3');
      await expect(writeWithRevision(write({ requireValueAbsent: true }))).resolves.toBe(4);
      expect(localStorage.getItem('value')).toBe('new');
    });
  });
});

describe('readRawStrict (localStorage fallback)', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
  it('distinguishes an empty string from a missing key', async () => {
    localStorage.setItem('k', '');
    await expect(readRawStrict('k')).resolves.toBe('');
    await expect(readRawStrict('missing')).resolves.toBeNull();
  });
  it('lets read errors propagate', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disk I/O error'); });
    await expect(readRawStrict('k')).rejects.toThrow('disk I/O error');
  });
});

type OpenOutcome = 'error' | 'blocked' | 'throw';
function installUnopenableIndexedDB(outcome: OpenOutcome) {
  const open = vi.fn(() => {
    if (outcome === 'throw') throw new DOMException('denied', 'SecurityError');
    const request: Record<string, unknown> = { error: new DOMException('broken', 'UnknownError') };
    setTimeout(() => {
      const handler = request[outcome === 'error' ? 'onerror' : 'onblocked'];
      if (typeof handler === 'function') handler();
    }, 0);
    return request;
  });
  vi.stubGlobal('indexedDB', { open });
}
async function freshStorageModule() { vi.resetModules(); return import('../storage'); }

describe.each<OpenOutcome>(['error', 'blocked', 'throw'])('IndexedDB open failure (%s)', (outcome) => {
  beforeEach(() => { localStorage.clear(); vi.spyOn(console, 'error').mockImplementation(() => {}); installUnopenableIndexedDB(outcome); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });
  it('strict reads fail instead of reading localStorage', async () => {
    localStorage.setItem('campaignState', '{"stale":true}');
    const mod = await freshStorageModule();
    await expect(mod.readRawStrict('campaignState')).rejects.toBeInstanceOf(mod.StorageUnavailableError);
  });
  it('revisioned writes fail without touching localStorage', async () => {
    const mod = await freshStorageModule();
    await expect(mod.writeWithRevision(write())).rejects.toBeInstanceOf(mod.StorageUnavailableError);
    expect(localStorage.getItem('value')).toBeNull();
    expect(localStorage.getItem('rev')).toBeNull();
  });
  it('lenient get keeps the localStorage fallback', async () => {
    localStorage.setItem('misc', 'kept');
    const mod = await freshStorageModule();
    await expect(mod.default.get('misc')).resolves.toEqual({ value: 'kept' });
  });
});
