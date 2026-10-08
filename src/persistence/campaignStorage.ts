import { ingestInlineImageLayers, pruneUnreferencedAssets } from '../assets/assetMigration';
import storage, { readRawStrict, writeWithRevision, ValueAlreadyPresentError } from '../utils/storage';
import { createCampaignState, type CampaignState } from '../state/campaignReducer';
import { generateAllTestSampleData, isStateEmpty } from '../utils/testSampleData';
import { initialMapState } from '../types/map';
import { logger } from '../utils/logger';
import { removeLegacyTravelState } from '../utils/dataMigrations';
import { ensureMapTokens, ensureMapScale, ensureAmbientWeather, ensureCharacterTemplates, ensureTravelGroups, ensureJourneyIntegrity, ensureTravelEventTables, ensureInventoryRecords, ensureOwnerAttributedHoldings, ensureConditionVisibility, ensureCombatCharacterCategories, ensureCombatHistoryShape, ensureLocationIntegrity } from './dataMigration';
import { DEFAULT_CALENDAR } from '../utils/timeSystem';
import { CAMPAIGN_SCHEMA_VERSION, classifySchemaVersion } from '../../shared/campaignVersion';

const CAMPAIGN_STORAGE_KEY = 'campaignState';
const CAMPAIGN_REVISION_KEY = 'campaignStateRevision';
// Legacy key as a string literal on purpose: the field no longer exists on
// MapModel, but pre-1.5.6 saves still carry it.
const LEGACY_PARTY_POSITION_KEY = 'partyTileId';

// ---------------------------------------------------------------------------
// Cross-tab overwrite guard
//
// The entire CampaignState persists as a single blob that each session reads
// once at boot, so a second tab (or a lingering old session) that dispatches
// later would overwrite the blob with its own stale in-memory copy, silently
// erasing everything the other tab saved. Every save bumps a monotonic
// revision in CAMPAIGN_REVISION_KEY; a session that finds a stored revision
// newer than the one it booted from (or last wrote) refuses to save and asks
// for a reload instead.
// ---------------------------------------------------------------------------

/** Window events the autosave loop emits so the UI can show save health. */
export const CAMPAIGN_SAVE_OK_EVENT = 'campaign-save-ok';
export const CAMPAIGN_SAVE_FAILED_EVENT = 'campaign-save-failed';
export const CAMPAIGN_STATE_CONFLICT_EVENT = 'campaign-state-conflict';
/** Fired whenever getCampaignSaveHealth() changes (load issue set/cleared, conflict). */
export const CAMPAIGN_SAVE_HEALTH_EVENT = 'campaign-save-health';

/** Revision this session booted from / last wrote; null until load or first save. */
let sessionRevision: number | null = null;
let conflictAnnounced = false;

export class CampaignStateConflictError extends Error {
  constructor(storedRevision: number, sessionRev: number) {
    super(
      `Refusing to save campaign state: storage holds revision ${storedRevision}, ` +
      `newer than this session's revision ${sessionRev}. Another tab or window has ` +
      `saved since this session loaded — reload to pick up the latest state.`
    );
    this.name = 'CampaignStateConflictError';
  }
}

function announceSaveHealth() {
  window.dispatchEvent(new CustomEvent(CAMPAIGN_SAVE_HEALTH_EVENT));
}

