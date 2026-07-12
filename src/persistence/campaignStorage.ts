import storage from '../utils/storage';
import { createCampaignState, type CampaignState } from '../state/campaignReducer';
import { generateAllTestSampleData, isStateEmpty } from '../utils/testSampleData';
import { initialMapState } from '../types/map';
import { logger } from '../utils/logger';
import { ensureInventoryRecords, ensureConditionVisibility, ensureCombatCharacterCategories } from './dataMigration';

const CAMPAIGN_STORAGE_KEY = 'campaignState';

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
    hydratedMaps[mapId] = {
      ...map,
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
  const base = createCampaignState();
  const reveal = payload.combat?.reveal ?? base.combat.reveal;
  return ensureCombatCharacterCategories(ensureConditionVisibility(ensureInventoryRecords({
    ...base,
    ...payload,
    // Ensure all nested structures have proper defaults
    checkpoints: {
      ...base.checkpoints,
      ...payload.checkpoints,
      entries: payload.checkpoints?.entries ?? base.checkpoints.entries
    },
    entities: {
      ...base.entities,
      ...payload.entities
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
    maps: hydrateMapState((payload as any).maps),
  })));
};

export async function saveCampaignState(state: CampaignState) {
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
        return; // Pruned save succeeded
      } catch {
        // Still over quota even without checkpoints — re-throw the original error
      }
    }
    throw error;
  }
}

/**
 * Injects test sample data into an empty campaign state.
 * This provides persistent test samples for development and QA.
 *
 * Note: View types (Extended) and state types differ - state types are simpler
 * but runtime objects can have additional properties. We cast through 'any'
 * to match the pattern used elsewhere in the codebase.
 */
function injectTestSampleData(state: CampaignState): CampaignState {
  if (!isStateEmpty(state)) {
    return state;
  }

  console.log('[CampaignStorage] Empty state detected - loading test sample data...');
  const sampleData = generateAllTestSampleData();

  return {
    ...state,
    entities: {
      ...state.entities,
      materials: sampleData.materials,
      foods: sampleData.foods,
      // Gathering types: view types (Extended) have more fields than state types
      // but are compatible at runtime, matching the pattern in GatheringManager
      gatheringSpecies: sampleData.gatheringSpecies as any,
      gatheringTools: sampleData.gatheringTools as any,
      gatheringTables: sampleData.gatheringTables as any,
      gatheringEnvironments: sampleData.gatheringEnvironments as any,
      gatheringBait: sampleData.gatheringBait as any,
      gatheringItems: sampleData.gatheringItems as any,
      // Alchemy reagents: views.ts has extended type, campaign.ts has simple type
      alchemyReagents: sampleData.alchemyReagents as any,
      customTemplates: sampleData.customTemplates,
      // Cooking skills: both types have same shape but different imports
      cookingSkills: sampleData.cookingSkills as any,
    },
  };
}

export async function loadCampaignState(): Promise<CampaignState> {
  const stored = await storage.get(CAMPAIGN_STORAGE_KEY, false);
  if (!stored?.value) {
    const freshState = createCampaignState();
    return injectTestSampleData(freshState);
  }

  try {
    const parsed = JSON.parse(stored.value);
    const hydratedState = hydrateCampaignState(parsed);
    return injectTestSampleData(hydratedState);
  } catch (error) {
    console.error('Failed to parse campaign state, using defaults.', error);
    const freshState = createCampaignState();
    return injectTestSampleData(freshState);
  }
}
