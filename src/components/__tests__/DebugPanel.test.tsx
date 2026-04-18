import { useEffect } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../state/campaignStore';
import { DebugPanel } from '../DebugPanel';
import { ToastProvider } from '../ui';

function CampaignStateProbe() {
  const { state, actions } = useCampaignStore();

  useEffect(() => {
    actions.addLogEntry({
      id: 'log-1',
      timestamp: Date.now(),
      type: 'test',
      visibility: 'player',
      payload: { message: 'Existing log' }
    });
  }, [actions]);

  return (
    <div>
      <div data-testid="time-day">{state.time.day}</div>
      <div data-testid="log-count">{state.logs.entries.length}</div>
    </div>
  );
}

describe('DebugPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows error on invalid JSON and does not overwrite', () => {
    render(
      <ToastProvider>
        <CampaignStoreProvider>
          <CampaignStateProbe />
          <DebugPanel />
        </CampaignStoreProvider>
      </ToastProvider>
    );

    const input = screen.getByTestId('debug-json');
    fireEvent.change(input, { target: { value: '{invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    // Invalid JSON error appears before dialog, so no dialog confirmation needed
    expect(screen.getByTestId('debug-error')).toHaveTextContent('Invalid JSON');
    expect(screen.getByTestId('time-day')).toHaveTextContent('1');
  });

  it('applies valid JSON, overwrites time, and does not append logs', async () => {
    render(
      <ToastProvider>
        <CampaignStoreProvider>
          <CampaignStateProbe />
          <DebugPanel />
        </CampaignStoreProvider>
      </ToastProvider>
    );

    const input = screen.getByTestId('debug-json') as HTMLInputElement;
    const parsed = JSON.parse(input.value);
    parsed.time.day = 7;
    const updatedJson = JSON.stringify(parsed, null, 2);

    fireEvent.change(input, { target: { value: updatedJson } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    // Wait for the confirmation dialog to appear and click confirm
    await waitFor(() => {
      expect(screen.getByText('Apply Debug State')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(screen.getByTestId('time-day')).toHaveTextContent('7');
    });
    expect(screen.getByTestId('log-count')).toHaveTextContent('1');
  });
});
