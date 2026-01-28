import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CraftingActivity } from '../CraftingActivity';
import { CampaignStoreProvider } from '../../../../state/campaignStore';
import { DowntimeProvider } from '../../DowntimeContext';

// Helper to render with all required providers
function renderWithProviders(
  ui: React.ReactElement,
  { currentDayKey = 1, currentSlot = 0 } = {}
) {
  return render(
    <CampaignStoreProvider>
      <DowntimeProvider currentDayKey={currentDayKey} currentSlot={currentSlot}>
        {ui}
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
}

describe('CraftingActivity', () => {
  const defaultProps = {
    currentDayKey: 1,
    currentSlot: 0,
  };

  describe('rendering', () => {
    it('renders crafting activity header', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      expect(screen.getByText('Crafting')).toBeInTheDocument();
    });

    it('shows new crafting task button', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      expect(screen.getByTestId('new-crafting-task-button')).toBeInTheDocument();
      expect(screen.getByText('New Crafting Task')).toBeInTheDocument();
    });

    it('shows pending tasks section', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      expect(screen.getByTestId('pending-tasks-section')).toBeInTheDocument();
    });

    it('shows completed tasks section', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      expect(screen.getByTestId('completed-tasks-section')).toBeInTheDocument();
    });

    it('shows empty state for pending tasks', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      expect(screen.getByText('No pending crafting tasks')).toBeInTheDocument();
    });

    it('shows empty state for completed tasks', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      expect(screen.getByText('No completed crafting tasks')).toBeInTheDocument();
    });

    it('shows no recipes message when no recipes available', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      expect(screen.getByText(/No crafting recipes available/)).toBeInTheDocument();
    });
  });

  describe('task creation form', () => {
    it('new crafting task button is disabled when no recipes exist', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);

      const button = screen.getByTestId('new-crafting-task-button');
      expect(button).toBeDisabled();
    });
  });

  describe('task count display', () => {
    it('shows zero count when no tasks exist', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);

      expect(screen.getByText('Pending (0)')).toBeInTheDocument();
      expect(screen.getByText('Completed (0)')).toBeInTheDocument();
    });
  });
});

describe('CraftingActivity validation', () => {
  const defaultProps = {
    currentDayKey: 1,
    currentSlot: 0,
  };

  it('does not show validation error initially', () => {
    renderWithProviders(<CraftingActivity {...defaultProps} />);
    expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
  });
});
