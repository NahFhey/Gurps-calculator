import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../../state/campaignStore';
import { createCampaignState } from '../../../../state/campaignReducer';
import { DowntimeProvider } from '../../DowntimeContext';
import { TradingActivity } from '../TradingActivity';
import type { Character } from '../../../../types/campaign';
import type { DowntimeTask } from '../../../../types/downtime';

const leader: Character = { id: 'rina', name: 'Rina', work: { skills: { merchant: 13 } } };

function LogObserver() {
  const { state } = useCampaignStore();
  const last = state.logs.entries[0];
  return <div data-testid="last-log">{last ? `${last.type}:${String(last.payload.message)}` : 'none'}</div>;
}

function renderActivity(withTask = false) {
  const campaign = createCampaignState();
  campaign.downtime = { tasksById: {}, taskOrder: [], pendingDayLedger: null };
  campaign.entities.characters[leader.id] = leader;
  if (withTask) {
    const task: DowntimeTask = {
      id: 'trade-1', activityType: 'trading', dayKey: 1, slot: 0, leaderId: leader.id, helperIds: [], status: 'pending',
      activityData: { type: 'trading', merchantName: 'Copper Market', opposingSkill: 12 }, createdAt: 1, updatedAt: 1,
    };
    campaign.downtime.tasksById[task.id] = task;
    campaign.downtime.taskOrder.push(task.id);
  }
  render(
    <CampaignStoreProvider initialCampaignState={campaign}>
      <DowntimeProvider currentDayKey={1} currentSlot={0}>
        <TradingActivity currentDayKey={1} currentSlot={0} />
        <LogObserver />
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
}

describe('TradingActivity', () => {
  it('renders current-slot trading tasks', () => {
    renderActivity(true);
    expect(screen.getByTestId('trading-task-card')).toHaveTextContent('Copper Market');
    expect(screen.getByTestId('trading-task-card')).toHaveTextContent('Merchant-13');
  });

  it('creates a trip and logs the changelog entry', async () => {
    renderActivity();
    fireEvent.click(screen.getByTestId('new-trading-task-button'));
    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'rina' } });
    fireEvent.click(screen.getByTestId('submit-button'));
    await waitFor(() => expect(screen.getByTestId('last-log')).toHaveTextContent('trading.trip_created:Rina scheduled a market trip'));
    expect(screen.getByTestId('trading-task-card')).toBeInTheDocument();
  });
});
