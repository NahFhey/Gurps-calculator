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

    expect(screen.queryByTestId('advance-time')).not.toBeInTheDocument();
  });

  it('advances time when GM mode is enabled', () => {
    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');
    expect(timeDisplay).toHaveTextContent('Day 1 · Slot 1');

    fireEvent.click(screen.getByTestId('advance-time'));

    expect(timeDisplay).toHaveTextContent('Day 1 · Slot 2');
  });

  it('shows blocking error and prevents advance when paused sessions exist', () => {
    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <PauseActivities pausedIds={['paused-1']} />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const timeDisplay = screen.getByTestId('time-display');
    fireEvent.click(screen.getByTestId('advance-time'));

    expect(timeDisplay).toHaveTextContent('Day 1 · Slot 1');
    expect(screen.getByTestId('blocking-error')).toHaveTextContent(
      'Paused activities are blocking time advance.'
    );
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
    fireEvent.click(screen.getByTestId('advance-time'));

    expect(timeDisplay).toHaveTextContent('Day 1 · Slot 1');

    unmount();

    render(
      <CampaignStoreProvider>
        <EnableGmMode />
        <PauseActivities pausedIds={[]} />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('advance-time'));
    expect(screen.getByTestId('time-display')).toHaveTextContent('Day 1 · Slot 2');
  });
});
