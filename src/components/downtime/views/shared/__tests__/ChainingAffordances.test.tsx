import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../../../state/campaignStore';
import { createCampaignState, type CampaignState } from '../../../../../state/campaignReducer';
import type { InventoryDelta, TaskResults } from '../../../../../types/downtime';
import { ChainingAffordances } from '../ChainingAffordances';

function makeResults(inventoryChanges: InventoryDelta[], success = true): TaskResults {
  return { success, message: 'Gathered a haul', inventoryChanges };
}

function StateProbe({ capture }: { capture: (state: CampaignState) => void }) {
  capture(useCampaignStore().state);
  return null;
}

function renderAffordances(
  results: TaskResults,
  capture: (state: CampaignState) => void = () => undefined,
) {
  return render(
    <CampaignStoreProvider initialCampaignState={createCampaignState()}>
      <ChainingAffordances results={results} />
      <StateProbe capture={capture} />
    </CampaignStoreProvider>,
  );
}

const foodChange: InventoryDelta = {
  itemId: 'food-trout',
  itemName: 'Trout Meat',
  quantity: 3,
  kind: 'food',
};
const materialChange: InventoryDelta = {
  itemId: 'mat-scales',
  itemName: 'Trout Scales',
  quantity: 2,
  kind: 'material',
};

describe('ChainingAffordances', () => {
  it('renders nothing for unsuccessful results', () => {
    const { container } = renderAffordances(makeResults([foodChange], false));
    expect(container.querySelector('[data-testid="chaining-affordances"]')).toBeNull();
  });

  it('renders nothing when deltas have no kind metadata', () => {
    renderAffordances(makeResults([{ itemId: 'legacy', itemName: 'Old haul', quantity: 2 }]));
    expect(screen.queryByTestId('chaining-affordances')).not.toBeInTheDocument();
  });

  it('shows only cooking for a food-only haul', () => {
    renderAffordances(makeResults([foodChange]));
    expect(screen.getByTestId('chain-cook')).toBeInTheDocument();
    expect(screen.queryByTestId('chain-craft')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chain-promote')).not.toBeInTheDocument();
  });

  it('shows crafting and promotion for a material-only haul', () => {
    renderAffordances(makeResults([materialChange]));
    expect(screen.queryByTestId('chain-cook')).not.toBeInTheDocument();
    expect(screen.getByTestId('chain-craft')).toBeInTheDocument();
    expect(screen.getByTestId('chain-promote')).toBeInTheDocument();
  });

  it('shows all three buttons for a mixed positive haul', () => {
    renderAffordances(makeResults([foodChange, materialChange]));
    expect(screen.getByTestId('chain-cook')).toBeInTheDocument();
    expect(screen.getByTestId('chain-craft')).toBeInTheDocument();
    expect(screen.getByTestId('chain-promote')).toBeInTheDocument();
  });

  it('dispatches the food ids when cooking is selected', () => {
    let latest = createCampaignState();
    renderAffordances(makeResults([foodChange, { ...foodChange, itemId: 'food-bass', itemName: 'Bass Meat' }]), state => {
      latest = state;
    });

    fireEvent.click(screen.getByTestId('chain-cook'));
    expect(latest.ui.pendingIntent).toEqual({ kind: 'cook', foodIds: ['food-trout', 'food-bass'] });
  });

  it('dispatches the craft intent', () => {
    let latest = createCampaignState();
    renderAffordances(makeResults([materialChange]), state => {
      latest = state;
    });

    fireEvent.click(screen.getByTestId('chain-craft'));
    expect(latest.ui.pendingIntent).toEqual({ kind: 'craft' });
  });

  it('dispatches promotion names before navigating to manager', () => {
    let latest = createCampaignState();
    renderAffordances(makeResults([materialChange, { ...materialChange, itemName: 'Iron Ore' }]), state => {
      latest = state;
    });

    fireEvent.click(screen.getByTestId('chain-promote'));
    expect(latest.ui.pendingIntent).toEqual({
      kind: 'promote',
      sourceNames: ['Trout Scales', 'Iron Ore'],
    });
    expect(latest.ui.activeModule).toBe('manager');
  });
});
