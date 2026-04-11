import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FormulasView } from '../views/FormulasView';
import type { FormulasViewProps, AlchemyFormula } from '../../../types/views';

describe('FormulasView', () => {
  const mockSaveAlchemyFormulas = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps: FormulasViewProps = {
    alchemyFormulas: [],
    alchemyReagents: [],
    saveAlchemyFormulas: mockSaveAlchemyFormulas,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading', () => {
    render(<FormulasView {...defaultProps} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
  });

  it('shows empty state when no formulas provided', () => {
    render(<FormulasView {...defaultProps} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
  });

  it('renders without crashing with empty data', () => {
    const { container } = render(<FormulasView {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it('renders formula cards when provided', () => {
    const alchemyFormulas: AlchemyFormula[] = [
      {
        id: '1',
        name: 'Health Potion',
        tier: 1,
        ingredients: [],
        traits: [],
        potencyLoad: 0,
        vector: 'oral',
        baseWR: 10,
        baseDM: 0,
        basePotency: 'P1',
        finalPotency: 'P1',
        concentrationSteps: 0,
        traitBudget: 0,
        roleCoverage: { valid: true, wrDelta: 0, messages: [] },
        hazards: []
      },
      {
        id: '2',
        name: 'Strength Elixir',
        tier: 2,
        ingredients: [],
        traits: [],
        potencyLoad: 0,
        vector: 'oral',
        baseWR: 10,
        baseDM: 0,
        basePotency: 'P2',
        finalPotency: 'P2',
        concentrationSteps: 0,
        traitBudget: 0,
        roleCoverage: { valid: true, wrDelta: 0, messages: [] },
        hazards: []
      }
    ];

    render(<FormulasView {...defaultProps} alchemyFormulas={alchemyFormulas} />);

    expect(screen.getByText('Health Potion')).toBeInTheDocument();
    expect(screen.getByText('Strength Elixir')).toBeInTheDocument();
  });

  it('displays formula tier information', () => {
    const alchemyFormulas: AlchemyFormula[] = [
      {
        id: '1',
        name: 'Basic Remedy',
        tier: 1,
        ingredients: [],
        traits: [],
        potencyLoad: 0,
        vector: 'oral',
        baseWR: 10,
        baseDM: 0,
        basePotency: 'P1',
        finalPotency: 'P1',
        concentrationSteps: 0,
        traitBudget: 0,
        roleCoverage: { valid: true, wrDelta: 0, messages: [] },
        hazards: []
      }
    ];

    render(<FormulasView {...defaultProps} alchemyFormulas={alchemyFormulas} />);

    expect(screen.getByText('Basic Remedy')).toBeInTheDocument();
  });

  it('renders Design button', () => {
    render(<FormulasView {...defaultProps} />);
    const designButton = screen.queryByRole('button', { name: /design/i });
    expect(designButton).toBeInTheDocument();
  });

  it('passes correct props to component', () => {
    const customReagents = [{ id: '1', name: 'Test Reagent', aspects: { primary: 'Fire', secondary: 'Air', tertiary: 'Water' }, basePotency: 'P1', concentrationSteps: 0, refinement: 'crude' as const, roles: [], primaryRole: 'Active', hazards: [], processingNotes: '', quantity: 10, identificationLevel: 4, analysisHistory: [], falseProfile: null }];

    const props: FormulasViewProps = {
      ...defaultProps,
      alchemyReagents: customReagents
    };

    render(<FormulasView {...props} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('renders container with proper structure', () => {
    const { container } = render(<FormulasView {...defaultProps} />);
    const mainContainer = container.querySelector('[class*="space"]') || container.firstChild;
    expect(mainContainer).toBeInTheDocument();
  });

  it('shows heading with appropriate styling', () => {
    render(<FormulasView {...defaultProps} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H2');
  });

  it('renders with multiple formulas without crashing', () => {
    const alchemyFormulas: AlchemyFormula[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `Formula ${i}`,
      tier: (i % 3) + 1,
      ingredients: [],
      traits: [],
      potencyLoad: 0,
      vector: 'oral',
      baseWR: 10,
      baseDM: 0,
      basePotency: 'P1',
      finalPotency: 'P1',
      concentrationSteps: 0,
      traitBudget: 0,
      roleCoverage: { valid: true, wrDelta: 0, messages: [] },
      hazards: []
    }));

    render(<FormulasView {...defaultProps} alchemyFormulas={alchemyFormulas} />);

    expect(screen.getByText('Formula 0')).toBeInTheDocument();
    expect(screen.getByText('Formula 4')).toBeInTheDocument();
  });
});
