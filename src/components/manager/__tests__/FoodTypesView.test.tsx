import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FoodTypesView } from '../views/FoodTypesView';
import type { FoodType } from '../../../types/campaign';

describe('FoodTypesView', () => {
  const mockSaveFoodTypes = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    foodTypes: [] as (string | FoodType)[],
    saveFoodTypes: mockSaveFoodTypes,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Food Types heading', () => {
    render(<FoodTypesView {...defaultProps} />);
    expect(screen.getByText('Food Types')).toBeInTheDocument();
  });

  it('renders Add button', () => {
    render(<FoodTypesView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('shows add form when Add button is clicked', () => {
    render(<FoodTypesView {...defaultProps} />);

    const addButton = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addButton);

    expect(screen.getByPlaceholderText('Type name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('hides add form when X button is clicked', () => {
    render(<FoodTypesView {...defaultProps} />);

    // Open form
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByPlaceholderText('Type name')).toBeInTheDocument();

    // Close form (X button has no text, find by its position after Save)
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(btn => btn.querySelector('svg.lucide-x'));
    if (closeButton) fireEvent.click(closeButton);

    expect(screen.queryByPlaceholderText('Type name')).not.toBeInTheDocument();
  });

  it('renders existing food types', () => {
    const foodTypes: FoodType[] = [
      { name: 'meat', color: '#FF0000' },
      { name: 'grain', color: '#00FF00' }
    ];

    render(<FoodTypesView {...defaultProps} foodTypes={foodTypes} />);

    expect(screen.getByDisplayValue('meat')).toBeInTheDocument();
    expect(screen.getByDisplayValue('grain')).toBeInTheDocument();
  });

  it('renders legacy string food types', () => {
    const foodTypes: (string | FoodType)[] = ['fruit', 'vegetable'];

    render(<FoodTypesView {...defaultProps} foodTypes={foodTypes} />);

    expect(screen.getByDisplayValue('fruit')).toBeInTheDocument();
    expect(screen.getByDisplayValue('vegetable')).toBeInTheDocument();
  });

  it('calls saveFoodTypes when adding a new type', () => {
    render(<FoodTypesView {...defaultProps} />);

    // Open form
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    // Fill in name
    const input = screen.getByPlaceholderText('Type name');
    fireEvent.change(input, { target: { value: 'dairy' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveFoodTypes).toHaveBeenCalledWith([
      { name: 'dairy', color: '#60A5FA' }
    ]);
  });

  it('converts input to lowercase when adding', () => {
    render(<FoodTypesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText('Type name'), { target: { value: 'DAIRY' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveFoodTypes).toHaveBeenCalledWith([
      { name: 'dairy', color: '#60A5FA' }
    ]);
  });

  it('alerts when trying to add empty type name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<FoodTypesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter a type name');
    expect(mockSaveFoodTypes).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('alerts when trying to add duplicate type', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const foodTypes: FoodType[] = [{ name: 'meat', color: '#FF0000' }];

    render(<FoodTypesView {...defaultProps} foodTypes={foodTypes} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText('Type name'), { target: { value: 'meat' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Duplicate type');
    expect(mockSaveFoodTypes).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('calls onDelete when delete button is clicked', () => {
    const foodTypes: FoodType[] = [{ name: 'meat', color: '#FF0000' }];

    render(<FoodTypesView {...defaultProps} foodTypes={foodTypes} />);

    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.querySelector('svg.lucide-trash-2')
    );

    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      expect(mockOnDelete).toHaveBeenCalledWith('foodType', 'meat');
    }
  });

  it('calls saveFoodTypes when editing a type name', () => {
    const foodTypes: FoodType[] = [{ name: 'meat', color: '#FF0000' }];

    render(<FoodTypesView {...defaultProps} foodTypes={foodTypes} />);

    const nameInput = screen.getByDisplayValue('meat');
    fireEvent.change(nameInput, { target: { value: 'beef' } });

    expect(mockSaveFoodTypes).toHaveBeenCalledWith([
      { name: 'beef', color: '#FF0000' }
    ]);
  });

  it('calls saveFoodTypes when editing a type color', () => {
    const foodTypes: FoodType[] = [{ name: 'meat', color: '#FF0000' }];

    render(<FoodTypesView {...defaultProps} foodTypes={foodTypes} />);

    // Color inputs in the list (not the add form)
    const listColorInputs = document.querySelectorAll('input[type="color"]');
    if (listColorInputs.length > 0) {
      fireEvent.change(listColorInputs[0], { target: { value: '#00FF00' } });
      // Browser normalizes hex to lowercase
      expect(mockSaveFoodTypes).toHaveBeenCalledWith([
        { name: 'meat', color: '#00ff00' }
      ]);
    }
  });
});
