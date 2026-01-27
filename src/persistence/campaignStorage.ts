import storage from '../utils/storage';
import { createCampaignState, type CampaignState } from '../state/campaignReducer';

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

export async function loadCampaignState(): Promise<CampaignState> {
  const stored = await storage.get(CAMPAIGN_STORAGE_KEY, false);
  if (!stored?.value) {
    return createCampaignState();
  }

  try {
    const parsed = JSON.parse(stored.value);
    return hydrateCampaignState(parsed);
  } catch (error) {
    console.error('Failed to parse campaign state, using defaults.', error);
    return createCampaignState();
  }
}
