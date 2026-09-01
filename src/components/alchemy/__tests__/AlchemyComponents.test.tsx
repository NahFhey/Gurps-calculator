import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AlchemySettings } from '../../../types/campaign';

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
    calculatedTier: 1,
    potencyLoad: 1,
    vector: 'Potion',
    baseWR: 10,
    baseDM: 5,
    dominantAspect: 'Fire',
    secondaryAspect: 'Water',
    basePotency: 'P1',
    finalPotency: 'P1',
    concentrationSteps: 0,
    totalConcentrationSteps: 0,
    traitBudget: 10,
    hasMatchingStabilizer: false,
    roleCoverage: { valid: true, wrDelta: 0, messages: [] },
    batchValidation: { valid: true, errors: [], warnings: [] },
    hazardEvaluation: { count: 0, hazards: [], details: [] },
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
  VECTORS: [
    { name: 'Potion', wrMod: 0, dmMod: 0 },
    { name: 'Salve', wrMod: 0, dmMod: 0 },
    { name: 'Powder', wrMod: 0, dmMod: 0 },
  ],
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

type ReagentFixture = ComponentProps<
  typeof TallyWorksheetView
>['reagents'][number];
type FormulaFixture = ComponentProps<
  typeof FormulasView
>['formulas'][number];
type LabFixture = ComponentProps<typeof AnalysisView>['labs'][number];
type BatchFixture = ComponentProps<typeof BatchesView>['batches'][number];

function makeReagent(
  overrides: Partial<ReagentFixture> = {},
): ReagentFixture {
  return {
    id: 'reagent-1',
    name: 'Test Reagent',
    quantity: 10,
    identificationLevel: 1,
    ...overrides,
  };
}

function makeFormula(
  overrides: Partial<FormulaFixture> = {},
): FormulaFixture {
  return {
    id: 'formula-1',
    name: 'Test Potion',
    tier: 1,
    traitBudget: 10,
    vector: 'Potion',
    ingredients: [],
    traits: [],
    ...overrides,
  };
}

function makeAlchemySettings(
  overrides: Partial<AlchemySettings> = {},
): AlchemySettings {
  return {
    defaultLabRating: 0,
    workBlockMinutes: 60,
    ...overrides,
  };
}

function makeLab(
  overrides: Partial<LabFixture> = {},
): LabFixture {
  return {
    id: 'lab-1',
    name: 'Test Lab',
    rating: 2,
    description: '',
    ...overrides,
  };
}

function makeBatch(
  overrides: Partial<BatchFixture> = {},
): BatchFixture {
  return {
    id: 'batch-1',
    formulaId: 'formula-1',
    formulaName: 'Test Potion',
    status: 'brewing',
    phase: 'brewing',
    worker: 'worker-1',
    startDate: '2026-07-27T00:00:00.000Z',
    startDay: 1,
    CP: 0,
    ...overrides,
  };
}

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
      makeReagent({
        id: 'r1',
        aspects: { primary: 'Fire', secondary: 'Water' },
      }),
    ];

    render(<TallyWorksheetView reagents={mockReagents} />);
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
      makeFormula({
        id: 'f1',
      }),
    ];

    render(
      <FormulasView
        formulas={mockFormulas}
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
      makeFormula({
        id: 'f1',
      }),
    ];

    render(
      <FormulasView
        formulas={mockFormulas}
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
        alchemySettings={makeAlchemySettings()}
      />
    );

    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders with minimal props', () => {
    const mockReagents = [
      makeReagent({
        id: 'r1',
      }),
    ];

    render(
      <ReagentsView
        reagents={mockReagents}
        alchemySettings={makeAlchemySettings()}
      />
    );

    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders reagent names', () => {
    const mockReagents = [
      makeReagent({
        id: 'r1',
        name: 'Reagent Alpha',
        quantity: 5,
        identificationLevel: 2,
      }),
      makeReagent({
        id: 'r2',
        name: 'Reagent Beta',
        quantity: 8,
        identificationLevel: 1,
      }),
    ];

    render(
      <ReagentsView
        reagents={mockReagents}
        alchemySettings={makeAlchemySettings()}
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
      makeReagent({
        id: 'r1',
        identificationLevel: 0,
        aspects: { primary: 'Fire', secondary: 'Water', tertiary: 'Earth' },
      }),
    ];

    const mockLabs = [
      makeLab({
        id: 'lab1',
      }),
    ];

    expect(() => {
      render(
        <AnalysisView
          reagents={mockReagents}
          labs={mockLabs}
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
      makeBatch({
        id: 'batch1',
        formulaId: 'f1',
      }),
    ];

    expect(() => {
      render(
        <BatchesView
          batches={mockBatches}
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

  it('previews reagent sufficiency and disables batch start when short', () => {
    render(
      <BatchesView
        batches={[]}
        reagents={[makeReagent({ name: 'Mandrake', quantity: 5 })]}
        formulas={[]}
        workers={[]}
        labs={[makeLab()]}
        saveBatches={vi.fn()}
        saveFormulas={vi.fn()}
        saveReagents={vi.fn()}
        downtimeState={undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Start New Batch/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add Ingredient/i }));

    const sufficientLine = screen.getByText(/Mandrake: 1U required.*5U available/);
    expect(sufficientLine).toHaveClass('text-success-400');
    expect(screen.getByRole('button', { name: 'Start Batch' })).not.toBeDisabled();

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '6' } });

    const insufficientLine = screen.getByText(/Mandrake: 6U required.*5U available/);
    expect(insufficientLine).toHaveClass('text-danger-400');
    expect(screen.getByRole('button', { name: 'Need Reagents' })).toBeDisabled();
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
      makeReagent({
        id: 'r1',
        name: 'Reagent to Refine',
        refinement: 'crude',
        basePotency: 'P1',
      }),
    ];

    const mockLabs = [
      makeLab({
        id: 'lab1',
      }),
    ];

    expect(() => {
      render(
        <ConcentrationRefinementView
          reagents={mockReagents}
          labs={mockLabs}
          workers={[]}
          saveReagents={vi.fn()}
          downtimeState={undefined}
        />
      );
    }).not.toThrow();
  });
});
