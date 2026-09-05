/**
 * @fileoverview Import/Export utilities for GURPS Tool data
 *
 * This module handles exporting and importing application state with support for:
 * - Schema versioning and migration
 * - GM/Player data separation
 * - Password-protected GM content encryption
 * - Validation and error handling
 *
 * Export formats:
 * - **Unlocked Export**: Everything in plaintext JSON (GM use only)
 * - **Locked Export**: Public data + encrypted GM payload (safe to share with players)
 *
 * @module utils/exportImport
 */

import type { AssetId } from '../types/map';
import type { AssetStore } from '../assets/assetStore';
import { getAssetStore } from '../assets/assetStore';
import { collectReferencedAssetIds, ingestInlineImageLayers } from '../assets/assetMigration';
import { parseDataUrl, toDataUrl } from '../assets/dataUrl';
import { sha256Hex } from '../assets/sha256';
import { encryptJSON, decryptJSON, validateGMLock, type GMLock, type EncryptOptions } from './cryptoLock';
import {
  CURRENT_SCHEMA_VERSION,
  compareVersions,
  getMigrationPath,
} from './schemaVersioning';
import { migrateData, validateDataForVersion } from './dataMigrations';
import { logger } from './logger';
import { CampaignImportSchema, exceedsImportSizeLimit } from './importSchemas';
import type { CampaignState } from '../state/campaignReducer';
import type {
  AlchemyBatch,
  AlchemyFormula,
  AlchemyReagent,
  AlchemySettings,
  Craft,
  CraftDesign,
  CustomTemplates,
  EffectFamilyMap,
  Food,
  FoodType,
  Material,
  MaterialType,
  Recipe,
} from '../types/campaign';
import type { Worker } from '../types/views';

/** Current schema version - synchronized with schemaVersioning.ts */
export const SCHEMA_VERSION: string = CURRENT_SCHEMA_VERSION;

export interface MigrationInfo {
  sourceVersion: string;
  targetVersion: string;
  path: string[];
  timestamp: string;
}

type SerializedCombatReveal = Omit<
  CampaignState['combat']['reveal'],
  'revealedTargets' | 'revealedHP'
> & {
  revealedTargets: string[];
  revealedHP: string[];
};

/** JSON-safe normalized campaign state used inside export envelopes. */
export type SerializedCampaignState = Omit<CampaignState, 'combat'> & {
  combat: Omit<CampaignState['combat'], 'reveal'> & {
    reveal?: SerializedCombatReveal;
  };
};

export type LegacyAlchemyReagent = Omit<AlchemyReagent, 'aspects'> & {
  aspects?: AlchemyReagent['aspects'] | string[];
};

export interface LegacyAlchemyFormula extends AlchemyFormula {
  coherent?: boolean;
  activeAspectCount?: number;
  conflicts?: unknown;
  hazardCount?: number;
  createdDate?: string;
  hazardEvaluation?: unknown;
}

export interface LegacyAlchemyBatch extends AlchemyBatch {
  gmNotes?: string;
}

/** Flat pre-CampaignStore state accepted for backward-compatible exports. */
export interface LegacyCampaignState {
  materials?: Material[];
  foods?: Food[];
  recipes?: Recipe[];
  crafts?: Craft[];
  foodTypes?: FoodType[];
  materialTypes?: MaterialType[];
  workers?: Worker[];
  customTemplates?: CustomTemplates;
  craftDesigns?: CraftDesign[];
  alchemySettings?: Partial<AlchemySettings>;
  effectFamilyMap?: EffectFamilyMap;
  alchemyReagents?: LegacyAlchemyReagent[];
  alchemyFormulas?: LegacyAlchemyFormula[];
  alchemyBatches?: LegacyAlchemyBatch[];
  gmNotes?: string;
  gmCustomRules?: unknown[];
  [key: string]: unknown;
}

