import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForagingTaskForm } from '../ForagingTaskForm';
import { downtimeInitialState } from '../../../../state/downtime/downtimeInitialState';
import { DEFAULT_FORAGING_CONFIG } from '../../../../constants/foraging';
import type { Character, GatheringTool } from '../../../../types/campaign';
import type { ForageZoneProfile, ForageItem } from '../../../../types/foraging';

// Mock data
const mockCharacters: Character[] = [
  {
    id: 'char-1',
    name: 'Aldric',
    hitLocationProfileId: 'humanoid',
    skills: [{ name: 'Survival', level: 12 }],
  } as unknown as Character,
  {
    id: 'char-2',
    name: 'Brina',
    hitLocationProfileId: 'humanoid',
    skills: [{ name: 'Survival', level: 14 }, { name: 'Naturalist', level: 11 }],
  } as unknown as Character,
];

const mockZones: ForageZoneProfile[] = [
  {
    id: 'zone-1',
    name: 'Forest',
    locationId: 'loc-1',
    commonCategories: [{ categoryId: 'fruits', weight: 2, items: [] }, { categoryId: 'mushrooms', weight: 1, items: [] }],
    uncommonCategories: [{ categoryId: 'herbs_spices', weight: 1, items: [] }],
    rareCategories: [{ categoryId: 'alchemical_ingredients', weight: 1, items: [] }],
    tags: ['woodland'],
  },
  {
    id: 'zone-2',
    name: 'Meadow',
    locationId: 'loc-1',
    commonCategories: [{ categoryId: 'grains', weight: 1, items: [] }],
    uncommonCategories: [],
    rareCategories: [],
    tags: ['grassland'],
  },
];

const mockForageItems: ForageItem[] = [
  {
    id: 'item-1',
    name: 'Wild Berries',
    categoryId: 'fruits',
    tier: 'common',
    yieldFormula: '2d+1',
    inventoryKind: 'food',
    typeId: 'berries',
  },
  {
    id: 'item-2',
    name: 'Chanterelle Mushrooms',
    categoryId: 'mushrooms',
    tier: 'uncommon',
    yieldFormula: '1d+2',
    inventoryKind: 'food',
    typeId: 'chanterelle',
  },
];

const mockTools: GatheringTool[] = [
  {
    id: 'tool-1',
    name: 'Foraging Basket',
    toolType: 'container',
    allowedModes: ['Foraging'],
    allowedMethods: [],
    bonuses: [],
    durability: null,
    notes: '',
    // Legacy flat bonus fields — the form still reads these for migrated saves
    skillBonus: 1,
    yieldBonus: 2,
  },
  {
    id: 'tool-2',
    name: 'Herbalist Kit',
    toolType: 'kit',
    allowedModes: ['Foraging'],
    allowedMethods: [],
    bonuses: [],
    durability: null,
    notes: '',
    skillBonus: 2,
    yieldBonus: 0,
  },
];

