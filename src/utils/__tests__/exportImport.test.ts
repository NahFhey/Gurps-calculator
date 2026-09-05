import { describe, expect, it, beforeAll } from 'vitest';
import {
  SCHEMA_VERSION,
  exportLocked,
  exportUnlocked,
  importFile,
  mergeGM,
  splitState,
  validateImport,
  type ImportResult,
  type LegacyCampaignState,
  type SerializedCampaignState,
  type UnlockedExportData,
  type ValidationResult
} from '../exportImport';
import { createCampaignState } from '../../state/campaignReducer';

type LegacyCampaignFixture = LegacyCampaignState & {
  alchemyReagents: NonNullable<LegacyCampaignState['alchemyReagents']>;
  alchemyFormulas: NonNullable<LegacyCampaignState['alchemyFormulas']>;
  alchemyBatches: NonNullable<LegacyCampaignState['alchemyBatches']>;
  gmNotes: string;
  gmCustomRules: unknown[];
};

type InvalidValidationResult = Extract<ValidationResult, { valid: false }>;
type ValidValidationResult = Extract<ValidationResult, { valid: true }>;
type FailedImportResult = Extract<ImportResult, { ok: false }>;
type SuccessfulImportResult = Extract<ImportResult, { ok: true }>;

function createLegacyCampaignFixture(): LegacyCampaignFixture {
  return {
    alchemyReagents: [
      {
        id: 'reagent-1',
        name: 'Ember Moss',
        quantity: 6,
        refinement: 'refined',
        basePotency: 'P2',
        concentrationSteps: 1,
        identificationLevel: 1,
        aspects: {
          primary: 'Fire',
          secondary: 'Life'
        },
        hazards: ['Volatile when heated'],
        roles: ['Carrier', 'Catalyst'],
        falseProfile: {
          aspects: { primary: 'Earth' },
          basePotency: 'P1',
          roles: ['Stabilizer']
        },
        notes: 'Only harvest beneath a new moon',
        analysisHistory: []
      }
    ],
    alchemyFormulas: [
      {
        id: 'formula-1',
        name: 'Ashen Renewal',
        ingredients: [
          {
            reagentId: 'reagent-1',
            reagentName: 'Ember Moss',
            role: 'Carrier',
            unitsUsed: 2,
            refinement: 'refined',
            aspects: { primary: 'Fire', secondary: 'Life' }
          }
        ],
        vector: 'Potion',
        tier: 2,
        notes: 'Secretly leaves a visible ember mark',
        hazardEvaluation: {
          hazards: ['Volatile when heated']
        }
      }
    ],
    alchemyBatches: [
      {
        id: 'batch-1',
        formulaId: 'formula-1',
        formulaName: 'Ashen Renewal',
        status: 'brewing',
        phase: 'brewing',
        worker: 'Mira',
        startDate: '2026-07-27',
        startDay: 42,
        gmHazards: [{ id: 'hazard-1', severity: 'major' }],
        hazardDetails: [{ trigger: 'critical failure' }],
        gmNotes: 'The cauldron is already compromised'
      }
    ],
    gmNotes: 'The rival alchemist is watching the party',
    gmCustomRules: [
      {
        id: 'rule-1',
        text: 'Critical failures add one hidden hazard'
      }
    ]
  };
}