export interface PublicAlchemyReagent {
  id: string;
  name: string;
  quantity: number;
  refinement: NonNullable<AlchemyReagent['refinement']>;
  basePotency: string;
  concentrationSteps: number;
  identificationLevel: number;
  aspects: LegacyAlchemyReagent['aspects'] | null;
  hazards: string[] | undefined;
  roles: string[];
  analysisHistory: unknown[];
}

export interface PublicAlchemyFormula {
  id: string;
  name: string;
  ingredients: AlchemyFormula['ingredients'];
  vector: AlchemyFormula['vector'];
  tier: AlchemyFormula['tier'];
  baseWR: AlchemyFormula['baseWR'];
  baseDM: AlchemyFormula['baseDM'];
  dominantAspect: AlchemyFormula['dominantAspect'];
  secondaryAspect: AlchemyFormula['secondaryAspect'];
  basePotency: AlchemyFormula['basePotency'];
  finalPotency: AlchemyFormula['finalPotency'];
  concentrationSteps: AlchemyFormula['concentrationSteps'];
  traitBudget: AlchemyFormula['traitBudget'];
  traits: NonNullable<AlchemyFormula['traits']>;
  hasMatchingStabilizer: AlchemyFormula['hasMatchingStabilizer'];
  coherent: boolean | undefined;
  activeAspectCount: number | undefined;
  conflicts: unknown;
  hazardCount: number | undefined;
  createdDate: string | undefined;
}

export interface PublicAlchemyBatch {
  id: string;
  formulaId: string;
  formulaName: AlchemyBatch['formulaName'];
  phase: AlchemyBatch['phase'];
  consumedIngredients: AlchemyBatch['consumedIngredients'];
  tier: AlchemyBatch['tier'];
  vector: AlchemyBatch['vector'];
  WR: AlchemyBatch['WR'];
  DM: AlchemyBatch['DM'];
  PP: AlchemyBatch['PP'];
  CP: AlchemyBatch['CP'];
  dominantAspect: AlchemyBatch['dominantAspect'];
  secondaryAspect: AlchemyBatch['secondaryAspect'];
  basePotency: AlchemyBatch['basePotency'];
  finalPotency: AlchemyBatch['finalPotency'];
  concentrationSteps: AlchemyBatch['concentrationSteps'];
  traitBudget: AlchemyBatch['traitBudget'];
  traits: NonNullable<AlchemyBatch['traits']>;
  forecast: AlchemyBatch['forecast'];
  microAssay: AlchemyBatch['microAssay'];
  hasMatchingStabilizer: AlchemyBatch['hasMatchingStabilizer'];
  hazardsPublic: NonNullable<AlchemyBatch['hazardsPublic']>;
  shifts: NonNullable<AlchemyBatch['shifts']>;
  quality: AlchemyBatch['quality'];
  startDate: string;
  completedDate: AlchemyBatch['completedDate'];
  completionHazards: AlchemyBatch['completionHazards'];
}

export interface LegacyPublicState {
  materials: Material[];
  foods: Food[];
  recipes: Recipe[];
  crafts: Craft[];
  foodTypes: FoodType[];
  materialTypes: MaterialType[];
  workers: Worker[];
  customTemplates: CustomTemplates | Record<string, never>;
  craftDesigns: CraftDesign[];
  alchemySettings: {
    defaultLabRating: number;
    workBlockMinutes: number;
    showObviousRoles: boolean;
  };
  effectFamilyMap: EffectFamilyMap;
  alchemyReagents: PublicAlchemyReagent[];
  alchemyFormulas: PublicAlchemyFormula[];
  alchemyBatches: PublicAlchemyBatch[];
}

export interface ReagentSecret {
  id: string;
  aspects: LegacyAlchemyReagent['aspects'];
  hazards: string[];
  roles: string[];
  falseProfile: AlchemyReagent['falseProfile'] | null;
  notes: string;
}

export interface FormulaSecret {
  id: string;
  notes: string;
  hazardEvaluation: unknown;
}

