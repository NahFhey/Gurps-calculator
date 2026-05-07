import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BaitView } from '../views/BaitView';
import type { GatheringBaitExtended, GatheringSpeciesExtended } from '../../../types/gathering';

describe('BaitView', () => {
  const mockSaveBait = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    bait: [] as GatheringBaitExtended[],
    species: [
      { id: 'species-1', name: 'Trout', type: 'fish' } as GatheringSpeciesExtended,
      { id: 'species-2', name: 'Salmon', type: 'fish' } as GatheringSpeciesExtended
    ],
    saveBait: mockSaveBait,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Bait heading with count', () => {
    render(<BaitView {...defaultProps} />);
    expect(screen.getByText('Bait (0)')).toBeInTheDocument();
  });

  it('shows count in header when bait exist', () => {
    const bait = [
      { id: '1', name: 'Worms', consumableType: 'bait', baitTags: [], attractsSpeciesIds: ['species-1'], quantity: 10, rollBonus: 1 },
      { id: '2', name: 'Flies', consumableType: 'bait', baitTags: [], attractsSpeciesIds: ['species-1'], quantity: 5, rollBonus: 2 }
    ] as any;
    render(<BaitView {...defaultProps} bait={bait} />);
    expect(screen.getByText('Bait (2)')).toBeInTheDocument();
  });

  it('renders Add Bait button', () => {
    render(<BaitView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add bait/i })).toBeInTheDocument();
  });

  it('shows add form when Add Bait button is clicked', () => {
    render(<BaitView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add bait/i }));

    expect(screen.getByPlaceholderText(/glowing worms/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows empty state when no bait', () => {
    render(<BaitView {...defaultProps} bait={[]} />);
    expect(screen.getByText(/no bait defined/i)).toBeInTheDocument();
  });

  it('renders existing bait with quantity and roll bonus', () => {
    const bait = [
      { id: '1', name: 'Glowing Worms', consumableType: 'bait', baitTags: [], attractsSpeciesIds: ['species-1'], quantity: 15, rollBonus: 2 }
    ] as any;

    render(<BaitView {...defaultProps} bait={bait} />);

    expect(screen.getByText('Glowing Worms')).toBeInTheDocument();
    expect(screen.getByText('(15 available)')).toBeInTheDocument();
    expect(screen.getByText('+2 to catch roll')).toBeInTheDocument();
  });

  it('alerts when trying to add bait with empty name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<BaitView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add bait/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter bait name');
    expect(mockSaveBait).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('alerts when trying to add bait with no species selected', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<BaitView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add bait/i }));
    fireEvent.change(screen.getByPlaceholderText(/glowing worms/i), {
      target: { value: 'New Bait' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Bait must attract at least one species');
    expect(mockSaveBait).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('shows form with input when Add Bait is clicked', () => {
    render(<BaitView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add bait/i }));
    fireEvent.change(screen.getByPlaceholderText(/glowing worms/i), {
      target: { value: 'Magic Beetles' }
    });

    // Verify form is visible and input was filled
    expect(screen.getByDisplayValue('Magic Beetles')).toBeInTheDocument();
    // Save button is present (for new entry, not update)
    const buttons = screen.getAllByRole('button', { name: /save/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls onDelete with correct parameters when delete button is clicked', () => {
    const bait = [
      { id: 'bait-123', name: 'Test Bait', consumableType: 'bait', baitTags: [], attractsSpeciesIds: ['species-1'], quantity: 10, rollBonus: 1 }
    ] as any;

    render(<BaitView {...defaultProps} bait={bait} />);

    const deleteButton = document.querySelector('button.text-red-400');
    expect(deleteButton).not.toBeNull();
    if (deleteButton) fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('bait', 'bait-123', 'Test Bait');
  });

  it('enters edit mode when edit button is clicked', () => {
    const bait = [
      { id: '1', name: 'Edit Bait', consumableType: 'bait', baitTags: [], attractsSpeciesIds: ['species-1'], quantity: 10, rollBonus: 1 }
    ] as any;

    render(<BaitView {...defaultProps} bait={bait} />);

    const editButton = document.querySelector('button.text-blue-400');
    expect(editButton).not.toBeNull();
    if (editButton) fireEvent.click(editButton);

    // Form should show with Update button
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edit Bait')).toBeInTheDocument();
  });

  it('displays bait tags when present', () => {
    const bait = [
      { id: '1', name: 'Tagged Bait', consumableType: 'bait', baitTags: ['Organic', 'Scented'], attractsSpeciesIds: ['species-1'], quantity: 10, rollBonus: 1 }
    ] as any;

    render(<BaitView {...defaultProps} bait={bait} />);

    expect(screen.getByText('Organic')).toBeInTheDocument();
    expect(screen.getByText('Scented')).toBeInTheDocument();
  });
});
