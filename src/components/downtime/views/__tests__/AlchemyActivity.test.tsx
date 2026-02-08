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

    it('renders with alchemy-activity test id', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      expect(screen.getByTestId('alchemy-activity')).toBeInTheDocument();
    });

    it('shows sub-view tabs', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      // Some tab labels also appear in content, so use getAllByText where needed
      expect(screen.getByText('Reagents')).toBeInTheDocument();
      expect(screen.getAllByText('Analysis').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('Formulas')).toBeInTheDocument();
      expect(screen.getByText('Batches')).toBeInTheDocument();
      expect(screen.getByText('Tally')).toBeInTheDocument();
    });

    it('does not show a Work Sessions tab', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      expect(screen.queryByText('Work Sessions')).not.toBeInTheDocument();
    });

    it('defaults to Reagents tab', () => {
      renderWithProviders(<AlchemyActivity {...defaultProps} />);
      // Reagents tab should be active (has purple border class)
      const reagentsButton = screen.getByText('Reagents');
      expect(reagentsButton.closest('button')).toHaveClass('border-purple-500');
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
