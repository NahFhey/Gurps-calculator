import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FishingTaskCard } from '../FishingTaskCard';
import type { DowntimeTask, FishingData, TaskResults } from '../../../../types/downtime';
import type { Character, GatheringSpecies, GatheringEnvironment } from '../../../../types/campaign';

// Helper to create a fishing task
function createFishingTask(
  overrides: Partial<DowntimeTask> = {}
): DowntimeTask {
  const now = Date.now();
  return {
    id: 'task-1',
    activityType: 'fishing',
    dayKey: 1,
    slot: 0,
    leaderId: 'char-1',
    helperIds: [],
    status: 'pending',
    activityData: {
      type: 'fishing',
      speciesId: 'species-trout',
      spotId: 'spot-river',
      toolIds: ['tool-rod'],
      skillModifier: 2,
      targetYield: 3,
    } as FishingData,
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

const mockSpots: GatheringEnvironment[] = [
  {
    id: 'spot-river',
    name: 'River Bank',
    supportedModes: ['Fishing'],
    defaultsByMode: {},
    skillMod: 0,
  },
];

const mockSpecies: GatheringSpecies[] = [
  {
    id: 'species-trout',
    name: 'Trout',
    type: 'fish',
    tags: [],
    foodType: 'fish',
    yieldMeatFormula: '1d6',
    secondaryMaterialType: null,
    yieldSecondaryFormula: null,
    secondaryNameOverride: null,
    st: null,
    specialRules: [],
  },
];

const defaultProps = {
  species: mockSpecies,
  spots: mockSpots,
  characters: mockCharacters,
};

describe('FishingTaskCard', () => {
  describe('rendering', () => {
    it('renders task with species name', () => {
      const task = createFishingTask();
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Fishing: Trout/)).toBeInTheDocument();
    });

    it('renders leader name', () => {
      const task = createFishingTask();
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Aldric/)).toBeInTheDocument();
    });

    it('renders helpers when present', () => {
      const task = createFishingTask({
        helperIds: ['char-2'],
      });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Helpers:/)).toBeInTheDocument();
      expect(screen.getByText(/Brina/)).toBeInTheDocument();
    });

    it('does not render helpers section when empty', () => {
      const task = createFishingTask();
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.queryByText(/Helpers:/)).not.toBeInTheDocument();
    });

    it('renders spot name', () => {
      const task = createFishingTask();
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/River Bank/)).toBeInTheDocument();
    });

    it('renders skill modifier', () => {
      const task = createFishingTask();
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });

    it('renders target yield', () => {
      const task = createFishingTask();
      render(<FishingTaskCard task={task} {...defaultProps} />);

      // Check for target yield label and value separately since they're in different elements
      expect(screen.getByText('Target Yield:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('status badge', () => {
    it('shows pending status', () => {
      const task = createFishingTask({ status: 'pending' });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Pending');
    });

    it('shows in_progress status', () => {
      const task = createFishingTask({ status: 'in_progress' });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('In Progress');
    });

    it('shows resolved status', () => {
      const task = createFishingTask({
        status: 'resolved',
        results: {
          success: true,
          message: 'Caught 5 trout!',
        },
      });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Resolved');
    });

    it('shows cancelled status', () => {
      const task = createFishingTask({ status: 'cancelled' });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Cancelled');
    });
  });

  describe('action buttons', () => {
    it('shows resolve and cancel buttons for pending task', () => {
      const task = createFishingTask({ status: 'pending' });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByTestId('resolve-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    it('hides action buttons when readonly', () => {
      const task = createFishingTask({ status: 'pending' });
      render(<FishingTaskCard task={task} {...defaultProps} readonly />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });

    it('hides action buttons for resolved task', () => {
      const task = createFishingTask({
        status: 'resolved',
        results: { success: true, message: 'Done!' },
      });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
    });

    it('hides action buttons for cancelled task', () => {
      const task = createFishingTask({ status: 'cancelled' });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
    });

    it('calls onResolve when resolve button clicked', () => {
      const onResolve = vi.fn();
      const task = createFishingTask({ status: 'pending' });
      render(
        <FishingTaskCard task={task} {...defaultProps} onResolve={onResolve} />
      );

      fireEvent.click(screen.getByTestId('resolve-button'));
      expect(onResolve).toHaveBeenCalled();
    });

    it('calls onCancel when cancel button clicked', () => {
      const onCancel = vi.fn();
      const task = createFishingTask({ status: 'pending' });
      render(
        <FishingTaskCard task={task} {...defaultProps} onCancel={onCancel} />
      );

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('results display', () => {
    it('shows success results', () => {
      const results: TaskResults = {
        success: true,
        message: 'Caught 5 trout!',
        inventoryChanges: [
          { itemId: 'species-trout', quantity: 5, itemName: 'Trout' },
        ],
        experienceGained: 50,
      };
      const task = createFishingTask({ status: 'resolved', results });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByTestId('task-results')).toBeInTheDocument();
      expect(screen.getByText('Caught 5 trout!')).toBeInTheDocument();
      expect(screen.getByText('+5')).toBeInTheDocument();
      expect(screen.getByText('+50 XP')).toBeInTheDocument();
    });

    it('shows failure results', () => {
      const results: TaskResults = {
        success: false,
        message: 'The fish got away!',
      };
      const task = createFishingTask({ status: 'resolved', results });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText('The fish got away!')).toBeInTheDocument();
    });

    it('shows cancelled message for cancelled task', () => {
      const task = createFishingTask({ status: 'cancelled' });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText('Task was cancelled')).toBeInTheDocument();
    });
  });

  describe('data attributes', () => {
    it('has correct data-testid', () => {
      const task = createFishingTask();
      render(<FishingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByTestId('fishing-task-card')).toBeInTheDocument();
    });

    it('has task-id data attribute', () => {
      const task = createFishingTask({ id: 'task-123' });
      render(<FishingTaskCard task={task} {...defaultProps} />);

      const card = screen.getByTestId('fishing-task-card');
      expect(card).toHaveAttribute('data-task-id', 'task-123');
    });
  });
});
