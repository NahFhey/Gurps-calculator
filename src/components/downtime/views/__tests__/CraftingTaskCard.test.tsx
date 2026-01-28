import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CraftingTaskCard } from '../CraftingTaskCard';
import type { DowntimeTask, CraftingData } from '../../../../types/downtime';
import type { Character, Recipe, Material } from '../../../../types/campaign';

// Mock data
const mockCharacters: Character[] = [
  {
    id: 'char-1',
    name: 'Aldric',
    st: 10,
    work: {
      enabled: true,
      skills: { crafting: 14 },
    },
  },
  {
    id: 'char-2',
    name: 'Brina',
    st: 12,
    work: {
      enabled: true,
      skills: { crafting: 12 },
    },
  },
];

const mockRecipes: Recipe[] = [
  {
    id: 'recipe-1',
    name: 'Iron Sword',
    ingredients: [],
    skill: 'Armoury',
    difficulty: 0,
    prepTime: 120,
    servings: 1,
  },
];

const mockMaterials: Material[] = [];

const createMockTask = (overrides?: Partial<DowntimeTask>): DowntimeTask => ({
  id: 'task-1',
  activityType: 'crafting',
  dayKey: 1,
  slot: 0,
  leaderId: 'char-1',
  helperIds: [],
  status: 'pending',
  activityData: {
    type: 'crafting',
    recipeId: 'recipe-1',
    materialInstanceIds: [],
    toolInstanceIds: [],
    qualityTarget: 'standard',
    skillModifier: 2,
  } as CraftingData,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe('CraftingTaskCard', () => {
  const defaultProps = {
    task: createMockTask(),
    recipes: mockRecipes,
    materials: mockMaterials,
    characters: mockCharacters,
    onResolve: vi.fn(),
    onCancel: vi.fn(),
  };

  describe('rendering', () => {
    it('renders task card', () => {
      render(<CraftingTaskCard {...defaultProps} />);
      expect(screen.getByTestId('crafting-task-card')).toBeInTheDocument();
    });

    it('displays recipe name', () => {
      render(<CraftingTaskCard {...defaultProps} />);
      expect(screen.getByText(/Iron Sword/)).toBeInTheDocument();
    });

    it('displays crafter name', () => {
      render(<CraftingTaskCard {...defaultProps} />);
      expect(screen.getByText('Aldric')).toBeInTheDocument();
    });

    it('displays quality target', () => {
      render(<CraftingTaskCard {...defaultProps} />);
      expect(screen.getByText('Standard')).toBeInTheDocument();
    });

    it('displays skill modifier', () => {
      render(<CraftingTaskCard {...defaultProps} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('displays status badge', () => {
      render(<CraftingTaskCard {...defaultProps} />);
      expect(screen.getByTestId('status-badge')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('displays helper names when present', () => {
      const taskWithHelpers = createMockTask({
        helperIds: ['char-2'],
      });
      render(<CraftingTaskCard {...defaultProps} task={taskWithHelpers} />);
      expect(screen.getByText('Brina')).toBeInTheDocument();
    });
  });

  describe('quality display', () => {
    it('displays basic quality', () => {
      const task = createMockTask({
        activityData: {
          type: 'crafting',
          recipeId: 'recipe-1',
          materialInstanceIds: [],
          toolInstanceIds: [],
          qualityTarget: 'basic',
          skillModifier: 0,
        },
      });
      render(<CraftingTaskCard {...defaultProps} task={task} />);
      expect(screen.getByText('Basic')).toBeInTheDocument();
    });

    it('displays masterwork quality', () => {
      const task = createMockTask({
        activityData: {
          type: 'crafting',
          recipeId: 'recipe-1',
          materialInstanceIds: [],
          toolInstanceIds: [],
          qualityTarget: 'masterwork',
          skillModifier: 0,
        },
      });
      render(<CraftingTaskCard {...defaultProps} task={task} />);
      expect(screen.getByText('Masterwork')).toBeInTheDocument();
    });
  });

  describe('status states', () => {
    it('renders pending status correctly', () => {
      render(<CraftingTaskCard {...defaultProps} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('renders in_progress status correctly', () => {
      const task = createMockTask({ status: 'in_progress' });
      render(<CraftingTaskCard {...defaultProps} task={task} />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('renders resolved status correctly', () => {
      const task = createMockTask({
        status: 'resolved',
        results: {
          success: true,
          message: 'Successfully crafted Standard Iron Sword!',
          inventoryChanges: [
            { itemId: 'recipe-1', quantity: 1, itemName: 'Standard Iron Sword' },
          ],
          experienceGained: 20,
        },
      });
      render(<CraftingTaskCard {...defaultProps} task={task} />);
      expect(screen.getByText('Resolved')).toBeInTheDocument();
      expect(screen.getByTestId('task-results')).toBeInTheDocument();
    });

    it('renders cancelled status correctly', () => {
      const task = createMockTask({ status: 'cancelled' });
      render(<CraftingTaskCard {...defaultProps} task={task} />);
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
      expect(screen.getByText(/Crafting task was cancelled/)).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('shows resolve and cancel buttons for pending tasks', () => {
      render(<CraftingTaskCard {...defaultProps} />);
      expect(screen.getByTestId('resolve-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    it('calls onResolve when resolve button is clicked', () => {
      const onResolve = vi.fn();
      render(<CraftingTaskCard {...defaultProps} onResolve={onResolve} />);

      fireEvent.click(screen.getByTestId('resolve-button'));
      expect(onResolve).toHaveBeenCalled();
    });

    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<CraftingTaskCard {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('disables buttons for in_progress tasks', () => {
      const task = createMockTask({ status: 'in_progress' });
      render(<CraftingTaskCard {...defaultProps} task={task} />);

      expect(screen.getByTestId('resolve-button')).toBeDisabled();
      expect(screen.getByTestId('cancel-button')).toBeDisabled();
    });

    it('hides buttons for resolved tasks', () => {
      const task = createMockTask({
        status: 'resolved',
        results: {
          success: true,
          message: 'Success!',
          inventoryChanges: [],
          experienceGained: 10,
        },
      });
      render(<CraftingTaskCard {...defaultProps} task={task} />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });

    it('hides buttons when readonly is true', () => {
      render(<CraftingTaskCard {...defaultProps} readonly />);

      expect(screen.queryByTestId('resolve-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });
  });

  describe('results display', () => {
    it('displays success results with inventory changes', () => {
      const task = createMockTask({
        status: 'resolved',
        results: {
          success: true,
          message: 'Successfully crafted Standard Iron Sword!',
          inventoryChanges: [
            { itemId: 'mat-1', quantity: -2, itemName: 'Iron Ingot' },
            { itemId: 'recipe-1', quantity: 1, itemName: 'Standard Iron Sword' },
          ],
          experienceGained: 20,
        },
      });
      render(<CraftingTaskCard {...defaultProps} task={task} />);

      expect(screen.getByTestId('task-results')).toBeInTheDocument();
      expect(screen.getByText(/Successfully crafted/)).toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.getByText('-2')).toBeInTheDocument();
      expect(screen.getByText('+20 XP')).toBeInTheDocument();
    });

    it('displays failure results', () => {
      const task = createMockTask({
        status: 'resolved',
        results: {
          success: false,
          message: 'Crafting failed! Materials consumed.',
          inventoryChanges: [
            { itemId: 'mat-1', quantity: -2, itemName: 'Iron Ingot' },
          ],
          experienceGained: 5,
        },
      });
      render(<CraftingTaskCard {...defaultProps} task={task} />);

      expect(screen.getByText(/Crafting failed/)).toBeInTheDocument();
      expect(screen.getByText('-2')).toBeInTheDocument();
    });
  });

  describe('slot-bounded indicator', () => {
    it('shows single-roll resolution notice for pending tasks', () => {
      render(<CraftingTaskCard {...defaultProps} />);
      expect(screen.getByText(/Single-roll resolution/)).toBeInTheDocument();
    });

    it('does not show notice for resolved tasks', () => {
      const task = createMockTask({
        status: 'resolved',
        results: {
          success: true,
          message: 'Done!',
          inventoryChanges: [],
          experienceGained: 10,
        },
      });
      render(<CraftingTaskCard {...defaultProps} task={task} />);
      expect(screen.queryByText(/Single-roll resolution/)).not.toBeInTheDocument();
    });
  });
});