export interface BatchSecret {
  id: string;
  gmHazards: unknown[];
  hazardDetails: unknown[];
  gmNotes: string;
}

export interface LegacyGMPayload {
  reagentSecrets: ReagentSecret[];
  formulaSecrets: FormulaSecret[];
  batchSecrets: BatchSecret[];
  gmSettings: {
    notes: string;
    customRules: unknown[];
  };
}

export interface CampaignSplitStateResult {
  public: SerializedCampaignState;
  gm: SerializedCampaignState;
}

export interface LegacySplitStateResult {
  public: LegacyPublicState;
  gm: LegacyGMPayload;
}

export type SplitStateResult = CampaignSplitStateResult | LegacySplitStateResult;
export type ExportPublicPayload = SerializedCampaignState | LegacyPublicState;
export type ExportGMPayload = SerializedCampaignState | LegacyGMPayload;

export type ExportAssets = Record<AssetId, { mime: string; base64: string }>;

interface ExportEnvelopeMetadata {
  assets?: ExportAssets;
  schemaVersion: string;
  exportDate: string;
  migrationInfo?: MigrationInfo;
}

export interface UnlockedExportData extends ExportEnvelopeMetadata {
  exportType: 'unlocked';
  public: ExportPublicPayload;
  gm: ExportGMPayload;
}

export interface LockedExportData extends ExportEnvelopeMetadata {
  exportType: 'locked';
  public: ExportPublicPayload;
  gmLock: GMLock;
}

export type ExportData = UnlockedExportData | LockedExportData;

export interface CampaignImportEnvelope {
  assets?: ExportAssets;
  schemaVersion: string | number;
  exportDate?: string;
  exportType?: string;
  public: Record<string, unknown>;
  gm?: Record<string, unknown>;
  gmLock?: GMLock & { encryptedData?: string };
  migrationInfo?: MigrationInfo;
  [key: string]: unknown;
}

export type ImportResult =
  | {
      ok: true;
      data: CampaignImportEnvelope & {
        exportType: 'locked';
        gmLock: GMLock & { encryptedData?: string };
      };
      warnings: string[];
      isLocked: true;
    }
  | {
      ok: true;
      data: CampaignImportEnvelope;
      warnings: string[];
      isLocked: false;
    }
  | {
      ok: false;
      error: string;
    };

export type ValidationResult =
  | { valid: true; warnings: string[] }
  | { valid: false; error: string };

export type UnlockResult =
  | { ok: true; gmData: unknown }
  | { ok: false; error: string };

const isCampaignState = (state: unknown): state is CampaignState =>
  Boolean(
    state
    && (state as Partial<CampaignState>).ui
    && (state as Partial<CampaignState>).meta
    && (state as Partial<CampaignState>).entities
    && (state as Partial<CampaignState>).time
  );

const toSerializableCampaignState = (state: CampaignState): SerializedCampaignState => {
  if (!state?.combat?.reveal) {
    return state as unknown as SerializedCampaignState;
  }
  return {
    ...state,
    combat: {
      ...state.combat,
      reveal: {
        ...state.combat.reveal,
        revealedTargets: Array.from(state.combat.reveal.revealedTargets || []),
        revealedHP: Array.from(state.combat.reveal.revealedHP || [])
      }
    }
  };
};

const stripSchemaVersion = (
  state: Record<string, unknown>
): Record<string, unknown> => {
  if (!state || typeof state !== 'object') {
    return state;
  }
  const { schemaVersion: _schemaVersion, ...rest } = state;
  return rest;
};

/**
 * Splits application state into public (player-safe) and GM-only portions.
 * Public data: visible to all users
 * GM data: should only be visible in GM mode
 */
