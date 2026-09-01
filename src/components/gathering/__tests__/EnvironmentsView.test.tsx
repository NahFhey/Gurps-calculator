import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EnvironmentsView } from '../views/EnvironmentsView';
import type {
  EnvironmentsViewProps,
  GatheringEnvironmentExtended,
} from '../../../types/gathering';

function makeEnvironment(
  overrides: Partial<GatheringEnvironmentExtended> = {},
): GatheringEnvironmentExtended {
  return {
    id: 'environment-1',
    name: 'River',
    supportedModes: ['Fishing'],
    defaultsByMode: {},
    skillMod: 0,
    locationId: undefined,
    ...overrides,
  };
}

describe('EnvironmentsView', () => {
  const mockSaveEnvironments = vi.fn();
  const mockSaveForageZoneProfile = vi.fn();
  const mockRemoveForageZoneProfile = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps: EnvironmentsViewProps = {
    environments: [],
    tables: [],
    items: [],
    locations: [
      { id: 'loc-1', name: 'Coastal Waters' },
    ],
    forageZoneProfiles: [],
    saveEnvironments: mockSaveEnvironments,
    saveForageZoneProfile: mockSaveForageZoneProfile,
    removeForageZoneProfile: mockRemoveForageZoneProfile,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Environments heading with count', () => {
    render(<EnvironmentsView {...defaultProps} />);
    expect(screen.getByText('Environments (0)')).toBeInTheDocument();
  });

  it('shows count in header when environments exist', () => {
    const environments = [
      makeEnvironment({ id: '1' }),
      makeEnvironment({ id: '2', name: 'Lake', skillMod: -1 }),
    ];
    render(<EnvironmentsView {...defaultProps} environments={environments} />);
    expect(screen.getByText('Environments (2)')).toBeInTheDocument();
  });

  it('renders Add Environment button', () => {
    render(<EnvironmentsView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add environment/i })).toBeInTheDocument();
  });

  it('shows add form when Add Environment button is clicked', () => {
    render(<EnvironmentsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add environment/i }));

    expect(screen.getByPlaceholderText(/tuto coastal waters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows empty state when no environments', () => {
    render(<EnvironmentsView {...defaultProps} environments={[]} />);
    expect(screen.getByText(/no environments defined/i)).toBeInTheDocument();
  });

  it('renders existing environments with modes and skill mod', () => {
    const environments = [
      makeEnvironment({
        id: '1',
        name: 'Coastal Waters',
        supportedModes: ['Fishing', 'Foraging'],
        skillMod: 1,
        locationId: 'loc-1',
      }),
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    expect(screen.getByText('Coastal Waters')).toBeInTheDocument();
    // Skill mod is displayed as "Skill: +1"
    expect(screen.getByText(/Skill: \+1/)).toBeInTheDocument();
  });

  it('shows location reference for environments with locationId', () => {
    const environments = [
      makeEnvironment({ id: '1', name: 'Test Env', locationId: 'loc-1' }),
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    expect(screen.getByText('Test Env')).toBeInTheDocument();
  });

  it('alerts when trying to add environment with empty name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<EnvironmentsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add environment/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter environment name');
    expect(mockSaveEnvironments).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('calls saveEnvironments when adding a new environment with valid data', () => {
    render(<EnvironmentsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add environment/i }));
    fireEvent.change(screen.getByPlaceholderText(/tuto coastal waters/i), {
      target: { value: 'Mountain Stream' }
    });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveEnvironments).toHaveBeenCalledTimes(1);
    const savedEnvironments = mockSaveEnvironments.mock.calls[0][0];
    expect(savedEnvironments).toHaveLength(1);
    expect(savedEnvironments[0].name).toBe('Mountain Stream');
  });

  it('calls onDelete with correct parameters when delete button is clicked', () => {
    const environments = [
      makeEnvironment({ id: 'env-123', name: 'Test Env' }),
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    const deleteButton = document.querySelector('button.text-danger-400');
    expect(deleteButton).not.toBeNull();
    if (deleteButton) fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('environment', 'env-123', 'Test Env');
  });

  it('enters edit mode when edit button is clicked', () => {
    const environments = [
      makeEnvironment({ id: '1', name: 'Edit Env' }),
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    const editButton = document.querySelector('button.text-accent-400');
    expect(editButton).not.toBeNull();
    if (editButton) fireEvent.click(editButton);

    // Form should show with Update button
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edit Env')).toBeInTheDocument();
  });

  it('displays skill modifier correctly', () => {
    const environments = [
      makeEnvironment({ id: '1', name: 'Difficult Area', skillMod: -2 }),
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    expect(screen.getByText(/Skill: -2/)).toBeInTheDocument();
  });

  it('shows supported modes in environment list', () => {
    const environments = [
      makeEnvironment({
        id: '1',
        name: 'Multi Mode Env',
        supportedModes: ['Fishing', 'Foraging', 'Hunting'],
      }),
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    expect(screen.getByText('Multi Mode Env')).toBeInTheDocument();
  });
});
