import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../../state/campaignStore';
import { createCampaignState } from '../../../../state/campaignReducer';
import { DowntimeProvider } from '../../DowntimeContext';
import { rollVsTarget } from '../../../../utils/dice';
import { SocialActivity } from '../SocialActivity';
import type { CampaignState } from '../../../../state/campaignReducer';
import type { Character, ContactEntry } from '../../../../types/campaign';
import type { RollVsTargetResult } from '../../../../utils/dice';
import type { SocialTask } from '../SocialTaskCard';

vi.mock('../../../../utils/dice', () => ({ rollVsTarget: vi.fn() }));
const mockedRollVsTarget = vi.mocked(rollVsTarget);
const leader: Character = { id: 'rina', name: 'Rina', work: { skills: { carousing: 12, diplomacy: 14 } } };
const contact: ContactEntry = { id: 'guild', name: "Dockworkers' Guild", kind: 'faction', modifier: 1, notes: 'Controls the harbor', history: [{ id: 'shift-1', dayKey: 1, delta: 1, newModifier: 1, cause: 'GM adjustment', timestamp: 1 }], createdAt: 1, updatedAt: 1 };

function result(total: number, target: number): RollVsTargetResult {
  return { expression: '3d6', dice: [3, 3, total - 6], modifier: 0, total, valid: true, target, margin: target - total, success: total <= target };
}

function task(): SocialTask {
  return { id: 'social-1', activityType: 'social', dayKey: 1, slot: 0, leaderId: leader.id, helperIds: [], status: 'pending', activityData: { type: 'social', contactId: contact.id, contactName: contact.name, skillKey: 'carousing' }, createdAt: 1, updatedAt: 1 };
}

function Observer() {
  const { state } = useCampaignStore();
  const entries = Object.values(state.entities.contacts ?? {});
  return <div data-testid="observer">contacts:{entries.map((entry) => `${entry.name}:${entry.modifier}:${entry.history.length}`).join('|')};tasks:{Object.values(state.downtime.tasksById).map((entry) => `${entry.id}:${entry.status}`).join('|')};logs:{state.logs.entries.map((entry) => entry.type).join(',')}</div>;
}

function renderActivity(configure?: (state: CampaignState) => void) {
  const state = createCampaignState();
  state.entities.characters = { [leader.id]: leader };
  state.entities.contacts = { [contact.id]: contact };
  state.downtime = { tasksById: {}, taskOrder: [], pendingDayLedger: null };
  configure?.(state);
  render(<CampaignStoreProvider initialCampaignState={state}><DowntimeProvider currentDayKey={1} currentSlot={0}><SocialActivity currentDayKey={1} currentSlot={0} /><Observer /></DowntimeProvider></CampaignStoreProvider>);
}

describe('SocialActivity', () => {
  beforeEach(() => mockedRollVsTarget.mockReset());

  it('renders, edits, and expands ledger history', async () => {
    renderActivity();
    expect(screen.getByTestId('contact-card')).toHaveTextContent("Dockworkers' Guild");
    fireEvent.click(screen.getByTestId('contact-history-toggle'));
    expect(screen.getByTestId('contact-history')).toHaveTextContent('Day 1: +1 → +1 — GM adjustment');
    fireEvent.click(screen.getByLabelText("Edit Dockworkers' Guild"));
    fireEvent.change(screen.getByLabelText('Contact modifier'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('save-contact-button'));
    await waitFor(() => expect(screen.getByTestId('observer')).toHaveTextContent("Dockworkers' Guild:2:2"));
    expect(screen.getByTestId('observer')).toHaveTextContent('social.contact_adjusted');
  });

  it('resolves a roll, shifts standing, and logs the attempt', async () => {
    mockedRollVsTarget.mockReturnValue(result(10, 13));
    renderActivity((state) => { const pending = task(); state.downtime.tasksById[pending.id] = pending; state.downtime.taskOrder = [pending.id]; });
    fireEvent.click(screen.getByTestId('resolve-button'));
    fireEvent.click(screen.getByTestId('roll-social-button'));
    fireEvent.click(screen.getByTestId('apply-social-button'));
    await waitFor(() => expect(screen.getByTestId('observer')).toHaveTextContent("Dockworkers' Guild:2:2"));
    expect(screen.getByTestId('observer')).toHaveTextContent('social-1:resolved');
    expect(screen.getByTestId('observer')).toHaveTextContent('social.attempt_resolved');
  });

  it('find-or-create reuses a contact with a normalized matching name', async () => {
    renderActivity();
    fireEvent.click(screen.getByTestId('new-social-task-button'));
    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'rina' } });
    fireEvent.change(screen.getByTestId('contact-select'), { target: { value: '__new__' } });
    fireEvent.change(screen.getByTestId('new-contact-name-input'), { target: { value: "  dockworkers' guild  " } });
    fireEvent.click(screen.getByTestId('submit-button'));
    await waitFor(() => expect(screen.getByTestId('observer')).toHaveTextContent(':pending'));
    expect(screen.getAllByTestId('contact-card')).toHaveLength(1);
    expect(screen.getByTestId('observer').textContent?.match(/Dockworkers' Guild/g)).toHaveLength(1);
  });
});
