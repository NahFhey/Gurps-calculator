/**
 * @fileoverview Turns an export file into a campaign the store can load.
 *
 * `importFile` validates and migrates the envelope; this module adds the step
 * the Manager was missing: hydrate the payload into a `CampaignState` and, for
 * locked files, keep the whole envelope (not just the bare lock) so a later
 * unlock can migrate and merge the GM payload.
 *
 * @module utils/campaignImport
 */

import { projectCampaignForPlayers } from '../../shared/playerProjection';
import { CampaignVersionError, hydrateCampaignState } from '../persistence/campaignStorage';
import type { CampaignState } from '../state/campaignReducer';
import type { GMLock } from './cryptoLock';
import { importFile, isCampaignState, mergeGM, unlockGMData } from './exportImport';

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

type Hydrated = { ok: true; state: CampaignState } | { ok: false; error: string };

/**
 * Hydrate a payload, returning a version refusal as a failure. The envelope
 * version is checked by `importFile`; this catches an inner `meta.schemaVersion`
 * from a newer build, or a malformed one, which would otherwise be stamped over.
 */
function hydrateForImport(payload: CampaignState): Hydrated {
  try {
    return { ok: true, state: hydrateCampaignState(payload) };
  } catch (error) {
    if (error instanceof CampaignVersionError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Validate, migrate and hydrate an export file. Nothing is dispatched here. */
export async function prepareCampaignImport(json: string): Promise<PreparedCampaignImport> {
  const result = await importFile(json);
  if (!result.ok) return result;

  if (result.isLocked) {
    const publicState = result.data.public;
    if (!isCampaignState(publicState)) return { ok: false, error: PRE_CAMPAIGN_EXPORT_ERROR };
    // The plaintext half is not trusted: a tampered file, or one exported before the public half
    // was projected, would otherwise load GM secrets and GM mode without the password.
    const hydrated = hydrateForImport(projectCampaignForPlayers(publicState));
    if (!hydrated.ok) return hydrated;
    return {
      ok: true,
      state: hydrated.state,
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
  if (!isCampaignState(fullState)) return { ok: false, error: PRE_CAMPAIGN_EXPORT_ERROR };
  const hydrated = hydrateForImport(fullState);
  if (!hydrated.ok) return hydrated;
  return { ok: true, state: hydrated.state, pendingLock: null, warnings: result.warnings };
}

/** Decrypt a pending lock. A wrong password or bad payload is returned as a failure, never thrown. */
export async function unlockPendingGMLock(pending: PendingGMLock, password: string): Promise<GMUnlockOutcome> {
  const unlocked = await unlockGMData(pending, password);
  if (!unlocked.ok) return unlocked;
  const merged = mergeGM(pending.public, unlocked.gmData);
  if (!isCampaignState(merged)) return { ok: false, error: 'The decrypted GM data is not a campaign.' };
  return hydrateForImport(merged);
}
