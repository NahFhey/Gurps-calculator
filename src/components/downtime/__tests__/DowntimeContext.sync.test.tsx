import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import { createTask } from '../../../state/downtime';
import type { DowntimeTask } from '../../../types/downtime';
import { DowntimeProvider, useDowntimeContext } from '../DowntimeContext';

const travelTask: DowntimeTask = {
  id: 'external-travel', activityType: 'travel', dayKey: 1, slot: 0,
  leaderId: 'a', helperIds: [], status: 'resolved',
  activityData: { type: 'travel', journeyId: 'j', groupId: 'g', vehicleId: null, milesMoved: 12, drifted: false },
  results: { success: true, message: '12 mi toward camp' }, createdAt: 1, updatedAt: 1,
};

function SyncHarness() {
  const { actions } = useCampaignStore();
  const { state, dispatch } = useDowntimeContext();
  return (
    <div>
      <span data-testid="ids">{state.taskOrder.join(',')}</span>
      <button type="button" onClick={() => actions.setDowntime({ tasksById: { [travelTask.id]: travelTask }, taskOrder: [travelTask.id], pendingDayLedger: null })}>
        Campaign write
      </button>
      <button type="button" onClick={() => dispatch(createTask({
        id: 'local-rest', activityType: 'rest', dayKey: 1, slot: 1, leaderId: 'b', helperIds: [],
        activityData: { type: 'rest', restType: 'sleep', recoveryBonus: 0 },
      }))}>
        Local write
      </button>
    </div>
  );
}

describe('DowntimeProvider campaign adoption', () => {
  it('adopts campaign writes and preserves them through the next local dispatch', async () => {
    const initial = createCampaignState();
    initial.entities = {
      ...initial.entities,
      characters: {
        a: { id: 'a', name: 'A', work: { skills: {} } },
        b: { id: 'b', name: 'B', work: { skills: {} } },
      },
    };
    initial.downtime = { tasksById: {}, taskOrder: [], pendingDayLedger: null };
    render(
      <CampaignStoreProvider initialCampaignState={initial}>
        <DowntimeProvider><SyncHarness /></DowntimeProvider>
      </CampaignStoreProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Campaign write' }));
    await waitFor(() => expect(screen.getByTestId('ids')).toHaveTextContent('external-travel'));
    fireEvent.click(screen.getByRole('button', { name: 'Local write' }));
    await waitFor(() => expect(screen.getByTestId('ids')).toHaveTextContent('external-travel,local-rest'));
  });
});
