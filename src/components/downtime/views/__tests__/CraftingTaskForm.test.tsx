import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CraftingTaskForm } from '../CraftingTaskForm';
import { downtimeInitialState } from '../../../../state/downtime/downtimeInitialState';
import type {
  Character,
  Recipe,
  Material,
  Facility,
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
    ingredients: [
      { type: 'material', id: 'mat-1', amount: 2 },
      { type: 'material', id: 'mat-2', amount: 1 },
    ],
    skill: 'Armoury',
    difficulty: 0,
    prepTime: 120,
    servings: 1,
    effects: 'Standard iron sword',
  },
  {
    id: 'recipe-2',
    name: 'Leather Armor',
    ingredients: [
      { type: 'material', id: 'mat-3', amount: 4 },
    ],
    skill: 'Leatherworking',
    difficulty: -2,
    prepTime: 180,
    servings: 1,
    effects: 'Light armor, DR 1',
  },
];

const mockMaterials: Material[] = [
  {
    id: 'mat-1',
    name: 'Iron Ingot',
    type: 'Metal',
    quantity: 10,
  },
  {
    id: 'mat-2',
    name: 'Leather Wrap',
    type: 'Leather',
    quantity: 5,
  },
  {
    id: 'mat-3',
    name: 'Tanned Hide',
    type: 'Leather',
    quantity: 8,
  },
];

const mockWorkshops: Facility[] = [
  {
    id: 'workshop-1',
    name: 'Basic Forge',
    facilityType: 'workshop',
    rating: 1,
    description: 'A simple smithing forge',
  },
  {
    id: 'workshop-2',
    name: 'Master Workshop',
    facilityType: 'workshop',
    rating: 3,
    description: 'A well-equipped crafting workshop',
  },
];

const mockTools: GatheringTool[] = [];

describe('CraftingTaskForm', () => {
  const defaultProps = {
    characters: mockCharacters,
    recipes: mockRecipes,
    materials: mockMaterials,
    workshops: mockWorkshops,
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
      render(<CraftingTaskForm {...defaultProps} />);
      expect(screen.getByText('New Crafting Task')).toBeInTheDocument();
    });

    it('renders crafter select with characters', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      const leaderSelect = screen.getByTestId('leader-select');
      expect(leaderSelect).toBeInTheDocument();

      const options = leaderSelect.querySelectorAll('option');
      expect(options.length).toBe(3); // "Select crafter..." + 2 characters
      expect(options[1]).toHaveTextContent('Aldric');
      expect(options[2]).toHaveTextContent('Brina');
    });

    it('renders recipe select with recipes', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      const recipeSelect = screen.getByTestId('recipe-select');
      expect(recipeSelect).toBeInTheDocument();

      const options = recipeSelect.querySelectorAll('option');
      expect(options.length).toBe(3); // "Select recipe..." + 2 recipes
    });

    it('renders quality select with options', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      const qualitySelect = screen.getByTestId('quality-select');
      expect(qualitySelect).toBeInTheDocument();

      const options = qualitySelect.querySelectorAll('option');
      expect(options.length).toBe(4); // basic, standard, fine, masterwork
    });

    it('renders workshop select with workshops', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      const workshopSelect = screen.getByTestId('workshop-select');
      expect(workshopSelect).toBeInTheDocument();
    });

    it('renders submit and cancel buttons', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<CraftingTaskForm {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('submit button is disabled when required fields are empty', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when required fields are filled', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      // Fill required fields
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('recipe-select'), {
        target: { value: 'recipe-1' },
      });

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).not.toBeDisabled();
    });

    it('calls onSubmit with correct data when form is submitted', () => {
      const onSubmit = vi.fn();
      render(<CraftingTaskForm {...defaultProps} onSubmit={onSubmit} />);

      // Fill required fields
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('recipe-select'), {
        target: { value: 'recipe-1' },
      });

      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      expect(onSubmit).toHaveBeenCalledWith({
        leaderId: 'char-1',
        helperIds: [],
        activityData: expect.objectContaining({
          type: 'crafting',
          recipeId: 'recipe-1',
          qualityTarget: 'standard', // default
        }),
      });
    });

    it('includes quality target in submission', () => {
      const onSubmit = vi.fn();
      render(<CraftingTaskForm {...defaultProps} onSubmit={onSubmit} />);

      // Fill required fields
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('recipe-select'), {
        target: { value: 'recipe-1' },
      });
      fireEvent.change(screen.getByTestId('quality-select'), {
        target: { value: 'masterwork' },
      });

      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      expect(onSubmit).toHaveBeenCalledWith({
        leaderId: 'char-1',
        helperIds: [],
        activityData: expect.objectContaining({
          type: 'crafting',
          qualityTarget: 'masterwork',
        }),
      });
    });
  });

  describe('recipe details display', () => {
    it('shows recipe details when recipe is selected', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      // Select a recipe
      fireEvent.change(screen.getByTestId('recipe-select'), {
        target: { value: 'recipe-1' },
      });

      const recipeDetails = screen.getByTestId('recipe-details');
      expect(recipeDetails).toBeInTheDocument();
      // Check that the recipe name appears in the details section
      expect(recipeDetails).toHaveTextContent('Iron Sword');
    });
  });

  describe('skill modifier calculation', () => {
    it('shows skill modifier summary', () => {
      render(<CraftingTaskForm {...defaultProps} />);
      expect(screen.getByText(/Total Skill Modifier:/)).toBeInTheDocument();
    });

    it('updates modifier when workshop is selected', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      // Select master workshop
      fireEvent.change(screen.getByTestId('workshop-select'), {
        target: { value: 'workshop-2' },
      });

      // Check that Workshop +3 is shown somewhere
      expect(screen.getByText(/Workshop: \+3/)).toBeInTheDocument();
    });

    it('shows quality modifier in summary', () => {
      render(<CraftingTaskForm {...defaultProps} />);

      // Select fine quality
      fireEvent.change(screen.getByTestId('quality-select'), {
        target: { value: 'fine' },
      });

      // Check that Quality -2 is shown
      expect(screen.getByText(/Quality: -2/)).toBeInTheDocument();
    });
  });

  describe('character availability', () => {
    it('shows message when no characters are available', () => {
      render(<CraftingTaskForm {...defaultProps} characters={[]} />);
      expect(
        screen.getByText('All characters are already assigned to tasks in this slot')
      ).toBeInTheDocument();
    });

    it('shows no available helpers message when only one character exists', () => {
      render(
        <CraftingTaskForm {...defaultProps} characters={[mockCharacters[0]]} />
      );

      // Select the only character as leader
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });

      expect(screen.getByText('No available helpers')).toBeInTheDocument();
    });
  });

  describe('recipe availability', () => {
    it('shows no recipes message when none available', () => {
      render(<CraftingTaskForm {...defaultProps} recipes={[]} />);
      expect(screen.getByText(/No recipes available/)).toBeInTheDocument();
    });
  });

  describe('slot-bounded notice', () => {
    it('shows slot-bounded notice about single-roll resolution', () => {
      render(<CraftingTaskForm {...defaultProps} />);
      expect(screen.getByText(/Crafting completes in a single slot/)).toBeInTheDocument();
      expect(screen.getByText(/Materials are consumed regardless of outcome/)).toBeInTheDocument();
    });
  });
});
