/**
 * @fileoverview Zod validation schemas for imported data.
 *
 * These schemas provide structural validation for data entering the app
 * through import flows (file import, character library import, combat import).
 * They catch malformed or malicious JSON before it reaches state merging logic.
 *
 * Design notes:
 * - Schemas are deliberately loose on optional fields — GURPS data varies widely
 *   and older exports may lack newer fields. The goal is to reject garbage, not
 *   enforce a rigid shape on every nested property.
 * - Campaign import validation lives here; runtime type narrowing for internal
 *   state still uses the TypeScript types in src/types/.
 *
 * @module utils/importSchemas
 */

import { z } from 'zod';

// ─── Character (Combat Library Import) ───────────────────────────────────────

const AttackSchema = z.object({
  name: z.string(),
  skill: z.number(),
  damage: z.string(),
  notes: z.string().optional(),
});

/**
 * Validates a single character entry imported into the Combat Character Library.
 * Required fields are the GURPS core attributes; everything else is optional.
 */
export const CharacterDataSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Character must have a name'),
  // Optional (no default): absence must stay detectable so the import path
  // can fall back to the legacy isNPC flag when deriving the category.
  category: z.string().optional(),
  isNPC: z.boolean().optional(),
  st: z.number(),
  dx: z.number(),
  iq: z.number(),
  ht: z.number(),
  hp: z.number(),
  fp: z.number().default(0),
  mp: z.number().default(0),
  basicSpeed: z.number(),
  basicMove: z.number(),
  dodge: z.number(),
  parry: z.number().default(0),
  block: z.number().default(0),
  dr: z.number().default(0),
  hitLocationProfileId: z.string().optional(),
  drByLocation: z.record(z.string(), z.number()).optional(),
  attacks: z.array(AttackSchema).optional(),
  notes: z.string().optional(),
  currentHP: z.number().optional(),
  currentFP: z.number().optional(),
  currentMP: z.number().optional(),
}).passthrough(); // allow extra fields from older/newer exports

/**
 * Validates the top-level shape of a character library import file.
 * Must be an array of character objects.
 */
export const CharacterArraySchema = z.array(CharacterDataSchema).min(1, 'Import must contain at least one character');

// ─── Combat Export ───────────────────────────────────────────────────────────

const ParticipantSchema = z.object({
  instanceId: z.string(),
  id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  st: z.number().optional(),
  dx: z.number().optional(),
  iq: z.number().optional(),
  ht: z.number().optional(),
  hp: z.number().optional(),
  fp: z.number().optional(),
  basicSpeed: z.number().optional(),
  basicMove: z.number().optional(),
  dodge: z.number().optional(),
}).passthrough();

const CombatStateSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  participants: z.array(ParticipantSchema).optional().default([]),
  turnOrder: z.array(z.string()).optional().default([]),
  currentTurnIndex: z.number().optional().default(0),
  currentRound: z.number().optional().default(1),
  log: z.array(z.unknown()).optional().default([]),
}).passthrough();

/**
 * Validates imported combat export JSON.
 */
export const CombatExportSchema = z.object({
  version: z.number(),
  exportDate: z.string().optional(),
  exportType: z.string().optional(),
  combatState: CombatStateSchema,
  history: z.unknown().nullable().optional(),
  revealState: z.unknown().nullable().optional(),
  gmLock: z.string().optional(),
}).passthrough();

// ─── Campaign File Import ────────────────────────────────────────────────────

const GMLockSchema = z.object({
  encryptedData: z.string(),
  salt: z.string(),
  iv: z.string(),
}).passthrough();

/**
 * Validates the top-level envelope of a campaign export file.
 * This does NOT deeply validate every entity inside `public` or `gm` — that
 * would be brittle across schema versions. Instead it ensures the structural
 * envelope is correct so that mergeGM / migrateImport can operate safely.
 */
export const CampaignImportSchema = z.object({
  schemaVersion: z.union([z.string(), z.number()]).transform(String),
  exportDate: z.string().optional(),
  exportType: z.enum(['locked', 'unlocked']).optional(),
  public: z.record(z.string(), z.unknown()),
  gm: z.record(z.string(), z.unknown()).optional(),
  gmLock: z.union([GMLockSchema, z.string()]).optional(),
}).passthrough();

/**
 * Validates the inner public state section of a campaign import.
 * Checks that required top-level sections exist without deeply validating
 * every entity — migrations handle version-specific shapes.
 */
export const CampaignPublicStateSchema = z.object({
  ui: z.object({}).passthrough().optional(),
  meta: z.object({}).passthrough().optional(),
  entities: z.object({}).passthrough().optional(),
  time: z.object({}).passthrough().optional(),
}).passthrough();

// ─── File Size Validation ────────────────────────────────────────────────────

/** Maximum import file size in bytes (50 MB) */
export const MAX_IMPORT_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Check whether a raw string or File exceeds the import size limit.
 */
export function exceedsImportSizeLimit(input: string | File): boolean {
  if (typeof input === 'string') {
    // Rough byte estimate — 2 bytes per char is conservative for UTF-16
    return input.length * 2 > MAX_IMPORT_SIZE_BYTES;
  }
  return input.size > MAX_IMPORT_SIZE_BYTES;
}

// ─── Helper: safe parse + validate ───────────────────────────────────────────

export type SchemaValidationResult<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
}

/**
 * Parse a JSON string and validate it against a Zod schema in one step.
 * Returns a discriminated union so callers can branch cleanly.
 */
export function parseAndValidate<T>(
  jsonString: string,
  schema: z.ZodType<T>,
  label = 'import'
): SchemaValidationResult<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: `Invalid JSON in ${label}` };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue?.path?.join('.') || '';
    const msg = firstIssue?.message || 'Validation failed';
    return { ok: false, error: `${label} validation error${path ? ` at ${path}` : ''}: ${msg}` };
  }

  return { ok: true, data: result.data };
}
