import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DowntimePanel } from '../DowntimePanel';
import { CampaignStoreProvider } from '../../../state/campaignStore';

// Wrapper component with CampaignStoreProvider
function renderWithProvider(ui: React.ReactElement) {
  return render(<CampaignStoreProvider>{ui}</CampaignStoreProvider>);
}

describe('DowntimePanel', () => {
  const defaultProps = {
    currentDayKey: 1,
    currentSlot: 0,
  };

  it('renders without crashing', () => {
    renderWithProvider(<DowntimePanel {...defaultProps} />);
    expect(screen.getByText('Downtime')).toBeInTheDocument();
  });

  it('shows tile grid by default', () => {
    renderWithProvider(<DowntimePanel {...defaultProps} />);
    expect(screen.getByText('Fishing')).toBeInTheDocument();
    expect(screen.getByText('Foraging')).toBeInTheDocument();
  });

  it('does not show back button on tile view', () => {
    renderWithProvider(<DowntimePanel {...defaultProps} />);
    expect(screen.queryByLabelText('Back to activities')).not.toBeInTheDocument();
  });

  it('navigates to fishing activity and shows back button', () => {
    renderWithProvider(<DowntimePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Fishing'));
    expect(screen.getByLabelText('Back to activities')).toBeInTheDocument();
    // Verify fishing activity is rendered
    expect(screen.getByTestId('fishing-activity')).toBeInTheDocument();
  });

  it('returns to tiles when back clicked', () => {
    renderWithProvider(<DowntimePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Fishing'));
    fireEvent.click(screen.getByLabelText('Back to activities'));
    expect(screen.getByText('Foraging')).toBeInTheDocument();
  });

  it('shows fishing activity with new task button', () => {
    renderWithProvider(<DowntimePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Fishing'));
    expect(screen.getByTestId('new-fishing-task-button')).toBeInTheDocument();
  });
});