export function splitState(state: CampaignState): CampaignSplitStateResult;
export function splitState(state: LegacyCampaignState): LegacySplitStateResult;
export function splitState(
  state: CampaignState | LegacyCampaignState
): SplitStateResult {
  if (isCampaignState(state)) {
    const serializedState = toSerializableCampaignState(state);
    return {
      public: {
        ...serializedState,
        ui: {
          ...serializedState.ui,
          gmModeEnabled: false,
          gmSessionUnlocked: false,
          pendingIntent: null
        }
      },
      gm: {
        ...serializedState,
        ui: {
          ...serializedState.ui,
          pendingIntent: null
        }
      }
    };
  }
  const {
    materials,
    foods,
    recipes,
    crafts,
    foodTypes,
    materialTypes,
    workers,
    customTemplates,
    craftDesigns,
    alchemySettings,
    effectFamilyMap
  } = state;

  // Public data: inventory, recipes, workers (without GM notes), etc.
  const publicData = {
    materials: materials || [],
    foods: foods || [],
    recipes: recipes || [],
    crafts: crafts || [],
    foodTypes: foodTypes || [],
    materialTypes: materialTypes || [],
    workers: workers || [],
    customTemplates: customTemplates || {},
    craftDesigns: craftDesigns || [],
    alchemySettings: {
      defaultLabRating: alchemySettings?.defaultLabRating || 0,
      workBlockMinutes: alchemySettings?.workBlockMinutes || 120,
      showObviousRoles: alchemySettings?.showObviousRoles ?? true
    },
    effectFamilyMap: effectFamilyMap || {}
  } as LegacyPublicState;

  // Process reagents: public gets masked versions, GM gets full data
  const reagents: LegacyAlchemyReagent[] = state.alchemyReagents || [];
  publicData.alchemyReagents = reagents.map((r) => ({
    id: r.id,
    name: r.name,
    quantity: r.quantity,
    refinement: r.refinement || 'crude',
    basePotency: r.basePotency || 'P1',
    concentrationSteps: r.concentrationSteps || 0,
    identificationLevel: r.identificationLevel || 0,
    aspects: r.identificationLevel! >= 4 ? r.aspects : null,
    hazards: r.identificationLevel! >= 3 ? r.hazards : [],
    roles: r.roles || [],
    analysisHistory: r.analysisHistory || []
  }));

  // Process formulas: public gets basic info, GM gets hidden notes
  const formulas: LegacyAlchemyFormula[] = state.alchemyFormulas || [];
  publicData.alchemyFormulas = formulas.map((f) => ({
    id: f.id,
    name: f.name,
    ingredients: f.ingredients,
    vector: f.vector,
    tier: f.tier,
    baseWR: f.baseWR,
    baseDM: f.baseDM,
    dominantAspect: f.dominantAspect,
    secondaryAspect: f.secondaryAspect,
    basePotency: f.basePotency,
    finalPotency: f.finalPotency,
    concentrationSteps: f.concentrationSteps,
    traitBudget: f.traitBudget,
    traits: f.traits || [],
    hasMatchingStabilizer: f.hasMatchingStabilizer,
    coherent: f.coherent,
    activeAspectCount: f.activeAspectCount,
    conflicts: f.conflicts,
    hazardCount: f.hazardCount,
    createdDate: f.createdDate
  }));

  // Process batches: public gets player-visible data, GM gets full hazards
  const batches: LegacyAlchemyBatch[] = state.alchemyBatches || [];
  publicData.alchemyBatches = batches.map((b) => ({
    id: b.id,
    formulaId: b.formulaId,
    formulaName: b.formulaName,
    phase: b.phase,
    consumedIngredients: b.consumedIngredients,
    tier: b.tier,
    vector: b.vector,
    WR: b.WR,
    DM: b.DM,
    PP: b.PP,
    CP: b.CP,
    dominantAspect: b.dominantAspect,
    secondaryAspect: b.secondaryAspect,
    basePotency: b.basePotency,
    finalPotency: b.finalPotency,
    concentrationSteps: b.concentrationSteps,
    traitBudget: b.traitBudget,
    traits: b.traits || [],
    forecast: b.forecast,
    microAssay: b.microAssay,
    hasMatchingStabilizer: b.hasMatchingStabilizer,
    hazardsPublic: b.hazardsPublic || [],
    shifts: b.shifts || [],
    quality: b.quality,
    startDate: b.startDate,
    completedDate: b.completedDate,
    completionHazards: b.completionHazards
  }));

  // GM data: hidden information, secret notes, full hazard details
  const gmData = {
    reagentSecrets: reagents.map((r) => ({
      id: r.id,
      aspects: r.aspects,
      hazards: r.hazards || [],
      roles: r.roles || [],
      falseProfile: r.falseProfile || null,
      notes: r.notes || ''
    })),
    formulaSecrets: formulas.map((f) => ({
      id: f.id,
      notes: f.notes || '',
      hazardEvaluation: f.hazardEvaluation || null
    })),
    batchSecrets: batches.map((b) => ({
      id: b.id,
      gmHazards: b.gmHazards || [],
      hazardDetails: b.hazardDetails || [],
      gmNotes: b.gmNotes || ''
    })),
    gmSettings: {
      notes: state.gmNotes || '',
      customRules: state.gmCustomRules || []
    }
  };

  return { public: publicData, gm: gmData };
}

