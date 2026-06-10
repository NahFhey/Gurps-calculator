/**
 * LootDistribution dispatch tests (Phase 12a.5)
 *
 * Verifies the post-combat loot flow commits items through the inventory bus:
 * party-pool default, per-character assignment, and the currency mapping.
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LootDistribution from '../LootDistribution';

const { acquireItemMock } = vi.hoisted(() => ({ acquireItemMock: vi.fn() }));

vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: () => ({ actions: { acquireItem: acquireItemMock } }),
}));

vi.mock('../../../hooks/useCombatStore', () => ({
  useCombatStore: () => ({
    partyCharacters: [{ id: 'char-1', name: 'Korrin' }],
  }),
}));

function addLootItem(name: string, type?: string) {
  fireEvent.change(screen.getByPlaceholderText('Item name'), {
    target: { value: name },
  });
  if (type) {
    // The add-form type selector is the first combobox in the document
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: type },
    });
  }
  fireEvent.click(screen.getByText('Add Item'));
}

describe('LootDistribution', () => {
  beforeEach(() => {
    acquireItemMock.mockClear();
  });

  it('distributes an item to the party pool by default', () => {
    render(<LootDistribution onComplete={vi.fn()} />);
    addLootItem('Iron Shield', 'equipment');
    fireEvent.click(screen.getByText('Distribute'));

    expect(acquireItemMock).toHaveBeenCalledTimes(1);
    const [item, owner, source] = acquireItemMock.mock.calls[0];
    expect(item).toMatchObject({ kind: 'equipment', name: 'Iron Shield', quantity: 1 });
    expect(owner).toBe('party');
    expect(source).toBe('loot');
  });

  it('distributes to an assigned character', () => {
    render(<LootDistribution onComplete={vi.fn()} />);
    addLootItem('Magic Sword', 'equipment');

    // After adding, the row's target selector is the second combobox
    // (the add form's type selector renders first in the DOM)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[selects.length - 1], { target: { value: 'char-1' } });
    fireEvent.click(screen.getByText('Distribute'));

    expect(acquireItemMock).toHaveBeenCalledTimes(1);
    const [item, owner] = acquireItemMock.mock.calls[0];
    expect(item).toMatchObject({ kind: 'equipment', name: 'Magic Sword' });
    expect(owner).toBe('char-1');
  });

  it('maps currency loot to a currency acquisition with a normalized key', () => {
    render(<LootDistribution onComplete={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Item name'), {
      target: { value: 'Gold' },
    });
    fireEvent.change(screen.getByPlaceholderText('Qty'), {
      target: { value: '25' },
    });
    fireEvent.click(screen.getByText('Add Item')); // default type is currency
    fireEvent.click(screen.getByText('Distribute'));

    expect(acquireItemMock).toHaveBeenCalledTimes(1);
    const [item, owner, source] = acquireItemMock.mock.calls[0];
    expect(item).toEqual({ kind: 'currency', currencyKey: 'gold', amount: 25 });
    expect(owner).toBe('party');
    expect(source).toBe('loot');
  });

  it('finishing with no loot dispatches nothing and completes', () => {
    const onComplete = vi.fn();
    render(<LootDistribution onComplete={onComplete} />);
    // With zero items the action button reads 'Finish'
    fireEvent.click(screen.getByText('Finish'));

    expect(acquireItemMock).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it('shows the distribution summary after distributing', () => {
    render(<LootDistribution onComplete={vi.fn()} />);
    addLootItem('Iron Shield', 'equipment');
    fireEvent.click(screen.getByText('Distribute'));

    expect(screen.getByText('Loot Distributed')).toBeInTheDocument();
  });
});
