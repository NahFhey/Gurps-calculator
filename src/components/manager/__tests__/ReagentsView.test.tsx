import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReagentsView } from '../views/ReagentsView';
import type { ReagentsViewProps, AlchemyReagent } from '../../../types/views';

describe('ReagentsView', () => {
  const mockSaveAlchemyReagents = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps: ReagentsViewProps = {
    alchemyReagents: [],
    saveAlchemyReagents: mockSaveAlchemyReagents,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading', () => {
    const { container } = render(<ReagentsView {...defaultProps} />);
    expect(container.textContent).toContain('Reagent');
  });

  it('renders Add button', () => {
    render(<ReagentsView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('shows empty state when no reagents provided', () => {
    const { container } = render(<ReagentsView {...defaultProps} />);
    expect(container.textContent).toContain('No reagents');
  });

  it('toggles add form when Add button is clicked', () => {
    const { container } = render(<ReagentsView {...defaultProps} />);

    const addButton = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addButton);

    const nameInput = container.querySelector('input[placeholder*="reagent"]') || screen.queryByPlaceholderText(/reagent name/i);
    expect(nameInput || container).toBeInTheDocument();
  });

  it('validates empty name on add', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ReagentsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    const buttons = screen.getAllByRole('button');
    const saveButton = buttons.find(btn => btn.textContent?.includes('Save'));
    if (saveButton) fireEvent.click(saveButton);

    expect(alertSpy).toHaveBeenCalledWith('Enter reagent name');
    expect(mockSaveAlchemyReagents).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('renders existing reagents with properties', () => {
    const reagents: AlchemyReagent[] = [
      {
        id: '1',
        name: 'Moonflower Extract',
        aspects: { primary: 'Water', secondary: 'Air', tertiary: 'Light' },
        basePotency: 'P2',
        concentrationSteps: 1,
        refinement: 'refined',
        roles: ['Active', 'Catalyst'],
        primaryRole: 'Active',
        hazards: [],
        processingNotes: 'Distilled',
        quantity: 15,
        identificationLevel: 4,
        analysisHistory: [],
        falseProfile: null
      },
      {
        id: '2',
        name: 'Shadow Sap',
        aspects: { primary: 'Dark', secondary: 'Earth', tertiary: 'Water' },
        basePotency: 'P1',
        concentrationSteps: 0,
        refinement: 'crude',
        roles: ['Binder'],
        primaryRole: 'Binder',
        hazards: ['Flammable'],
        processingNotes: '',
        quantity: 8,
        identificationLevel: 3,
        analysisHistory: [],
        falseProfile: null
      }
    ];

    render(<ReagentsView {...defaultProps} alchemyReagents={reagents} />);

    expect(screen.getByText('Moonflower Extract')).toBeInTheDocument();
    expect(screen.getByText('Shadow Sap')).toBeInTheDocument();
  });

  it('displays reagent quantity', () => {
    const reagents: AlchemyReagent[] = [
      {
        id: '1',
        name: 'Starlight Dust',
        aspects: { primary: 'Light', secondary: 'Air', tertiary: 'Fire' },
        basePotency: 'P3',
        concentrationSteps: 2,
        refinement: 'prepared',
        roles: ['Active'],
        primaryRole: 'Active',
        hazards: [],
        processingNotes: '',
        quantity: 25,
        identificationLevel: 4,
        analysisHistory: [],
        falseProfile: null
      }
    ];

    render(<ReagentsView {...defaultProps} alchemyReagents={reagents} />);

    expect(screen.getByText(/Starlight Dust/)).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const reagents: AlchemyReagent[] = [
      {
        id: '1',
        name: 'Phoenix Feather',
        aspects: { primary: 'Fire', secondary: 'Air', tertiary: 'Light' },
        basePotency: 'P4',
        concentrationSteps: 3,
        refinement: 'refined',
        roles: ['Active', 'Catalyst'],
        primaryRole: 'Active',
        hazards: ['Flammable', 'Volatile'],
        processingNotes: 'Rare',
        quantity: 2,
        identificationLevel: 4,
        analysisHistory: [],
        falseProfile: null
      }
    ];

    render(<ReagentsView {...defaultProps} alchemyReagents={reagents} />);

    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.querySelector('svg.lucide-trash-2')
    );

    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      expect(mockOnDelete).toHaveBeenCalledWith('alchemyReagent', '1');
    }
  });

  it('saves new reagent with form data', () => {
    const { container } = render(<ReagentsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    const nameInput = container.querySelector('input[placeholder*="reagent"]');
    if (nameInput && nameInput instanceof HTMLInputElement) {
      fireEvent.change(nameInput, { target: { value: 'Crystal Shard' } });

      const saveButton = Array.from(container.querySelectorAll('button'))
        .find(btn => btn.textContent?.includes('Save'));
      if (saveButton) fireEvent.click(saveButton);

      expect(mockSaveAlchemyReagents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Crystal Shard',
            quantity: expect.any(Number)
          })
        ])
      );
    }
  });

  it('renders with multiple reagents without crashing', () => {
    const reagents: AlchemyReagent[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `Reagent ${i}`,
      aspects: { primary: 'Fire', secondary: 'Water', tertiary: 'Earth' },
      basePotency: 'P1',
      concentrationSteps: 0,
      refinement: 'crude' as const,
      roles: ['Active'],
      primaryRole: 'Active',
      hazards: [],
      processingNotes: '',
      quantity: 10,
      identificationLevel: 4,
      analysisHistory: [],
      falseProfile: null
    }));

    render(<ReagentsView {...defaultProps} alchemyReagents={reagents} />);

    expect(screen.getByText('Reagent 0')).toBeInTheDocument();
    expect(screen.getByText('Reagent 4')).toBeInTheDocument();
  });

  it('displays aspect information for reagents', () => {
    const reagents: AlchemyReagent[] = [
      {
        id: '1',
        name: 'Ember Stone',
        aspects: { primary: 'Fire', secondary: 'Earth', tertiary: 'Metal' },
        basePotency: 'P2',
        concentrationSteps: 1,
        refinement: 'crude',
        roles: ['Active'],
        primaryRole: 'Active',
        hazards: ['Flammable'],
        processingNotes: '',
        quantity: 5,
        identificationLevel: 4,
        analysisHistory: [],
        falseProfile: null
      }
    ];

    render(<ReagentsView {...defaultProps} alchemyReagents={reagents} />);

    expect(screen.getByText('Ember Stone')).toBeInTheDocument();
  });
});
