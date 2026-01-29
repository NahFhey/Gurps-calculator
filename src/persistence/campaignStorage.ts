import storage from '../utils/storage';
import { createCampaignState, type CampaignState } from '../state/campaignReducer';
import { generateAllTestSampleData, isStateEmpty } from '../utils/testSampleData';

const CAMPAIGN_STORAGE_KEY = 'campaignState';

const serializeCampaignState = (state: CampaignState) => ({
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
  }
});

const hydrateCampaignState = (payload: CampaignState): CampaignState => {
  const base = createCampaignState();
  const reveal = payload.combat?.reveal ?? base.combat.reveal;
  return {
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
    }
  };
};

export async function saveCampaignState(state: CampaignState) {
  const payload = serializeCampaignState(state);
  await storage.set(CAMPAIGN_STORAGE_KEY, JSON.stringify(payload), false);
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
