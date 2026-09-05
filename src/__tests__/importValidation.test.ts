/**
 * Tests for import validation edge cases.
 *
 * Covers: validateImport, importFile, mergeGM from exportImport.js
 * Tests malformed JSON, huge files, missing fields, invalid types.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  validateImport,
  importFile,
  exportUnlocked,
  splitState,
  mergeGM,
  SCHEMA_VERSION,
  type ImportResult,
  type ValidationResult,
} from '../utils/exportImport';
import { createCampaignState } from '../state/campaignReducer';

type InvalidValidationResult = Extract<ValidationResult, { valid: false }>;
type ValidValidationResult = Extract<ValidationResult, { valid: true }>;
type FailedImportResult = Extract<ImportResult, { ok: false }>;
type SuccessfulImportResult = Extract<ImportResult, { ok: true }>;

function requireInvalidValidation(
  result: ValidationResult
): asserts result is InvalidValidationResult {
  if (result.valid) {
    throw new Error('Expected validation to fail');
  }
}

function requireValidValidation(
  result: ValidationResult
): asserts result is ValidValidationResult {
  if (!result.valid) {
    throw new Error('Expected validation to succeed');
  }
}

function requireFailedImport(
  result: ImportResult
): asserts result is FailedImportResult {
  if (result.ok) {
    throw new Error('Expected import to fail');
  }
}

function requireSuccessfulImport(
  result: ImportResult
): asserts result is SuccessfulImportResult {
  if (!result.ok) {
    throw new Error('Expected import to succeed');
  }
}

function requireLegacyMergedState(
  value: unknown
): asserts value is {
  alchemyReagents: Array<{ aspects?: unknown }>;
  gmNotes?: unknown;
} {
  if (
    !value
    || typeof value !== 'object'
    || !('alchemyReagents' in value)
    || !Array.isArray(value.alchemyReagents)
    || !('gmNotes' in value)
  ) {
    throw new Error('Expected merged legacy state');
  }
}

// Ensure crypto is available for tests
beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('crypto');
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  }
});

// ---------------------------------------------------------------------------
// validateImport
// ---------------------------------------------------------------------------
describe('validateImport', () => {
  it('rejects null', () => {
    const result = validateImport(null);
    expect(result.valid).toBe(false);
    requireInvalidValidation(result);
    expect(result.error).toContain('not an object');
  });

  it('rejects undefined', () => {
    const result = validateImport(undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects non-object (string)', () => {
    const result = validateImport('not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects non-object (number)', () => {
    const result = validateImport(42);
    expect(result.valid).toBe(false);
  });

  it('rejects non-object (array)', () => {
    const result = validateImport([1, 2, 3]);
    expect(result.valid).toBe(false);
  });

  it('rejects missing schemaVersion', () => {
    const result = validateImport({ public: {}, exportType: 'unlocked' });
    expect(result.valid).toBe(false);
    requireInvalidValidation(result);
    expect(result.error).toContain('schemaVersion');
  });

  it('rejects future schema version', () => {
    const result = validateImport({
      schemaVersion: '999.0.0',
      public: {},
      exportType: 'unlocked',
    });
    expect(result.valid).toBe(false);
    requireInvalidValidation(result);
    expect(result.error).toContain('Incompatible');
  });

  it('warns on older schema version', () => {
    const result = validateImport({
      schemaVersion: '1.0.0',
      public: { some: 'data' },
      exportType: 'unlocked',
      gm: {},
    });
    // May or may not be valid depending on migration support,
    // but should at least have a warning about old version
    if (result.valid) {
      expect(result.warnings?.some((w) => w.includes('Old schema'))).toBe(true);
    }
  });

  it('rejects missing public data section', () => {
    const result = validateImport({
      schemaVersion: SCHEMA_VERSION,
      exportType: 'unlocked',
    });
    expect(result.valid).toBe(false);
    requireInvalidValidation(result);
    expect(result.error).toContain('public');
  });

  it('rejects non-object public data', () => {
    const result = validateImport({
      schemaVersion: SCHEMA_VERSION,
      exportType: 'unlocked',
      public: 'not an object',
    });
    expect(result.valid).toBe(false);
  });

  it('warns on unknown exportType', () => {
    const result = validateImport({
      schemaVersion: SCHEMA_VERSION,
      exportType: 'unknown-type',
      public: { data: true },
    });
    expect(result.valid).toBe(true);
    requireValidValidation(result);
    expect(result.warnings?.some((w) => w.includes('exportType'))).toBe(true);
  });

  it('rejects locked export without gmLock', () => {
    const result = validateImport({
      schemaVersion: SCHEMA_VERSION,
      exportType: 'locked',
      public: { data: true },
    });
    expect(result.valid).toBe(false);
    requireInvalidValidation(result);
    expect(result.error).toContain('gmLock');
  });

  it('warns on unlocked export without gm section', () => {
    const result = validateImport({
      schemaVersion: SCHEMA_VERSION,
      exportType: 'unlocked',
      public: { data: true },
    });
    expect(result.valid).toBe(true);
    requireValidValidation(result);
    expect(result.warnings?.some((w) => w.includes('GM data'))).toBe(true);
  });

  it('accepts valid unlocked export', async () => {
    const state = createCampaignState();
    const exported = await exportUnlocked(state);
    const result = validateImport(exported);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// importFile
// ---------------------------------------------------------------------------
describe('importFile', () => {
  it('handles malformed JSON string', async () => {
    const result = await importFile('{not valid json!!!');
    expect(result.ok).toBe(false);
    requireFailedImport(result);
    expect(result.error).toBeDefined();
  });

  it('handles empty string', async () => {
    const result = await importFile('');
    expect(result.ok).toBe(false);
  });

  it('handles null input', async () => {
    const result = await importFile(null);
    expect(result.ok).toBe(false);
  });

  it('handles object with missing schema version', async () => {
    const result = await importFile({ public: {} });
    expect(result.ok).toBe(false);
    requireFailedImport(result);
    expect(result.error).toContain('schemaVersion');
  });

  it('successfully imports a valid unlocked export', async () => {
    const state = createCampaignState();
    const exported = await exportUnlocked(state);
    const result = await importFile(exported);
    expect(result.ok).toBe(true);
    requireSuccessfulImport(result);
    expect(result.data).toBeDefined();
    expect(result.isLocked).toBe(false);
  });

  it('successfully imports a valid JSON string', async () => {
    const state = createCampaignState();
    const exported = await exportUnlocked(state);
    const jsonStr = JSON.stringify(exported);
    const result = await importFile(jsonStr);
    expect(result.ok).toBe(true);
  });

  it('handles deeply nested invalid data without crashing', async () => {
    const result = await importFile({
      schemaVersion: SCHEMA_VERSION,
      exportType: 'unlocked',
      public: { deeply: { nested: { data: true } } },
      gm: { deeply: { nested: { data: true } } },
    });
    // Should either succeed or fail gracefully, not throw
    expect(typeof result.ok).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// splitState / mergeGM round-trip
// ---------------------------------------------------------------------------
describe('splitState / mergeGM', () => {
  it('round-trips campaign state through split and merge', () => {
    const state = createCampaignState();
    state.time.day = 7;
    state.ui.activeModule = 'combat';

    const { public: pub, gm } = splitState(state);
    const merged = mergeGM(pub, gm);

    // Campaign state path: mergeGM returns gm payload directly
    expect(merged.time.day).toBe(7);
  });

  it('splitState strips GM flags from public data', () => {
    const state = createCampaignState();
    state.ui.gmModeEnabled = true;
    state.ui.gmSessionUnlocked = true;

    const { public: pub } = splitState(state);
    expect(pub.ui.gmModeEnabled).toBe(false);
    expect(pub.ui.gmSessionUnlocked).toBe(false);
  });

  it('splitState handles missing combat reveal gracefully', () => {
    const state = createCampaignState();
    const { reveal, ...combatWithoutReveal } = state.combat;
    void reveal;
    const stateWithoutReveal = { ...state, combat: combatWithoutReveal };
    // Should not throw
    const { public: pub } = splitState(stateWithoutReveal);
    expect(pub).toBeDefined();
  });

  it('mergeGM handles legacy (non-campaign) state', () => {
    const publicData = {
      materials: [{ id: 'm1', name: 'Iron' }],
      foods: [],
      recipes: [],
      crafts: [],
      foodTypes: [],
      materialTypes: [],
      workers: [],
      customTemplates: {},
      craftDesigns: [],
      alchemySettings: {},
      effectFamilyMap: {},
      alchemyReagents: [{ id: 'r1', name: 'Herb' }],
      alchemyFormulas: [],
      alchemyBatches: [],
    };

    const gmPayload = {
      reagentSecrets: [{ id: 'r1', aspects: ['fire'], hazards: [], roles: [] }],
      formulaSecrets: [],
      batchSecrets: [],
      gmSettings: { notes: 'GM note', customRules: [] },
    };

    const merged = mergeGM(publicData, gmPayload);
    requireLegacyMergedState(merged);
    expect(merged.alchemyReagents[0].aspects).toEqual(['fire']);
    expect(merged.gmNotes).toBe('GM note');
  });
});
