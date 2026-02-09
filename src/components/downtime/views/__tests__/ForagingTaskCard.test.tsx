import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForagingTaskCard } from '../ForagingTaskCard';
import type { DowntimeTask, ForagingData, TaskResults } from '../../../../types/downtime';
import type { Character } from '../../../../types/campaign';
import type { ForageZoneProfile, ForageItem } from '../../../../types/foraging';

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
      zoneId: 'zone-forest',
      mode: 'general',
      skillUsed: 'survival',
      toolIds: ['tool-basket'],
      leaderSkill: 12,
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
    hitLocationProfileId: 'humanoid',
  } as Character,
  {
    id: 'char-2',
    name: 'Brina',
    hitLocationProfileId: 'humanoid',
  } as Character,
];

const mockZones: ForageZoneProfile[] = [
  {
    id: 'zone-forest',
    name: 'Forest',
    locationId: 'loc-1',
    commonCategories: [{ categoryId: 'fruits', weight: 1, items: [] }],
    uncommonCategories: [{ categoryId: 'mushrooms', weight: 1, items: [] }],
    rareCategories: [{ categoryId: 'herbs_spices', weight: 1, items: [] }],
    tags: ['woodland'],
  },
];

const mockForageItems: ForageItem[] = [
  {
    id: 'item-berries',
    name: 'Wild Berries',
    categoryId: 'fruits',
    tier: 'common',
    yieldFormula: '2d+1',
    inventoryKind: 'food',
    typeId: 'berries',
  },
];

const defaultProps = {
  zones: mockZones,
  forageItems: mockForageItems,
  characters: mockCharacters,
};

describe('ForagingTaskCard', () => {
  describe('rendering', () => {
    it('renders task with mode label for general mode', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText('General Forage')).toBeInTheDocument();
    });

    it('renders task with mode label for category mode', () => {
      const task = createForagingTask({
        activityData: {
          type: 'foraging',
          zoneId: 'zone-forest',
          mode: 'category',
          targetCategory: 'mushrooms',
          skillUsed: 'survival',
          toolIds: [],
          leaderSkill: 12,
          skillModifier: 0,
        } as ForagingData,
      });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Category: Mushrooms/)).toBeInTheDocument();
    });

    it('renders task with mode label for specific mode', () => {
      const task = createForagingTask({
        activityData: {
          type: 'foraging',
          zoneId: 'zone-forest',
          mode: 'specific',
          targetItemId: 'item-berries',
          skillUsed: 'survival',
          toolIds: [],
          leaderSkill: 12,
          skillModifier: 0,
        } as ForagingData,
      });
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Specific: Wild Berries/)).toBeInTheDocument();
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

    it('renders zone name', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Forest/)).toBeInTheDocument();
    });

    it('renders skill modifier', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });

    it('renders skill label', () => {
      const task = createForagingTask();
      render(<ForagingTaskCard task={task} {...defaultProps} />);

      expect(screen.getByText(/Survival/)).toBeInTheDocument();
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
      render(<ForagingTaskCard task={task} {...defaultProps} onResolve={vi.fn()} onCancel={vi.fn()} />);

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
          { itemId: 'item-berries', quantity: 8, itemName: 'Wild Berries' },
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
