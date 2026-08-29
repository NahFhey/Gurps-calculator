import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import { TradingView } from '../views/TradingView';

function renderView() {
  const state = createCampaignState();
  state.entities.currencyConfig = {
    currencies: [{ key: 'cp', name: 'Copper' }, { key: 'sp', name: 'Silver' }],
    primaryKey: 'cp',
  };
  state.entities.priceBook = {
    'material:iron': { key: 'material:iron', name: 'Iron', kind: 'material', price: 3, updatedAt: 1 },
  };
  render(<CampaignStoreProvider initialCampaignState={state}><TradingView /></CampaignStoreProvider>);
}

describe('TradingView', () => {
  it('renames a currency inline', () => {
    renderView();
    const input = screen.getByLabelText('Rename cp');
    fireEvent.change(input, { target: { value: 'Copper Pennies' } });
    expect(input).toHaveValue('Copper Pennies');
  });

  it('blocks deletion of the primary currency', () => {
    renderView();
    expect(screen.getByLabelText('Delete Copper')).toBeDisabled();
    expect(screen.getByLabelText('Delete Silver')).toBeEnabled();
  });

  it('edits a learned price inline', () => {
    renderView();
    const input = screen.getByLabelText('Price for Iron');
    fireEvent.change(input, { target: { value: '8' } });
    expect(input).toHaveValue(8);
  });
});
