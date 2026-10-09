/**
 * @fileoverview Turns an export file into a campaign the store can load.
 *
 * `importFile` validates and migrates the envelope; this module adds the step
 * the Manager was missing: decode the payload into a `CampaignState` and, for
 * locked files, keep the whole envelope (not just the bare lock) so a later
 * unlock can migrate and merge the GM payload.
 *
 * @module utils/campaignImport
 */

import { isCampaignRoot } from '../../shared/campaignDocument';
import { projectCampaignForPlayers } from '../../shared/playerProjection';
import { decodeCampaign } from '../persistence/decodeCampaign';
import type { CampaignState } from '../state/campaignReducer';
import type { GMLock } from './cryptoLock';
import { importFile, unlockGMData } from './exportImport';

/** What a locked import leaves behind for a later GM unlock. */
export interface PendingGMLock {
  gmLock: GMLock;
  public: Record<string, unknown>;
  schemaVersion: string | number;
  originalSchemaVersion?: string;
}

export type PreparedCampaignImport =
  | { ok: true; state: CampaignState; pendingLock: PendingGMLock | null; warnings: string[] }
  | { ok: false; error: string };

export type GMUnlockOutcome =
  | { ok: true; state: CampaignState }
  | { ok: false; error: string };

export const PRE_CAMPAIGN_EXPORT_ERROR =
  'This file uses the pre-campaign export format, which this version cannot load into a campaign.';

type Decoded = { ok: true; state: CampaignState } | { ok: false; error: string };

/**
 * Decode a payload through the one campaign decoder: an inner
 * `meta.schemaVersion` from a newer build (or a malformed one) and a malformed
 * slice are failures, never thrown and never stamped over.
 */
function decodeForImport(payload: unknown): Decoded {
  const decoded = decodeCampaign(payload);
  return decoded.ok ? { ok: true, state: decoded.state } : { ok: false, error: decoded.detail };
}

/** Validate, migrate and decode an export file. Nothing is dispatched here. */
export async function prepareCampaignImport(json: string): Promise<PreparedCampaignImport> {
  const result = await importFile(json);
  if (!result.ok) return result;

  if (result.isLocked) {
    const publicState = result.data.public;
    if (!isCampaignRoot(publicState)) return { ok: false, error: PRE_CAMPAIGN_EXPORT_ERROR };
    // The plaintext half is not trusted: a tampered file, or one exported before the public half
    // was projected, would otherwise load GM secrets and GM mode without the password.
    const decoded = decodeForImport(projectCampaignForPlayers(publicState));
    if (!decoded.ok) return decoded;
    return {
      ok: true,
      state: decoded.state,
      pendingLock: {
        gmLock: result.data.gmLock,
        public: result.data.public,
        schemaVersion: result.data.schemaVersion,
        originalSchemaVersion: result.data.originalSchemaVersion,
      },
      warnings: result.warnings,
    };
  }

  const fullState = result.data.gm ?? result.data.public;
  if (!isCampaignRoot(fullState)) return { ok: false, error: PRE_CAMPAIGN_EXPORT_ERROR };
  const decoded = decodeForImport(fullState);
  if (!decoded.ok) return decoded;
  return { ok: true, state: decoded.state, pendingLock: null, warnings: result.warnings };
}

/** Decrypt a pending lock. A wrong password or bad payload is returned as a failure, never thrown. */
export async function unlockPendingGMLock(pending: PendingGMLock, password: string): Promise<GMUnlockOutcome> {
  const unlocked = await unlockGMData(pending, password);
  if (!unlocked.ok) return unlocked;
  // A campaign export's GM half is the whole campaign, so it is decoded as is (no merge).
  const gmCampaign = unlocked.gmData || pending.public;
  if (!isCampaignRoot(gmCampaign)) return { ok: false, error: 'The decrypted GM data is not a campaign.' };
  return decodeForImport(gmCampaign);
}