async function readStoredRevision(): Promise<number> {
  const stored = await storage.get(CAMPAIGN_REVISION_KEY);
  if (!stored?.value) {
    return 0;
  }
  const parsed = Number(stored.value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

// ---------------------------------------------------------------------------
// Load-failure save block
//
// If the stored campaign exists but cannot be read or decoded, the session
// starts on a blank campaign. Autosave would then replace the user's real
// save with that blank one on the first dispatch, so saving stays blocked
// until the user either downloads the original or explicitly starts fresh.
// ---------------------------------------------------------------------------

export const UNREADABLE_SAVE_KEY_PREFIX = 'campaignState_unreadable_';

export interface CampaignLoadIssue {
  /**
   * 'unreadable': storage read failed. 'invalid': bytes read but did not
   * parse/hydrate. 'newer-version': a newer build saved it; this one must not
   * load or overwrite it.
   */
  kind: 'unreadable' | 'invalid' | 'newer-version';
  message: string;
  /** Original stored text, when it could be read. */
  raw: string | null;
  /** Storage key holding a copy of `raw`, or null if the copy failed or there were no bytes. */
  recoveryKey: string | null;
}

let loadIssue: CampaignLoadIssue | null = null;

export class CampaignSaveBlockedError extends Error {
  constructor() {
    super(
      'Saving is paused: the stored campaign could not be loaded, and saving now ' +
      'would overwrite it. Download the original or choose to start fresh first.'
    );
    this.name = 'CampaignSaveBlockedError';
  }
}

/** The load failure that is currently blocking saves, if any. */
export function getCampaignLoadIssue(): CampaignLoadIssue | null {
  return loadIssue;
}

export interface CampaignSaveHealth {
  loadIssue: CampaignLoadIssue | null;
  /** Another tab saved after this session loaded; saves are refused until reload. */
  conflict: boolean;
}

/**
 * Current save health. Events alone are not enough: a conflict or load issue
 * can arise before the banner mounts, so the banner reads this on mount and
 * re-reads it on every CAMPAIGN_SAVE_HEALTH_EVENT.
 */
export function getCampaignSaveHealth(): CampaignSaveHealth {
  return { loadIssue, conflict: conflictAnnounced };
}

/**
 * The user chose to continue on the fresh campaign. Saving resumes and the
 * next save replaces the stored campaign; the recovery copy (if any) stays.
 */
export function acknowledgeCampaignLoadIssue() {
  loadIssue = null;
  announceSaveHealth();
}

/** Resolves once every save queued so far has finished (either way). */
export function whenCampaignSavesSettled(): Promise<void> {
  return saveQueue;
}

/** Test-only: forget this session's revision baseline and load state. */
export function resetRevisionGuard() {
  sessionRevision = null;
  conflictAnnounced = false;
  loadIssue = null;
  saveQueue = Promise.resolve();
  loadInFlight = null;
}

const serializeMapState = (maps: CampaignState['maps']) => {
  const serializedMaps: Record<string, unknown> = {};
  for (const [mapId, map] of Object.entries(maps.mapsById)) {
    serializedMaps[mapId] = {
      ...map,
      revealedTileIds: Array.from(map.revealedTileIds || []),
    };
  }
  return {
    ...maps,
    mapsById: serializedMaps,
  };
};

export const serializeCampaignState = (state: CampaignState) => ({
  ...state,
  legacy: {
    ...state.legacy,
    appState: {}
  },
  combat: {
    ...state.combat,
    reveal: {
      ...state.combat.reveal,
      revealedTargets: Array.from(state.combat.reveal.revealedTargets || []),
      revealedHP: Array.from(state.combat.reveal.revealedHP || [])
    }
  },
  maps: serializeMapState(state.maps),
});

const hydrateMapState = (maps: any): CampaignState['maps'] => {
  if (!maps || !maps.mapsById) {
    return initialMapState;
  }
  const hydratedMaps: Record<string, any> = {};
  for (const [mapId, map] of Object.entries(maps.mapsById as Record<string, any>)) {
    const mapWithoutPartyPosition = { ...map };
    delete mapWithoutPartyPosition[LEGACY_PARTY_POSITION_KEY];
    hydratedMaps[mapId] = {
      ...mapWithoutPartyPosition,
      climate: map.climate ?? 'temperate',
      visionMode: map.visionMode ?? 'lineOfSight',
      revealedTileIds: new Set(map.revealedTileIds || []),
    };
  }
  return {
    ...initialMapState,
    ...maps,
    mapsById: hydratedMaps,
  };
};

/**
 * A campaign payload whose `meta.schemaVersion` this build cannot read: a
 * newer build wrote it ('future'), or the version is not strict semver
 * ('malformed'). Thrown before anything is repaired or stamped.
 */
export class CampaignVersionError extends Error {
  constructor(readonly version: unknown, readonly versionClass: 'future' | 'malformed') {
    super(
      versionClass === 'future'
        ? `This campaign was saved by a newer version of the app (schema ${String(version)}; ` +
          `this version reads up to ${CAMPAIGN_SCHEMA_VERSION}). Update the app to open it.`
        : `This campaign has a malformed schema version: ${JSON.stringify(version) ?? String(version)}`
    );
    this.name = 'CampaignVersionError';
  }
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Refuse a payload from a newer build or with a malformed version. A missing
 * version, or any below 1.7.0, is pre-contract: the old `'1.0.0'` was never
 * bumped, so hydration's idempotent repairs are what bring it up to date.
 */
function assertReadableSchemaVersion(payload: unknown): void {
  const meta = isPlainRecord(payload) ? payload.meta : undefined;
  if (!isPlainRecord(meta) || meta.schemaVersion === undefined) return;
  const versionClass = classifySchemaVersion(meta.schemaVersion);
  if (versionClass === 'future' || versionClass === 'malformed') {
    throw new CampaignVersionError(meta.schemaVersion, versionClass);
  }
}

/**
 * Turn a parsed campaign payload into runtime state: refuse unreadable
 * versions, run the idempotent repairs, and stamp the current schema version.
 */
export const hydrateCampaignState = (payload: CampaignState): CampaignState => {
  assertReadableSchemaVersion(payload);
  payload = ensureMapTokens(removeLegacyTravelState(payload));
  const base = createCampaignState();
  const reveal = payload.combat?.reveal ?? base.combat.reveal;
  return ensureLocationIntegrity(ensureAmbientWeather(ensureTravelEventTables(ensureJourneyIntegrity(ensureTravelGroups(ensureCharacterTemplates(ensureCombatHistoryShape(ensureCombatCharacterCategories(ensureConditionVisibility(ensureOwnerAttributedHoldings(ensureInventoryRecords(ensureMapScale({
    ...base,
    ...payload,
    // Ensure all nested structures have proper defaults
    meta: {
      ...base.meta,
      ...(isPlainRecord(payload.meta) ? payload.meta : {}),
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    },
    ui: {
      ...base.ui,
      ...payload.ui,
      pendingIntent: null
    },
    checkpoints: {
      ...base.checkpoints,
      ...payload.checkpoints,
      entries: payload.checkpoints?.entries ?? base.checkpoints.entries
    },
    entities: {
      ...base.entities,
      ...payload.entities
    },
    time: {
      ...base.time,
      ...payload.time,
      calendar: payload.time?.calendar ?? DEFAULT_CALENDAR,
    },
    locations: {
      ...base.locations,
      ...payload.locations,
      locations: payload.locations?.locations ?? base.locations.locations,
      weatherTables: payload.locations?.weatherTables ?? base.locations.weatherTables,
    },
    legacy: {
      ...base.legacy,
      ...payload.legacy,
      appState: base.legacy.appState
    },
    combat: {
      ...base.combat,
      ...payload.combat,
      reveal: {
        ...base.combat.reveal,
        ...reveal,
        revealedTargets: new Set(reveal.revealedTargets || []),
        revealedHP: new Set(reveal.revealedHP || [])
      }
    },
    maps: hydrateMapState(payload.maps),
  }))))))))))));
};

/** Decide the revision to stamp, or refuse if another tab saved since we loaded. */
function nextRevisionOrConflict(storedRevision: number): number {
  if (sessionRevision !== null && storedRevision > sessionRevision) {
    if (!conflictAnnounced) {
      conflictAnnounced = true;
      logger.warn(
        `[CampaignStorage] Save refused: stored revision ${storedRevision} is newer than ` +
        `this session's revision ${sessionRevision} — another tab has saved since this ` +
        `session loaded. Reload to pick up the latest state.`
      );
      window.dispatchEvent(new CustomEvent(CAMPAIGN_STATE_CONFLICT_EVENT, {
        detail: { storedRevision, sessionRevision },
      }));
      announceSaveHealth();
    }
    throw new CampaignStateConflictError(storedRevision, sessionRevision);
  }
  return Math.max(sessionRevision ?? 0, storedRevision) + 1;
}

async function writeCampaignPayload(payload: ReturnType<typeof serializeCampaignState>) {
  sessionRevision = await writeWithRevision({
    valueKey: CAMPAIGN_STORAGE_KEY,
    value: JSON.stringify(payload),
    revisionKey: CAMPAIGN_REVISION_KEY,
    nextRevision: nextRevisionOrConflict,
  });
}

async function saveCampaignStateNow(state: CampaignState) {
  if (loadIssue) {
    throw new CampaignSaveBlockedError();
  }
  const payload = serializeCampaignState(state);
  try {
    await writeCampaignPayload(payload);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      // Auto-prune: remove checkpoints (the biggest space hog) and retry
      const pruned = {
        ...payload,
        checkpoints: { ...payload.checkpoints, entries: [] },
      };
      logger.log('[CampaignStorage] Quota exceeded — pruning all checkpoints and retrying save');
      try {
        await writeCampaignPayload(pruned);
        return;
      } catch {
        // Still over quota even without checkpoints — re-throw the original error
      }
    }
    throw error;
  }
}

/**
 * Saves from one session run strictly one after another, so two overlapping
 * calls cannot both read revision N and both stamp N+1.
 */
let saveQueue: Promise<void> = Promise.resolve();

function enqueueSave(task: () => Promise<void>): Promise<void> {
  const result = saveQueue.then(task);
  saveQueue = result.catch(() => undefined);
  return result;
}

export function saveCampaignState(state: CampaignState): Promise<void> {
  return enqueueSave(() => saveCampaignStateNow(state));
}

/**
 * Write the campaign produced by the legacy (v1) migration. It commits only
 * if no campaign is stored yet (checked inside the write transaction, so a
 * migration that loses a race with another tab cannot replace that tab's
 * campaign), stamps a revision, and makes it this session's baseline: the
 * session then refuses to overwrite anything another tab saves later.
 *
 * @throws ValueAlreadyPresentError when a campaign already exists.
 */
export function commitMigratedCampaignState(state: CampaignState): Promise<void> {
  return enqueueSave(async () => {
    sessionRevision = await writeWithRevision({
      valueKey: CAMPAIGN_STORAGE_KEY,
      value: JSON.stringify(serializeCampaignState(state)),
      revisionKey: CAMPAIGN_REVISION_KEY,
      nextRevision: (storedRevision) => storedRevision + 1,
      requireValueAbsent: true,
    });
    conflictAnnounced = false;
    if (loadIssue) {
      loadIssue = null;
      announceSaveHealth();
    }
  });
}

export { ValueAlreadyPresentError };

/**
 * Injects test sample data into an empty campaign state.
 * This provides persistent test samples for development and QA.
 */
function injectTestSampleData(state: CampaignState): CampaignState {
  if (!isStateEmpty(state)) {
    return state;
  }

  console.log('[CampaignStorage] Empty state detected - loading test sample data...');
  const sampleData = generateAllTestSampleData();

  const partyInventory = Object.values(state.entities.inventories).find(
    (inventory) => inventory.ownerType === 'party'
  );
  return {
    ...state,
    entities: {
      ...state.entities,
      inventories: partyInventory ? {
        ...state.entities.inventories,
        [partyInventory.id]: {
          ...partyInventory,
          materials: Object.values(sampleData.materials),
          food: Object.values(sampleData.foods),
        },
      } : state.entities.inventories,
      gatheringSpecies: sampleData.gatheringSpecies,
      gatheringTools: sampleData.gatheringTools,
      gatheringTables: sampleData.gatheringTables,
      gatheringEnvironments: sampleData.gatheringEnvironments,
      gatheringBait: sampleData.gatheringBait,
      gatheringItems: sampleData.gatheringItems,
      alchemyReagents: sampleData.alchemyReagents,
      customTemplates: sampleData.customTemplates,
      cookingSkills: sampleData.cookingSkills,
    },
  };
}

/**
 * Assets created within this window are never pruned. Another tab stores an
 * image's bytes before it commits the campaign that references them; the
 * age gate keeps a booting tab from deleting them in between.
 */
const ASSET_PRUNE_MIN_AGE_MS = 60 * 60 * 1000;

let loadInFlight: Promise<CampaignState> | null = null;

/**
 * Load the stored campaign. Single-flight: a call while a load is running
 * gets that load's promise. Two overlapping loads would share one revision
 * baseline, so the older one could save or prune over the newer one.
 */
export function loadCampaignState(): Promise<CampaignState> {
  if (!loadInFlight) {
    loadInFlight = loadCampaignStateNow().finally(() => {
      loadInFlight = null;
    });
  }
  return loadInFlight;
}

/**
 * Install a finished load's outcome: its revision baseline and its load
 * issue (or none), clearing any earlier conflict. Until a load gets here the
 * previous guards stay in force, so a provider still mounted with unsaved
 * changes cannot save over the campaign the load is reading.
 */
function settleLoad(baseline: number | null, issue: CampaignLoadIssue | null) {
  const changed = loadIssue !== null || conflictAnnounced || issue !== null;
  sessionRevision = baseline;
  conflictAnnounced = false;
  loadIssue = issue;
  if (changed) announceSaveHealth();
}

async function loadCampaignStateNow(): Promise<CampaignState> {
  // Whatever revision is on disk becomes this session's baseline; saves from
  // this session are refused once another tab advances past it. Read before
  // the campaign itself: a save landing in between leaves the baseline behind
  // the bytes, which can only cause a false conflict, never an overwrite.
  const baseline = await readStoredRevision();

  let raw: string | null;
  try {
    raw = await readRawStrict(CAMPAIGN_STORAGE_KEY);
  } catch (error) {
    // Something may well be stored; we just can't see it. Never treat that
    // as "no save".
    logger.error('[CampaignStorage] Could not read the stored campaign; saving is paused.', error);
    settleLoad(baseline, {
      kind: 'unreadable',
      message: describeError(error),
      raw: null,
      recoveryKey: null,
    });
    return createFreshCampaignState();
  }

  // Only null means "never saved"; an empty string is a damaged save.
  if (raw === null) {
    settleLoad(baseline, null);
    return injectTestSampleData(createFreshCampaignState());
  }

  let state: CampaignState;
  try {
    state = injectTestSampleData(hydrateCampaignState(JSON.parse(raw)));
  } catch (error) {
    logger.error('[CampaignStorage] Stored campaign cannot be loaded; saving is paused.', error);
    // Block saves before the first await below, not after it.
    const issue: CampaignLoadIssue = {
      kind: error instanceof CampaignVersionError && error.versionClass === 'future' ? 'newer-version' : 'invalid',
      message: describeError(error),
      raw,
      recoveryKey: null,
    };
    settleLoad(baseline, issue);
    const recoveryKey = await preserveUnreadableSave(raw);
    if (loadIssue === issue && recoveryKey) {
      loadIssue = { ...issue, recoveryKey };
      announceSaveHealth();
    }
    return createFreshCampaignState();
  }

  settleLoad(baseline, null);
  try {
    const migrated = await ingestInlineImageLayers(state);
    if (migrated.ingested > 0) await saveCampaignState(migrated.state);
    // Prune only from a snapshot that is still the stored campaign: if
    // another tab saved meanwhile, its campaign may reference assets this
    // one does not.
    if ((await readStoredRevision()) === sessionRevision) {
      await pruneUnreferencedAssets(migrated.state, undefined, { minAgeMs: ASSET_PRUNE_MIN_AGE_MS });
    }
    return migrated.state;
  } catch (error) {
    logger.warn('[CampaignStorage] Asset migration/cleanup failed; keeping loaded state', error);
    return state;
  }
}

function createFreshCampaignState(): CampaignState {
  return ensureTravelEventTables(ensureTravelGroups(ensureCharacterTemplates(createCampaignState())));
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** Copy the undecodable save aside so "start fresh" never destroys it. */
async function preserveUnreadableSave(raw: string): Promise<string | null> {
  const key = `${UNREADABLE_SAVE_KEY_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    // Every reload while the save is still broken lands here; reuse an
    // identical copy rather than stacking up full-size duplicates.
    for (const existing of await storage.keys()) {
      if (
        existing.startsWith(UNREADABLE_SAVE_KEY_PREFIX) &&
        (await storage.get(existing))?.value === raw
      ) {
        return existing;
      }
    }
    await storage.set(key, raw);
    return key;
  } catch (error) {
    logger.warn('[CampaignStorage] Could not copy the unreadable save aside', error);
    return null;
  }
}
