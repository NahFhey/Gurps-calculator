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

import { encryptJSON, decryptJSON, validateGMLock, type GMLock, type EncryptOptions } from './cryptoLock';
import {
  CURRENT_SCHEMA_VERSION,
  compareVersions,
  getMigrationPath,
} from './schemaVersioning';
import { migrateData, validateDataForVersion } from './dataMigrations';
import { logger } from './logger';
import { CampaignImportSchema, exceedsImportSizeLimit } from './importSchemas';

/** Current schema version - synchronized with schemaVersioning.ts */
export const SCHEMA_VERSION: string = CURRENT_SCHEMA_VERSION;

export interface ImportResult {
  ok: boolean;
  error?: string;
  data?: any;
  warnings?: string[];
  isLocked?: boolean;
}

export interface ExportData {
  schemaVersion: string;
  exportDate: string;
  exportType: 'locked' | 'unlocked';
  public: any;
  gm?: any;
  gmLock?: GMLock;
  migrationInfo?: {
    sourceVersion: string;
    targetVersion: string;
    path: string[];
    timestamp: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface SplitStateResult {
  public: any;
  gm: any;
}

export interface UnlockResult {
  ok: boolean;
  gmData?: any;
  error?: string;
}

const isCampaignState = (state: any): boolean =>
  Boolean(state && state.ui && state.meta && state.entities && state.time);

const toSerializableCampaignState = (state: any): any => {
  if (!state?.combat?.reveal) {
    return state;
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

const stripSchemaVersion = (state: any): any => {
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
export function splitState(state: any): SplitStateResult {
  if (isCampaignState(state)) {
    const serializedState = toSerializableCampaignState(state);
    return {
      public: {
        ...serializedState,
        ui: {
          ...serializedState.ui,
          gmModeEnabled: false,
          gmSessionUnlocked: false
        }
      },
      gm: serializedState
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
  const publicData: any = {
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
  };

  // Process reagents: public gets masked versions, GM gets full data
  const reagents: any[] = state.alchemyReagents || [];
  publicData.alchemyReagents = reagents.map((r: any) => ({
    id: r.id,
    name: r.name,
    quantity: r.quantity,
    refinement: r.refinement || 'crude',
    basePotency: r.basePotency || 'P1',
    concentrationSteps: r.concentrationSteps || 0,
    identificationLevel: r.identificationLevel || 0,
    aspects: r.identificationLevel >= 4 ? r.aspects : null,
    hazards: r.identificationLevel >= 3 ? r.hazards : [],
    roles: r.roles || [],
    analysisHistory: r.analysisHistory || []
  }));

  // Process formulas: public gets basic info, GM gets hidden notes
  const formulas: any[] = state.alchemyFormulas || [];
  publicData.alchemyFormulas = formulas.map((f: any) => ({
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
  const batches: any[] = state.alchemyBatches || [];
  publicData.alchemyBatches = batches.map((b: any) => ({
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
    reagentSecrets: reagents.map((r: any) => ({
      id: r.id,
      aspects: r.aspects,
      hazards: r.hazards || [],
      roles: r.roles || [],
      falseProfile: r.falseProfile || null,
      notes: r.notes || ''
    })),
    formulaSecrets: formulas.map((f: any) => ({
      id: f.id,
      notes: f.notes || '',
      hazardEvaluation: f.hazardEvaluation || null
    })),
    batchSecrets: batches.map((b: any) => ({
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
export function mergeGM(publicState: any, gmPayload: any): any {
  if (isCampaignState(publicState)) {
    return gmPayload || publicState;
  }
  const merged: any = { ...publicState };

  if (gmPayload.reagentSecrets && merged.alchemyReagents) {
    merged.alchemyReagents = merged.alchemyReagents.map((r: any) => {
      const secret = gmPayload.reagentSecrets.find((s: any) => s.id === r.id);
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

  if (gmPayload.formulaSecrets && merged.alchemyFormulas) {
    merged.alchemyFormulas = merged.alchemyFormulas.map((f: any) => {
      const secret = gmPayload.formulaSecrets.find((s: any) => s.id === f.id);
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

  if (gmPayload.batchSecrets && merged.alchemyBatches) {
    merged.alchemyBatches = merged.alchemyBatches.map((b: any) => {
      const secret = gmPayload.batchSecrets.find((s: any) => s.id === b.id);
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

  if (gmPayload.gmSettings) {
    merged.gmNotes = gmPayload.gmSettings.notes || '';
    merged.gmCustomRules = gmPayload.gmSettings.customRules || [];
  }

  return merged;
}

/**
 * Exports full application state as unlocked JSON.
 * WARNING: Contains all GM data in plaintext. For GM use only.
 */
export function exportUnlocked(state: any): ExportData {
  const { public: publicData, gm: gmData } = splitState(state);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    exportType: 'unlocked',
    public: publicData,
    gm: gmData
  };
}

/**
 * Exports application state as locked JSON with encrypted GM data.
 * Safe to share with players - GM content requires password to decrypt.
 */
export async function exportLocked(
  state: any,
  password: string,
  options: EncryptOptions = {}
): Promise<ExportData> {
  const { public: publicData, gm: gmData } = splitState(state);

  const gmLock = await encryptJSON(gmData, password, options);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    exportType: 'locked',
    public: publicData,
    gmLock: gmLock
  };
}

/**
 * Validates imported data structure.
 * Checks schema version and required fields.
 */
export function validateImport(data: any): ValidationResult {
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid import data: not an object' };
  }

  if (!('schemaVersion' in data)) {
    return { valid: false, error: 'Missing schemaVersion field' };
  }

  const importedVersion = String(data.schemaVersion);

  if (compareVersions(importedVersion, SCHEMA_VERSION) > 0) {
    return {
      valid: false,
      error: `Incompatible schema version ${importedVersion} (current: ${SCHEMA_VERSION}). Please update the application.`
    };
  }

  if (compareVersions(importedVersion, SCHEMA_VERSION) < 0) {
    warnings.push(`Old schema version ${importedVersion} (current: ${SCHEMA_VERSION}). Migration will be attempted.`);
  }

  if (!data.exportType || !['locked', 'unlocked'].includes(data.exportType)) {
    warnings.push('Unknown or missing exportType field');
  }

  if (!data.public || typeof data.public !== 'object') {
    return { valid: false, error: 'Missing or invalid public data section' };
  }

  if (data.exportType === 'locked') {
    if (!data.gmLock) {
      return { valid: false, error: 'Locked export missing gmLock' };
    }
    const lockValidation = validateGMLock(data.gmLock);
    if (!lockValidation.valid) {
      return { valid: false, error: `Invalid gmLock: ${lockValidation.error}` };
    }
  }

  if (data.exportType === 'unlocked' && !data.gm) {
    warnings.push('Unlocked export missing GM data section');
  }

  return { valid: true, warnings };
}

/**
 * Migrates imported data from old schema versions to current version.
 * Handles version normalization and applies necessary migrations.
 */
export function migrateImport(data: any): any {
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

    const { public: migratedPublic, gm: migratedGm } = splitState(migratedState);

    const migrationPath = getMigrationPath(importedVersion, SCHEMA_VERSION);

    return {
      ...data,
      public: migratedPublic,
      ...(data.exportType === 'unlocked' ? { gm: migratedGm } : {}),
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
export async function importFile(jsonInput: string | any): Promise<ImportResult> {
  try {
    if (typeof jsonInput === 'string' && exceedsImportSizeLimit(jsonInput)) {
      return { ok: false, error: 'Import file too large (max 50 MB)' };
    }

    const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;

    const zodResult = CampaignImportSchema.safeParse(data);
    if (!zodResult.success) {
      const issue = zodResult.error.issues[0];
      const path = issue?.path?.join('.') || '';
      return { ok: false, error: `Import validation error${path ? ` at ${path}` : ''}: ${issue?.message}` };
    }

    const validation = validateImport(data);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const migrated = migrateImport(data);

    const sanitized = {
      ...migrated,
      public: stripSchemaVersion(migrated.public),
      ...(migrated.gm ? { gm: stripSchemaVersion(migrated.gm) } : {})
    };

    return {
      ok: true,
      data: sanitized,
      warnings: validation.warnings || [],
      isLocked: migrated.exportType === 'locked'
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
export async function unlockGMData(importData: any, password: string): Promise<UnlockResult> {
  if (!importData.gmLock) {
    return { ok: false, error: 'No gmLock present in import data' };
  }

  try {
    const gmData = await decryptJSON(importData.gmLock, password);
    return { ok: true, gmData };
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
