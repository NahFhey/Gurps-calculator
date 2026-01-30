import React, { useEffect } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../state/campaignStore';
import { UnifiedShell } from '../UnifiedShell';

const modules = [
  { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> }
];

function EnableGmMode() {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.toggleGmMode();
  }, [actions]);
  return null;
}

function PauseActivities({ pausedIds = [] }) {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.setPausedSessionIds(pausedIds);
  }, [actions, pausedIds]);
  return null;
}

describe('UnifiedShell time header', () => {
  it('hides advance time button when GM mode is disabled', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    // TimeControls compact uses 'advance-slot-compact' test ID
    expect(screen.queryByTestId('advance-slot-compact')).not.toBeInTheDocument();
  });

  it('advances time when GM mode is enabled', () => {
    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');
    // TimeDisplay shows Day number and slot label (Morning, Afternoon, Night)
    expect(timeDisplay).toHaveTextContent('Day');
    expect(timeDisplay).toHaveTextContent('1');
    expect(timeDisplay).toHaveTextContent('Morning');

    fireEvent.click(screen.getByTestId('advance-slot-compact'));

    // After advancing, slot changes to Afternoon
    expect(timeDisplay).toHaveTextContent('Afternoon');
  });

  it('disables advance button and prevents advance when paused sessions exist', () => {
    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <PauseActivities pausedIds={['paused-1']} />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');
    const advanceButton = screen.getByTestId('advance-slot-compact');

    // Button should be disabled due to paused activities
    expect(advanceButton).toBeDisabled();

    // Click should not advance time - still Morning
    fireEvent.click(advanceButton);
    expect(timeDisplay).toHaveTextContent('Morning');
  });

  it('advances time after paused sessions are cleared', () => {
    const { unmount } = render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <PauseActivities pausedIds={['paused-1']} />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');
    fireEvent.click(screen.getByTestId('advance-slot-compact'));

    // Time should not advance - still Morning
    expect(timeDisplay).toHaveTextContent('Morning');

    unmount();

    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <PauseActivities pausedIds={[]} />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('advance-slot-compact'));
    // After advancing without paused activities, slot changes to Afternoon
    expect(screen.getByTestId('time-display')).toHaveTextContent('Afternoon');
  });
});
