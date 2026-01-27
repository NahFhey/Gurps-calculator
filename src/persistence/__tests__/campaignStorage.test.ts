import { beforeEach, describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { loadCampaignState, saveCampaignState } from '../campaignStorage';

describe('campaignStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadCampaignState returns defaults when empty', async () => {
    const state = await loadCampaignState();

    expect(state.time.day).toBe(1);
    expect(state.time.slot).toBe(0);
    expect(state.combat.active).toBe(false);
  });

  it('saveCampaignState round-trips key fields', async () => {
    const state = createCampaignState();
    state.time.day = 5;
    state.ui.debugMode = true;
    state.combat.reveal.revealedTargets.add('target-1');

    await saveCampaignState(state);
    const loaded = await loadCampaignState();

    expect(loaded.time.day).toBe(5);
    expect(loaded.ui.debugMode).toBe(true);
    expect(loaded.combat.reveal.revealedTargets.has('target-1')).toBe(true);
  });
});