/**
 * Merges GM data back into public state.
 * Used after decrypting a locked import or loading an unlocked export.
 */
export function mergeGM(
  publicState: SerializedCampaignState,
  gmPayload: SerializedCampaignState
): SerializedCampaignState;
export function mergeGM(
  publicState: LegacyPublicState,
  gmPayload: LegacyGMPayload
): LegacyPublicState & { gmNotes: string; gmCustomRules: unknown[] };
export function mergeGM(publicState: unknown, gmPayload: unknown): unknown;
export function mergeGM(publicState: unknown, gmPayload: unknown): unknown {
  if (isCampaignState(publicState)) {
    return gmPayload || publicState;
  }
  const merged: LegacyPublicState & {
    gmNotes?: string;
    gmCustomRules?: unknown[];
  } = { ...(publicState as LegacyPublicState) };
  const gmData = gmPayload as LegacyGMPayload;

  if (gmData.reagentSecrets && merged.alchemyReagents) {
    merged.alchemyReagents = merged.alchemyReagents.map((r) => {
      const secret = gmData.reagentSecrets.find((s) => s.id === r.id);
      if (secret) {
        return {
          ...r,
          aspects: secret.aspects,
          hazards: secret.hazards,
          roles: secret.roles,
          falseProfile: secret.falseProfile,
          notes: secret.notes
        };
      }
      return r;
    });
  }

  if (gmData.formulaSecrets && merged.alchemyFormulas) {
    merged.alchemyFormulas = merged.alchemyFormulas.map((f) => {
      const secret = gmData.formulaSecrets.find((s) => s.id === f.id);
      if (secret) {
        return {
          ...f,
          notes: secret.notes,
          hazardEvaluation: secret.hazardEvaluation
        };
      }
      return f;
    });
  }

  if (gmData.batchSecrets && merged.alchemyBatches) {
    merged.alchemyBatches = merged.alchemyBatches.map((b) => {
      const secret = gmData.batchSecrets.find((s) => s.id === b.id);
      if (secret) {
        return {
          ...b,
          gmHazards: secret.gmHazards,
          hazardDetails: secret.hazardDetails,
          gmNotes: secret.gmNotes
        };
      }
      return b;
    });
  }

  if (gmData.gmSettings) {
    merged.gmNotes = gmData.gmSettings.notes || '';
    merged.gmCustomRules = gmData.gmSettings.customRules || [];
  }

  return merged;
}

