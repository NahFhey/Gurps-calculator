import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ActionPanelItemsWorkflow from '../action-panel/ActionPanelItemsWorkflow';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import type { CampaignState } from '../../../state/campaignReducer';
import type { CombatState, ConsumptionEntry, Participant } from '../../../types/combatTracker';

const actor: Participant = {
  instanceId: 'actor-1',
  name: 'Alice',
  category: 'player',
  st: 10,
  dx: 10,
  iq: 10,
  ht: 10,
  hp: 10,
  fp: 10,
  mp: 10,
  basicSpeed: 5,
  basicMove: 5,
  partyCharacterId: 'char-1',
};

function makeCombat(consumptions?: ConsumptionEntry[]): CombatState {
  return {
    id: 'combat-1',
    name: 'Bridge Ambush',
    startTime: 1,
    participants: [actor],
    turnOrder: [actor.instanceId],
    currentTurnIndex: 0,
    currentRound: 4,
    turnDecisions: {},
    log: [],
    ...(consumptions ? { consumptions } : {}),
  };
}

function makeEntry(): ConsumptionEntry {
  return {
    id: 'consume-1',
    participantId: actor.instanceId,
    participantName: actor.name,
    characterId: 'char-1',
    itemSnapshot: {
      id: 'potion-1',
      name: 'Healing Potion',
      quantity: 1,
      magical: true,
      source: 'loot',
    },
    quantity: 1,
    round: 3,
  };
}

function makeState(options: { items?: boolean; consumptions?: ConsumptionEntry[] } = {}): CampaignState {
  const state = createCampaignState();
  state.entities.inventories = {
    'inv-char-1': {
      id: 'inv-char-1',
      ownerType: 'character',
      ownerId: 'char-1',
      currency: {},
      items: options.items === false
        ? []
        : [{ id: 'potion-1', name: 'Healing Potion', quantity: 2, magical: true, source: 'loot' }],
      tools: [],
      materials: [],
      food: [],
    },
  };
  state.combat.activeSession = makeCombat(options.consumptions) as unknown as CampaignState['combat']['activeSession'];
  return state;
}

function renderWorkflow(
  initialState: CampaignState,
  participant: Participant = actor,
): { getState: () => CampaignState } {
  let latestState = initialState;

  function StateObserver() {
    latestState = useCampaignStore().state;
    return null;
  }

  render(
    <CampaignStoreProvider initialCampaignState={initialState}>
      <ActionPanelItemsWorkflow
        currentActor={participant}
        currentRound={4}
        currentTurn={0}
        onClose={() => undefined}
      />
      <StateObserver />
    </CampaignStoreProvider>,
  );

  return { getState: () => latestState };
}

describe('ActionPanelItemsWorkflow', () => {
  it('shows a party participant inventory with item quantities', () => {
    renderWorkflow(makeState());
    expect(screen.getByText('Healing Potion')).toBeInTheDocument();
    expect(screen.getByText('x2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use Healing Potion' })).toBeInTheDocument();
  });

  it('uses one item with the acting participant combat payload', () => {
    const { getState } = renderWorkflow(makeState());
    fireEvent.click(screen.getByRole('button', { name: 'Use Healing Potion' }));

    expect(getState().entities.inventories['inv-char-1'].items[0].quantity).toBe(1);
    const combat = getState().combat.activeSession as unknown as CombatState;
    expect(combat.consumptions?.[0]).toMatchObject({
      participantId: 'actor-1',
      participantName: 'Alice',
      characterId: 'char-1',
      quantity: 1,
      round: 4,
    });
  });

  it('shows the explanatory state for a non-party participant', () => {
    renderWorkflow(makeState(), { ...actor, partyCharacterId: undefined, category: 'enemy' });
    expect(screen.getByText("No linked inventory — library combatants don't carry items.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use Healing Potion' })).not.toBeInTheDocument();
  });

  it('shows the quiet empty row when the linked inventory has no items', () => {
    renderWorkflow(makeState({ items: false }));
    expect(screen.getByText('No items.')).toBeInTheDocument();
  });

  it('renders encounter consumptions with item, participant, quantity, and round', () => {
    renderWorkflow(makeState({ consumptions: [makeEntry()] }));
    expect(screen.getByText('Used this encounter')).toBeInTheDocument();
    expect(screen.getByText('Healing Potion x1 · Alice · Round 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo use of Healing Potion' })).toBeInTheDocument();
  });

  it('undoes a use, restores the record, and removes the entry', () => {
    const state = makeState({ items: false, consumptions: [makeEntry()] });
    const { getState } = renderWorkflow(state);
    fireEvent.click(screen.getByRole('button', { name: 'Undo use of Healing Potion' }));

    expect(getState().entities.inventories['inv-char-1'].items[0]).toMatchObject({
      id: 'potion-1',
      name: 'Healing Potion',
      quantity: 1,
      magical: true,
      source: 'loot',
    });
    expect((getState().combat.activeSession as unknown as CombatState).consumptions).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Undo use of Healing Potion' })).not.toBeInTheDocument();
  });

  it('writes both combat and activity changelog entries when an item is used', () => {
    const { getState } = renderWorkflow(makeState());
    fireEvent.click(screen.getByRole('button', { name: 'Use Healing Potion' }));

    const combat = getState().combat.activeSession as unknown as CombatState;
    expect(combat.log[combat.log.length - 1]).toMatchObject({
      entryType: 'item',
      text: 'Alice uses Healing Potion',
      round: 4,
      turn: 0,
    });
    const activityEntries = getState().logs.entries;
    expect(activityEntries[activityEntries.length - 1]).toMatchObject({
      type: 'inventory.item_consumed',
      payload: expect.objectContaining({ message: 'Alice used "Healing Potion"' }),
    });
  });

  it('writes an activity changelog entry when a use is reversed', () => {
    const { getState } = renderWorkflow(makeState({ items: false, consumptions: [makeEntry()] }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo use of Healing Potion' }));
    const activityEntries = getState().logs.entries;
    expect(activityEntries[activityEntries.length - 1]).toMatchObject({
      type: 'inventory.item_consumption_reverted',
      payload: expect.objectContaining({ message: 'Restored "Healing Potion" to Alice' }),
    });
  });
});
