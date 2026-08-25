import { beforeEach, describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState } from '../../campaignReducer';
import {
  ITEM_CONSUMED,
  ITEM_CONSUMPTION_REVERTED,
  isInventoryAction,
} from '../inventoryActions';
import type { CampaignState } from '../../campaignReducer';
import type { Inventory, ItemInstance } from '../../../types/campaign';
import type { CombatState, ConsumptionEntry } from '../../../types/combatTracker';

const baseItem: ItemInstance = {
  id: 'potion-1',
  name: 'Greater Healing Potion',
  quantity: 3,
  magical: true,
  value: 1200,
  notes: 'Ruby glass vial',
  source: 'loot',
};

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    id: 'combat-1',
    name: 'Bridge Ambush',
    startTime: 1,
    participants: [],
    turnOrder: [],
    currentTurnIndex: 0,
    currentRound: 4,
    turnDecisions: {},
    log: [],
    ...overrides,
  };
}

function makeInventory(item: ItemInstance = baseItem): Inventory {
  return {
    id: 'inv-char-1',
    ownerType: 'character',
    ownerId: 'char-1',
    currency: {},
    items: [{ ...item }],
    tools: [],
    materials: [],
    food: [],
  };
}

function makeEntry(overrides: Partial<ConsumptionEntry> = {}): ConsumptionEntry {
  return {
    id: 'consume-1',
    participantId: 'actor-1',
    participantName: 'Alice',
    characterId: 'char-1',
    itemSnapshot: { ...baseItem },
    quantity: 1,
    round: 4,
    ...overrides,
  };
}

function setActiveCombat(state: CampaignState, combat: CombatState | null): void {
  state.combat.activeSession = combat as unknown as CampaignState['combat']['activeSession'];
}

function consume(state: CampaignState, quantity?: number, withCombat = true): CampaignState {
  return campaignReducer(state, {
    type: ITEM_CONSUMED,
    payload: {
      itemId: baseItem.id,
      ...(quantity === undefined ? {} : { quantity }),
      ...(withCombat
        ? { combat: { participantId: 'actor-1', participantName: 'Alice', round: 4 } }
        : {}),
    },
  });
}

describe('combat item consumption reducer', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createCampaignState();
    state.entities.inventories = { 'inv-char-1': makeInventory() };
    setActiveCombat(state, makeCombat());
  });

  it('decrements by an explicit quantity', () => {
    const next = consume(state, 2);
    expect(next.entities.inventories['inv-char-1'].items[0].quantity).toBe(1);
  });

  it('defaults the consumed quantity to one', () => {
    const next = consume(state);
    expect(next.entities.inventories['inv-char-1'].items[0].quantity).toBe(2);
    expect((next.combat.activeSession as unknown as CombatState).consumptions?.[0].quantity).toBe(1);
  });

  it('clamps over-consumption and records only the quantity actually removed', () => {
    const next = consume(state, 10);
    expect(next.entities.inventories['inv-char-1'].items).toHaveLength(0);
    expect((next.combat.activeSession as unknown as CombatState).consumptions?.[0].quantity).toBe(3);
  });

  it('deletes the item record when quantity reaches zero exactly', () => {
    const next = consume(state, 3);
    expect(next.entities.inventories['inv-char-1'].items).toEqual([]);
  });

  it('silently ignores a missing item', () => {
    const next = campaignReducer(state, {
      type: ITEM_CONSUMED,
      payload: {
        itemId: 'missing',
        combat: { participantId: 'actor-1', participantName: 'Alice', round: 4 },
      },
    });
    expect(next).toEqual(state);
  });

  it('captures the full snapshot before decrementing', () => {
    const next = consume(state);
    const entry = (next.combat.activeSession as unknown as CombatState).consumptions?.[0];
    expect(entry?.itemSnapshot).toEqual(baseItem);
    expect(entry?.itemSnapshot.quantity).toBe(3);
  });

  it('does not append an encounter entry without combat context', () => {
    const next = consume(state, 1, false);
    expect(next.entities.inventories['inv-char-1'].items[0].quantity).toBe(2);
    expect((next.combat.activeSession as unknown as CombatState).consumptions).toBeUndefined();
  });

  it('does not append an encounter entry when no combat session is active', () => {
    setActiveCombat(state, null);
    const next = consume(state);
    expect(next.entities.inventories['inv-char-1'].items[0].quantity).toBe(2);
    expect(next.combat.activeSession).toBeNull();
  });

  it('appends participant, character, and round context to the active encounter', () => {
    const next = consume(state);
    expect((next.combat.activeSession as unknown as CombatState).consumptions?.[0]).toMatchObject({
      participantId: 'actor-1',
      participantName: 'Alice',
      characterId: 'char-1',
      quantity: 1,
      round: 4,
    });
  });

  it('consumes an attuned item without preserving a separate attunement record', () => {
    state.entities.inventories['inv-char-1'] = makeInventory({
      ...baseItem,
      quantity: 1,
      attuned: true,
    });
    const next = consume(state);
    expect(next.entities.inventories['inv-char-1'].items).toEqual([]);
    expect((next.combat.activeSession as unknown as CombatState).consumptions?.[0].itemSnapshot.attuned).toBe(true);
  });

  it('creates distinct entries for repeated stack consumption', () => {
    const once = consume(state);
    const twice = consume(once);
    const entries = (twice.combat.activeSession as unknown as CombatState).consumptions ?? [];
    expect(entries).toHaveLength(2);
    expect(entries[0].id).not.toBe(entries[1].id);
    expect(twice.entities.inventories['inv-char-1'].items[0].quantity).toBe(1);
  });
});

