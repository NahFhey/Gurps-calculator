import { ingestInlineImageLayers, pruneUnreferencedAssets } from '../assets/assetMigration';
import storage from '../utils/storage';
import { createCampaignState, type CampaignState } from '../state/campaignReducer';
import { generateAllTestSampleData, isStateEmpty } from '../utils/testSampleData';
import { initialMapState } from '../types/map';
import { logger } from '../utils/logger';
import { removeLegacyTravelState } from '../utils/dataMigrations';
import { ensureAmbientWeather, ensureCharacterTemplates, ensureTravelGroups, ensureJourneyIntegrity, ensureTravelEventTables, ensureInventoryRecords, ensureOwnerAttributedHoldings, ensureConditionVisibility, ensureCombatCharacterCategories, ensureCombatHistoryShape, ensureLocationIntegrity } from './dataMigration';
import { DEFAULT_CALENDAR } from '../utils/timeSystem';

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

async function readStoredRevision(): Promise<number> {
  const stored = await storage.get(CAMPAIGN_REVISION_KEY, false);
  if (!stored?.value) {
    return 0;
  }
  const parsed = Number(stored.value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function commitRevision(revision: number) {
  try {
    await storage.set(CAMPAIGN_REVISION_KEY, String(revision), false);
  } catch (error) {
    // The state blob itself saved; a failed revision stamp only weakens the
    // guard, so don't fail the save over it.
    logger.warn('[CampaignStorage] Failed to persist revision stamp', error);
  }
  sessionRevision = revision;
}

/** Test-only: forget this session's revision baseline. */
export function resetRevisionGuard() {
  sessionRevision = null;
  conflictAnnounced = false;
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

export const hydrateCampaignState = (payload: CampaignState): CampaignState => {
  payload = removeLegacyTravelState(payload);
  const base = createCampaignState();
  const reveal = payload.combat?.reveal ?? base.combat.reveal;
  return ensureLocationIntegrity(ensureAmbientWeather(ensureTravelEventTables(ensureJourneyIntegrity(ensureTravelGroups(ensureCharacterTemplates(ensureCombatHistoryShape(ensureCombatCharacterCategories(ensureConditionVisibility(ensureOwnerAttributedHoldings(ensureInventoryRecords({
    ...base,
    ...payload,
    // Ensure all nested structures have proper defaults
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
  })))))))))));
};

export async function saveCampaignState(state: CampaignState) {
  const storedRevision = await readStoredRevision();
  if (sessionRevision !== null && storedRevision > sessionRevision) {
    if (!conflictAnnounced) {
      conflictAnnounced = true;
      logger.warn(
        `[CampaignStorage] Save refused: stored revision ${storedRevision} is newer than ` +
        `this session's revision ${sessionRevision} — another tab has saved since this ` +
        `session loaded. Reload to pick up the latest state.`
      );
      window.dispatchEvent(new CustomEvent('campaign-state-conflict', {
        detail: { storedRevision, sessionRevision },
      }));
    }
    throw new CampaignStateConflictError(storedRevision, sessionRevision);
  }
  const nextRevision = Math.max(sessionRevision ?? 0, storedRevision) + 1;

  const payload = serializeCampaignState(state);
  try {
    await storage.set(CAMPAIGN_STORAGE_KEY, JSON.stringify(payload), false);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      // Auto-prune: remove checkpoints (the biggest space hog) and retry
      const pruned = {
        ...payload,
        checkpoints: { ...payload.checkpoints, entries: [] },
      };
      logger.log('[CampaignStorage] Quota exceeded — pruning all checkpoints and retrying save');
      try {
        await storage.set(CAMPAIGN_STORAGE_KEY, JSON.stringify(pruned), false);
        await commitRevision(nextRevision); // Pruned save succeeded
        return;
      } catch {
        // Still over quota even without checkpoints — re-throw the original error
      }
    }
    throw error;
  }
  await commitRevision(nextRevision);
}

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

export async function loadCampaignState(): Promise<CampaignState> {
  // Adopt whatever revision is on disk as this session's baseline; saves from
  // this session are refused once another tab advances past it.
  sessionRevision = await readStoredRevision();
  conflictAnnounced = false;

  const stored = await storage.get(CAMPAIGN_STORAGE_KEY, false);
  if (!stored?.value) {
    const freshState = ensureTravelEventTables(ensureTravelGroups(ensureCharacterTemplates(createCampaignState())));
    return injectTestSampleData(freshState);
  }

  try {
    const parsed = JSON.parse(stored.value);
    const hydratedState = hydrateCampaignState(parsed);
    const state = injectTestSampleData(hydratedState);
    try {
      const migrated = await ingestInlineImageLayers(state);
      if (migrated.ingested > 0) await saveCampaignState(migrated.state);
      await pruneUnreferencedAssets(migrated.state);
      return migrated.state;
    } catch (error) {
      logger.warn('[CampaignStorage] Asset migration/cleanup failed; keeping loaded state', error);
      return state;
    }
  } catch (error) {
    console.error('Failed to parse campaign state, using defaults.', error);
    const freshState = ensureTravelEventTables(ensureTravelGroups(ensureCharacterTemplates(createCampaignState())));
    return injectTestSampleData(freshState);
  }
}
