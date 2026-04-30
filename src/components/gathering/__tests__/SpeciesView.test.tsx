import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SpeciesView } from '../views/SpeciesView';
import type { GatheringSpeciesExtended, SpeciesViewProps } from '../../../types/gathering';

type Species = Partial<GatheringSpeciesExtended> & { id: string; name: string };
const asSpecies = (xs: Species[]): GatheringSpeciesExtended[] => xs as unknown as GatheringSpeciesExtended[];

describe('SpeciesView', () => {
  const mockSaveSpecies = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps: SpeciesViewProps = {
    species: [],
    foodTypes: ['fish', 'shellfish'],
    saveSpecies: mockSaveSpecies,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Species heading with count', () => {
    render(<SpeciesView {...defaultProps} />);
    expect(screen.getByText('Species (0)')).toBeInTheDocument();
  });

  it('shows count in header when species exist', () => {
    const species: Species[] = [
      { id: '1', name: 'Trout' },
      { id: '2', name: 'Salmon' }
    ];
    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);
    expect(screen.getByText('Species (2)')).toBeInTheDocument();
  });

  it('renders Add Species button', () => {
    render(<SpeciesView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add species/i })).toBeInTheDocument();
  });

  it('shows add form when Add Species button is clicked', () => {
    render(<SpeciesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add species/i }));

    expect(screen.getByPlaceholderText(/coastal trout/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows type dropdown with options', () => {
    render(<SpeciesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add species/i }));

    const typeSelect = screen.getAllByRole('combobox')[0];
    expect(typeSelect).toBeInTheDocument();
    expect(typeSelect).toContainHTML('Fish');
    expect(typeSelect).toContainHTML('Shellfish');
    expect(typeSelect).toContainHTML('Crustacean');
  });

  it('shows empty state when no species', () => {
    render(<SpeciesView {...defaultProps} species={[]} />);
    expect(screen.getByText(/no species defined/i)).toBeInTheDocument();
  });

  it('renders existing species', () => {
    const species: Species[] = [
      { id: '1', name: 'Coastal Trout', type: 'fish' },
      { id: '2', name: 'River Salmon', type: 'fish' }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    expect(screen.getByText('Coastal Trout')).toBeInTheDocument();
    expect(screen.getByText('River Salmon')).toBeInTheDocument();
  });

  it('displays species type in list', () => {
    const species: Species[] = [
      { id: '1', name: 'Trout', type: 'fish' },
      { id: '2', name: 'Clam', type: 'shellfish' }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    expect(screen.getByText('fish')).toBeInTheDocument();
    expect(screen.getByText('shellfish')).toBeInTheDocument();
  });

  it('shows Large badge for LargeFish tagged species', () => {
    const species: Species[] = [
      { id: '1', name: 'Giant Tuna', type: 'fish', tags: ['LargeFish'], st: 16 }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('calls saveSpecies when adding a new species', () => {
    render(<SpeciesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add species/i }));
    fireEvent.change(screen.getByPlaceholderText(/coastal trout/i), {
      target: { value: 'New Species' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveSpecies).toHaveBeenCalledTimes(1);
    const savedSpecies = mockSaveSpecies.mock.calls[0][0];
    expect(savedSpecies).toHaveLength(1);
    expect(savedSpecies[0].name).toBe('New Species');
  });

  it('alerts when trying to add species with empty name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<SpeciesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add species/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter species name');
    expect(mockSaveSpecies).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('expands species details when clicked', () => {
    const species: Species[] = [
      { id: '1', name: 'Test Fish', type: 'fish', yieldMeatFormula: '2d+1', foodType: 'fish' }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    fireEvent.click(screen.getByText('Test Fish'));

    // Should show details and action buttons
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByText(/delete/i)).toBeInTheDocument();
  });

  it('shows meat yield formula in expanded view', () => {
    const species: Species[] = [
      { id: '1', name: 'Test Fish', type: 'fish', yieldMeatFormula: '3d+2', foodType: 'fish' }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    fireEvent.click(screen.getByText('Test Fish'));

    expect(screen.getByText(/3d\+2/)).toBeInTheDocument();
  });

  it('shows secondary material in expanded view', () => {
    const species: Species[] = [
      {
        id: '1',
        name: 'Scaled Fish',
        type: 'fish',
        yieldMeatFormula: '2d',
        foodType: 'fish',
        secondaryMaterialType: 'Scales',
        yieldSecondaryFormula: '1d'
      }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    fireEvent.click(screen.getByText('Scaled Fish'));

    expect(screen.getByText(/secondary/i)).toBeInTheDocument();
    expect(screen.getByText(/scales/i)).toBeInTheDocument();
  });

  it('shows ST for large fish in expanded view', () => {
    const species: Species[] = [
      { id: '1', name: 'Big Fish', type: 'fish', tags: ['LargeFish'], st: 18, yieldMeatFormula: '2d', foodType: 'fish' }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    fireEvent.click(screen.getByText('Big Fish'));

    // ST is displayed as "ST: 18"
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('shows tags in expanded view', () => {
    const species: Species[] = [
      { id: '1', name: 'Tagged Fish', type: 'fish', tags: ['LargeFish', 'Dangerous'] }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    fireEvent.click(screen.getByText('Tagged Fish'));

    expect(screen.getByText('LargeFish')).toBeInTheDocument();
    expect(screen.getByText('Dangerous')).toBeInTheDocument();
  });

  it('calls onDelete when delete is clicked', () => {
    const species: Species[] = [
      { id: 'species-123', name: 'Test Species', type: 'fish' }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    fireEvent.click(screen.getByText('Test Species'));

    const deleteButton = document.querySelector('button.text-red-400');
    expect(deleteButton).not.toBeNull();
    if (deleteButton) fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('species', 'species-123', 'Test Species');
  });

  it('enters edit mode when edit button is clicked', () => {
    const species: Species[] = [
      { id: '1', name: 'Edit Me', type: 'fish', yieldMeatFormula: '2d' }
    ];

    render(<SpeciesView {...defaultProps} species={asSpecies(species)} />);

    fireEvent.click(screen.getByText('Edit Me'));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // Form should show with Update button
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edit Me')).toBeInTheDocument();
  });

  it('hides add form when X button is clicked', () => {
    render(<SpeciesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add species/i }));
    expect(screen.getByPlaceholderText(/coastal trout/i)).toBeInTheDocument();

    // Find and click X button
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(btn => btn.querySelector('svg.lucide-x'));
    if (closeButton) fireEvent.click(closeButton);

    expect(screen.queryByPlaceholderText(/coastal trout/i)).not.toBeInTheDocument();
  });
});
