/**
 * Structural decoder for a campaign payload, shared by client and server
 * (docs/TYPED_BOUNDARIES_PLAN.md §2.3).
 *
 * It checks only what holds for every campaign: `ui`, `entities` and `time`
 * are JSON objects, `meta` is one when present (a save without it is
 * pre-contract), and `meta.schemaVersion` is one this build can read. It does not
 * know slice types (`shared/` cannot import `src/`); the client's deep
 * validation is `src/persistence/decodeCampaign.ts`. Unknown fields are kept:
 * a decoder must never drop data it does not understand.
 */
import { z } from 'zod';
import {
  CAMPAIGN_SCHEMA_VERSION,
  FIRST_CONTRACT_VERSION,
  classifySchemaVersion,
  compareSchemaVersions,
} from './campaignVersion.js';

const JsonObjectSchema = z.record(z.string(), z.unknown());

/**
 * The root slices, each a JSON object; every other field is kept. `meta` is
 * optional (early local saves have none); `ui`, `entities` and `time` are what
 * tell a campaign from a flat legacy export.
 */
export const CampaignRootSchema = z.looseObject({
  ui: JsonObjectSchema,
  meta: JsonObjectSchema.optional(),
  entities: JsonObjectSchema,
  time: JsonObjectSchema,
});

export type CampaignRootJSON = z.infer<typeof CampaignRootSchema>;

export interface SchemaVersionInfo {
  /** `meta.schemaVersion` as written; undefined when the payload has none. */
  declared: string | undefined;
  /** Below the contract (or missing): the version carries no information, so repairs bring it up to date. */
  preContract: boolean;
}

export type CampaignDecodeReason = 'not-json' | 'not-a-campaign' | 'malformed-version' | 'future-version';

export type DecodeResult =
  | { ok: true; state: CampaignRootJSON; version: SchemaVersionInfo }
  | { ok: false; reason: CampaignDecodeReason; detail: string };

/** True for the normalized campaign shape (as opposed to the pre-campaign flat exports). Structure only, no version check; `meta` may be missing. */
export const isCampaignRoot = (value: unknown): value is CampaignRootJSON =>
  CampaignRootSchema.safeParse(value).success;

/** The message for a version this build refuses. */
export function describeVersionRefusal(version: unknown, versionClass: 'future' | 'malformed'): string {
  return versionClass === 'future'
    ? `This campaign was saved by a newer version of the app (schema ${String(version)}; ` +
      `this version reads up to ${CAMPAIGN_SCHEMA_VERSION}). Update the app to open it.`
    : `This campaign has a malformed schema version: ${JSON.stringify(version) ?? String(version)}`;
}

/**
 * Decode a campaign payload: a string is JSON-parsed first. A missing `meta`
 * or `meta.schemaVersion`, or a version below 1.7.0, is pre-contract; a malformed or
 * newer one is refused.
 */
export function decodeCampaignPayload(input: unknown): DecodeResult {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (error) {
      return { ok: false, reason: 'not-json', detail: error instanceof Error ? error.message : String(error) };
    }
  }

  const root = CampaignRootSchema.safeParse(value);
  if (!root.success) {
    const issue = root.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    return {
      ok: false,
      reason: 'not-a-campaign',
      detail: `Not a campaign${path ? ` (at ${path})` : ''}: ${issue?.message ?? 'unexpected shape'}`,
    };
  }

  const declared = root.data.meta?.schemaVersion;
  if (declared === undefined) {
    return { ok: true, state: root.data, version: { declared: undefined, preContract: true } };
  }
  const versionClass = classifySchemaVersion(declared);
  if (typeof declared !== 'string' || versionClass === 'malformed') {
    return { ok: false, reason: 'malformed-version', detail: describeVersionRefusal(declared, 'malformed') };
  }
  if (versionClass === 'future') {
    return { ok: false, reason: 'future-version', detail: describeVersionRefusal(declared, 'future') };
  }
  return {
    ok: true,
    state: root.data,
    version: { declared, preContract: compareSchemaVersions(declared, FIRST_CONTRACT_VERSION) < 0 },
  };
}
