import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import type { CampaignState } from '../../campaignReducer';
import type { Character, Inventory } from '../../../types/campaign';
import type { Equipment } from '../../../types/characterSheet';
import { createDefaultGCSData } from '../../../types/characterSheet';
import { calculateCharacterEncumbrance } from '../../../utils/encumbrance';
import {
  ITEM_ACQUIRED,
  ITEM_DEMOTED,
  ITEM_PROMOTED,
  type InventoryAction,
} from '../inventoryActions';
import { handleInventoryAction } from '../inventoryReducer';

function inventory(id: string, overrides: Partial<Inventory> = {}): Inventory {
  return {
    id,
    ownerType: 'party',
    ownerId: null,
    currency: {},
    items: [],
    tools: [],
    materials: [],
    food: [],
    ...overrides,
  };
}

function character(id: string, withGcsData = true): Character {
  return {
    id,
    name: id,
    work: { skills: {} },
    ...(withGcsData ? { gcsData: createDefaultGCSData() } : {}),
  };
}

function createState(): CampaignState {
  return {
    entities: {
      characters: {
        'char-1': character('char-1'),
        'char-2': character('char-2', false),
      },
      inventories: { party: inventory('party') },
    },
  } as unknown as CampaignState;
}

function apply(state: CampaignState, action: InventoryAction): CampaignState {
  return produce(state, draft => {
    handleInventoryAction(draft, action);
  });
}

function equipment(overrides: Partial<Omit<Equipment, 'id' | 'sourceItem'>> = {}) {
  return {
    name: 'Longsword',
    quantity: 1,
    weight: 4,
    cost: 700,
    category: 'weapon' as const,
    equipped: true,
    ...overrides,
  };
}

