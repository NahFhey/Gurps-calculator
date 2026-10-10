/**
 * Minimal campaign documents for server tests. Server tests cannot import
 * `src/`, so this builds the smallest payload `decodeCampaignPayload`
 * (shared/campaignDocument.ts) accepts: `ui`, `entities` and `time` as
 * objects, plus `meta.schemaVersion`.
 */
import { CAMPAIGN_SCHEMA_VERSION } from '../../../shared/campaignVersion.js';

export interface CampaignFixtureOptions {
  /** `meta.schemaVersion`; `null` leaves `meta` out entirely (a pre-contract save). */
  schemaVersion?: unknown;
  /** Extra root keys, merged over the defaults (so they can also replace a slice). */
  extra?: Record<string, unknown>;
}

export function campaignDoc({ schemaVersion = CAMPAIGN_SCHEMA_VERSION, extra = {} }: CampaignFixtureOptions = {}): Record<string, unknown> {
  return {
    ...(schemaVersion === null ? {} : { meta: { schemaVersion } }),
    ui: {},
    entities: {},
    time: { day: 1, slot: 0 },
    ...extra,
  };
}

export function campaignJson(options: CampaignFixtureOptions = {}): string {
  return JSON.stringify(campaignDoc(options));
}
