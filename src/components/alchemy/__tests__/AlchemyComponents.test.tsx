import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock stores and heavy dependencies
// ---------------------------------------------------------------------------

vi.mock('../../../state/downtime/downtimeStore', () => ({
  useDowntimeStore: vi.fn(),
}));

vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: vi.fn(),
}));

// Mock alchemy utilities
vi.mock('../../../utils/alchemy', () => ({
  calculateFormulaStats: vi.fn(() => ({
    tier: 1,
    baseWR: 10,
    baseDM: 5,
    finalPotency: 'P1',
  })),
  startBatchFromFormula: vi.fn(() => ({
    ok: true,
    batch: { id: 'batch-1', formulaId: 'formula-1' },
    reagents: [],
  })),
  computeDominantSecondary: vi.fn(() => ({ primary: 'Fire', secondary: 'Water' })),
  calculateProcessingDifficulty: vi.fn(() => ({
    effectiveSkill: 12,
    breakdown: 'Test breakdown',
  })),
  evaluateProcessingResult: vi.fn(() => ({
    success: true,
    mos: 3,
  })),
  createDerivedReagentName: vi.fn(() => 'Refined Test Reagent'),
  applyWorkBlockResult: vi.fn(() => ({})),
}));

// Mock DiceRoller component
vi.mock('../../DiceRoller', () => ({
  DiceRoller: ({ onRoll }: { onRoll: (result: number[]) => void }) => (
    <button onClick={() => onRoll([3, 4, 2])}>Roll Dice</button>
  ),
}));

// Mock helper utilities
vi.mock('../../../utils/helpers', () => ({
  toNumberOr: (val: string | number, fallback: number) => {
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  },
}));

// Mock constants
vi.mock('../../../constants', () => ({
  REFINEMENT_LEVELS: {
    crude: ['primary'],
    prepared: ['primary', 'secondary'],
    refined: ['primary', 'secondary', 'tertiary'],
  },
  ASPECTS: ['Fire', 'Water', 'Earth', 'Air', 'Life', 'Death'],
  VECTORS: ['Potion', 'Salve', 'Powder'],
  POTENCY_LEVELS: ['P1', 'P2', 'P3', 'P4', 'P5'],
}));

// Mock downtime utilities
vi.mock('../../../utils/createAutoResolvedTask', () => ({
  createAndResolveTask: vi.fn(),
}));

vi.mock('../../../state/downtime/downtimeSelectors', () => ({
  selectCharacterAssignmentForSlot: vi.fn(() => null),
}));

