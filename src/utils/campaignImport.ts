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
import { hydrateCampaignState } from '../persistence/campaignStorage';
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

/** Validate, migrate and hydrate an export file. Nothing is dispatched here. */
export async function prepareCampaignImport(json: string): Promise<PreparedCampaignImport> {
  const result = await importFile(json);
  if (!result.ok) return result;

  if (result.isLocked) {
    const publicState = result.data.public;
    if (!isCampaignState(publicState)) return { ok: false, error: PRE_CAMPAIGN_EXPORT_ERROR };
    return {
      ok: true,
      // The plaintext half is not trusted: a tampered file, or one exported before the public half
      // was projected, would otherwise load GM secrets and GM mode without the password.
      state: hydrateCampaignState(projectCampaignForPlayers(publicState)),
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
  return { ok: true, state: hydrateCampaignState(fullState), pendingLock: null, warnings: result.warnings };
}

/** Decrypt a pending lock. A wrong password or bad payload is returned as a failure, never thrown. */
export async function unlockPendingGMLock(pending: PendingGMLock, password: string): Promise<GMUnlockOutcome> {
  const unlocked = await unlockGMData(pending, password);
  if (!unlocked.ok) return unlocked;
  const merged = mergeGM(pending.public, unlocked.gmData);
  if (!isCampaignState(merged)) return { ok: false, error: 'The decrypted GM data is not a campaign.' };
  return { ok: true, state: hydrateCampaignState(merged) };
}
