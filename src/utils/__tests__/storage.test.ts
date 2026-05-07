import { describe, it, expect, beforeEach, vi } from 'vitest';
import storage from '../storage';

describe('storage.get — JSON.parse hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null when appState contains malformed JSON', async () => {
    localStorage.setItem('appState', '{not valid json');
    const result = await storage.get('appState');
    expect(result).toBeNull();
  });

  it('returns null when gmState contains malformed JSON', async () => {
    localStorage.setItem('gmState', '###broken###');
    const result = await storage.get('gmState');
    expect(result).toBeNull();
  });

  it('returns the raw value for non-state keys even if not valid JSON', async () => {
    localStorage.setItem('miscKey', 'not-json-but-fine');
    const result = await storage.get('miscKey');
    expect(result).toEqual({ value: 'not-json-but-fine' });
  });

  it('returns the value unchanged when appState contains well-formed JSON', async () => {
    const payload = JSON.stringify({ foo: 'bar' });
    localStorage.setItem('appState', payload);
    const result = await storage.get('appState');
    expect(result).not.toBeNull();
    expect(typeof result?.value).toBe('string');
    expect(JSON.parse(result!.value)).toMatchObject({ foo: 'bar' });
  });

  it('returns null when the key does not exist', async () => {
    const result = await storage.get('appState');
    expect(result).toBeNull();
  });
});