/** Embed each referenced asset once, including checkpoint-only references. Missing assets stay dangling. */
export async function collectExportAssets(
  state: CampaignState | LegacyCampaignState, store: AssetStore = getAssetStore(),
): Promise<ExportAssets> {
  const assets: ExportAssets = {};
  if (!isCampaignState(state)) return assets;
  for (const id of collectReferencedAssetIds(state)) {
    const record = await store.get(id);
    if (record) assets[id] = { mime: record.mime, base64: toDataUrl(record.bytes, record.mime).split(',')[1] };
  }
  return assets;
}

async function ingestExportAssets(assets: ExportAssets | undefined): Promise<void> {
  if (!assets) return;
  const store = getAssetStore();
  for (const [id, asset] of Object.entries(assets)) {
    const decoded = parseDataUrl(`data:${asset.mime};base64,${asset.base64}`);
    // Verify before put: a corrupt entry must not leave unreferenced bytes in storage.
    if (!decoded || await sha256Hex(decoded.bytes) !== id) continue;
    await store.put(decoded.bytes, decoded.mime);
  }
}

async function ingestImportPayload(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isCampaignState(payload)) return payload;
  const { state } = await ingestInlineImageLayers(payload);
  return state as unknown as Record<string, unknown>;
}

/**
 * Exports full application state as unlocked JSON.
 * WARNING: Contains all GM data in plaintext. For GM use only.
 */
export async function exportUnlocked(
  state: CampaignState | LegacyCampaignState
): Promise<UnlockedExportData> {
  const { public: publicData, gm: gmData } = splitState(state);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    exportType: 'unlocked',
    assets: await collectExportAssets(state),
    public: publicData,
    gm: gmData
  };
}

/**
 * Exports application state as locked JSON with encrypted GM data.
 * Safe to share with players - GM content requires password to decrypt.
 */
export async function exportLocked(
  state: CampaignState | LegacyCampaignState,
  password: string,
  options: EncryptOptions = {}
): Promise<LockedExportData> {
  const { public: publicData, gm: gmData } = splitState(state);

  const gmLock = await encryptJSON(gmData, password, options);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    exportType: 'locked',
    assets: await collectExportAssets(state),
    public: publicData,
    gmLock: gmLock
  };
}

/**
 * Validates imported data structure.
 * Checks schema version and required fields.
 */
export function validateImport(data: unknown): ValidationResult {
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid import data: not an object' };
  }
  const envelope = data as Record<string, unknown>;

  if (!('schemaVersion' in envelope)) {
    return { valid: false, error: 'Missing schemaVersion field' };
  }

  const importedVersion = String(envelope.schemaVersion);

  if (compareVersions(importedVersion, SCHEMA_VERSION) > 0) {
    return {
      valid: false,
      error: `Incompatible schema version ${importedVersion} (current: ${SCHEMA_VERSION}). Please update the application.`
    };
  }

  if (compareVersions(importedVersion, SCHEMA_VERSION) < 0) {
    warnings.push(`Old schema version ${importedVersion} (current: ${SCHEMA_VERSION}). Migration will be attempted.`);
  }

  if (
    typeof envelope.exportType !== 'string'
    || !['locked', 'unlocked'].includes(envelope.exportType)
  ) {
    warnings.push('Unknown or missing exportType field');
  }

  if (!envelope.public || typeof envelope.public !== 'object') {
    return { valid: false, error: 'Missing or invalid public data section' };
  }

  if (envelope.exportType === 'locked') {
    if (!envelope.gmLock) {
      return { valid: false, error: 'Locked export missing gmLock' };
    }
    const lockValidation = validateGMLock(envelope.gmLock);
    if (!lockValidation.valid) {
      return { valid: false, error: `Invalid gmLock: ${lockValidation.error}` };
    }
  }

  if (envelope.exportType === 'unlocked' && !envelope.gm) {
    warnings.push('Unlocked export missing GM data section');
  }

  return { valid: true, warnings };
}

/**
 * Migrates imported data from old schema versions to current version.
 * Handles version normalization and applies necessary migrations.
 */
