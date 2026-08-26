import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { createCampaignState, type CampaignState } from '../../../state/campaignReducer';
import type { AlchemyReagent, Inventory } from '../../../types/campaign';
import { ReagentsView } from '../views/ReagentsView';

const existingReagent: AlchemyReagent = {
  id: 'lunar-moss-reagent',
  name: 'Lunar Moss',
  quantity: 4,
  aspects: { primary: 'Water', secondary: 'Air', tertiary: 'Light' },
  refinement: 'prepared',
  basePotency: 'P2',
  concentrationSteps: 0,
  roles: ['Active'],
  primaryRole: 'Active',
  hazards: [],
  processingNotes: '',
  identificationLevel: 4,
  analysisHistory: [],
  falseProfile: null
};

function makeInitialState(): CampaignState {
  const state = createCampaignState();
  const partyInventory: Inventory = {
    id: 'custom-party-record',
    ownerType: 'party',
    ownerId: null,
    currency: {},
    items: [],
    tools: [],
    materials: [{ id: 'moss', name: 'LUNAR MOSS', type: 'herb', quantity: 5 }],
    food: [{ id: 'berries', name: 'Sun Berries', types: ['fruit'], quantity: 3 }]
  };
  state.entities.inventories = { [partyInventory.id]: partyInventory };
  state.entities.alchemyReagents = { [existingReagent.id]: existingReagent };
  return state;
}

function StateProbe({ onState }: { onState: (state: CampaignState) => void }) {
  onState(useCampaignStore().state);
  return null;
}

function renderView(onState: (state: CampaignState) => void = () => undefined) {
  render(
    <CampaignStoreProvider initialCampaignState={makeInitialState()}>
      <ReagentsView
        alchemyReagents={[existingReagent]}
        saveAlchemyReagents={vi.fn()}
        onDelete={vi.fn()}
      />
      <StateProbe onState={onState} />
    </CampaignStoreProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: /import from inventory/i }));
}

function selectLunarMoss() {
  fireEvent.click(screen.getByRole('button', { name: /material lunar moss 5 on hand/i }));
}

describe('ReagentsView inventory import picker', () => {
  it('renders party materials and food with their kinds and on-hand quantities', () => {
    renderView();

    expect(screen.getByRole('button', { name: /material lunar moss 5 on hand/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /food sun berries 3 on hand/i })).toBeInTheDocument();
  });

  it('preselects add-to-existing for a case-insensitive name match', () => {
    renderView();
    selectLunarMoss();

    expect(screen.getByLabelText('Target')).toHaveValue('existing');
    expect(screen.getByLabelText('Existing reagent')).toHaveValue(existingReagent.id);
    expect(screen.getByLabelText('Quantity')).toHaveValue(5);
  });

  it('confirms one promotion action and writes the alchemy activity log', () => {
    let latestState = makeInitialState();
    renderView(state => {
      latestState = state;
    });
    selectLunarMoss();
    fireEvent.click(screen.getByRole('button', { name: /confirm import/i }));

    const partyInventory = Object.values(latestState.entities.inventories).find(
      inventory => inventory.ownerType === 'party'
    );
    expect(partyInventory?.materials).toEqual([]);
    expect(latestState.entities.alchemyReagents[existingReagent.id].quantity).toBe(9);
    expect(latestState.logs.entries[0]).toMatchObject({
      type: 'alchemy.reagent_promoted',
      payload: { message: '5 Lunar Moss promoted to lab stock' }
    });
    expect(screen.queryByText('Import from party inventory')).not.toBeInTheDocument();
  });

  it('creates an enriched crude reagent with party-stock provenance', () => {
    let latestState = makeInitialState();
    renderView(state => {
      latestState = state;
    });
    fireEvent.click(screen.getByRole('button', { name: /food sun berries 3 on hand/i }));

    expect(screen.getByLabelText('Target')).toHaveValue('new');
    expect(screen.getByLabelText('Reagent Name')).toHaveValue('Sun Berries');
    expect(screen.getByLabelText('Refinement')).toHaveValue('crude');
    expect(screen.getByRole('checkbox', { name: 'Active' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /confirm import/i }));

    const promoted = Object.values(latestState.entities.alchemyReagents).find(
      candidate => candidate.name === 'Sun Berries'
    );
    expect(promoted).toMatchObject({
      name: 'Sun Berries',
      quantity: 3,
      refinement: 'crude',
      concentrationSteps: 0,
      roles: ['Active'],
      source: 'Promoted from party stock: Sun Berries',
      identificationLevel: 4,
      analysisHistory: [],
      falseProfile: null
    });
  });
});
