import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { KitchensView } from '../views/KitchensView';
import type { Kitchen } from '../../../types/campaign';

describe('KitchensView', () => {
  const mockSaveKitchens = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    kitchens: [] as Kitchen[],
    saveKitchens: mockSaveKitchens,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Kitchens heading', () => {
    render(<KitchensView {...defaultProps} />);
    expect(screen.getByText('Kitchens')).toBeInTheDocument();
  });

  it('renders Add button', () => {
    render(<KitchensView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('shows add form when Add button is clicked', () => {
    render(<KitchensView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(screen.getByPlaceholderText(/kitchen name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('renders existing kitchens with rating badges', () => {
    const kitchens: Kitchen[] = [
      { id: '1', name: 'Basic Kitchen', rating: 0, description: 'A basic kitchen' },
      { id: '2', name: 'Master Chef Kitchen', rating: 4, description: 'A master chef kitchen' }
    ];

    render(<KitchensView {...defaultProps} kitchens={kitchens} />);

    expect(screen.getByText('Basic Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Master Chef Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Rating 0')).toBeInTheDocument();
    expect(screen.getByText('Rating 4')).toBeInTheDocument();
  });

  it('shows skill bonus text for each kitchen', () => {
    const kitchens: Kitchen[] = [
      { id: '1', name: 'Test Kitchen', rating: 3, description: 'A test kitchen' }
    ];

    render(<KitchensView {...defaultProps} kitchens={kitchens} />);

    expect(screen.getByText('+3 to cooking skill')).toBeInTheDocument();
  });

  it('calls saveKitchens when adding a new kitchen', () => {
    render(<KitchensView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/kitchen name/i), {
      target: { value: 'New Kitchen' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveKitchens).toHaveBeenCalledTimes(1);
    const savedKitchens = mockSaveKitchens.mock.calls[0][0];
    expect(savedKitchens).toHaveLength(1);
    expect(savedKitchens[0].name).toBe('New Kitchen');
    expect(savedKitchens[0].rating).toBe(0);
  });

  it('clamps rating between 0 and 4', () => {
    render(<KitchensView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/kitchen name/i), {
      target: { value: 'Test Kitchen' }
    });

    const ratingInputs = document.querySelectorAll('input[type="number"]');
    fireEvent.change(ratingInputs[0], { target: { value: '-5' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const savedKitchens = mockSaveKitchens.mock.calls[0][0];
    expect(savedKitchens[0].rating).toBe(0); // Clamped to min 0
  });

  it('alerts when trying to add empty kitchen name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<KitchensView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter a kitchen name');
    expect(mockSaveKitchens).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('alerts when trying to add duplicate kitchen name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const kitchens: Kitchen[] = [{ id: '1', name: 'Main Kitchen', rating: 2, description: 'The main kitchen' }];

    render(<KitchensView {...defaultProps} kitchens={kitchens} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/kitchen name/i), {
      target: { value: 'Main Kitchen' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Duplicate kitchen name');
    expect(mockSaveKitchens).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('expands kitchen details when clicked', () => {
    const kitchens: Kitchen[] = [
      { id: '1', name: 'Test Kitchen', rating: 2, description: 'A test kitchen' }
    ];

    render(<KitchensView {...defaultProps} kitchens={kitchens} />);

    fireEvent.click(screen.getByText('Test Kitchen'));

    expect(screen.getByRole('button', { name: /delete kitchen/i })).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const kitchens: Kitchen[] = [
      { id: 'kitchen-456', name: 'Test Kitchen', rating: 2, description: 'A test kitchen' }
    ];

    render(<KitchensView {...defaultProps} kitchens={kitchens} />);

    fireEvent.click(screen.getByText('Test Kitchen'));
    fireEvent.click(screen.getByRole('button', { name: /delete kitchen/i }));

    expect(mockOnDelete).toHaveBeenCalledWith('kitchen', 'Test Kitchen', { id: 'kitchen-456' });
  });

  it('saves kitchen with description when provided', () => {
    render(<KitchensView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/kitchen name/i), {
      target: { value: 'New Kitchen' }
    });
    fireEvent.change(screen.getByPlaceholderText(/description/i), {
      target: { value: 'Well-equipped kitchen' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const savedKitchens = mockSaveKitchens.mock.calls[0][0];
    expect(savedKitchens[0].description).toBe('Well-equipped kitchen');
  });

  it('updates kitchen rating when edited', () => {
    const kitchens: Kitchen[] = [
      { id: '1', name: 'Test Kitchen', rating: 1, description: 'A test kitchen' }
    ];

    render(<KitchensView {...defaultProps} kitchens={kitchens} />);

    // Expand
    fireEvent.click(screen.getByText('Test Kitchen'));

    // Find rating input in expanded view (second number input)
    const ratingInputs = document.querySelectorAll('input[type="number"]');
    fireEvent.change(ratingInputs[0], { target: { value: '3' } });

    expect(mockSaveKitchens).toHaveBeenCalled();
    const updatedKitchens = mockSaveKitchens.mock.calls[0][0];
    expect(updatedKitchens[0].rating).toBe(3);
  });
});