function createSerializedCampaignFixture(): SerializedCampaignState {
  return splitState(createCampaignState()).public;
}

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

  describe('splitState', () => {
    it('removes pending UI intents from public and GM campaign exports', () => {
      const state = createCampaignState();
      state.ui.pendingIntent = { kind: 'promote', sourceNames: ['Iron Ore'] };

      const { public: publicData, gm } = splitState(state);

      expect(publicData.ui.pendingIntent).toBeNull();
      expect(gm.ui.pendingIntent).toBeNull();
    });

    it('keeps reagent secrets out of public data and in GM data', () => {
      const state = createLegacyCampaignFixture();
      const { public: publicData, gm } = splitState(state);

      expect(publicData.alchemyReagents[0]).not.toHaveProperty('falseProfile');
      expect(publicData.alchemyReagents[0]).not.toHaveProperty('notes');
      expect(gm.reagentSecrets[0]).toMatchObject({
        id: 'reagent-1',
        aspects: state.alchemyReagents[0].aspects,
        hazards: state.alchemyReagents[0].hazards,
        roles: state.alchemyReagents[0].roles,
        falseProfile: state.alchemyReagents[0].falseProfile,
        notes: state.alchemyReagents[0].notes
      });
    });

    it('keeps formula secrets out of public data and in GM data', () => {
      const state = createLegacyCampaignFixture();
      const { public: publicData, gm } = splitState(state);

      expect(publicData.alchemyFormulas[0]).not.toHaveProperty('notes');
      expect(publicData.alchemyFormulas[0]).not.toHaveProperty('hazardEvaluation');
      expect(gm.formulaSecrets[0]).toEqual({
        id: 'formula-1',
        notes: state.alchemyFormulas[0].notes,
        hazardEvaluation: state.alchemyFormulas[0].hazardEvaluation
      });
    });

    it('keeps batch secrets out of public data and in GM data', () => {
      const state = createLegacyCampaignFixture();
      const { public: publicData, gm } = splitState(state);

      expect(publicData.alchemyBatches[0]).not.toHaveProperty('gmHazards');
      expect(publicData.alchemyBatches[0]).not.toHaveProperty('hazardDetails');
      expect(publicData.alchemyBatches[0]).not.toHaveProperty('gmNotes');
      expect(gm.batchSecrets[0]).toEqual({
        id: 'batch-1',
        gmHazards: state.alchemyBatches[0].gmHazards,
        hazardDetails: state.alchemyBatches[0].hazardDetails,
        gmNotes: state.alchemyBatches[0].gmNotes
      });
    });

    it('keeps GM notes and custom rules out of public data and in GM settings', () => {
      const state = createLegacyCampaignFixture();
      const { public: publicData, gm } = splitState(state);

      expect(publicData).not.toHaveProperty('gmNotes');
      expect(publicData).not.toHaveProperty('gmCustomRules');
      expect(gm.gmSettings).toEqual({
        notes: state.gmNotes,
        customRules: state.gmCustomRules
      });
    });
  });

  describe('mergeGM', () => {
    it('restores every covered secret after splitState', () => {
      const state = createLegacyCampaignFixture();
      const { public: publicData, gm } = splitState(state);
      const merged = mergeGM(publicData, gm);

      expect(merged.alchemyReagents[0]).toMatchObject({
        aspects: state.alchemyReagents[0].aspects,
        hazards: state.alchemyReagents[0].hazards,
        roles: state.alchemyReagents[0].roles,
        falseProfile: state.alchemyReagents[0].falseProfile,
        notes: state.alchemyReagents[0].notes
      });
      expect(merged.alchemyFormulas[0]).toMatchObject({
        notes: state.alchemyFormulas[0].notes,
        hazardEvaluation: state.alchemyFormulas[0].hazardEvaluation
      });
      expect(merged.alchemyBatches[0]).toMatchObject({
        gmHazards: state.alchemyBatches[0].gmHazards,
        hazardDetails: state.alchemyBatches[0].hazardDetails,
        gmNotes: state.alchemyBatches[0].gmNotes
      });
      expect(merged.gmNotes).toBe(state.gmNotes);
      expect(merged.gmCustomRules).toEqual(state.gmCustomRules);
    });
  });

  describe('validateImport', () => {
    it('rejects a non-object input', () => {
      const input: unknown = 'not an export';
      const result: ValidationResult = validateImport(input);

      expect(result.valid).toBe(false);
      requireInvalidValidation(result);
      expect(result.error).toContain('not an object');
    });

    it('rejects an envelope without schemaVersion', () => {
      const result: ValidationResult = validateImport({
        exportType: 'unlocked',
        public: {},
        gm: {}
      });

      expect(result.valid).toBe(false);
      requireInvalidValidation(result);
      expect(result.error).toContain('schemaVersion');
    });

    it('rejects a newer schema version', () => {
      const result: ValidationResult = validateImport({
        schemaVersion: '999.0.0',
        exportType: 'unlocked',
        public: {},
        gm: {}
      });

      expect(result.valid).toBe(false);
      requireInvalidValidation(result);
      expect(result.error).toContain('Incompatible schema version');
    });

    it('warns for an older schema version', () => {
      const result: ValidationResult = validateImport({
        schemaVersion: '0.0.0',
        exportType: 'unlocked',
        public: {},
        gm: {}
      });

      expect(result.valid).toBe(true);
      requireValidValidation(result);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Old schema version');
    });

    it('warns for a bad exportType', () => {
      const result: ValidationResult = validateImport({
        schemaVersion: SCHEMA_VERSION,
        exportType: 'partial',
        public: {}
      });

      expect(result.valid).toBe(true);
      requireValidValidation(result);
      expect(result.warnings).toContain('Unknown or missing exportType field');
    });

    it('warns for a missing exportType', () => {
      const result: ValidationResult = validateImport({
        schemaVersion: SCHEMA_VERSION,
        public: {}
      });

      expect(result.valid).toBe(true);
      requireValidValidation(result);
      expect(result.warnings).toContain('Unknown or missing exportType field');
    });

    it('rejects a locked envelope without gmLock', () => {
      const result: ValidationResult = validateImport({
        schemaVersion: SCHEMA_VERSION,
        exportType: 'locked',
        public: {}
      });

      expect(result.valid).toBe(false);
      requireInvalidValidation(result);
      expect(result.error).toContain('missing gmLock');
    });

    it('warns for an unlocked envelope without GM data', () => {
      const result: ValidationResult = validateImport({
        schemaVersion: SCHEMA_VERSION,
        exportType: 'unlocked',
        public: {}
      });

      expect(result.valid).toBe(true);
      requireValidValidation(result);
      expect(result.warnings).toContain('Unlocked export missing GM data section');
    });

    it('accepts a fully valid envelope without warnings', () => {
      const publicData: SerializedCampaignState =
        createSerializedCampaignFixture();
      const result: ValidationResult = validateImport({
        schemaVersion: SCHEMA_VERSION,
        exportType: 'unlocked',
        public: publicData,
        gm: publicData
      });

      expect(result.valid).toBe(true);
      requireValidValidation(result);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('exportUnlocked and importFile', () => {
    it('re-imports an unlocked campaign export', async () => {
      const exported: UnlockedExportData =
        await exportUnlocked(createCampaignState());
      const result: ImportResult = await importFile(JSON.stringify(exported));

      expect(result.ok).toBe(true);
      requireSuccessfulImport(result);
      expect(result.isLocked).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(result.data.exportType).toBe('unlocked');
      expect(result.data.public).toEqual(exported.public);
    });

    it('returns an error for malformed JSON without throwing', async () => {
      const malformedJson: unknown = '{"schemaVersion":';
      const result: ImportResult = await importFile(malformedJson);

      expect(result.ok).toBe(false);
      requireFailedImport(result);
      expect(result.error).toContain('Import failed');
    });

    it('returns an error for an object missing public data without throwing', async () => {
      const wrongShape: unknown = {
        schemaVersion: SCHEMA_VERSION,
        exportType: 'unlocked',
        gm: {}
      };
      const result: ImportResult = await importFile(wrongShape);

      expect(result.ok).toBe(false);
      requireFailedImport(result);
      expect(result.error).toContain('Import validation error');
    });

    it('returns an error for an object with non-object public data without throwing', async () => {
      const wrongShape: unknown = {
        schemaVersion: SCHEMA_VERSION,
        exportType: 'unlocked',
        public: 'campaign'
      };
      const result: ImportResult = await importFile(wrongShape);

      expect(result.ok).toBe(false);
      requireFailedImport(result);
      expect(result.error).toContain('Import validation error');
    });
  });
});
