import { describe, it, expect, beforeEach, vi } from 'vitest';
import storage from '../storage';

// Schema versioning lives with the campaign (meta.schemaVersion), not in the
// storage layer: values are opaque strings for every key, including the old
// appState/gmState keys that once had a separate app_schema_version path.
describe('storage get/set — opaque values', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each(['appState', 'gmState', 'miscKey'])('returns %s unchanged, even if not valid JSON', async (key) => {
    localStorage.setItem(key, '{not valid json');
    await expect(storage.get(key)).resolves.toEqual({ value: '{not valid json' });
  });

  it('returns well-formed JSON unchanged (no migration, no re-serialisation)', async () => {
    const payload = '{"foo":"bar",  "schemaVersion":"1.0.0"}';
    localStorage.setItem('appState', payload);
    await expect(storage.get('appState')).resolves.toEqual({ value: payload });
  });

  it('returns null when the key does not exist', async () => {
    await expect(storage.get('appState')).resolves.toBeNull();
  });

  it('set does not write a separate schema-version key', async () => {
    await storage.set('appState', '{}');
    await storage.set('gmState', '{}');
    expect(localStorage.getItem('app_schema_version')).toBeNull();
    expect(await storage.keys()).toEqual(expect.arrayContaining(['appState', 'gmState']));
    expect(await storage.keys()).not.toContain('app_schema_version');
  });
});
