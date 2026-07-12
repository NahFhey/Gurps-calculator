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
  useCampaignStore: () => ({
    actions: { acquireItem: acquireItemMock },
    state: {
      entities: {
        materialTypes: [
          { name: 'Iron', difficulty: 0, effects: '', ht: 10, drShift: 0, weightMod: 0, hpMod: 0 },
          { name: 'Steel', difficulty: 0, effects: '', ht: 12, drShift: 1, weightMod: 0, hpMod: 0 },
        ],
      },
    },
  }),
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

  it('acquires a material with the picked MaterialType instead of the loot placeholder', () => {
    render(<LootDistribution onComplete={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Item name'), {
      target: { value: 'Ingot' },
    });
    // Set loot type to material — this reveals the material-type selector
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'material' } });
    // The material-type selector is now the second combobox in the add form
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Steel' } });
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Distribute'));

    expect(acquireItemMock).toHaveBeenCalledTimes(1);
    const [item, owner, source] = acquireItemMock.mock.calls[0];
    expect(item).toMatchObject({ kind: 'material', name: 'Ingot', type: 'Steel' });
    expect(owner).toBe('party');
    expect(source).toBe('loot');
  });

  it('falls back to the untyped loot material type when none is picked', () => {
    render(<LootDistribution onComplete={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Item name'), {
      target: { value: 'Scrap' },
    });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'material' } });
    // Leave the material-type selector at its default "Untyped loot material"
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Distribute'));

    const [item] = acquireItemMock.mock.calls[0];
    expect(item).toMatchObject({ kind: 'material', name: 'Scrap', type: 'loot' });
  });

  it('shows the distribution summary after distributing', () => {
    render(<LootDistribution onComplete={vi.fn()} />);
    addLootItem('Iron Shield', 'equipment');
    fireEvent.click(screen.getByText('Distribute'));

    expect(screen.getByText('Loot Distributed')).toBeInTheDocument();
  });
});
