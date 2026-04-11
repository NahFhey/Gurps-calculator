import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AlchemySettingsView } from '../views/AlchemySettingsView';
import type { AlchemySettingsViewProps } from '../../../types/views';

describe('AlchemySettingsView', () => {
  const mockSaveAlchemySettings = vi.fn();

  const defaultAlchemySettings = {
    defaultLabRating: 2,
    workBlockMinutes: 120,
    autoSaveRecipes: false,
    showObviousRoles: true
  };

  const defaultProps: AlchemySettingsViewProps = {
    alchemySettings: defaultAlchemySettings,
    saveAlchemySettings: mockSaveAlchemySettings
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Alchemy Settings heading', () => {
    render(<AlchemySettingsView {...defaultProps} />);
    expect(screen.getByText('Alchemy Settings')).toBeInTheDocument();
  });

  it('renders Default Lab Rating input', () => {
    render(<AlchemySettingsView {...defaultProps} />);
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('renders Work Block Duration input', () => {
    render(<AlchemySettingsView {...defaultProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('clamps lab rating to minimum 0', () => {
    render(<AlchemySettingsView {...defaultProps} />);

    const labRatingInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(labRatingInput, { target: { value: '-5' } });

    expect(mockSaveAlchemySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultLabRating: 0
      })
    );
  });

  it('clamps lab rating to maximum 4', () => {
    render(<AlchemySettingsView {...defaultProps} />);

    const labRatingInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(labRatingInput, { target: { value: '10' } });

    expect(mockSaveAlchemySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultLabRating: 4
      })
    );
  });

  it('renders auto-save recipes checkbox', () => {
    render(<AlchemySettingsView {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);
  });

  it('calls saveAlchemySettings when work block duration changes', () => {
    render(<AlchemySettingsView {...defaultProps} />);

    const workBlockInput = screen.getAllByRole('spinbutton')[1];
    fireEvent.change(workBlockInput, { target: { value: '60' } });

    expect(mockSaveAlchemySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        workBlockMinutes: 60
      })
    );
  });

  it('renders show obvious physical roles checkbox', () => {
    render(<AlchemySettingsView {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('calls saveAlchemySettings when auto-save checkbox is toggled', () => {
    render(<AlchemySettingsView {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(mockSaveAlchemySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        autoSaveRecipes: true
      })
    );
  });

  it('displays current lab rating with effect description', () => {
    render(<AlchemySettingsView {...defaultProps} />);
    expect(screen.getByText(/LR 2 \(reduces WR by 2\)/)).toBeInTheDocument();
  });

  it('displays current work block duration in hours', () => {
    render(<AlchemySettingsView {...defaultProps} />);
    expect(screen.getByText(/120 minutes \(2\.0 hours\)/)).toBeInTheDocument();
  });
});
