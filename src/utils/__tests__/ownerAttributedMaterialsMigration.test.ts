import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState, type CampaignState } from '../../state/campaignReducer';
import { hydrateCampaignState, serializeCampaignState } from '../../persistence/campaignStorage';
import { ensureOwnerAttributedHoldings } from '../../persistence/dataMigration';
import { migrateTo1_5_4 } from '../dataMigrations';

describe('owner-attributed holdings migration', () => {
  it('moves legacy global pools to the party with exact quantities and fields', () => {
    const migrated = migrateTo1_5_4({
      materials: { iron: { id: 'iron', name: 'Iron', type: 'metal', quantity: 7.5, notes: 'pure' } },
      foods: [{ id: 'apple', name: 'Apple', types: ['fruit'], quantity: 3, calories: 90 }],
      inventories: {
        stash: { id: 'stash', ownerType: 'party', ownerId: null, materials: [], food: [] },
      },
    });
    const inventories = migrated.inventories as Record<string, { materials: unknown[]; food: unknown[] }>;
    expect(inventories.stash.materials).toEqual([
      { id: 'iron', name: 'Iron', type: 'metal', quantity: 7.5, notes: 'pure' },
    ]);
    expect(inventories.stash.food).toEqual([
      { id: 'apple', name: 'Apple', types: ['fruit'], quantity: 3, calories: 90 },
    ]);
  });

  it('discards party and character advisory arrays before seeding the party', () => {
    const migrated = migrateTo1_5_4({
      materials: [{ id: 'iron', name: 'Iron', type: 'metal', quantity: 8 }],
      foods: [],
      inventories: {
        party: { id: 'party', ownerType: 'party', materials: [{ id: 'drift-party', quantity: 99 }], food: [] },
        rina: { id: 'rina', ownerType: 'character', ownerId: 'rina', materials: [{ id: 'drift-rina', quantity: 4 }], food: [{ id: 'drift-food', quantity: 2 }] },
      },
    });
    const inventories = migrated.inventories as Record<string, { materials: unknown[]; food: unknown[] }>;
    expect(inventories.party.materials).toEqual([
      { id: 'iron', name: 'Iron', type: 'metal', quantity: 8 },
    ]);
    expect(inventories.rina.materials).toEqual([]);
    expect(inventories.rina.food).toEqual([]);
  });

  it('creates a party inventory for a pre-bus save', () => {
    const migrated = migrateTo1_5_4({
      materials: [{ id: 'wood', name: 'Wood', type: 'wood', quantity: 12 }],
      foods: [],
    });
    const inventories = migrated.inventories as Record<string, { ownerType: string; materials: unknown[] }>;
    expect(inventories.party.ownerType).toBe('party');
    expect(inventories.party.materials).toHaveLength(1);
  });

  it('removes the legacy pool keys', () => {
    const migrated = migrateTo1_5_4({ materials: [], foods: [], inventories: {} });
    expect('materials' in migrated).toBe(false);
    expect('foods' in migrated).toBe(false);
  });

  it('is idempotent after the legacy keys are removed', () => {
    const once = migrateTo1_5_4({
      materials: [{ id: 'wood', name: 'Wood', type: 'wood', quantity: 12 }],
      foods: [],
      inventories: {},
    });
    expect(migrateTo1_5_4(once)).toEqual(once);
  });

  it('migrates nested campaign state and discards character holdings', () => {
    const state = createCampaignState();
    state.entities.inventories.rina = {
      id: 'rina', ownerType: 'character', ownerId: 'rina', currency: {}, items: [], tools: [],
      materials: [{ id: 'old', name: 'Old ref', type: 'wood', quantity: 99 }],
      food: [{ id: 'old-food', name: 'Old food ref', types: ['fruit'], quantity: 99 }],
    };
    const legacy = {
      ...state,
      entities: {
        ...state.entities,
        materials: { iron: { id: 'iron', name: 'Iron', type: 'metal', quantity: 6 } },
        foods: { apple: { id: 'apple', name: 'Apple', types: ['fruit'], quantity: 2 } },
      },
    };
    const migrated = ensureOwnerAttributedHoldings(legacy);
    const party = Object.values(migrated.entities.inventories).find(inventory => inventory.ownerType === 'party');
    expect(party?.materials[0].quantity).toBe(6);
    expect(party?.food[0].quantity).toBe(2);
    expect(migrated.entities.inventories.rina.materials).toEqual([]);
    expect(migrated.entities.inventories.rina.food).toEqual([]);
    expect('materials' in migrated.entities).toBe(false);
  });

  it('round-trips migrated holdings without recreating pools', () => {
    const state = createCampaignState();
    const party = Object.values(state.entities.inventories).find(inventory => inventory.ownerType === 'party');
    if (!party) throw new Error('party inventory missing');
    party.materials = [{ id: 'iron', name: 'Iron', type: 'metal', quantity: 4 }];
    party.food = [{ id: 'apple', name: 'Apple', types: ['fruit'], quantity: 2 }];
    const serialized = JSON.stringify(serializeCampaignState(state));
    const hydrated = hydrateCampaignState(JSON.parse(serialized) as CampaignState);
    const roundTrippedParty = Object.values(hydrated.entities.inventories).find(inventory => inventory.ownerType === 'party');
    expect(roundTrippedParty?.materials).toEqual(party.materials);
    expect(roundTrippedParty?.food).toEqual(party.food);
    expect('materials' in hydrated.entities).toBe(false);
    expect('foods' in hydrated.entities).toBe(false);
  });

  it('migrates legacy pools inside checkpoint snapshots before restore', () => {
    const state = createCampaignState();
    const { checkpoints: _checkpoints, ...snapshot } = state;
    const legacySnapshot = {
      ...snapshot,
      entities: {
        ...snapshot.entities,
        materials: { iron: { id: 'iron', name: 'Iron', type: 'metal', quantity: 11 } },
        foods: { apple: { id: 'apple', name: 'Apple', types: ['fruit'], quantity: 5 } },
      },
    };
    state.checkpoints.entries = [{
      id: 'legacy-checkpoint', label: 'Legacy', createdAt: 1, snapshot: legacySnapshot,
    }];
    const hydrated = ensureOwnerAttributedHoldings(state);
    const restored = campaignReducer(hydrated, { type: 'restoreCheckpoint', payload: 'legacy-checkpoint' });
    const party = Object.values(restored.entities.inventories).find(inventory => inventory.ownerType === 'party');
    expect(party?.materials[0].quantity).toBe(11);
    expect(party?.food[0].quantity).toBe(5);
    expect('materials' in restored.entities).toBe(false);
  });
});
