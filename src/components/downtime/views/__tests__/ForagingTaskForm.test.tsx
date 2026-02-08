import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForagingTaskForm } from '../ForagingTaskForm';
import { downtimeInitialState } from '../../../../state/downtime/downtimeInitialState';
import type { Character, GatheringSpecies, GatheringTool, GatheringEnvironment, GatheringTable } from '../../../../types/campaign';

// Mock data
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
    skills: { survival: 12 },
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
    skills: { survival: 14, naturalist: 11 },
    advantages: [],
    disadvantages: [],
    equipment: [],
  },
];

const mockBiomes: GatheringEnvironment[] = [
  {
    id: 'biome-1',
    name: 'Forest',
    description: 'Dense woodland',
    species: ['node-1', 'node-2'],
  },
  {
    id: 'biome-2',
    name: 'Meadow',
    description: 'Open grassland',
    species: ['node-2'],
  },
];

const mockNodes: GatheringSpecies[] = [
  {
    id: 'node-1',
    name: 'Wild Berries',
    category: 'plant',
    baseYield: 5,
    skill: 'Naturalist',
    difficulty: 0,
    environments: ['biome-1'],
  },
  {
    id: 'node-2',
    name: 'Mushrooms',
    category: 'plant',
    baseYield: 3,
    skill: 'Naturalist',
    difficulty: -2,
    environments: ['biome-1', 'biome-2'],
  },
];

const mockTables: GatheringTable[] = [
  {
    id: 'table-1',
    name: 'Basic Foraging',
    skill: 'Naturalist',
    rolls: [],
  },
];

const mockTools: GatheringTool[] = [
  {
    id: 'tool-1',
    name: 'Foraging Basket',
    category: 'container',
    skillBonus: 1,
    yieldBonus: 2,
  },
  {
    id: 'tool-2',
    name: 'Herbalist Kit',
    category: 'kit',
    skillBonus: 2,
    yieldBonus: 0,
  },
];

describe('ForagingTaskForm', () => {
  const defaultProps = {
    characters: mockCharacters,
    biomes: mockBiomes,
    nodes: mockNodes,
    tables: mockTables,
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
      render(<ForagingTaskForm {...defaultProps} />);
      expect(screen.getByText('New Foraging Task')).toBeInTheDocument();
    });

    it('renders leader select with characters', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      const leaderSelect = screen.getByTestId('leader-select');
      expect(leaderSelect).toBeInTheDocument();

      // Check that the select has the expected options
      const options = leaderSelect.querySelectorAll('option');
      expect(options.length).toBe(3); // "Select character..." + 2 characters
      expect(options[1]).toHaveTextContent('Aldric');
      expect(options[2]).toHaveTextContent('Brina');
    });

    it('renders biome select with biomes', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      const biomeSelect = screen.getByTestId('biome-select');
      expect(biomeSelect).toBeInTheDocument();
    });

    it('renders node select with nodes', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      const nodeSelect = screen.getByTestId('node-select');
      expect(nodeSelect).toBeInTheDocument();
    });

    it('renders table select', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      const tableSelect = screen.getByTestId('table-select');
      expect(tableSelect).toBeInTheDocument();
    });

    it('renders submit and cancel buttons', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<ForagingTaskForm {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('submit button is disabled when required fields are empty', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when required fields are filled', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      // Fill required fields
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('biome-select'), {
        target: { value: 'biome-1' },
      });
      fireEvent.change(screen.getByTestId('node-select'), {
        target: { value: 'node-1' },
      });

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).not.toBeDisabled();
    });

    it('calls onSubmit with correct data when form is submitted', () => {
      const onSubmit = vi.fn();
      render(<ForagingTaskForm {...defaultProps} onSubmit={onSubmit} />);

      // Fill required fields
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('biome-select'), {
        target: { value: 'biome-1' },
      });
      fireEvent.change(screen.getByTestId('node-select'), {
        target: { value: 'node-1' },
      });

      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      expect(onSubmit).toHaveBeenCalledWith({
        leaderId: 'char-1',
        helperIds: [],
        activityData: expect.objectContaining({
          type: 'foraging',
          nodeId: 'node-1',
          biomeId: 'biome-1',
        }),
      });
    });
  });

  describe('character availability', () => {
    it('shows message when no characters are available', () => {
      render(<ForagingTaskForm {...defaultProps} characters={[]} />);
      expect(
        screen.getByText('All characters are already assigned to tasks in this slot')
      ).toBeInTheDocument();
    });

    it('shows no available helpers message when only one character exists', () => {
      render(
        <ForagingTaskForm {...defaultProps} characters={[mockCharacters[0]]} />
      );

      // Select the only character as leader
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });

      expect(screen.getByText('No available helpers')).toBeInTheDocument();
    });
  });

  describe('tool selection', () => {
    it('renders available tools', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      expect(screen.getByText('Foraging Basket')).toBeInTheDocument();
      expect(screen.getByText('Herbalist Kit')).toBeInTheDocument();
    });

    it('shows no tools message when none available', () => {
      render(<ForagingTaskForm {...defaultProps} tools={[]} />);
      expect(screen.getByText('No foraging tools available')).toBeInTheDocument();
    });
  });

  describe('skill modifier calculation', () => {
    it('shows skill modifier summary', () => {
      render(<ForagingTaskForm {...defaultProps} />);
      expect(screen.getByText(/Total Skill Modifier:/)).toBeInTheDocument();
    });
  });

  describe('biome-node filtering', () => {
    it('filters nodes based on selected biome', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      // Select Forest biome which has both nodes
      fireEvent.change(screen.getByTestId('biome-select'), {
        target: { value: 'biome-1' },
      });

      const nodeSelect = screen.getByTestId('node-select');
      const options = nodeSelect.querySelectorAll('option');
      // Should have "Select node..." + 2 nodes (both in forest)
      expect(options.length).toBe(3);
    });

    it('shows only biome-specific nodes when biome limits species', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      // Select Meadow biome which only has Mushrooms
      fireEvent.change(screen.getByTestId('biome-select'), {
        target: { value: 'biome-2' },
      });

      const nodeSelect = screen.getByTestId('node-select');
      const options = nodeSelect.querySelectorAll('option');
      // Should have "Select node..." + 1 node (only mushrooms in meadow)
      expect(options.length).toBe(2);
    });

    it('resets node selection when biome changes', () => {
      render(<ForagingTaskForm {...defaultProps} />);

      // Select Forest and Wild Berries
      fireEvent.change(screen.getByTestId('biome-select'), {
        target: { value: 'biome-1' },
      });
      fireEvent.change(screen.getByTestId('node-select'), {
        target: { value: 'node-1' },
      });

      // Verify node is selected
      expect(screen.getByTestId('node-select')).toHaveValue('node-1');

      // Change biome to Meadow (which doesn't have Wild Berries)
      fireEvent.change(screen.getByTestId('biome-select'), {
        target: { value: 'biome-2' },
      });

      // Node should be reset
      expect(screen.getByTestId('node-select')).toHaveValue('');
    });
  });
});
