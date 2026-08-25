import { beforeEach, describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import type { CampaignState } from '../../state/campaignReducer';
import { hydrateCampaignState, loadCampaignState, saveCampaignState } from '../../persistence/campaignStorage';
import type { CombatState } from '../../types/combatTracker';

function makeLegacyCombat(): CombatState {
  return {
    id: 'combat-old',
    name: 'Legacy Encounter',
    startTime: 1,
    participants: [],
    turnOrder: [],
    currentTurnIndex: 0,
    currentRound: 1,
    turnDecisions: {},
    log: [],
  };
}

describe('combat consumption persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates an older CombatState that has no consumptions field', () => {
    const state = createCampaignState();
    state.combat.activeSession = makeLegacyCombat() as unknown as CampaignState['combat']['activeSession'];
    const hydrated = hydrateCampaignState(state);
    const combat = hydrated.combat.activeSession as unknown as CombatState;
    expect(combat.id).toBe('combat-old');
    expect(combat.consumptions).toBeUndefined();
  });

  it('save-load round-trips an active encounter without requiring consumptions', async () => {
    const state = createCampaignState();
    state.combat.activeSession = makeLegacyCombat() as unknown as CampaignState['combat']['activeSession'];
    await saveCampaignState(state);
    const loaded = await loadCampaignState();
    const combat = loaded.combat.activeSession as unknown as CombatState;
    expect(combat.name).toBe('Legacy Encounter');
    expect(combat).not.toHaveProperty('consumptions');
  });
});