describe('inventory equipment bridge', () => {
  it('promotes a whole stack, creates missing gcsData, and preserves existing sheet data', () => {
    const state = createState();
    state.entities.characters['char-1'].gcsData!.notes = 'keep me';
    state.entities.inventories.party.items = [{
      id: 'sword-1',
      name: 'Crafted sword',
      quantity: 2,
      crafterId: 'smith',
      magical: true,
      attuned: true,
      source: 'crafting',
    }];

    const preserved = apply(state, {
      type: ITEM_PROMOTED,
      payload: {
        itemId: 'sword-1',
        characterId: 'char-1',
        equipment: equipment({ name: 'Crafted sword', quantity: 2 }),
      },
    });
    expect(preserved.entities.inventories.party.items).toEqual([]);
    expect(preserved.entities.characters['char-1'].gcsData?.notes).toBe('keep me');
    expect(preserved.entities.characters['char-1'].gcsData?.equipment[0]).toMatchObject({
      name: 'Crafted sword',
      quantity: 2,
      weight: 4,
      cost: 700,
      sourceItem: {
        id: 'sword-1',
        crafterId: 'smith',
        magical: true,
        attuned: true,
        source: 'crafting',
      },
    });

    state.entities.inventories.party.items = [{ id: 'rope-1', name: 'Rope', quantity: 1 }];
    const created = apply(state, {
      type: ITEM_PROMOTED,
      payload: {
        itemId: 'rope-1',
        characterId: 'char-2',
        equipment: equipment({ name: 'Rope', weight: 1, cost: 5 }),
      },
    });
    expect(created.entities.characters['char-2'].gcsData).toBeDefined();
    expect(created.entities.characters['char-2'].gcsData?.equipment).toHaveLength(1);
  });

  it('partially promotes and leaves the source id and remainder intact', () => {
    const state = createState();
    state.entities.inventories.party.items = [{ id: 'arrow-1', name: 'Arrow', quantity: 10 }];
    const next = apply(state, {
      type: ITEM_PROMOTED,
      payload: {
        itemId: 'arrow-1',
        characterId: 'char-1',
        equipment: equipment({ name: 'Arrow', quantity: 3, category: 'ammo' }),
      },
    });
    expect(next.entities.inventories.party.items).toEqual([
      { id: 'arrow-1', name: 'Arrow', quantity: 7 },
    ]);
    expect(next.entities.characters['char-1'].gcsData?.equipment[0]).toMatchObject({
      quantity: 3,
      sourceItem: { id: 'arrow-1' },
    });
  });

  it('round trips sheet stats, native value/notes, and provenance through inventory cargo', () => {
    const state = createState();
    state.entities.inventories.party.items = [{
      id: 'mail-1',
      name: 'Mail shirt',
      quantity: 1,
      crafterId: 'smith',
      magical: true,
      attuned: false,
      source: 'crafting',
      value: 900,
      notes: 'inventory note',
    }];
    const promoted = apply(state, {
      type: ITEM_PROMOTED,
      payload: {
        itemId: 'mail-1',
        characterId: 'char-1',
        equipment: equipment({
          name: 'Mail shirt',
          weight: 16,
          cost: 850,
          category: 'armor',
          dr: 4,
          drLocations: ['torso', 'groin'],
          notes: 'fitted',
        }),
      },
    });
    const equipmentId = promoted.entities.characters['char-1'].gcsData!.equipment[0].id;
    const demoted = apply(promoted, {
      type: ITEM_DEMOTED,
      payload: { characterId: 'char-1', equipmentId },
    });
    const restored = demoted.entities.inventories['inv-char-1'].items[0];
    expect(restored).toMatchObject({
      id: 'mail-1',
      name: 'Mail shirt',
      quantity: 1,
      value: 850,
      notes: 'fitted',
      crafterId: 'smith',
      magical: true,
      attuned: false,
      source: 'crafting',
      equipmentData: {
        weight: 16,
        cost: 850,
        category: 'armor',
        dr: 4,
        drLocations: ['torso', 'groin'],
        notes: 'fitted',
      },
    });
  });

  it('re-stacks a demotion onto a surviving remainder in the character inventory', () => {
    const state = createState();
    state.entities.inventories.personal = inventory('personal', {
      ownerType: 'character',
      ownerId: 'char-1',
      items: [{ id: 'bolt-1', name: 'Bolt', quantity: 8 }],
    });
    const promoted = apply(state, {
      type: ITEM_PROMOTED,
      payload: {
        itemId: 'bolt-1',
        characterId: 'char-1',
        equipment: equipment({ name: 'Bolt', quantity: 3, category: 'ammo' }),
      },
    });
    const equipmentId = promoted.entities.characters['char-1'].gcsData!.equipment[0].id;
    const demoted = apply(promoted, {
      type: ITEM_DEMOTED,
      payload: { characterId: 'char-1', equipmentId },
    });
    expect(demoted.entities.inventories.personal.items).toHaveLength(1);
    expect(demoted.entities.inventories.personal.items[0]).toMatchObject({
      id: 'bolt-1',
      quantity: 8,
      equipmentData: { weight: 4, cost: 700, category: 'ammo' },
    });
  });

  it('mints a new id when the source id remains in the party stash', () => {
    const state = createState();
    state.entities.inventories.party.items = [{ id: 'arrow-1', name: 'Arrow', quantity: 10 }];
    const promoted = apply(state, {
      type: ITEM_PROMOTED,
      payload: {
        itemId: 'arrow-1',
        characterId: 'char-1',
        equipment: equipment({ name: 'Arrow', quantity: 4, category: 'ammo' }),
      },
    });
    const equipmentId = promoted.entities.characters['char-1'].gcsData!.equipment[0].id;
    const demoted = apply(promoted, {
      type: ITEM_DEMOTED,
      payload: { characterId: 'char-1', equipmentId },
    });
    expect(demoted.entities.inventories.party.items).toEqual([
      { id: 'arrow-1', name: 'Arrow', quantity: 6 },
    ]);
    expect(demoted.entities.inventories['inv-char-1'].items[0].id).not.toBe('arrow-1');
    const ids = Object.values(demoted.entities.inventories).flatMap(inv => inv.items.map(item => item.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('demotes a grandfathered sheet row with a fresh id', () => {
    const state = createState();
    state.entities.characters['char-1'].gcsData!.equipment = [{
      id: 'legacy-equipment',
      ...equipment({ name: 'Old cloak', weight: 2, cost: 20 }),
    }];
    const next = apply(state, {
      type: ITEM_DEMOTED,
      payload: { characterId: 'char-1', equipmentId: 'legacy-equipment' },
    });
    expect(next.entities.characters['char-1'].gcsData?.equipment).toEqual([]);
    expect(next.entities.inventories['inv-char-1'].items[0]).toMatchObject({
      name: 'Old cloak',
      quantity: 1,
      value: 20,
    });
    expect(next.entities.inventories['inv-char-1'].items[0].id).not.toBe('legacy-equipment');
  });

  it('silently no-ops for unknown promotion and demotion ids', () => {
    const state = createState();
    state.entities.inventories.party.items = [{ id: 'rope-1', name: 'Rope', quantity: 1 }];
    const unknownItem = apply(state, {
      type: ITEM_PROMOTED,
      payload: { itemId: 'missing', characterId: 'char-1', equipment: equipment() },
    });
    const unknownCharacter = apply(state, {
      type: ITEM_PROMOTED,
      payload: { itemId: 'rope-1', characterId: 'missing', equipment: equipment() },
    });
    const unknownEquipment = apply(state, {
      type: ITEM_DEMOTED,
      payload: { characterId: 'char-1', equipmentId: 'missing' },
    });
    expect(unknownItem).toEqual(state);
    expect(unknownCharacter).toEqual(state);
    expect(unknownEquipment).toEqual(state);
  });

  it('carries cargo through acquisition and adopts it only when an id-stack lacks cargo', () => {
    const state = createState();
    const first = apply(state, {
      type: ITEM_ACQUIRED,
      payload: {
        item: {
          kind: 'equipment',
          id: 'sword-1',
          name: 'Sword',
          quantity: 1,
          equipmentData: { weight: 3, cost: 10, category: 'weapon', damage: '1d cut' },
        },
        owner: 'party',
        source: 'loot',
      },
    });
    expect(first.entities.inventories.party.items[0].equipmentData).toEqual({
      weight: 3,
      cost: 10,
      category: 'weapon',
      damage: '1d cut',
    });

    const preserved = apply(first, {
      type: ITEM_ACQUIRED,
      payload: {
        item: {
          kind: 'equipment',
          id: 'sword-1',
          name: 'Sword',
          quantity: 1,
          equipmentData: { weight: 9, cost: 90, category: 'general' },
        },
        owner: 'party',
        source: 'loot',
      },
    });
    expect(preserved.entities.inventories.party.items[0]).toMatchObject({
      quantity: 2,
      equipmentData: { weight: 3, cost: 10, category: 'weapon' },
    });

    const bareState = createState();
    bareState.entities.inventories.party.items = [{ id: 'sword-1', name: 'Sword', quantity: 1 }];
    const adopted = apply(bareState, {
      type: ITEM_ACQUIRED,
      payload: {
        item: {
          kind: 'equipment',
          id: 'sword-1',
          name: 'Sword',
          quantity: 1,
          equipmentData: { weight: 3, cost: 10, category: 'weapon' },
        },
        owner: 'party',
        source: 'loot',
      },
    });
    expect(adopted.entities.inventories.party.items[0].equipmentData).toEqual({
      weight: 3,
      cost: 10,
      category: 'weapon',
    });
  });

  it('makes promoted equipped weight visible to encumbrance calculations', () => {
    const state = createState();
    state.entities.inventories.party.items = [{ id: 'anvil-1', name: 'Anvil', quantity: 1 }];
    const promoted = apply(state, {
      type: ITEM_PROMOTED,
      payload: {
        itemId: 'anvil-1',
        characterId: 'char-1',
        equipment: equipment({ name: 'Anvil', weight: 25, cost: 100 }),
      },
    });
    const gcsData = promoted.entities.characters['char-1'].gcsData!;
    const encumbrance = calculateCharacterEncumbrance(
      gcsData.attributes,
      gcsData.secondaryAttributes,
      gcsData.equipment
    );
    expect(encumbrance.carriedWeight).toBe(25);
    expect(encumbrance.level).toBe(1);
  });
});
