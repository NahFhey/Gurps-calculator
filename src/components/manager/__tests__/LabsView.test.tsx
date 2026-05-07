import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LabsView } from '../views/LabsView';
import type { AlchemyLab as CampaignAlchemyLab } from '../../../types/campaign';
import type { LabsViewProps } from '../../../types/views';

type AlchemyLab = Partial<CampaignAlchemyLab> & { id: string; name: string; rating: number };
const asLabs = (xs: AlchemyLab[]): CampaignAlchemyLab[] => xs as unknown as CampaignAlchemyLab[];

describe('LabsView', () => {
  const mockSaveAlchemyLabs = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps: LabsViewProps = {
    alchemyLabs: [],
    saveAlchemyLabs: mockSaveAlchemyLabs,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Alchemy Labs heading', () => {
    render(<LabsView {...defaultProps} />);
    expect(screen.getByText('Alchemy Labs')).toBeInTheDocument();
  });

  it('renders Add button', () => {
    render(<LabsView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('shows add form when Add button is clicked', () => {
    render(<LabsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(screen.getByPlaceholderText(/lab name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('renders existing labs with rating badges', () => {
    const alchemyLabs: AlchemyLab[] = [
      { id: '1', name: 'Basic Lab', rating: 1 },
      { id: '2', name: 'Master Workshop', rating: 3 }
    ];

    render(<LabsView {...defaultProps} alchemyLabs={asLabs(alchemyLabs)} />);

    expect(screen.getByText('Basic Lab')).toBeInTheDocument();
    expect(screen.getByText('Master Workshop')).toBeInTheDocument();
    expect(screen.getByText('Rating 1')).toBeInTheDocument();
    expect(screen.getByText('Rating 3')).toBeInTheDocument();
  });

  it('shows skill bonus text for each lab', () => {
    const alchemyLabs: AlchemyLab[] = [
      { id: '1', name: 'Test Lab', rating: 2 }
    ];

    render(<LabsView {...defaultProps} alchemyLabs={asLabs(alchemyLabs)} />);

    expect(screen.getByText('+2 to processing skill')).toBeInTheDocument();
  });

  it('calls saveAlchemyLabs when adding a new lab', () => {
    render(<LabsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/lab name/i), {
      target: { value: 'New Lab' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveAlchemyLabs).toHaveBeenCalledTimes(1);
    const savedLabs = mockSaveAlchemyLabs.mock.calls[0][0];
    expect(savedLabs).toHaveLength(1);
    expect(savedLabs[0].name).toBe('New Lab');
    expect(savedLabs[0].rating).toBe(0);
  });

  it('clamps rating between 0 and 4', () => {
    render(<LabsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/lab name/i), {
      target: { value: 'Test Lab' }
    });

    // Find the rating input (number type)
    const ratingInputs = document.querySelectorAll('input[type="number"]');
    fireEvent.change(ratingInputs[0], { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const savedLabs = mockSaveAlchemyLabs.mock.calls[0][0];
    expect(savedLabs[0].rating).toBe(4); // Clamped to max 4
  });

  it('alerts when trying to add empty lab name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<LabsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter a lab name');
    expect(mockSaveAlchemyLabs).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('alerts when trying to add duplicate lab name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const alchemyLabs: AlchemyLab[] = [{ id: '1', name: 'Existing Lab', rating: 1 }];

    render(<LabsView {...defaultProps} alchemyLabs={asLabs(alchemyLabs)} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/lab name/i), {
      target: { value: 'Existing Lab' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Duplicate lab name');
    expect(mockSaveAlchemyLabs).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('expands lab details when clicked', () => {
    const alchemyLabs: AlchemyLab[] = [
      { id: '1', name: 'Test Lab', rating: 2, description: 'A test lab' }
    ];

    render(<LabsView {...defaultProps} alchemyLabs={asLabs(alchemyLabs)} />);

    // Click on the lab row to expand
    fireEvent.click(screen.getByText('Test Lab'));

    // Should show delete button after expansion
    expect(screen.getByRole('button', { name: /delete lab/i })).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const alchemyLabs: AlchemyLab[] = [
      { id: 'lab-123', name: 'Test Lab', rating: 2 }
    ];

    render(<LabsView {...defaultProps} alchemyLabs={asLabs(alchemyLabs)} />);

    // Expand the lab
    fireEvent.click(screen.getByText('Test Lab'));

    // Click delete
    fireEvent.click(screen.getByRole('button', { name: /delete lab/i }));

    expect(mockOnDelete).toHaveBeenCalledWith('lab', 'Test Lab', { id: 'lab-123' });
  });

  it('saves lab with description when provided', () => {
    render(<LabsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/lab name/i), {
      target: { value: 'New Lab' }
    });
    fireEvent.change(screen.getByPlaceholderText(/description/i), {
      target: { value: 'My lab description' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const savedLabs = mockSaveAlchemyLabs.mock.calls[0][0];
    expect(savedLabs[0].description).toBe('My lab description');
  });
});
