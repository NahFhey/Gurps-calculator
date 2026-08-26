import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider } from '../../../state/campaignStore';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import { DowntimeProvider, useDowntimeContext } from '../DowntimeContext';

function makePayload(leaderId: string, toolIds: string[]): CreateTaskPayload {
  return {
    activityType: 'fishing',
    dayKey: 1,
    slot: 0,
    leaderId,
    helperIds: [],
    activityData: {
      type: 'fishing',
      method: 'Line',
      speciesId: '',
      isRandomCatch: true,
      spotId: 'spot-1',
      toolIds,
      baitId: null,
      retryAttempt: 0,
      skillModifier: 0,
      targetYield: 1,
    },
  };
}

function BatchHarness() {
  const { state, createDowntimeTasksBatch } = useDowntimeContext();
  return (
    <div>
      <span data-testid="task-count">{state.taskOrder.length}</span>
      <button
        type="button"
        onClick={() => createDowntimeTasksBatch([
          makePayload('char-1', ['rod-1']),
          makePayload('char-2', ['rod-1']),
        ])}
      >
        Submit bad batch
      </button>
    </div>
  );
}

describe('DowntimeContext batch creation', () => {
  it('dispatches zero tasks when any payload fails validation', () => {
    render(
      <CampaignStoreProvider>
        <DowntimeProvider currentDayKey={1} currentSlot={0}>
          <BatchHarness />
        </DowntimeProvider>
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit bad batch' }));
    expect(screen.getByTestId('task-count')).toHaveTextContent('0');
  });
});
