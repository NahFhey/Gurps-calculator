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

import { encryptJSON, decryptJSON, validateGMLock } from './cryptoLock';

/** Current schema version - increment when making breaking changes */
export const SCHEMA_VERSION = 1;

/**
 * Splits application state into public (player-safe) and GM-only portions.
 * Public data: visible to all users
 * GM data: should only be visible in GM mode
 *
 * @param {Object} state - Full application state
 * @returns {Object} Split state with public and gm properties
 */
export function splitState(state) {
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
  };

  // Process reagents: public gets masked versions, GM gets full data
  const reagents = state.alchemyReagents || [];
  publicData.alchemyReagents = reagents.map(r => ({
    id: r.id,
    name: r.name,
    quantity: r.quantity,
    refinement: r.refinement || 'crude',
    basePotency: r.basePotency || 'P1',
    concentrationSteps: r.concentrationSteps || 0,
    identificationLevel: r.identificationLevel || 0,
    // Hide full aspects if not fully identified
    aspects: r.identificationLevel >= 4 ? r.aspects : null,
    // Hide hazards if not identified
    hazards: r.identificationLevel >= 3 ? r.hazards : [],
    // Public roles (Solvent, Binder, Tool might be obvious)
    roles: r.roles || [],
    analysisHistory: r.analysisHistory || []
  }));

  // Process formulas: public gets basic info, GM gets hidden notes
  const formulas = state.alchemyFormulas || [];
  publicData.alchemyFormulas = formulas.map(f => ({
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
  const batches = state.alchemyBatches || [];
  publicData.alchemyBatches = batches.map(b => ({
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
    // Public hazard shells only (masks unknown hazards)
    hazardsPublic: b.hazardsPublic || [],
    shifts: b.shifts || [],
    quality: b.quality,
    startDate: b.startDate,
    completedDate: b.completedDate,
    completionHazards: b.completionHazards
  }));

  // GM data: hidden information, secret notes, full hazard details
  const gmData = {
    // Full reagent data (unmasked aspects, hazards, etc.)
    reagentSecrets: reagents.map(r => ({
      id: r.id,
      aspects: r.aspects,
      hazards: r.hazards || [],
      roles: r.roles || [],
      falseProfile: r.falseProfile || null,
      notes: r.notes || ''
    })),

    // Formula secrets (GM notes, design rationale)
    formulaSecrets: formulas.map(f => ({
      id: f.id,
      notes: f.notes || '',
      hazardEvaluation: f.hazardEvaluation || null
    })),

    // Batch secrets (full hazard details, GM observations)
    batchSecrets: batches.map(b => ({
      id: b.id,
      gmHazards: b.gmHazards || [],
      hazardDetails: b.hazardDetails || [],
      gmNotes: b.gmNotes || ''
    })),

    // General GM settings and notes
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
 *
 * @param {Object} publicState - Public portion of state
 * @param {Object} gmPayload - GM data payload
 * @returns {Object} Merged full state
 */
export function mergeGM(publicState, gmPayload) {
  const merged = { ...publicState };

  // Merge reagent secrets
  if (gmPayload.reagentSecrets && merged.alchemyReagents) {
    merged.alchemyReagents = merged.alchemyReagents.map(r => {
      const secret = gmPayload.reagentSecrets.find(s => s.id === r.id);
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

  // Merge formula secrets
  if (gmPayload.formulaSecrets && merged.alchemyFormulas) {
    merged.alchemyFormulas = merged.alchemyFormulas.map(f => {
      const secret = gmPayload.formulaSecrets.find(s => s.id === f.id);
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

  // Merge batch secrets
  if (gmPayload.batchSecrets && merged.alchemyBatches) {
    merged.alchemyBatches = merged.alchemyBatches.map(b => {
      const secret = gmPayload.batchSecrets.find(s => s.id === b.id);
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

  // Merge GM settings
  if (gmPayload.gmSettings) {
    merged.gmNotes = gmPayload.gmSettings.notes || '';
    merged.gmCustomRules = gmPayload.gmSettings.customRules || [];
  }

  return merged;
}

/**
 * Exports full application state as unlocked JSON.
 * WARNING: Contains all GM data in plaintext. For GM use only.
 *
 * @param {Object} state - Full application state
 * @returns {Object} Export data structure
 */
export function exportUnlocked(state) {
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
 *
 * @param {Object} state - Full application state
 * @param {string} password - Password for GM data encryption
 * @param {Object} [options={}] - Export options
 * @param {number} [options.iterations=210000] - PBKDF2 iterations for key derivation
 * @returns {Promise<Object>} Export data structure with gmLock
 */
export async function exportLocked(state, password, options = {}) {
  const { public: publicData, gm: gmData } = splitState(state);

  // Encrypt GM payload
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
 *
 * @param {Object} data - Imported JSON data
 * @returns {Object} Validation result
 * @returns {boolean} returns.valid - Whether data is valid
 * @returns {string} [returns.error] - Error message if invalid
 * @returns {Array<string>} [returns.warnings] - Non-critical warnings
 */
export function validateImport(data) {
  const warnings = [];

  // Check basic structure
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid import data: not an object' };
  }

  // Check schema version
  if (!('schemaVersion' in data)) {
    return { valid: false, error: 'Missing schemaVersion field' };
  }

  if (typeof data.schemaVersion !== 'number') {
    return { valid: false, error: 'Invalid schemaVersion: must be a number' };
  }

  if (data.schemaVersion > SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Incompatible schema version ${data.schemaVersion} (current: ${SCHEMA_VERSION}). Please update the application.`
    };
  }

  if (data.schemaVersion < SCHEMA_VERSION) {
    warnings.push(`Old schema version ${data.schemaVersion} (current: ${SCHEMA_VERSION}). Migration will be attempted.`);
  }

  // Check export type
  if (!data.exportType || !['locked', 'unlocked'].includes(data.exportType)) {
    warnings.push('Unknown or missing exportType field');
  }

  // Check for public data
  if (!data.public || typeof data.public !== 'object') {
    return { valid: false, error: 'Missing or invalid public data section' };
  }

  // If locked, validate gmLock
  if (data.exportType === 'locked') {
    if (!data.gmLock) {
      return { valid: false, error: 'Locked export missing gmLock' };
    }
    const lockValidation = validateGMLock(data.gmLock);
    if (!lockValidation.valid) {
      return { valid: false, error: `Invalid gmLock: ${lockValidation.error}` };
    }
  }

  // If unlocked, check for GM data
  if (data.exportType === 'unlocked' && !data.gm) {
    warnings.push('Unlocked export missing GM data section');
  }

  return { valid: true, warnings };
}

/**
 * Migrates imported data from old schema versions to current version.
 * Currently a stub - implement actual migrations when schema changes.
 *
 * @param {Object} data - Imported data (will be mutated)
 * @returns {Object} Migrated data (same object, mutated in place)
 */
export function migrateImport(data) {
  if (data.schemaVersion === SCHEMA_VERSION) {
    return data; // No migration needed
  }

  // TODO: Implement migrations when schema changes
  // Example:
  // if (data.schemaVersion === 1) {
  //   // Migrate v1 → v2
  //   data.public.newField = defaultValue;
  //   data.schemaVersion = 2;
  // }

  console.warn(`Migration from schema ${data.schemaVersion} to ${SCHEMA_VERSION} not implemented. Data loaded as-is.`);
  data.schemaVersion = SCHEMA_VERSION;
  return data;
}

/**
 * Imports data from JSON file/string.
 * Validates, migrates, and returns state ready for loading.
 *
 * @param {string|Object} jsonInput - JSON string or parsed object
 * @returns {Promise<Object>} Import result
 * @returns {boolean} returns.ok - Whether import succeeded
 * @returns {Object} [returns.data] - Imported data (if ok: true)
 * @returns {string} [returns.error] - Error message (if ok: false)
 * @returns {Array<string>} [returns.warnings] - Non-critical warnings
 * @returns {boolean} returns.isLocked - Whether this is a locked import (requires password for GM mode)
 */
export async function importFile(jsonInput) {
  try {
    // Parse JSON if string
    const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;

    // Validate
    const validation = validateImport(data);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    // Migrate if needed
    const migrated = migrateImport(data);

    // Return result with metadata
    return {
      ok: true,
      data: migrated,
      warnings: validation.warnings || [],
      isLocked: migrated.exportType === 'locked'
    };
  } catch (err) {
    return {
      ok: false,
      error: `Import failed: ${err.message}`
    };
  }
}

/**
 * Unlocks a locked import by decrypting the GM data.
 * Call this after importFile() when user enters password for GM mode.
 *
 * @param {Object} importData - Data from importFile()
 * @param {string} password - Password to decrypt GM data
 * @returns {Promise<Object>} Unlock result
 * @returns {boolean} returns.ok - Whether unlock succeeded
 * @returns {Object} [returns.gmData] - Decrypted GM data (if ok: true)
 * @returns {string} [returns.error] - Error message (if ok: false)
 */
export async function unlockGMData(importData, password) {
  if (!importData.gmLock) {
    return { ok: false, error: 'No gmLock present in import data' };
  }

  try {
    const gmData = await decryptJSON(importData.gmLock, password);
    return { ok: true, gmData };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Downloads data as a JSON file.
 * Helper function for triggering browser download.
 *
 * @param {Object} data - Data to export
 * @param {string} filename - Filename for download (e.g., 'gurps-export.json')
 */
export function downloadJSON(data, filename) {
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
