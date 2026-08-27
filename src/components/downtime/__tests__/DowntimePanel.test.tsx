import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DowntimePanel } from '../DowntimePanel';
import { CampaignStoreProvider } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';

// Wrapper component with CampaignStoreProvider
function renderWithProvider(ui: React.ReactElement) {
  return render(<CampaignStoreProvider>{ui}</CampaignStoreProvider>);
}

function renderWithIntent(kind: 'cook' | 'craft') {
  const state = createCampaignState();
  state.ui.pendingIntent = kind === 'cook'
    ? { kind: 'cook', foodIds: [] }
    : { kind: 'craft' };
  return render(
    <CampaignStoreProvider initialCampaignState={state}>
      <DowntimePanel currentDayKey={1} currentSlot={0} />
    </CampaignStoreProvider>,
  );
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

  it('navigates to the rest task form', () => {
    renderWithProvider(<DowntimePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Rest'));
    expect(screen.getByTestId('rest-activity')).toBeInTheDocument();
    expect(screen.getByTestId('rest-task-form')).toBeInTheDocument();
  });

  it('navigates to cooking for a cook intent', () => {
    renderWithIntent('cook');
    expect(screen.getByPlaceholderText('Recipe name')).toBeInTheDocument();
  });

  it('navigates to crafting for a craft intent', () => {
    renderWithIntent('craft');
    expect(screen.getByTestId('crafting-activity')).toBeInTheDocument();
  });
});
