import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FishingTaskForm } from '../FishingTaskForm';
import { downtimeInitialState } from '../../../../state/downtime/downtimeInitialState';
import type { Character } from '../../../../types/campaign';

// Mock data
const mockCharacters: Character[] = [
  {
    id: 'char-1',
    name: 'Aldric',
    st: 10,
    work: { skills: { fishing: 12 } },
  },
  {
    id: 'char-2',
    name: 'Brina',
    st: 12,
    work: { skills: { fishing: 14 } },
  },
];

const mockSpots: any[] = [
  {
    id: 'spot-1',
    name: 'River Bank',
    description: 'A peaceful river',
    species: [],
  },
  {
    id: 'spot-2',
    name: 'Deep Lake',
    description: 'A deep lake',
    species: [],
  },
];

const mockSpecies: any[] = [
  {
    id: 'species-1',
    name: 'Trout',
    category: 'fish',
    baseYield: 1,
    skill: 'Fishing',
    difficulty: 12,
    environments: ['spot-1'],
  },
  {
    id: 'species-2',
    name: 'Bass',
    category: 'fish',
    baseYield: 2,
    skill: 'Fishing',
    difficulty: 13,
    environments: ['spot-1', 'spot-2'],
  },
];

const mockTools: any[] = [
  {
    id: 'tool-1',
    name: 'Fishing Rod',
    category: 'fishing',
    skillBonus: 1,
    yieldBonus: 0,
    durability: 10,
  },
  {
    id: 'tool-2',
    name: 'Fishing Net',
    category: 'fishing',
    skillBonus: 0,
    yieldBonus: 1,
    durability: 5,
  },
];

describe('FishingTaskForm', () => {
  const defaultProps = {
    characters: mockCharacters,
    spots: mockSpots,
    species: mockSpecies,
    tools: mockTools,
    bait: [],
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
      render(<FishingTaskForm {...defaultProps} />);
      expect(screen.getByText('New Fishing Task')).toBeInTheDocument();
    });

    it('renders leader select with characters', () => {
      render(<FishingTaskForm {...defaultProps} />);

      const leaderSelect = screen.getByTestId('leader-select');
      expect(leaderSelect).toBeInTheDocument();

      // Check that the select has the expected options
      const options = leaderSelect.querySelectorAll('option');
      expect(options.length).toBe(3); // "Select character..." + 2 characters
      expect(options[1]).toHaveTextContent('Aldric');
      expect(options[2]).toHaveTextContent('Brina');
    });

    it('renders spot select with spots', () => {
      render(<FishingTaskForm {...defaultProps} />);

      const spotSelect = screen.getByTestId('spot-select');
      expect(spotSelect).toBeInTheDocument();
    });

    it('renders species select when targeting mode is selected', () => {
      render(<FishingTaskForm {...defaultProps} />);

      // By default, random catch is selected - species select should not be visible
      expect(screen.queryByTestId('species-select')).not.toBeInTheDocument();

      // Must select a spot first, then click Target Species
      fireEvent.change(screen.getByTestId('spot-select'), {
        target: { value: 'spot-1' },
      });

      // Click on "Target Species" to enable targeting mode
      const targetButton = screen.getByText('Target Species');
      fireEvent.click(targetButton);

      // Now species select should be visible
      const speciesSelect = screen.getByTestId('species-select');
      expect(speciesSelect).toBeInTheDocument();
    });

    it('renders submit and cancel buttons', () => {
      render(<FishingTaskForm {...defaultProps} />);

      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<FishingTaskForm {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('submit button is disabled when required fields are empty', () => {
      render(<FishingTaskForm {...defaultProps} />);

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when required fields are filled (random catch mode)', () => {
      render(<FishingTaskForm {...defaultProps} />);

      // For random catch mode, only leader and spot are required
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('spot-select'), {
        target: { value: 'spot-1' },
      });

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).not.toBeDisabled();
    });

    it('enables submit button when required fields are filled (targeted mode)', () => {
      render(<FishingTaskForm {...defaultProps} />);

      // Fill required fields
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('spot-select'), {
        target: { value: 'spot-1' },
      });

      // Switch to targeted mode and select species
      const targetButton = screen.getByText('Target Species');
      fireEvent.click(targetButton);
      fireEvent.change(screen.getByTestId('species-select'), {
        target: { value: 'species-1' },
      });

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).not.toBeDisabled();
    });

    it('calls onSubmit with correct data when form is submitted (random catch)', () => {
      const onSubmit = vi.fn();
      render(<FishingTaskForm {...defaultProps} onSubmit={onSubmit} />);

      // Fill required fields (random catch mode - no species needed)
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('spot-select'), {
        target: { value: 'spot-1' },
      });

      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      expect(onSubmit).toHaveBeenCalledWith({
        leaderId: 'char-1',
        helperIds: [],
        activityData: expect.objectContaining({
          type: 'fishing',
          isRandomCatch: true,
          speciesId: '',
          spotId: 'spot-1',
        }),
      });
    });

    it('calls onSubmit with correct data when form is submitted (targeted)', () => {
      const onSubmit = vi.fn();
      render(<FishingTaskForm {...defaultProps} onSubmit={onSubmit} />);

      // Fill required fields
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });
      fireEvent.change(screen.getByTestId('spot-select'), {
        target: { value: 'spot-1' },
      });

      // Switch to targeted mode and select species
      const targetButton = screen.getByText('Target Species');
      fireEvent.click(targetButton);
      fireEvent.change(screen.getByTestId('species-select'), {
        target: { value: 'species-1' },
      });

      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      expect(onSubmit).toHaveBeenCalledWith({
        leaderId: 'char-1',
        helperIds: [],
        activityData: expect.objectContaining({
          type: 'fishing',
          isRandomCatch: false,
          speciesId: 'species-1',
          spotId: 'spot-1',
        }),
      });
    });
  });

  describe('character availability', () => {
    it('shows message when no characters are available', () => {
      render(<FishingTaskForm {...defaultProps} characters={[]} />);
      expect(
        screen.getByText('All characters are already assigned to tasks in this slot')
      ).toBeInTheDocument();
    });

    it('shows no available helpers message when only one character exists', () => {
      render(
        <FishingTaskForm {...defaultProps} characters={[mockCharacters[0]]} />
      );

      // Select the only character as leader
      fireEvent.change(screen.getByTestId('leader-select'), {
        target: { value: 'char-1' },
      });

      expect(screen.getByText('No available helpers')).toBeInTheDocument();
    });
  });

  describe('tool selection', () => {
    it('renders available tools for Line method', () => {
      render(<FishingTaskForm {...defaultProps} />);

      // Line method shows fishing_rod tools
      expect(screen.getByText('Fishing Rod')).toBeInTheDocument();
    });

    it('shows no tools message when none available', () => {
      render(<FishingTaskForm {...defaultProps} tools={[]} />);
      // Message format changed to "No tools available for {method}"
      expect(screen.getByText(/No tools available for/)).toBeInTheDocument();
    });
  });

  describe('skill modifier calculation', () => {
    it('shows skill modifier summary panel', () => {
      render(<FishingTaskForm {...defaultProps} />);
      // The form shows a skill modifier panel with resolution info
      expect(screen.getByText(/Large fish penalty.*applied during resolution/)).toBeInTheDocument();
    });
  });
});
