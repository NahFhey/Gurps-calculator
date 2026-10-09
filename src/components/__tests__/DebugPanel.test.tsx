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

  it.each([
    ['a non-campaign object', () => ({ hello: 'world' }), 'does not look like a campaign state'],
    ['a malformed combat reveal', (json: Record<string, unknown>) => ({ ...json, combat: { reveal: 'x' } }), 'combat.reveal'],
    ['a campaign from a newer version', (json: Record<string, unknown>) => ({ ...json, meta: { schemaVersion: '1.99.0' } }), 'newer version of the app'],
  ])('refuses %s before asking to confirm', (_label, edit, message) => {
    render(
      <ToastProvider>
        <CampaignStoreProvider>
          <CampaignStateProbe />
          <DebugPanel />
        </CampaignStoreProvider>
      </ToastProvider>
    );

    const input = screen.getByTestId('debug-json') as HTMLTextAreaElement;
    const edited = edit(JSON.parse(input.value) as Record<string, unknown>);
    fireEvent.change(input, { target: { value: JSON.stringify(edited) } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    expect(screen.getByTestId('debug-error')).toHaveTextContent(message);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
