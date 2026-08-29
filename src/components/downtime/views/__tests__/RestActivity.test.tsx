import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RestActivity } from '../RestActivity';
import { CampaignStoreProvider, useCampaignStore } from '../../../../state/campaignStore';
import { createCampaignState } from '../../../../state/campaignReducer';
import { DowntimeProvider } from '../../DowntimeContext';
import { createDefaultGCSData } from '../../../../types/characterSheet';
import type { Character } from '../../../../types/campaign';
import type { DowntimeTask } from '../../../../types/downtime';

function makeCharacter(): Character {
  const gcsData = createDefaultGCSData();
  gcsData.pools.HP.current = 6;
  gcsData.pools.FP.current = 8;
  return { id: 'patient', name: 'Aldric', work: { skills: {} }, gcsData };
}

function LogObserver() {
  const { state } = useCampaignStore();
  const last = state.logs.entries[0];
  return <div data-testid="last-log">{last ? `${last.type}:${String(last.payload.message)}` : 'none'}</div>;
}

function renderActivity(withTask = false) {
  const campaign = createCampaignState();
  campaign.downtime = { tasksById: {}, taskOrder: [], pendingDayLedger: null };
  const character = makeCharacter();
  campaign.entities.characters[character.id] = character;
  if (withTask) {
    const task: DowntimeTask = {
      id: 'rest-1', activityType: 'rest', dayKey: 1, slot: 0, leaderId: character.id, helperIds: [], status: 'pending',
      activityData: { type: 'rest', restType: 'sleep', recoveryBonus: 0 }, createdAt: 1, updatedAt: 1,
    };
    campaign.downtime.tasksById[task.id] = task;
    campaign.downtime.taskOrder.push(task.id);
  }
  return render(
    <CampaignStoreProvider initialCampaignState={campaign}>
      <DowntimeProvider currentDayKey={1} currentSlot={0}>
        <RestActivity currentDayKey={1} currentSlot={0} />
        <LogObserver />
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
}

describe('RestActivity', () => {
  it('renders the recovery status strip and current-slot task list', () => {
    renderActivity(true);
    const status = screen.getByTestId('party-recovery-status');
    expect(status).toHaveTextContent('Aldric');
    expect(status).toHaveTextContent('HP 6/10');
    expect(status).toHaveTextContent('FP 8/10');
    expect(screen.getByTestId('rest-task-card')).toHaveTextContent('Sleep');
  });

  it('creates a rest task and logs the changelog entry', async () => {
    renderActivity();
    fireEvent.click(screen.getByTestId('new-rest-task-button'));
    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'patient' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('last-log')).toHaveTextContent('rest.task_created:Aldric scheduled sleep');
    });
    expect(screen.getByTestId('rest-task-card')).toBeInTheDocument();
  });
});
