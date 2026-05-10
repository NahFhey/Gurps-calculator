import { describe, it, expect } from 'vitest';
import {
  CharacterDataSchema,
  CharacterArraySchema,
  CombatExportSchema,
  CampaignImportSchema,
  CampaignPublicStateSchema,
  MAX_IMPORT_SIZE_BYTES,
  exceedsImportSizeLimit,
  parseAndValidate,
} from '../importSchemas';

const validCharacter = {
  name: 'Bob',
  st: 10,
  dx: 11,
  iq: 12,
  ht: 10,
  hp: 10,
  basicSpeed: 5.25,
  basicMove: 5,
  dodge: 8,
};

describe('CharacterDataSchema', () => {
  it('parses a valid character', () => {
    const result = CharacterDataSchema.parse(validCharacter);
    expect(result.name).toBe('Bob');
    expect(result.category).toBe('PC');
    expect(result.fp).toBe(0);
    expect(result.parry).toBe(0);
    expect(result.block).toBe(0);
    expect(result.dr).toBe(0);
    expect(result.mp).toBe(0);
  });

  it('rejects an empty name', () => {
    const r = CharacterDataSchema.safeParse({ ...validCharacter, name: '' });
    expect(r.success).toBe(false);
  });

  it('requires core attributes', () => {
    const { st: _omit, ...rest } = validCharacter;
    void _omit;
    const r = CharacterDataSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it('allows optional attacks and notes', () => {
    const r = CharacterDataSchema.parse({
      ...validCharacter,
      attacks: [{ name: 'Punch', skill: 12, damage: '1d-3 cr' }],
      notes: 'tough',
    });
    expect(r.attacks?.[0].name).toBe('Punch');
    expect(r.notes).toBe('tough');
  });

  it('passes through unknown fields', () => {
    const r = CharacterDataSchema.parse({ ...validCharacter, customField: 42 }) as Record<string, unknown>;
    expect(r.customField).toBe(42);
  });

  it('validates attack shape', () => {
    const r = CharacterDataSchema.safeParse({
      ...validCharacter,
      attacks: [{ name: 'Bad', skill: 'not-a-number', damage: '1d' }],
    });
    expect(r.success).toBe(false);
  });
});

describe('CharacterArraySchema', () => {
  it('accepts a non-empty array', () => {
    const r = CharacterArraySchema.parse([validCharacter]);
    expect(r).toHaveLength(1);
  });

  it('rejects an empty array', () => {
    const r = CharacterArraySchema.safeParse([]);
    expect(r.success).toBe(false);
  });

  it('rejects non-array input', () => {
    const r = CharacterArraySchema.safeParse(validCharacter);
    expect(r.success).toBe(false);
  });
});

describe('CombatExportSchema', () => {
  it('parses a minimal valid export and applies defaults', () => {
    const r = CombatExportSchema.parse({
      version: 1,
      combatState: {},
    });
    expect(r.version).toBe(1);
    expect(r.combatState.participants).toEqual([]);
    expect(r.combatState.turnOrder).toEqual([]);
    expect(r.combatState.currentTurnIndex).toBe(0);
    expect(r.combatState.currentRound).toBe(1);
  });

  it('requires a version', () => {
    const r = CombatExportSchema.safeParse({ combatState: {} });
    expect(r.success).toBe(false);
  });

  it('requires combatState', () => {
    const r = CombatExportSchema.safeParse({ version: 1 });
    expect(r.success).toBe(false);
  });

  it('validates participant required fields', () => {
    const r = CombatExportSchema.safeParse({
      version: 1,
      combatState: {
        participants: [{ name: 'NoIds' }],
      },
    });
    expect(r.success).toBe(false);
  });

  it('accepts well-formed participants', () => {
    const r = CombatExportSchema.parse({
      version: 1,
      combatState: {
        participants: [{ instanceId: 'i1', id: 'c1', name: 'Bob' }],
      },
    });
    expect(r.combatState.participants).toHaveLength(1);
  });
});

describe('CampaignImportSchema', () => {
  it('coerces numeric schemaVersion to string', () => {
    const r = CampaignImportSchema.parse({
      schemaVersion: 7,
      public: {},
    });
    expect(r.schemaVersion).toBe('7');
  });

  it('accepts string schemaVersion', () => {
    const r = CampaignImportSchema.parse({
      schemaVersion: '7',
      public: {},
    });
    expect(r.schemaVersion).toBe('7');
  });

  it('requires public section', () => {
    const r = CampaignImportSchema.safeParse({ schemaVersion: '1' });
    expect(r.success).toBe(false);
  });

  it('accepts string-form gmLock (legacy)', () => {
    const r = CampaignImportSchema.parse({
      schemaVersion: '1',
      public: {},
      gmLock: 'legacy-string',
    });
    expect(r.gmLock).toBe('legacy-string');
  });

  it('accepts object-form gmLock', () => {
    const r = CampaignImportSchema.parse({
      schemaVersion: '1',
      public: {},
      gmLock: { encryptedData: 'a', salt: 'b', iv: 'c' },
    });
    expect(typeof r.gmLock).toBe('object');
  });

  it('rejects invalid exportType', () => {
    const r = CampaignImportSchema.safeParse({
      schemaVersion: '1',
      public: {},
      exportType: 'frobnicated',
    });
    expect(r.success).toBe(false);
  });
});

describe('CampaignPublicStateSchema', () => {
  it('accepts an empty object', () => {
    expect(CampaignPublicStateSchema.parse({})).toEqual({});
  });

  it('accepts known sections', () => {
    const r = CampaignPublicStateSchema.parse({
      ui: { theme: 'dark' },
      meta: {},
      entities: { characters: [] },
      time: {},
    });
    expect(r.ui).toBeDefined();
  });

  it('passes through unknown sections', () => {
    const r = CampaignPublicStateSchema.parse({ extra: { foo: 'bar' } }) as Record<string, unknown>;
    expect(r.extra).toEqual({ foo: 'bar' });
  });
});

describe('exceedsImportSizeLimit', () => {
  it('returns false for a small string', () => {
    expect(exceedsImportSizeLimit('hello world')).toBe(false);
  });

  it('returns true for an oversize string', () => {
    const big = 'x'.repeat(MAX_IMPORT_SIZE_BYTES); // 2 bytes per char => ~100MB
    expect(exceedsImportSizeLimit(big)).toBe(true);
  });

  it('handles File-like input under the limit', () => {
    const file = { size: 1024 } as File;
    expect(exceedsImportSizeLimit(file)).toBe(false);
  });

  it('handles File-like input over the limit', () => {
    const file = { size: MAX_IMPORT_SIZE_BYTES + 1 } as File;
    expect(exceedsImportSizeLimit(file)).toBe(true);
  });

  it('exposes a 50 MB limit', () => {
    expect(MAX_IMPORT_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });
});

describe('parseAndValidate', () => {
  it('returns ok on valid JSON matching schema', () => {
    const r = parseAndValidate(JSON.stringify([validCharacter]), CharacterArraySchema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toHaveLength(1);
  });

  it('returns an error for invalid JSON', () => {
    const r = parseAndValidate('{ not json', CharacterArraySchema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Invalid JSON/);
  });

  it('returns an error including the field path on schema mismatch', () => {
    const bad = JSON.stringify([{ ...validCharacter, name: '' }]);
    const r = parseAndValidate(bad, CharacterArraySchema, 'characters');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/characters/);
      expect(r.error).toMatch(/name/);
    }
  });

  it('uses the provided label in error messages', () => {
    const r = parseAndValidate('not json', CharacterArraySchema, 'my-import');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('my-import');
  });
});
