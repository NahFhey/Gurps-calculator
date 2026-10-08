/**
 * The campaign schema-version contract, shared by client and server.
 *
 * One semver string versions every persisted campaign: the local save, the
 * server's state_json, checkpoint snapshots (all through `meta.schemaVersion`)
 * and the export envelope. Versions are strict `MAJOR.MINOR.PATCH` of
 * non-negative integers without leading zeros; anything else is malformed and
 * is refused rather than guessed at.
 *
 * Every shape change from 1.7.0 on adds an ordered JSON→JSON migration and
 * bumps this constant. Payloads below 1.7.0 are "pre-contract": their
 * `meta.schemaVersion` was never bumped, so it carries no information.
 */

export const CAMPAIGN_SCHEMA_VERSION = '1.7.0';

/** First version whose `meta.schemaVersion` means anything. */
export const FIRST_CONTRACT_VERSION = '1.7.0';

export interface ParsedSchemaVersion {
  major: number;
  minor: number;
  patch: number;
}

export type SchemaVersionClass = 'current' | 'older' | 'future' | 'malformed';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Parse a strict `MAJOR.MINOR.PATCH`; null for anything else (including non-strings). */
export function parseSchemaVersion(value: unknown): ParsedSchemaVersion | null {
  if (typeof value !== 'string') return null;
  const match = SEMVER.exec(value);
  if (!match) return null;
  const [major, minor, patch] = [match[1], match[2], match[3]].map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch };
}

export class MalformedSchemaVersionError extends Error {
  constructor(readonly version: unknown) {
    super(`Malformed schema version: ${JSON.stringify(version) ?? String(version)}`);
    this.name = 'MalformedSchemaVersionError';
  }
}

function parseOrThrow(value: string): ParsedSchemaVersion {
  const parsed = parseSchemaVersion(value);
  if (!parsed) throw new MalformedSchemaVersionError(value);
  return parsed;
}

/** Negative, zero or positive as `a` is older than, equal to or newer than `b`. Throws on a malformed version. */
export function compareSchemaVersions(a: string, b: string): number {
  const pa = parseOrThrow(a);
  const pb = parseOrThrow(b);
  return pa.major - pb.major || pa.minor - pb.minor || pa.patch - pb.patch;
}

/** Where `value` stands relative to `current` (default: this build's version). */
export function classifySchemaVersion(
  value: unknown,
  current: string = CAMPAIGN_SCHEMA_VERSION
): SchemaVersionClass {
  if (!parseSchemaVersion(value)) return 'malformed';
  const order = compareSchemaVersions(value as string, current);
  if (order === 0) return 'current';
  return order < 0 ? 'older' : 'future';
}
