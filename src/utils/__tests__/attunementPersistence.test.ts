import { beforeEach, describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { loadCampaignState, saveCampaignState } from '../../persistence/campaignStorage';

describe('attunement persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips magical and attuned flags through save and load', async () => {
    const state = createCampaignState();
    state.entities.inventories = {
      'inv-mage': {
        id: 'inv-mage',
        ownerType: 'character',
        ownerId: 'mage',
        currency: {},
        items: [{ id: 'wand', name: 'Wand', magical: true, attuned: true }],
        tools: [],
        materials: [],
        food: [],
      },
    };

    await saveCampaignState(state);
    const loaded = await loadCampaignState();

    expect(loaded.entities.inventories['inv-mage'].items[0]).toMatchObject({
      magical: true,
      attuned: true,
    });
  });

  it('loads legacy items without either optional flag as falsey', async () => {
    const state = createCampaignState();
    state.entities.inventories = {
      party: {
        id: 'party',
        ownerType: 'party',
        ownerId: null,
        currency: {},
        items: [{ id: 'rope', name: 'Rope' }],
        tools: [],
        materials: [],
        food: [],
      },
    };

    await saveCampaignState(state);
    const loaded = await loadCampaignState();
    const item = loaded.entities.inventories.party.items[0];

    expect(Boolean(item.magical)).toBe(false);
    expect(Boolean(item.attuned)).toBe(false);
  });
});
