import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ManagerTab } from '../../ManagerTab';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { createCampaignState, type CampaignState } from '../../../state/campaignReducer';
import type { Inventory } from '../../../types/campaign';
import { ToastProvider } from '../../ui';

function makeState(sourceNames: string[]): CampaignState {
  const state = createCampaignState();
  const partyInventory: Inventory = {
    id: 'party-chain-test',
    ownerType: 'party',
    ownerId: null,
    currency: {},
    items: [],
    tools: [],
    materials: [
      { id: 'ore', name: 'Iron Ore', type: 'metal', quantity: 6 },
      { id: 'moss', name: 'Lunar Moss', type: 'herb', quantity: 3 },
    ],
    food: [],
  };
  state.entities.inventories = { [partyInventory.id]: partyInventory };
  state.ui.pendingIntent = { kind: 'promote', sourceNames };
  return state;
}

function StateProbe({ capture }: { capture: (state: CampaignState) => void }) {
  capture(useCampaignStore().state);
  return null;
}

function renderManager(sourceNames: string[], capture: (state: CampaignState) => void) {
  const initialState = makeState(sourceNames);
  render(
    <ToastProvider>
      <CampaignStoreProvider initialCampaignState={initialState}>
        <ManagerTab />
        <StateProbe capture={capture} />
      </CampaignStoreProvider>
    </ToastProvider>,
  );
}

describe('ManagerTab promotion chaining', () => {
  it('opens LocationManager from the Locations navigation item', () => {
    renderManager([], () => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Locations' }));
    expect(screen.getByRole('heading', { name: 'Locations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Location/ })).toBeInTheDocument();
  });

  it('opens Reagents and preselects the first matching source name', () => {
    let latest = makeState([]);
    renderManager(['Missing Stock', 'Lunar Moss', 'Iron Ore'], state => {
      latest = state;
    });

    expect(screen.getByRole('heading', { name: 'Reagent Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Import from party inventory' })).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity')).toHaveValue(3);
    expect(screen.getByLabelText('Reagent Name')).toHaveValue('Lunar Moss');
    expect(latest.ui.pendingIntent).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close inventory import' }));
    fireEvent.click(screen.getByRole('button', { name: 'Food Types' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reagents' }));
    expect(screen.queryByRole('heading', { name: 'Import from party inventory' })).not.toBeInTheDocument();
  });

  it('opens the picker without a selection when no source name matches', () => {
    let latest = makeState([]);
    renderManager(['Missing Stock'], state => {
      latest = state;
    });

    expect(screen.getByRole('heading', { name: 'Reagent Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Import from party inventory' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument();
    expect(latest.ui.pendingIntent).toBeNull();
  });
});
