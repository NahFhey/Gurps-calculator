import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MiningActivity } from '../MiningActivity';
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

describe('MiningActivity', () => {
  const defaultProps = {
    currentDayKey: 1,
    currentSlot: 0,
  };

  describe('rendering', () => {
    it('renders mining activity header', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);
      expect(screen.getByText('Mining')).toBeInTheDocument();
    });

    it('shows new task button', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);
      expect(screen.getByTestId('new-mining-task-button')).toBeInTheDocument();
      expect(screen.getByText('New Mining Task')).toBeInTheDocument();
    });

    it('shows pending tasks section', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);
      expect(screen.getByTestId('pending-tasks-section')).toBeInTheDocument();
    });

    it('shows completed tasks section', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);
      expect(screen.getByTestId('completed-tasks-section')).toBeInTheDocument();
    });

    it('shows empty state for pending tasks', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);
      expect(screen.getByText('No pending mining tasks')).toBeInTheDocument();
    });

    it('shows empty state for completed tasks', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);
      expect(screen.getByText('No completed mining tasks')).toBeInTheDocument();
    });
  });

  describe('task creation form', () => {
    it('opens form when new task button is clicked', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);

      fireEvent.click(screen.getByTestId('new-mining-task-button'));

      expect(screen.getByTestId('mining-task-form')).toBeInTheDocument();
    });

    it('hides new task button when form is open', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);

      fireEvent.click(screen.getByTestId('new-mining-task-button'));

      expect(screen.queryByTestId('new-mining-task-button')).not.toBeInTheDocument();
    });

    it('closes form when cancel is clicked', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);

      fireEvent.click(screen.getByTestId('new-mining-task-button'));
      expect(screen.getByTestId('mining-task-form')).toBeInTheDocument();

      // The MiningTaskForm has a Cancel button
      const cancelButtons = screen.getAllByText('Cancel');
      fireEvent.click(cancelButtons[0]);
      expect(screen.queryByTestId('mining-task-form')).not.toBeInTheDocument();
    });
  });

  describe('task count display', () => {
    it('shows zero count when no tasks exist', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);

      expect(screen.getByText('Pending (0)')).toBeInTheDocument();
      expect(screen.getByText('Completed (0)')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('does not show validation error initially', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);
      expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
    });
  });

  describe('mapped sites', () => {
    it('does not show mapped sites section when no sites exist', () => {
      renderWithProviders(<MiningActivity {...defaultProps} />);
      expect(screen.queryByText(/Mapped Sites/)).not.toBeInTheDocument();
    });
  });
});
