import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState } from '../../campaignReducer';
import { handleInventoryAction } from '../inventoryReducer';
import {
  isInventoryAction,
  REAGENT_PROMOTED,
  type ReagentPromotedAction
} from '../inventoryActions';
import type { AlchemyReagent, Inventory } from '../../../types/campaign';
import { produce } from 'immer';

const reagent: AlchemyReagent = {
  id: 'reagent-moss',
  name: 'Lunar Moss',
  quantity: 4,
  aspects: { primary: 'Water', secondary: 'Air', tertiary: 'Light' },
  refinement: 'prepared',
  basePotency: 'P2',
  concentrationSteps: 1,
  roles: ['Catalyst'],
  primaryRole: 'Catalyst',
  hazards: ['Volatile'],
  processingNotes: 'Keep chilled',
  identificationLevel: 2,
  analysisHistory: [{ result: 'partial' }],
  falseProfile: {
    aspects: { primary: 'Fire', secondary: 'Earth', tertiary: 'Dark' },
    basePotency: 'P4'
  },
  identityId: 'identity-moss'
};

function partyInventory(): Inventory {
  return {
    id: 'party-stock',
    ownerType: 'party',
    ownerId: null,
    currency: {},
    items: [],
    tools: [],
    materials: [
      { id: 'moss-material', name: 'Lunar Moss', type: 'herb', quantity: 5 }
    ],
    food: [
      { id: 'berries-food', name: 'Sun Berries', types: ['fruit', 'herb'], quantity: 3 }
    ]
  };
}

function makeState() {
  const state = createCampaignState();
  state.entities.inventories = { 'party-stock': partyInventory() };
  state.entities.alchemyReagents = { [reagent.id]: structuredClone(reagent) };
  return state;
}

function promote(
  state: ReturnType<typeof makeState>,
  payload: ReagentPromotedAction['payload']
) {
  return produce(state, draft => {
    handleInventoryAction(draft, { type: REAGENT_PROMOTED, payload });
  });
}

describe('reagent promotion reducer', () => {
  it('partially decrements a material and increments an existing reagent', () => {
    const next = promote(makeState(), {
      source: { kind: 'material', name: 'Lunar Moss', type: 'herb', quantity: 2 },
      target: { mode: 'existing', reagentId: reagent.id }
    });

    expect(next.entities.inventories['party-stock'].materials[0].quantity).toBe(3);
    expect(next.entities.alchemyReagents[reagent.id].quantity).toBe(6);
  });

  it('removes a material source after promoting the full stack', () => {
    const next = promote(makeState(), {
      source: { kind: 'material', name: 'Lunar Moss', type: 'herb', quantity: 5 },
      target: { mode: 'existing', reagentId: reagent.id }
    });

    expect(next.entities.inventories['party-stock'].materials).toEqual([]);
    expect(next.entities.alchemyReagents[reagent.id].quantity).toBe(9);
  });

  it('clamps promotion to the quantity actually on hand', () => {
    const next = promote(makeState(), {
      source: { kind: 'material', name: 'Lunar Moss', type: 'herb', quantity: 20 },
      target: { mode: 'existing', reagentId: reagent.id }
    });

    expect(next.entities.inventories['party-stock'].materials).toEqual([]);
    expect(next.entities.alchemyReagents[reagent.id].quantity).toBe(9);
  });

  it('does nothing when the source entry is missing', () => {
    const state = makeState();
    const next = promote(state, {
      source: { kind: 'material', name: 'Missing Herb', quantity: 2 },
      target: { mode: 'existing', reagentId: reagent.id }
    });

    expect(next).toBe(state);
    expect(next.entities.alchemyReagents[reagent.id]).toEqual(reagent);
  });

  it('does nothing when an existing target id is unknown', () => {
    const state = makeState();
    const next = promote(state, {
      source: { kind: 'material', name: 'Lunar Moss', type: 'herb', quantity: 2 },
      target: { mode: 'existing', reagentId: 'missing-reagent' }
    });

    expect(next).toBe(state);
    expect(next.entities.inventories['party-stock'].materials[0].quantity).toBe(5);
  });

  it('leaves every non-quantity target field untouched in existing mode', () => {
    const next = promote(makeState(), {
      source: { kind: 'material', name: 'Lunar Moss', type: 'herb', quantity: 1 },
      target: { mode: 'existing', reagentId: reagent.id }
    });

    expect(next.entities.alchemyReagents[reagent.id]).toEqual({ ...reagent, quantity: 5 });
  });

  it('inserts a new reagent verbatim', () => {
    const newReagent: AlchemyReagent = {
      id: 'new-moss',
      name: 'Crude Lunar Moss',
      quantity: 2,
      aspects: { primary: 'Water', secondary: 'Air', tertiary: 'Fire' },
      refinement: 'crude',
      basePotency: 'P1',
      concentrationSteps: 0,
      roles: ['Active'],
      primaryRole: 'Active',
      hazards: [],
      processingNotes: '',
      source: 'Promoted from party stock: Lunar Moss',
      identificationLevel: 4,
      analysisHistory: [],
      falseProfile: null
    };
    const next = promote(makeState(), {
      source: { kind: 'material', name: 'Lunar Moss', type: 'herb', quantity: 2 },
      target: { mode: 'new', reagent: newReagent }
    });

    expect(next.entities.alchemyReagents[newReagent.id]).toEqual(newReagent);
    expect(next.entities.inventories['party-stock'].materials[0].quantity).toBe(3);
  });

  it('promotes a food source with the same clamping and removal semantics', () => {
    const next = promote(makeState(), {
      source: { kind: 'food', name: 'Sun Berries', type: 'fruit,herb', quantity: 8 },
      target: { mode: 'existing', reagentId: reagent.id }
    });

    expect(next.entities.inventories['party-stock'].food).toEqual([]);
    expect(next.entities.alchemyReagents[reagent.id].quantity).toBe(7);
  });

  it('routes through isInventoryAction and the campaign reducer', () => {
    const action: ReagentPromotedAction = {
      type: REAGENT_PROMOTED,
      payload: {
        source: { kind: 'material', name: 'Lunar Moss', type: 'herb', quantity: 3 },
        target: { mode: 'existing', reagentId: reagent.id }
      }
    };

    expect(isInventoryAction(action)).toBe(true);
    const next = campaignReducer(makeState(), action);
    expect(next.entities.inventories['party-stock'].materials[0].quantity).toBe(2);
    expect(next.entities.alchemyReagents[reagent.id].quantity).toBe(7);
  });
});
