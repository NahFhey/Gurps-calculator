import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ItemsView } from '../views/ItemsView';
import type { GatheringItemExtended } from '../../../types/gathering';

describe('ItemsView', () => {
  const mockSaveItems = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    items: [] as GatheringItemExtended[],
    foodTypes: ['berries', 'herbs', 'vegetables'],
    materialTypes: ['wood', 'stone', 'fiber'],
    saveItems: mockSaveItems,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Forageable Items heading with count', () => {
    render(<ItemsView {...defaultProps} />);
    expect(screen.getByText('Forageable Items (0)')).toBeInTheDocument();
  });

  it('shows count in header when items exist', () => {
    const items = [
      { id: '1', name: 'Berries', inventoryKind: 'food', typeId: '1', yieldFormula: '1d6', rarity: 'common', description: 'Berry' },
      { id: '2', name: 'Mushrooms', inventoryKind: 'food', typeId: '2', yieldFormula: '1d4', rarity: 'common', description: 'Mushroom' },
      { id: '3', name: 'Roots', inventoryKind: 'material', typeId: '3', yieldFormula: '2d4', rarity: 'common', description: 'Root' }
    ];
    render(<ItemsView {...defaultProps} items={items as any} />);
    expect(screen.getByText('Forageable Items (3)')).toBeInTheDocument();
  });

  it('renders Add Item button', () => {
    render(<ItemsView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  it('shows add form when Add Item button is clicked', () => {
    render(<ItemsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(screen.getByPlaceholderText(/tamrya berries/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows inventory type dropdown with food and material options', () => {
    render(<ItemsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    const inventorySelect = screen.getAllByRole('combobox')[0];
    expect(inventorySelect).toContainHTML('Food');
    expect(inventorySelect).toContainHTML('Material');
  });

  it('shows rarity dropdown', () => {
    render(<ItemsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    // Check that rarity select exists and has options
    const selects = screen.getAllByRole('combobox');
    const raritySelect = selects[2]; // Third select is rarity
    expect(raritySelect).toBeInTheDocument();
    expect(raritySelect).toContainHTML('Common');
  });

  it('shows empty state when no items', () => {
    render(<ItemsView {...defaultProps} items={[]} />);
    expect(screen.getByText(/no items defined/i)).toBeInTheDocument();
  });

  it('renders existing items', () => {
    const items = [
      { id: '1', name: 'Wild Berries', inventoryKind: 'food' },
      { id: '2', name: 'Healing Herbs', inventoryKind: 'food' }
    ] as any;

    render(<ItemsView {...defaultProps} items={items as any} />);

    expect(screen.getByText('Wild Berries')).toBeInTheDocument();
    expect(screen.getByText('Healing Herbs')).toBeInTheDocument();
  });

  it('displays yield formula in list', () => {
    const items = [
      { id: '1', name: 'Berries', yieldFormula: '3d+2' }
    ] as any;

    render(<ItemsView {...defaultProps} items={items} />);

    expect(screen.getByText('3d+2')).toBeInTheDocument();
  });

  it('displays inventory kind badge', () => {
    const items = [
      { id: '1', name: 'Fiber Plant', inventoryKind: 'material' }
    ] as any;

    render(<ItemsView {...defaultProps} items={items} />);

    expect(screen.getByText('material')).toBeInTheDocument();
  });

  it('displays rarity badge', () => {
    const items = [
      { id: '1', name: 'Rare Herb', rarity: 'Rare' }
    ] as any;

    render(<ItemsView {...defaultProps} items={items} />);

    expect(screen.getByText('Rare')).toBeInTheDocument();
  });

  it('calls saveItems when adding a new item', () => {
    render(<ItemsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    fireEvent.change(screen.getByPlaceholderText(/tamrya berries/i), {
      target: { value: 'New Item' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveItems).toHaveBeenCalledTimes(1);
    const savedItems = mockSaveItems.mock.calls[0][0];
    expect(savedItems).toHaveLength(1);
    expect(savedItems[0].name).toBe('New Item');
  });

  it('sets default yield formula when adding item', () => {
    render(<ItemsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    fireEvent.change(screen.getByPlaceholderText(/tamrya berries/i), {
      target: { value: 'Test Item' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const savedItems = mockSaveItems.mock.calls[0][0];
    expect(savedItems[0].yieldFormula).toBe('3d');
  });

  it('alerts when trying to add item with empty name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ItemsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter item name');
    expect(mockSaveItems).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('expands item details when clicked', () => {
    const items = [
      { id: '1', name: 'Test Item', inventoryKind: 'food', yieldFormula: '2d', rarity: 'Common' }
    ] as any;

    render(<ItemsView {...defaultProps} items={items} />);

    fireEvent.click(screen.getByText('Test Item'));

    // Should show details and action buttons
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByText(/delete/i)).toBeInTheDocument();
  });

  it('shows type ID in expanded view', () => {
    const items = [
      { id: '1', name: 'Test Item', typeId: 'test_item_id' }
    ] as any;

    render(<ItemsView {...defaultProps} items={items} />);

    fireEvent.click(screen.getByText('Test Item'));

    expect(screen.getByText(/type id/i)).toBeInTheDocument();
    expect(screen.getByText(/test_item_id/)).toBeInTheDocument();
  });

  it('shows description in expanded view', () => {
    const items = [
      { id: '1', name: 'Test Item', description: 'A test description for this item' }
    ] as any;

    render(<ItemsView {...defaultProps} items={items} />);

    fireEvent.click(screen.getByText('Test Item'));

    expect(screen.getByText('A test description for this item')).toBeInTheDocument();
  });

  it('calls onDelete when delete is clicked', () => {
    const items = [
      { id: 'item-456', name: 'Test Item' }
    ] as any;

    render(<ItemsView {...defaultProps} items={items} />);

    fireEvent.click(screen.getByText('Test Item'));

    const deleteButton = document.querySelector('button.text-red-400');
    expect(deleteButton).not.toBeNull();
    if (deleteButton) fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('item', 'item-456', 'Test Item');
  });

  it('enters edit mode when edit button is clicked', () => {
    const items = [
      { id: '1', name: 'Edit Me', yieldFormula: '4d' }
    ] as any;

    render(<ItemsView {...defaultProps} items={items} />);

    fireEvent.click(screen.getByText('Edit Me'));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // Form should show with Update button
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edit Me')).toBeInTheDocument();
  });

  it('hides add form when X button is clicked', () => {
    render(<ItemsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getByPlaceholderText(/tamrya berries/i)).toBeInTheDocument();

    // Find and click X button
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(btn => btn.querySelector('svg.lucide-x'));
    if (closeButton) fireEvent.click(closeButton);

    expect(screen.queryByPlaceholderText(/tamrya berries/i)).not.toBeInTheDocument();
  });

  it('shows food types in type ID dropdown when food selected', () => {
    render(<ItemsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    // Type ID dropdown (second combobox) should have food types
    const selects = screen.getAllByRole('combobox');
    const typeIdSelect = selects[1];
    expect(typeIdSelect).toContainHTML('berries');
    expect(typeIdSelect).toContainHTML('herbs');
  });

  it('shows material types in type ID dropdown when material selected', () => {
    render(<ItemsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    // Change inventory type to material
    const inventorySelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(inventorySelect, { target: { value: 'material' } });

    // Type ID dropdown should now have material types
    const selects = screen.getAllByRole('combobox');
    const typeIdSelect = selects[1];
    expect(typeIdSelect).toContainHTML('wood');
    expect(typeIdSelect).toContainHTML('stone');
  });
});