export function migrateImport(
  data: CampaignImportEnvelope
): CampaignImportEnvelope {
  const importedVersion = String(data.schemaVersion);

  if (importedVersion === SCHEMA_VERSION) {
    return data;
  }

  try {
    logger.log(
      `Starting migration of imported data from v${importedVersion} to v${SCHEMA_VERSION}`
    );

    const fullState = {
      ...(data.exportType === 'locked' ? data.public : data.gm || data.public),
      schemaVersion: importedVersion
    };

    const migratedState = migrateData(
      fullState,
      importedVersion,
      SCHEMA_VERSION
    );

    const validation = validateDataForVersion(migratedState, SCHEMA_VERSION);

    if (!validation.valid) {
      logger.warn('Migrated data has validation issues:', validation.issues);
    }

    const { public: migratedPublic, gm: migratedGm } = splitState(
      migratedState as unknown as CampaignState | LegacyCampaignState
    );

    const migrationPath = getMigrationPath(importedVersion, SCHEMA_VERSION);

    return {
      ...data,
      public: migratedPublic as unknown as Record<string, unknown>,
      ...(data.exportType === 'unlocked'
        ? { gm: migratedGm as unknown as Record<string, unknown> }
        : {}),
      schemaVersion: SCHEMA_VERSION,
      migrationInfo: {
        sourceVersion: importedVersion,
        targetVersion: SCHEMA_VERSION,
        path: migrationPath,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Migration failed: ${message}`);
    throw new Error(
      `Failed to migrate data from v${importedVersion} to v${SCHEMA_VERSION}: ${message}`
    );
  }
}


/**
 * Imports data from JSON file/string.
 * Validates, migrates, and returns state ready for loading.
 */
export async function importFile(jsonInput: unknown): Promise<ImportResult> {
  try {
    if (typeof jsonInput === 'string' && exceedsImportSizeLimit(jsonInput)) {
      return { ok: false, error: 'Import file too large (max 50 MB)' };
    }

    const data: unknown =
      typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;

    const zodResult = CampaignImportSchema.safeParse(data);
    if (!zodResult.success) {
      const issue = zodResult.error.issues[0];
      const path = issue?.path?.join('.') || '';
      return { ok: false, error: `Import validation error${path ? ` at ${path}` : ''}: ${issue?.message}` };
    }

    const importData = data as CampaignImportEnvelope;
    const validation = validateImport(importData);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const migrated = migrateImport(importData);

    await ingestExportAssets(migrated.assets);
    const sanitized = {
      ...migrated,
      public: await ingestImportPayload(stripSchemaVersion(migrated.public)),
      ...(migrated.gm ? { gm: await ingestImportPayload(stripSchemaVersion(migrated.gm)) } : {})
    };

    if (migrated.exportType === 'locked') {
      return {
        ok: true,
        data: sanitized as CampaignImportEnvelope & {
          exportType: 'locked';
          gmLock: GMLock & { encryptedData?: string };
        },
        warnings: validation.warnings,
        isLocked: true
      };
    }

    return {
      ok: true,
      data: sanitized,
      warnings: validation.warnings,
      isLocked: false
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Import failed: ${message}`
    };
  }
}

/**
 * Unlocks a locked import by decrypting the GM data.
 * Call this after importFile() when user enters password for GM mode.
 */
export async function unlockGMData(
  importData: unknown,
  password: string
): Promise<UnlockResult> {
  const envelope = importData as { gmLock?: GMLock };
  if (!envelope.gmLock) {
    return { ok: false, error: 'No gmLock present in import data' };
  }

  try {
    const gmData = await decryptJSON(envelope.gmLock, password);
    return { ok: true, gmData: isCampaignState(gmData)
      ? (await ingestInlineImageLayers(gmData)).state : gmData };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Downloads data as a JSON file.
 * Helper function for triggering browser download.
 */
export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
