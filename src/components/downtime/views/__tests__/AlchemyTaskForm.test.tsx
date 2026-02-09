import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlchemyTaskForm } from '../AlchemyTaskForm';
import { downtimeInitialState } from '../../../../state/downtime/downtimeInitialState';
import type {
  Character,
  AlchemyReagent,
  AlchemyFormula,
  AlchemyBatch,
  AlchemyLab,
  GatheringTool,
} from '../../../../types/campaign';

// Mock data
const mockCharacters: Character[] = [
  {
    id: 'char-1',
    name: 'Aldric',
    st: 10,
    work: {
      enabled: true,
      skills: { alchemy: 14 },
    },
  },
  {
    id: 'char-2',
    name: 'Brina',
    st: 12,
    work: {
      enabled: true,
      skills: { alchemy: 12 },
    },
  },
];

const mockBatches: AlchemyBatch[] = [
  {
    id: 'batch-1',
    formulaId: 'formula-1',
    status: 'brewing',
    worker: 'Aldric',
    labId: 'lab-1',
    startDate: '2024-01-01',
    startDay: 1,
    // Extended properties for BatchesView compatibility
    formulaName: 'Healing Potion',
    PP: 5,
    WR: 10,
    CP: 0,
    dominantAspect: 'Vital',
    tier: 1,
  } as AlchemyBatch & { formulaName: string; PP: number; WR: number; CP: number; dominantAspect: string; tier: number },
  {
    id: 'batch-2',
    formulaId: 'formula-2',
    status: 'brewing',
    worker: 'Brina',
    labId: 'lab-1',
    startDate: '2024-01-01',
    startDay: 1,
    formulaName: 'Mana Elixir',
    PP: 2,
    WR: 15,
    CP: 1,
    dominantAspect: 'Light',
    tier: 2,
  } as AlchemyBatch & { formulaName: string; PP: number; WR: number; CP: number; dominantAspect: string; tier: number },
];

const mockFormulas: AlchemyFormula[] = [
  {
    id: 'formula-1',
    name: 'Healing Potion',
    reagents: [{ reagentId: 'reagent-1', amount: 2 }],
    skill: 'Alchemy',
    difficulty: 0,
    brewTime: 60,
    effects: 'Heals 1d HP',
  },
];

const mockReagents: AlchemyReagent[] = [
  {
    id: 'reagent-1',
    name: 'Healing Herb',
    quantity: 10,
    effectFamily: 'Healing',
    potency: 1,
  },
];

const mockLabs: AlchemyLab[] = [
  {
    id: 'lab-1',
    name: 'Basic Lab',
    rating: 1,
    description: 'A simple alchemy lab',
  },
  {
    id: 'lab-2',
    name: 'Advanced Lab',
    rating: 3,
    description: 'A well-equipped alchemy lab',
  },
];

const mockTools: GatheringTool[] = [];

describe('AlchemyTaskForm', () => {
  const defaultProps = {
    characters: mockCharacters,
    batches: mockBatches,
    formulas: mockFormulas,
    reagents: mockReagents,
    labs: mockLabs,
    tools: mockTools,
    state: downtimeInitialState,
    currentDayKey: 1,
    currentSlot: 0,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders form title', () => {
      render(<AlchemyTaskForm {...defaultProps} />);
      expect(screen.getByText('New Work Session')).toBeInTheDocument();
    });

    it('renders worker select with characters', () => {
      render(<AlchemyTaskForm {...defaultProps} />);

      const leaderSelect = screen.getByTestId('leader-select');
      expect(leaderSelect).toBeInTheDocument();

      const options = leaderSelect.querySelectorAll('option');
      expect(options.length).toBe(3); // "Select worker..." + 2 characters
      expect(options[1]).toHaveTextContent('Aldric');
      expect(options[2]).toHaveTextContent('Brina');
    });

    it('renders batch select with active batches', () => {
      render(<AlchemyTaskForm {...defaultProps} />);

      const batchSelect = screen.getByTestId('batch-select');
      expect(batchSelect).toBeInTheDocument();

      const options = batchSelect.querySelectorAll('option');
      expect(options.length).toBe(3); // "Select batch..." + 2 batches
    });

    it('renders lab select with labs', () => {
      render(<AlchemyTaskForm {...defaultProps} />);

      const labSelect = screen.getByTestId('lab-select');
      expect(labSelect).toBeInTheDocument();
    });

    it('renders submit and cancel buttons', () => {
      render(<AlchemyTaskForm {...defaultProps} />);

      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<AlchemyTaskForm {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('submit button is disabled when required fields are empty', () => {
      render(<AlchemyTaskForm {...defaultProps} />);

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when required fields are filled', () => {
      render(<AlchemyTaskForm {...defaultProps} />);

      // Fill required fields
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('batch-select'), {
        target: { value: 'batch-1' },
      });

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).not.toBeDisabled();
    });

    it('calls onSubmit with correct data when form is submitted', () => {
      const onSubmit = vi.fn();
      render(<AlchemyTaskForm {...defaultProps} onSubmit={onSubmit} />);

      // Fill required fields
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('batch-select'), {
        target: { value: 'batch-1' },
      });

      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      expect(onSubmit).toHaveBeenCalledWith({
        leaderId: 'char-1',
        helperIds: [],
        activityData: expect.objectContaining({
          type: 'alchemy',
          formulaId: 'batch-1',
        }),
      });
    });
  });

  describe('batch details display', () => {
    it('shows batch details when batch is selected', () => {
      render(<AlchemyTaskForm {...defaultProps} />);

      // Select a batch
      fireEvent.change(screen.getByTestId('batch-select'), {
        target: { value: 'batch-1' },
      });

      expect(screen.getByTestId('batch-details')).toBeInTheDocument();
      expect(screen.getByText(/Progress:/)).toBeInTheDocument();
    });
  });

  describe('skill modifier calculation', () => {
    it('shows skill modifier summary', () => {
      render(<AlchemyTaskForm {...defaultProps} />);
      expect(screen.getByText(/Total Skill Modifier:/)).toBeInTheDocument();
    });

    it('updates modifier when lab is selected', () => {
      render(<AlchemyTaskForm {...defaultProps} />);

      // Select advanced lab
      fireEvent.change(screen.getByTestId('lab-select'), {
        target: { value: 'lab-2' },
      });

      // Check that Lab +3 is shown somewhere
      expect(screen.getByText(/Lab: \+3/)).toBeInTheDocument();
    });
  });

  describe('character availability', () => {
    it('shows message when no characters are available', () => {
      render(<AlchemyTaskForm {...defaultProps} characters={[]} />);
      expect(
        screen.getByText('All characters are already assigned to tasks in this slot')
      ).toBeInTheDocument();
    });

    it('shows no available helpers message when only one character exists', () => {
      render(
        <AlchemyTaskForm {...defaultProps} characters={[mockCharacters[0]]} />
      );

      // Select the only character as leader
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });

      expect(screen.getByText('No available helpers')).toBeInTheDocument();
    });
  });

  describe('batch availability', () => {
    it('shows no batches message when none available', () => {
      render(<AlchemyTaskForm {...defaultProps} batches={[]} />);
      expect(screen.getByText(/No active batches/)).toBeInTheDocument();
    });
  });
});
