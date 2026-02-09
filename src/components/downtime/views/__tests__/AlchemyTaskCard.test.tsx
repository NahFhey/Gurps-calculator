import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlchemyTaskCard } from '../AlchemyTaskCard';
import type { DowntimeTask, AlchemyData, TaskResults } from '../../../../types/downtime';
import type { Character, AlchemyBatch, AlchemyFormula } from '../../../../types/campaign';

// Helper to create an alchemy task
function createAlchemyTask(
  overrides: Partial<DowntimeTask> = {}
): DowntimeTask {
  const now = Date.now();
  return {
    id: 'task-1',
    activityType: 'alchemy',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    status: 'pending',
    activityData: {
      type: 'alchemy',
      recipeId: 'formula-healing',
      formulaId: 'batch-1',
      reagentIds: [],
      toolIds: ['lab-1'],
      batchSize: 1,
      aspectModifiers: {
        skill: 2,
        lab: 1,
        helpers: 1,
      },
    } as AlchemyData,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

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
    formulaId: 'formula-healing',
    status: 'brewing',
    worker: 'Aldric',
    labId: 'lab-1',
    startDate: '2024-01-01',
    startDay: 1,
    // Extended properties
    formulaName: 'Healing Potion',
    PP: 5,
    WR: 10,
    CP: 0,
  } as AlchemyBatch & { formulaName: string; PP: number; WR: number; CP: number },
];

const mockFormulas: AlchemyFormula[] = [
  {
    id: 'formula-healing',
    name: 'Healing Potion',
    reagents: [],
    skill: 'Alchemy',
    difficulty: 0,
    brewTime: 60,
    effects: 'Heals 1d HP',
  },
];

const defaultProps = {
  batches: mockBatches,
  formulas: mockFormulas,
  characters: mockCharacters,
};

describe('AlchemyTaskCard', () => {
  describe('rendering', () => {
    it('renders task with batch name', () => {
      const task = createAlchemyTask();
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Alchemy: Healing Potion/)).toBeInTheDocument();
    });

    it('renders alchemist name', () => {
      const task = createAlchemyTask();
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Aldric/)).toBeInTheDocument();
    });

    it('renders assistants when present', () => {
      const task = createAlchemyTask({
        helperIds: ['char-2'],
      });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Assistants:/)).toBeInTheDocument();
      expect(screen.getByText(/Brina/)).toBeInTheDocument();
    });

    it('does not render assistants section when empty', () => {
      const task = createAlchemyTask();
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.queryByText(/Assistants:/)).not.toBeInTheDocument();
    });

    it('renders batch progress', () => {
      const task = createAlchemyTask();
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/5\/10 PP/)).toBeInTheDocument();
    });

    it('renders skill modifier', () => {
      const task = createAlchemyTask();
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });
  });

  describe('status badge', () => {
    it('shows pending status', () => {
      const task = createAlchemyTask({ status: 'pending' });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Pending');
    });

    it('shows in_progress status', () => {
      const task = createAlchemyTask({ status: 'in_progress' });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('In Progress');
    });

    it('shows resolved status', () => {
      const task = createAlchemyTask({
        status: 'resolved',
        results: {
          success: true,
          message: 'Work block completed!',
        },
      });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Resolved');
    });

    it('shows cancelled status', () => {
      const task = createAlchemyTask({ status: 'cancelled' });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Cancelled');
    });
  });

  describe('action buttons', () => {
    it('shows resolve and cancel buttons for pending task', () => {
      const task = createAlchemyTask({ status: 'pending' });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByTestId('resolve-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    it('hides action buttons when readonly', () => {
      const task = createAlchemyTask({ status: 'pending' });
      render(<AlchemyTaskCard task={task} {...defaultProps} readonly />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });

    it('hides action buttons for resolved task', () => {
      const task = createAlchemyTask({
        status: 'resolved',
        results: { success: true, message: 'Done!' },
      });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
    });

    it('hides action buttons for cancelled task', () => {
      const task = createAlchemyTask({ status: 'cancelled' });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
    });

    it('calls onResolve when resolve button clicked', () => {
      const onResolve = vi.fn();
      const task = createAlchemyTask({ status: 'pending' });
      render(
        <AlchemyTaskCard task={task} {...defaultProps} onResolve={onResolve} />
      );

      fireEvent.click(screen.getByTestId('resolve-button'));
      expect(onResolve).toHaveBeenCalled();
    });

    it('calls onCancel when cancel button clicked', () => {
      const onCancel = vi.fn();
      const task = createAlchemyTask({ status: 'pending' });
      render(
        <AlchemyTaskCard task={task} {...defaultProps} onCancel={onCancel} />
      );

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('results display', () => {
    it('shows success results', () => {
      const results: TaskResults = {
        success: true,
        message: 'Work block completed! Added 3 PP.',
        inventoryChanges: [],
        experienceGained: 10,
      };
      const task = createAlchemyTask({ status: 'resolved', results });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByTestId('task-results')).toBeInTheDocument();
      expect(screen.getByText('Work block completed! Added 3 PP.')).toBeInTheDocument();
      expect(screen.getByText('+10 XP')).toBeInTheDocument();
    });

    it('shows batch completion results with inventory changes', () => {
      const results: TaskResults = {
        success: true,
        message: 'Batch complete! Healing Potion finished.',
        inventoryChanges: [
          { itemId: 'formula-healing', quantity: 1, itemName: 'Healing Potion' },
        ],
        experienceGained: 25,
      };
      const task = createAlchemyTask({ status: 'resolved', results });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText('Batch complete! Healing Potion finished.')).toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.getByText('+25 XP')).toBeInTheDocument();
    });

    it('shows failure results', () => {
      const results: TaskResults = {
        success: false,
        message: 'Work block had issues. Contamination increased.',
      };
      const task = createAlchemyTask({ status: 'resolved', results });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText('Work block had issues. Contamination increased.')).toBeInTheDocument();
    });

    it('shows cancelled message for cancelled task', () => {
      const task = createAlchemyTask({ status: 'cancelled' });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText('Work session was cancelled')).toBeInTheDocument();
    });
  });

  describe('data attributes', () => {
    it('has correct data-testid', () => {
      const task = createAlchemyTask();
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      expect(screen.getByTestId('alchemy-task-card')).toBeInTheDocument();
    });

    it('has task-id data attribute', () => {
      const task = createAlchemyTask({ id: 'task-123' });
      render(<AlchemyTaskCard task={task} {...defaultProps} />);

      const card = screen.getByTestId('alchemy-task-card');
      expect(card).toHaveAttribute('data-task-id', 'task-123');
    });
  });
});
