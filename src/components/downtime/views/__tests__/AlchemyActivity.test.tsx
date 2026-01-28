import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlchemyActivity } from '../AlchemyActivity';
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

describe('AlchemyActivity', () => {
  const defaultProps = {
    currentDayKey: 1,
    currentSlot: 0,
  };

  describe('rendering', () => {
    it('renders alchemy activity header', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      expect(screen.getByText('Alchemy')).toBeInTheDocument();
    });

    it('shows new work session button', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      expect(screen.getByTestId('new-alchemy-task-button')).toBeInTheDocument();
      expect(screen.getByText('New Work Session')).toBeInTheDocument();
    });

    it('shows pending tasks section', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      expect(screen.getByTestId('pending-tasks-section')).toBeInTheDocument();
    });

    it('shows completed tasks section', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      expect(screen.getByTestId('completed-tasks-section')).toBeInTheDocument();
    });

    it('shows empty state for pending tasks', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      expect(screen.getByText('No pending alchemy tasks')).toBeInTheDocument();
    });

    it('shows empty state for completed tasks', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      expect(screen.getByText('No completed alchemy tasks')).toBeInTheDocument();
    });

    it('shows no batches message when no active batches', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      expect(screen.getByText(/No active batches/)).toBeInTheDocument();
    });
  });

  describe('task creation form', () => {
    it('new work session button is disabled when no batches exist', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);

      const button = screen.getByTestId('new-alchemy-task-button');
      expect(button).toBeDisabled();
    });
  });

  describe('task count display', () => {
    it('shows zero count when no tasks exist', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);

      expect(screen.getByText('Pending (0)')).toBeInTheDocument();
      expect(screen.getByText('Completed (0)')).toBeInTheDocument();
    });
  });
});

describe('AlchemyActivity validation', () => {
  const defaultProps = {
    currentDayKey: 1,
    currentSlot: 0,
  };

  it('does not show validation error initially', () => {
    renderWithProviders(<AlchemyActivity {...defaultProps} />);
    expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
  });
});