describe('combat item consumption reversal reducer', () => {
  let state: CampaignState;

  beforeEach(() => {
    state = createCampaignState();
  });

  it('increments a surviving item record and removes the entry', () => {
    state.entities.inventories = {
      'inv-char-1': makeInventory({ ...baseItem, quantity: 2 }),
    };
    setActiveCombat(state, makeCombat({ consumptions: [makeEntry()] }));
    const next = campaignReducer(state, {
      type: ITEM_CONSUMPTION_REVERTED,
      payload: { entryId: 'consume-1' },
    });
    expect(next.entities.inventories['inv-char-1'].items[0].quantity).toBe(3);
    expect((next.combat.activeSession as unknown as CombatState).consumptions).toEqual([]);
  });

  it('recreates a deleted record with snapshot fields and original source', () => {
    state.entities.inventories = { 'inv-char-1': makeInventory() };
    state.entities.inventories['inv-char-1'].items = [];
    setActiveCombat(state, makeCombat({ consumptions: [makeEntry({ quantity: 3 })] }));
    const next = campaignReducer(state, {
      type: ITEM_CONSUMPTION_REVERTED,
      payload: { entryId: 'consume-1' },
    });
    expect(next.entities.inventories['inv-char-1'].items[0]).toMatchObject({
      id: 'potion-1',
      name: 'Greater Healing Potion',
      quantity: 3,
      magical: true,
      value: 1200,
      notes: 'Ruby glass vial',
      source: 'loot',
    });
  });

  it('removes only the matching entry', () => {
    state.entities.inventories = { 'inv-char-1': makeInventory({ ...baseItem, quantity: 1 }) };
    setActiveCombat(state, makeCombat({
      consumptions: [makeEntry(), makeEntry({ id: 'consume-2', round: 5 })],
    }));
    const next = campaignReducer(state, {
      type: ITEM_CONSUMPTION_REVERTED,
      payload: { entryId: 'consume-1' },
    });
    expect((next.combat.activeSession as unknown as CombatState).consumptions).toEqual([
      expect.objectContaining({ id: 'consume-2' }),
    ]);
  });

  it('silently ignores a missing entry', () => {
    state.entities.inventories = { 'inv-char-1': makeInventory() };
    setActiveCombat(state, makeCombat({ consumptions: [makeEntry()] }));
    const next = campaignReducer(state, {
      type: ITEM_CONSUMPTION_REVERTED,
      payload: { entryId: 'missing' },
    });
    expect(next).toEqual(state);
  });

  it('restores a consumed attuned item as un-attuned', () => {
    const attunedSnapshot = { ...baseItem, quantity: 1, attuned: true };
    state.entities.inventories = { 'inv-char-1': makeInventory() };
    state.entities.inventories['inv-char-1'].items = [];
    setActiveCombat(state, makeCombat({
      consumptions: [makeEntry({ itemSnapshot: attunedSnapshot })],
    }));
    const next = campaignReducer(state, {
      type: ITEM_CONSUMPTION_REVERTED,
      payload: { entryId: 'consume-1' },
    });
    expect(next.entities.inventories['inv-char-1'].items[0].attuned).toBeUndefined();
    expect(next.entities.inventories['inv-char-1'].items[0].magical).toBe(true);
  });

  it('auto-creates the character inventory if it disappeared before reversal', () => {
    state.entities.inventories = {};
    setActiveCombat(state, makeCombat({ consumptions: [makeEntry()] }));
    const next = campaignReducer(state, {
      type: ITEM_CONSUMPTION_REVERTED,
      payload: { entryId: 'consume-1' },
    });
    expect(next.entities.inventories['inv-char-1'].items[0].id).toBe(baseItem.id);
  });

  it('round-trips consume-to-zero into an equivalent un-attuned record', () => {
    const original = { ...baseItem, quantity: 1 };
    state.entities.inventories = { 'inv-char-1': makeInventory(original) };
    setActiveCombat(state, makeCombat());
    const consumed = consume(state);
    const entryId = (consumed.combat.activeSession as unknown as CombatState).consumptions?.[0].id;
    if (!entryId) throw new Error('expected a consumption entry');
    const reverted = campaignReducer(consumed, {
      type: ITEM_CONSUMPTION_REVERTED,
      payload: { entryId },
    });
    expect(reverted.entities.inventories['inv-char-1'].items[0]).toEqual(original);
  });

  it('preserves crafter attribution through a consume-to-zero reversal', () => {
    const craftedItem = {
      ...baseItem,
      quantity: 1,
      source: 'crafting',
      crafterId: 'char-smith',
    };
    state.entities.inventories = { 'inv-char-1': makeInventory(craftedItem) };
    setActiveCombat(state, makeCombat());
    const consumed = consume(state);
    const entryId = (consumed.combat.activeSession as unknown as CombatState).consumptions?.[0].id;
    if (!entryId) throw new Error('expected a consumption entry');
    const reverted = campaignReducer(consumed, {
      type: ITEM_CONSUMPTION_REVERTED,
      payload: { entryId },
    });
    expect(reverted.entities.inventories['inv-char-1'].items[0].crafterId).toBe('char-smith');
  });

  it('registers both consumption actions with the inventory action guard', () => {
    expect(isInventoryAction({ type: ITEM_CONSUMED })).toBe(true);
    expect(isInventoryAction({ type: ITEM_CONSUMPTION_REVERTED })).toBe(true);
  });
});
