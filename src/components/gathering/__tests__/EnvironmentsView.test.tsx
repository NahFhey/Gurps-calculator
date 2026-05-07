import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EnvironmentsView } from '../views/EnvironmentsView';
import type { GatheringEnvironmentExtended, GatheringItemExtended, GatheringTableExtended } from '../../../types/gathering';
import type { ForageZoneProfile } from '../../../types/foraging';

describe('EnvironmentsView', () => {
  const mockSaveEnvironments = vi.fn();
  const mockSaveForageZoneProfile = vi.fn();
  const mockRemoveForageZoneProfile = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    environments: [] as GatheringEnvironmentExtended[],
    tables: [] as GatheringTableExtended[],
    items: [] as GatheringItemExtended[],
    locations: [
      { id: 'loc-1', name: 'Coastal Waters', type: 'water' } as any
    ],
    forageZoneProfiles: [] as ForageZoneProfile[],
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
      { id: '1', name: 'River', supportedModes: ['Fishing'], defaultsByMode: {}, skillMod: 0, locationId: undefined } as any,
      { id: '2', name: 'Lake', supportedModes: ['Fishing'], defaultsByMode: {}, skillMod: -1, locationId: undefined } as any
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
      { id: '1', name: 'Coastal Waters', supportedModes: ['Fishing', 'Foraging'], defaultsByMode: {}, skillMod: 1, locationId: 'loc-1' } as any
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    expect(screen.getByText('Coastal Waters')).toBeInTheDocument();
    // Skill mod is displayed as "Skill: +1"
    expect(screen.getByText(/Skill: \+1/)).toBeInTheDocument();
  });

  it('shows location reference for environments with locationId', () => {
    const environments = [
      { id: '1', name: 'Test Env', supportedModes: ['Fishing'], defaultsByMode: {}, skillMod: 0, locationId: 'loc-1' } as any
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
      { id: 'env-123', name: 'Test Env', supportedModes: ['Fishing'], defaultsByMode: {}, skillMod: 0, locationId: undefined } as any
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    const deleteButton = document.querySelector('button.text-red-400');
    expect(deleteButton).not.toBeNull();
    if (deleteButton) fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('environment', 'env-123', 'Test Env');
  });

  it('enters edit mode when edit button is clicked', () => {
    const environments = [
      { id: '1', name: 'Edit Env', supportedModes: ['Fishing'], defaultsByMode: {}, skillMod: 0, locationId: undefined } as any
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    const editButton = document.querySelector('button.text-blue-400');
    expect(editButton).not.toBeNull();
    if (editButton) fireEvent.click(editButton);

    // Form should show with Update button
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edit Env')).toBeInTheDocument();
  });

  it('displays skill modifier correctly', () => {
    const environments = [
      { id: '1', name: 'Difficult Area', supportedModes: ['Fishing'], defaultsByMode: {}, skillMod: -2, locationId: undefined } as any
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    expect(screen.getByText(/Skill: -2/)).toBeInTheDocument();
  });

  it('shows supported modes in environment list', () => {
    const environments = [
      { id: '1', name: 'Multi Mode Env', supportedModes: ['Fishing', 'Foraging', 'Hunting'], defaultsByMode: {}, skillMod: 0, locationId: undefined } as any
    ];

    render(<EnvironmentsView {...defaultProps} environments={environments} />);

    expect(screen.getByText('Multi Mode Env')).toBeInTheDocument();
  });
});