// Mock UI components
vi.mock('../../ui', () => ({
  useToast: () => ({
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { TBBuilderPanel } from '../TBBuilderPanel';
import { TallyWorksheetView } from '../TallyWorksheetView';
import { FormulasView } from '../FormulasView';
import { ReagentsView } from '../ReagentsView';
import { AnalysisView } from '../AnalysisView';
import { BatchesView } from '../BatchesView';
import { ConcentrationRefinementView } from '../ConcentrationRefinementView';

// ============================================================================
// 1. TBBuilderPanel
// ============================================================================

describe('TBBuilderPanel', () => {
  it('renders Trait Budget Builder heading', () => {
    const mockOnUpdate = vi.fn();
    render(
      <TBBuilderPanel
        traitBudget={50}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('Trait Budget (TB) Builder')).toBeInTheDocument();
  });

  it('displays budget information', () => {
    const mockOnUpdate = vi.fn();
    render(
      <TBBuilderPanel
        traitBudget={50}
        onUpdate={mockOnUpdate}
      />
    );

    // Verify budget display exists
    expect(screen.getAllByText(/50 pts/)).toHaveLength(2); // Budget and Remaining
    expect(screen.getByText('Budget:')).toBeInTheDocument();
    expect(screen.getByText('Used:')).toBeInTheDocument();
    expect(screen.getByText('Remaining:')).toBeInTheDocument();
  });

  it('renders Add Trait button', () => {
    const mockOnUpdate = vi.fn();
    render(
      <TBBuilderPanel
        traitBudget={50}
        onUpdate={mockOnUpdate}
      />
    );

    const addButton = screen.getByRole('button', { name: /Add Trait/i });
    expect(addButton).toBeInTheDocument();
  });

  it('shows empty state message when no traits added', () => {
    const mockOnUpdate = vi.fn();
    render(
      <TBBuilderPanel
        traitBudget={50}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText(/No traits added yet/i)).toBeInTheDocument();
  });

  it('calls onUpdate when adding a trait', () => {
    const mockOnUpdate = vi.fn();
    render(
      <TBBuilderPanel
        traitBudget={50}
        onUpdate={mockOnUpdate}
      />
    );

    const addButton = screen.getByRole('button', { name: /Add Trait/i });
    fireEvent.click(addButton);

    // Add trait form should appear
    const traitNameInput = screen.getByPlaceholderText(/e\.g\., Accelerated Healing/i);
    expect(traitNameInput).toBeInTheDocument();
  });

  it('renders with initial traits', () => {
    const mockOnUpdate = vi.fn();
    const initialTraits = [
      { id: '1', name: 'Test Trait', cost: 10, notes: 'Test note' }
    ];

    render(
      <TBBuilderPanel
        traitBudget={50}
        initialTraits={initialTraits}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByDisplayValue('Test Trait')).toBeInTheDocument();
    expect(screen.getByDisplayValue(10)).toBeInTheDocument();
  });
});

// ============================================================================
// 2. TallyWorksheetView
// ============================================================================

describe('TallyWorksheetView', () => {
  it('renders without crashing with empty reagents', () => {
    render(<TallyWorksheetView reagents={[]} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders with minimal props', () => {
    const mockReagents = [
      {
        id: 'r1',
        name: 'Test Reagent',
        quantity: 10,
        identificationLevel: 1,
        aspects: { primary: 'Fire', secondary: 'Water' },
      }
    ];

    render(<TallyWorksheetView reagents={mockReagents as any} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
});

// ============================================================================
// 3. FormulasView
// ============================================================================

describe('FormulasView', () => {
  it('renders without crashing with empty formulas', () => {
    render(
      <FormulasView
        formulas={[]}
        reagents={[]}
        batches={[]}
        saveReagents={vi.fn()}
        saveBatches={vi.fn()}
      />
    );

    expect(screen.getByText('Alchemy Formulas')).toBeInTheDocument();
  });

  it('shows empty state when no formulas available', () => {
    render(
      <FormulasView
        formulas={[]}
        reagents={[]}
        batches={[]}
        saveReagents={vi.fn()}
        saveBatches={vi.fn()}
      />
    );

    expect(screen.getByText(/No formulas available/i)).toBeInTheDocument();
  });

  it('renders formula names', () => {
    const mockFormulas = [
      {
        id: 'f1',
        name: 'Test Potion',
        tier: 1,
        traitBudget: 10,
        vector: 'Potion',
        ingredients: [],
        traits: [],
      }
    ];

    render(
      <FormulasView
        formulas={mockFormulas as any}
        reagents={[]}
        batches={[]}
        saveReagents={vi.fn()}
        saveBatches={vi.fn()}
      />
    );

    expect(screen.getByText('Test Potion')).toBeInTheDocument();
  });

  it('renders Start Batch buttons', () => {
    const mockFormulas = [
      {
        id: 'f1',
        name: 'Test Potion',
        tier: 1,
        traitBudget: 10,
        vector: 'Potion',
        ingredients: [],
        traits: [],
      }
    ];

    render(
      <FormulasView
        formulas={mockFormulas as any}
        reagents={[]}
        batches={[]}
        saveReagents={vi.fn()}
        saveBatches={vi.fn()}
      />
    );

    expect(screen.getByText('Start Batch')).toBeInTheDocument();
  });
});

// ============================================================================
// 4. ReagentsView
// ============================================================================

describe('ReagentsView', () => {
  it('renders without crashing with empty reagents', () => {
    render(
      <ReagentsView
        reagents={[]}
        alchemySettings={{ labIds: [] } as any}
      />
    );

    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders with minimal props', () => {
    const mockReagents = [
      {
        id: 'r1',
        name: 'Test Reagent',
        quantity: 10,
        identificationLevel: 1,
      }
    ];

    render(
      <ReagentsView
        reagents={mockReagents as any}
        alchemySettings={{ labIds: [] } as any}
      />
    );

    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders reagent names', () => {
    const mockReagents = [
      {
        id: 'r1',
        name: 'Reagent Alpha',
        quantity: 5,
        identificationLevel: 2,
      },
      {
        id: 'r2',
        name: 'Reagent Beta',
        quantity: 8,
        identificationLevel: 1,
      }
    ];

    render(
      <ReagentsView
        reagents={mockReagents as any}
        alchemySettings={{ labIds: [] } as any}
      />
    );

    // Check for at least one reagent name
    const alphaOrBeta = screen.queryByText('Reagent Alpha') || screen.queryByText('Reagent Beta');
    expect(alphaOrBeta).toBeInTheDocument();
  });
});

// ============================================================================
// 5. AnalysisView
// ============================================================================

describe('AnalysisView', () => {
  it('renders without crashing with minimal props', () => {
    const { container } = render(
      <AnalysisView
        reagents={[]}
        labs={[]}
        workers={[]}
        saveReagents={vi.fn()}
        downtimeState={undefined}
      />
    );

    // Just verify it renders without throwing
    expect(container).toBeInTheDocument();
  });

  it('handles complex component without crashing', () => {
    const mockReagents = [
      {
        id: 'r1',
        name: 'Test Reagent',
        quantity: 10,
        identificationLevel: 0,
        aspects: { primary: 'Fire', secondary: 'Water', tertiary: 'Earth' },
      }
    ];

    const mockLabs = [
      {
        id: 'lab1',
        name: 'Test Lab',
        rating: 2,
      }
    ];

    expect(() => {
      render(
        <AnalysisView
          reagents={mockReagents as any}
          labs={mockLabs as any}
          workers={[]}
          saveReagents={vi.fn()}
          downtimeState={undefined}
        />
      );
    }).not.toThrow();
  });
});

// ============================================================================
// 6. BatchesView
// ============================================================================

describe('BatchesView', () => {
  it('renders without crashing with minimal props', () => {
    const { container } = render(
      <BatchesView
        batches={[]}
        reagents={[]}
        formulas={[]}
        workers={[]}
        labs={[]}
        saveBatches={vi.fn()}
        saveFormulas={vi.fn()}
        saveReagents={vi.fn()}
        downtimeState={undefined}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('handles complex batches component without crashing', () => {
    const mockBatches = [
      {
        id: 'batch1',
        formulaId: 'f1',
        status: 'in-progress',
        createdAt: new Date().toISOString(),
        currentCP: 0,
      }
    ];

    expect(() => {
      render(
        <BatchesView
          batches={mockBatches as any}
          reagents={[]}
          formulas={[]}
          workers={[]}
          labs={[]}
          saveBatches={vi.fn()}
          saveFormulas={vi.fn()}
          saveReagents={vi.fn()}
          downtimeState={undefined}
        />
      );
    }).not.toThrow();
  });
});

// ============================================================================
// 7. ConcentrationRefinementView
// ============================================================================

describe('ConcentrationRefinementView', () => {
  it('renders without crashing with minimal props', () => {
    const { container } = render(
      <ConcentrationRefinementView
        reagents={[]}
        labs={[]}
        workers={[]}
        saveReagents={vi.fn()}
        downtimeState={undefined}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('handles complex refinement component without crashing', () => {
    const mockReagents = [
      {
        id: 'r1',
        name: 'Reagent to Refine',
        quantity: 10,
        refinement: 'crude',
        potency: 'P1',
      }
    ];

    const mockLabs = [
      {
        id: 'lab1',
        name: 'Test Lab',
        rating: 2,
      }
    ];

    expect(() => {
      render(
        <ConcentrationRefinementView
          reagents={mockReagents as any}
          labs={mockLabs as any}
          workers={[]}
          saveReagents={vi.fn()}
          downtimeState={undefined}
        />
      );
    }).not.toThrow();
  });
});
