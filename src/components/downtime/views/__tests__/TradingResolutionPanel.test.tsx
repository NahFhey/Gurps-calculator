import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider } from '../../../../state/campaignStore';
import { createCampaignState } from '../../../../state/campaignReducer';
import { createDefaultGCSData } from '../../../../types/characterSheet';
import { rollVsTarget } from '../../../../utils/dice';
import { TradingResolutionPanel } from '../TradingResolutionPanel';
import type { Character } from '../../../../types/campaign';
import type { RollVsTargetResult } from '../../../../utils/dice';
import type { TradingTask } from '../TradingTaskCard';

vi.mock('../../../../utils/dice', () => ({ rollVsTarget: vi.fn() }));
const mockedRollVsTarget = vi.mocked(rollVsTarget);

const task: TradingTask = {
  id: 'trade-1', activityType: 'trading', dayKey: 1, slot: 0, leaderId: 'leader', helperIds: [], status: 'pending',
  activityData: { type: 'trading', merchantName: 'Market', opposingSkill: 12 }, createdAt: 1, updatedAt: 1,
};
const leader: Character = { id: 'leader', name: 'Rina', work: { skills: { merchant: 13 } }, gcsData: createDefaultGCSData() };

function result(total: number, target: number): RollVsTargetResult {
  return { expression: '3d6', dice: [3, 3, total - 6], modifier: 0, total, valid: true, target, margin: target - total, success: total <= target };
}

function renderPanel(balance = 100) {
  const state = createCampaignState();
  state.entities.characters[leader.id] = leader;
  state.entities.inventories = { party: {
    id: 'party', ownerType: 'party', ownerId: null, currency: {}, items: [], tools: [], materials: [], food: [],
  } };
  state.entities.inventories.party.currency.cp = balance;
  state.entities.inventories.party.materials = [{ id: 'iron', name: 'Iron Ore', type: 'metal', quantity: 5 }];
  state.entities.priceBook = {
    'material:iron ore': { key: 'material:iron ore', name: 'Iron Ore', kind: 'material', price: 3, updatedAt: 1 },
    'item:rope': { key: 'item:rope', name: 'Rope', kind: 'item', price: 5, updatedAt: 1 },
  };
  const onFinalize = vi.fn();
  render(<CampaignStoreProvider initialCampaignState={state}><TradingResolutionPanel task={task} leader={leader} onFinalize={onFinalize} onCancel={vi.fn()} /></CampaignStoreProvider>);
  return onFinalize;
}

function addRopeBuy(quantity = 2) {
  fireEvent.change(screen.getByTestId('buy-kind-select'), { target: { value: 'item' } });
  fireEvent.change(screen.getByTestId('buy-name-input'), { target: { value: 'Rope' } });
  fireEvent.change(screen.getByTestId('buy-quantity-input'), { target: { value: String(quantity) } });
  fireEvent.click(screen.getByTestId('add-buy-line-button'));
}

describe('TradingResolutionPanel', () => {
  beforeEach(() => mockedRollVsTarget.mockReset());

  it('finalizes a mixed sell, buy, and adjustment basket', () => {
    const onFinalize = renderPanel();
    fireEvent.change(screen.getByTestId('sell-picker'), { target: { value: 'material:iron' } });
    expect(screen.getByTestId('sell-unit-price-input')).toHaveValue(3);
    fireEvent.change(screen.getByTestId('sell-quantity-input'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('add-sell-line-button'));
    addRopeBuy();
    fireEvent.change(screen.getByTestId('adjust-note-input'), { target: { value: 'Stall fee' } });
    fireEvent.change(screen.getByTestId('adjust-amount-input'), { target: { value: '-1' } });
    fireEvent.click(screen.getByTestId('add-adjust-line-button'));
    fireEvent.click(screen.getByTestId('apply-trade-button'));
    expect(onFinalize).toHaveBeenCalledOnce();
    expect(onFinalize.mock.calls[0]?.[0]).toMatchObject({ success: true, inventoryChanges: [
      { itemName: 'Iron Ore', quantity: -2 }, { itemName: 'Rope', quantity: 2 },
    ] });
    expect(onFinalize.mock.calls[0]?.[1]).toMatchObject({ totals: { proceeds: 6, costs: 10, adjustNet: -1, net: -5 } });
  });

  it('blocks Apply when the basket exceeds party funds', () => {
    renderPanel(0);
    addRopeBuy(1);
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    expect(screen.getByTestId('apply-trade-button')).toBeDisabled();
  });

  it('locks the console and resolves a broken deal without changes', () => {
    mockedRollVsTarget.mockReturnValueOnce(result(18, 13)).mockReturnValueOnce(result(10, 12));
    const onFinalize = renderPanel();
    addRopeBuy(1);
    fireEvent.click(screen.getByTestId('roll-haggle-button'));
    expect(screen.getByText('The merchant refuses to deal.')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('apply-trade-button'));
    expect(onFinalize.mock.calls[0]?.[0]).toMatchObject({ success: false, inventoryChanges: [] });
    expect(onFinalize.mock.calls[0]?.[1]).toMatchObject({ dealBroken: true });
  });

  it('prefills learned prices for sell and buy lines', () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('sell-picker'), { target: { value: 'material:iron' } });
    expect(screen.getByTestId('sell-unit-price-input')).toHaveValue(3);
    fireEvent.change(screen.getByTestId('buy-kind-select'), { target: { value: 'item' } });
    fireEvent.change(screen.getByTestId('buy-name-input'), { target: { value: 'Rope' } });
    expect(screen.getByTestId('buy-unit-price-input')).toHaveValue(5);
  });
});
