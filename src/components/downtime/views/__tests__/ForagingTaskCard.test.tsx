import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForagingTaskCard } from '../ForagingTaskCard';
import type { DowntimeTask, ForagingData, TaskResults } from '../../../../types/downtime';
import type { Character, GatheringSpecies, GatheringEnvironment } from '../../../../types/campaign';

// Helper to create a foraging task
function createForagingTask(
  overrides: Partial<DowntimeTask> = {}
): DowntimeTask {
  const now = Date.now();
  return {
    id: 'task-1',
    activityType: 'foraging',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    status: 'pending',
    activityData: {
      type: 'foraging',
      nodeId: 'node-berries',
      biomeId: 'biome-forest',
      tableId: '',
      toolIds: ['tool-basket'],
      skillModifier: 2,
    } as ForagingData,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const mockCharacters: Character[] = [
  {
    id: 'char-1',
    name: 'Aldric',
    hp: { current: 10, max: 10 },
    fp: { current: 10, max: 10 },
    speed: 5,
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    skills: {},
    advantages: [],
    disadvantages: [],
    equipment: [],
  },
  {
    id: 'char-2',
    name: 'Brina',
    hp: { current: 12, max: 12 },
    fp: { current: 12, max: 12 },
    speed: 5,
    st: 12,
    dx: 10,
    iq: 10,
    ht: 12,
    skills: {},
    advantages: [],
    disadvantages: [],
    equipment: [],
  },
];

const mockBiomes: GatheringEnvironment[] = [
  {
    id: 'biome-forest',
    name: 'Forest',
    description: 'Dense woodland',
    species: ['node-berries'],
  },
];

const mockNodes: GatheringSpecies[] = [
  {
    id: 'node-berries',
    name: 'Wild Berries',
    category: 'plant',
    baseYield: 5,
    skill: 'Naturalist',
    difficulty: 0,
    environments: ['biome-forest'],
  },
];

const defaultProps = {
  nodes: mockNodes,
  biomes: mockBiomes,
  characters: mockCharacters,
};

describe('ForagingTaskCard', () => {
  describe('rendering', () => {
    it('renders task with node name', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Foraging: Wild Berries/)).toBeInTheDocument();
    });

    it('renders leader name', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Aldric/)).toBeInTheDocument();
    });

    it('renders helpers when present', () => {
      const task = createForagingTask({
        helperIds: ['char-2'],
      });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Helpers:/)).toBeInTheDocument();
      expect(screen.getByText(/Brina/)).toBeInTheDocument();
    });

    it('does not render helpers section when empty', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.queryByText(/Helpers:/)).not.toBeInTheDocument();
    });

    it('renders biome name', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Forest/)).toBeInTheDocument();
    });

    it('renders skill modifier', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });
  });

  describe('status badge', () => {
    it('shows pending status', () => {
      const task = createForagingTask({ status: 'pending' });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Pending');
    });

    it('shows in_progress status', () => {
      const task = createForagingTask({ status: 'in_progress' });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('In Progress');
    });

    it('shows resolved status', () => {
      const task = createForagingTask({
        status: 'resolved',
        results: {
          success: true,
          message: 'Gathered 8 berries!',
        },
      });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Resolved');
    });

    it('shows cancelled status', () => {
      const task = createForagingTask({ status: 'cancelled' });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Cancelled');
    });
  });

  describe('action buttons', () => {
    it('shows resolve and cancel buttons for pending task', () => {
      const task = createForagingTask({ status: 'pending' });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByTestId('resolve-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    it('hides action buttons when readonly', () => {
      const task = createForagingTask({ status: 'pending' });
      render(<ForagingTaskCard task={task} {...defaultProps} readonly />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });

    it('hides action buttons for resolved task', () => {
      const task = createForagingTask({
        status: 'resolved',
        results: { success: true, message: 'Done!' },
      });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
    });

    it('hides action buttons for cancelled task', () => {
      const task = createForagingTask({ status: 'cancelled' });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
    });

    it('calls onResolve when resolve button clicked', () => {
      const onResolve = vi.fn();
      const task = createForagingTask({ status: 'pending' });
      render(
        <ForagingTaskCard task={task} {...defaultProps} onResolve={onResolve} />
      );

      fireEvent.click(screen.getByTestId('resolve-button'));
      expect(onResolve).toHaveBeenCalled();
    });

    it('calls onCancel when cancel button clicked', () => {
      const onCancel = vi.fn();
      const task = createForagingTask({ status: 'pending' });
      render(
        <ForagingTaskCard task={task} {...defaultProps} onCancel={onCancel} />
      );

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('results display', () => {
    it('shows success results', () => {
      const results: TaskResults = {
        success: true,
        message: 'Gathered 8 berries!',
        inventoryChanges: [
          { itemId: 'node-berries', quantity: 8, itemName: 'Wild Berries' },
        ],
        experienceGained: 30,
      };
      const task = createForagingTask({ status: 'resolved', results });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByTestId('task-results')).toBeInTheDocument();
      expect(screen.getByText('Gathered 8 berries!')).toBeInTheDocument();
      expect(screen.getByText('+8')).toBeInTheDocument();
      expect(screen.getByText('+30 XP')).toBeInTheDocument();
    });

    it('shows failure results', () => {
      const results: TaskResults = {
        success: false,
        message: 'Could not find any berries.',
      };
      const task = createForagingTask({ status: 'resolved', results });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText('Could not find any berries.')).toBeInTheDocument();
    });

    it('shows cancelled message for cancelled task', () => {
      const task = createForagingTask({ status: 'cancelled' });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText('Task was cancelled')).toBeInTheDocument();
    });
  });

  describe('data attributes', () => {
    it('has correct data-testid', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByTestId('foraging-task-card')).toBeInTheDocument();
    });

    it('has task-id data attribute', () => {
      const task = createForagingTask({ id: 'task-123' });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      const card = screen.getByTestId('foraging-task-card');
      expect(card).toHaveAttribute('data-task-id', 'task-123');
    });
  });
});
