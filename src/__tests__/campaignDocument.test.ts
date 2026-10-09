/**
 * Shared structural decoder (docs/TYPED_BOUNDARIES_PLAN.md §2.3, TB3).
 */
import { describe, expect, it } from 'vitest';
import { decodeCampaignPayload, isCampaignRoot } from '../../shared/campaignDocument';

const root = (meta: Record<string, unknown> = { schemaVersion: '1.7.0' }) => ({
  ui: { activeModule: 'inventory' },
  meta,
  entities: { characters: {} },
  time: { day: 3 },
});

describe('decodeCampaignPayload', () => {
  it.each([
    ['unparseable text', '{not json', 'not-json'],
    ['JSON null', 'null', 'not-a-campaign'],
    ['a number', 42, 'not-a-campaign'],
    ['an array', [], 'not-a-campaign'],
    ['an empty object', {}, 'not-a-campaign'],
    ['a root missing time', { ui: {}, meta: {}, entities: {} }, 'not-a-campaign'],
    ['a root slice that is an array', { ...root(), entities: [] }, 'not-a-campaign'],
    ['a root slice that is a string', { ...root(), ui: 'x' }, 'not-a-campaign'],
    ['a meta that is an array', { ...root(), meta: [] }, 'not-a-campaign'],
    ['a meta that is null', { ...root(), meta: null }, 'not-a-campaign'],
    ['a malformed version', root({ schemaVersion: '1.6.x' }), 'malformed-version'],
    ['a null version', root({ schemaVersion: null }), 'malformed-version'],
    ['a numeric version', root({ schemaVersion: 1.7 }), 'malformed-version'],
    ['a future version', root({ schemaVersion: '1.99.0' }), 'future-version'],
  ])('refuses %s', (_label, input, reason) => {
    const result = decodeCampaignPayload(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(reason);
    expect(result.detail).toEqual(expect.any(String));
  });

  it('explains a future version the way the app reports newer saves', () => {
    const result = decodeCampaignPayload(root({ schemaVersion: '1.99.0' }));
    expect(result).toEqual({ ok: false, reason: 'future-version', detail: expect.stringContaining('newer version of the app') });
  });

  it.each([
    ['the current version', '1.7.0', false],
    ['the never-bumped 1.0.0', '1.0.0', true],
    ['a version just below the contract', '1.6.5', true],
    ['no version at all', undefined, true],
  ])('accepts %s', (_label, schemaVersion, preContract) => {
    const meta = schemaVersion === undefined ? {} : { schemaVersion };
    const result = decodeCampaignPayload(root(meta));
    expect(result).toEqual({ ok: true, state: root(meta), version: { declared: schemaVersion, preContract } });
  });

  it('accepts a root with no meta at all as pre-contract', () => {
    const { meta: _meta, ...noMeta } = root();
    const result = decodeCampaignPayload(noMeta);
    expect(result).toEqual({ ok: true, state: noMeta, version: { declared: undefined, preContract: true } });
  });

  it('parses a JSON string', () => {
    const result = decodeCampaignPayload(JSON.stringify(root()));
    expect(result.ok && result.state.time).toEqual({ day: 3 });
  });

  it('keeps every field it does not know, at the root and inside slices', () => {
    const input = { ...root(), extraRoot: { a: 1 }, ui: { activeModule: 'x', extraUi: [1, 2] } };
    const result = decodeCampaignPayload(input);
    expect(result.ok && result.state).toEqual(input);
  });
});

describe('isCampaignRoot', () => {
  it('is true for the four root slices as objects, whatever the version', () => {
    expect(isCampaignRoot(root())).toBe(true);
    expect(isCampaignRoot(root({ schemaVersion: '1.99.0' }))).toBe(true);
  });

  it('is true without meta: ui, entities and time mark a campaign', () => {
    const { meta: _meta, ...noMeta } = root();
    expect(isCampaignRoot(noMeta)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a flat legacy export', { materials: [], foods: [], recipes: [] }],
    ['a root missing ui', { meta: {}, entities: {}, time: {} }],
    ['a root with an array slice', { ...root(), time: [] }],
  ])('is false for %s', (_label, value) => {
    expect(isCampaignRoot(value)).toBe(false);
  });
});
