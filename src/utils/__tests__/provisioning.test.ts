import { describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import { estimateProvisionDays } from '../provisioning';

describe('estimateProvisionDays', () => {
  it('counts party food quantities as one ingredient unit each', () => {
    const state = createCampaignState();
    const inventory = Object.values(state.entities.inventories).find((candidate) => candidate.ownerType === 'party')!;
    inventory.food = [
      { id: 'bread', name: 'Bread', types: ['grain'], quantity: 5 },
      { id: 'meat', name: 'Meat', types: ['meat'], quantity: 4 },
    ];
    expect(estimateProvisionDays(state, ['a', 'b', 'c'])).toMatchObject({ foodUnits: 9, days: 3 });
  });

  it('floors incomplete group meals', () => {
    const state = createCampaignState();
    const inventory = Object.values(state.entities.inventories).find((candidate) => candidate.ownerType === 'party')!;
    inventory.food = [{ id: 'food', name: 'Food', types: ['grain'], quantity: 5 }];
    expect(estimateProvisionDays(state, ['a', 'b']).days).toBe(2);
  });

  it('uses one as the divisor for an empty member list', () => {
    const state = createCampaignState();
    const inventory = Object.values(state.entities.inventories).find((candidate) => candidate.ownerType === 'party')!;
    inventory.food = [{ id: 'food', name: 'Food', types: ['grain'], quantity: 3 }];
    expect(estimateProvisionDays(state, []).days).toBe(3);
  });

  it('selects the traveling member with the highest cooking skill', () => {
    const state = createCampaignState();
    state.entities.characters = {
      a: { id: 'a', name: 'Ada', work: { skills: { cooking: 11 } } },
      b: { id: 'b', name: 'Borin', work: { skills: { cooking: 15 } } },
      c: { id: 'c', name: 'Cira', work: { skills: { cooking: 18 } } },
    };
    expect(estimateProvisionDays(state, ['a', 'b']).bestCookName).toBe('Borin');
  });

  it('returns no cook when no traveler has Cooking', () => {
    const state = createCampaignState();
    state.entities.characters = { a: { id: 'a', name: 'Ada', work: { skills: {} } } };
    expect(estimateProvisionDays(state, ['a']).bestCookName).toBeNull();
  });
});