describe('ForagingTaskForm', () => {
  const defaultProps = {
    characters: mockCharacters,
    zones: mockZones,
    forageItems: mockForageItems,
    tools: mockTools,
    foragingConfig: DEFAULT_FORAGING_CONFIG,
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
      render(<ForagingTaskForm {...defaultProps} />);
      expect(screen.getByText('New Foraging Task')).toBeInTheDocument();
    });

    it('renders mode selector with three modes', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      expect(screen.getByTestId('mode-selector')).toBeInTheDocument();
      expect(screen.getByTestId('mode-general')).toBeInTheDocument();
      expect(screen.getByTestId('mode-category')).toBeInTheDocument();
      expect(screen.getByTestId('mode-specific')).toBeInTheDocument();
    });

    it('renders leader select with characters', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      const leaderSelect = screen.getByTestId('leader-select');
      expect(leaderSelect).toBeInTheDocument();

      const options = leaderSelect.querySelectorAll('option');
      expect(options.length).toBe(3); // "Select a leader..." + 2 characters
      expect(options[1]).toHaveTextContent('Aldric');
      expect(options[2]).toHaveTextContent('Brina');
    });

    it('renders zone select with zones', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      const zoneSelect = screen.getByTestId('zone-select');
      expect(zoneSelect).toBeInTheDocument();

      const options = zoneSelect.querySelectorAll('option');
      expect(options.length).toBe(2); // 2 zones (no placeholder since first zone is pre-selected)
    });

    it('renders submit and cancel buttons', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    it('shows no zones message when zones is empty', () => {
      render(<ForagingTaskForm {...defaultProps} zones={[]} />);
      expect(screen.getByText(/No foraging zones at this location/)).toBeInTheDocument();
    });
  });

  describe('mode switching', () => {
    it('defaults to general mode', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      expect(screen.getByText(/Gather whatever the zone provides/)).toBeInTheDocument();
    });

    it('shows category dropdown when category mode selected', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId('mode-category'));

      expect(screen.getByTestId('category-select')).toBeInTheDocument();
      expect(screen.getByText(/Target a specific category/)).toBeInTheDocument();
    });

    it('shows category and item dropdowns when specific mode selected', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId('mode-specific'));

      expect(screen.getByTestId('category-select')).toBeInTheDocument();
      expect(screen.getByText(/Target a specific item/)).toBeInTheDocument();
    });

    it('does not show category dropdown in general mode', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      expect(screen.queryByTestId('category-select')).not.toBeInTheDocument();
    });

    it('resets target fields when switching modes', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      // Switch to category, select a category
      fireEvent.click(screen.getByTestId('mode-category'));
      fireEvent.change(screen.getByTestId('category-select'), {
        target: { value: 'mushrooms' },
      });

      // Switch to general - category should be cleared
      fireEvent.click(screen.getByTestId('mode-general'));
      expect(screen.queryByTestId('category-select')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<ForagingTaskForm {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('submit button is disabled when leader is not selected', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button in general mode when leader and zone are selected', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });

      const submitButton = screen.getByTestId('submit-button');
      // Zone is pre-selected to first zone, so form should be valid
      expect(submitButton).not.toBeDisabled();
    });

    it('calls onSubmit with correct data for general mode', () => {
      const onSubmit = vi.fn();
      render(<ForagingTaskForm {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });

      fireEvent.click(screen.getByTestId('submit-button'));

      expect(onSubmit).toHaveBeenCalledWith({
        leaderId: 'char-1',
        helperIds: [],
        activityData: expect.objectContaining({
          type: 'foraging',
          mode: 'general',
          zoneId: 'zone-1',
        }),
      });
    });
  });

  describe('validation', () => {
    it('requires category selection in category mode', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });

      // Switch to category mode
      fireEvent.click(screen.getByTestId('mode-category'));

      // Submit should be disabled without category
      expect(screen.getByTestId('submit-button')).toBeDisabled();

      // Select a category
      fireEvent.change(screen.getByTestId('category-select'), {
        target: { value: 'mushrooms' },
      });

      // Now submit should be enabled
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });
  });

  describe('tool selection', () => {
    it('renders available tools', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      expect(screen.getByText('Foraging Basket')).toBeInTheDocument();
      expect(screen.getByText('Herbalist Kit')).toBeInTheDocument();
    });
  });

  describe('context flags', () => {
    it('renders context modifier checkboxes', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      expect(screen.getByText(/Map\/Local Guide/)).toBeInTheDocument();
      expect(screen.getByText(/Unfamiliar\/Hostile/)).toBeInTheDocument();
      expect(screen.getByText(/Peak Season/)).toBeInTheDocument();
      expect(screen.getByText(/Off Season/)).toBeInTheDocument();
      expect(screen.getByText(/Proper Tools/)).toBeInTheDocument();
      expect(screen.getByText(/Dense\/Dangerous Terrain/)).toBeInTheDocument();
    });
  });

  describe('skill display', () => {
    it('shows skill summary after leader is selected', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });

      expect(screen.getByText(/Base Skill:/)).toBeInTheDocument();
      expect(screen.getByText(/Total Modifier:/)).toBeInTheDocument();
    });
  });
});
