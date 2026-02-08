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

    it('renders with crafting-activity test id', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      expect(screen.getByTestId('crafting-activity')).toBeInTheDocument();
    });

    it('shows sub-view tabs', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Workbench')).toBeInTheDocument();
      expect(screen.getByText('Designs')).toBeInTheDocument();
    });

    it('defaults to Projects tab', () => {
      renderWithProviders(<CraftingActivity {...defaultProps} />);
      // Projects tab should be active (has orange border class)
      const projectsButton = screen.getByText('Projects');
      expect(projectsButton.closest('button')).toHaveClass('border-orange-500');
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
