import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RestActivity } from '../RestActivity';
import { CampaignStoreProvider, useCampaignStore } from '../../../../state/campaignStore';
import { createCampaignState } from '../../../../state/campaignReducer';
import { DowntimeProvider } from '../../DowntimeContext';
import { createDefaultGCSData } from '../../../../types/characterSheet';
import type { Character } from '../../../../types/campaign';
import type { DowntimeTask } from '../../../../types/downtime';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  const gcsData = createDefaultGCSData();
  gcsData.pools.HP.current = 6;
  gcsData.pools.FP.current = 8;
  return { id: 'patient', name: 'Aldric', work: { skills: {} }, gcsData, ...overrides };
}

function LogObserver() {
  const { state } = useCampaignStore();
  const last = state.logs.entries[0];
  const character = state.entities.characters.patient;
  return (
    <>
      <div data-testid="last-log">{last ? `${last.type}:${String(last.payload.message)}` : 'none'}</div>
      <pre data-testid="patient-state">{JSON.stringify(character)}</pre>
    </>
  );
}

function renderActivity(withTask = false, character = makeCharacter()) {
  const campaign = createCampaignState();
  campaign.downtime = { tasksById: {}, taskOrder: [], pendingDayLedger: null };
  campaign.entities.characters = { [character.id]: character };
  if (withTask) {
    const task: DowntimeTask = {
      id: 'rest-1', activityType: 'rest', dayKey: 1, slot: 0, leaderId: character.id, helperIds: [], status: 'pending',
      activityData: { type: 'rest', restType: 'sleep', recoveryBonus: 0 }, createdAt: 1, updatedAt: 1,
    };
    campaign.downtime = {
      tasksById: { [task.id]: task },
      taskOrder: [task.id],
      pendingDayLedger: null,
    };
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('lists persistent conditions and human-readable crippled limbs in the recovery strip', () => {
    renderActivity(false, makeCharacter({
      status: {
        conditions: [{ instanceId: 'poison', conditionId: 'poisoned', label: 'Poisoned' }],
        crippled: ['armR'],
      },
    }));

    expect(screen.getByTestId('party-recovery-status')).toHaveTextContent('Poisoned');
    expect(screen.getByTestId('party-recovery-status')).toHaveTextContent('Crippled: Right Arm');
  });

  it('clears unconscious when finalized recovery raises HP above zero', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const patient = makeCharacter({
      status: { conditions: [{ instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' }] },
    });
    if (!patient.gcsData) throw new Error('Expected test character sheet');
    patient.gcsData.pools.HP.current = 0;
    renderActivity(true, patient);

    fireEvent.click(screen.getByTestId('resolve-button'));
    fireEvent.click(screen.getByTestId('roll-recovery-button'));
    fireEvent.click(screen.getByTestId('apply-recovery-button'));

    await waitFor(() => {
      const updated = JSON.parse(screen.getByTestId('patient-state').textContent ?? '{}');
      expect(updated.gcsData.pools.HP.current).toBe(1);
      expect(updated).not.toHaveProperty('status');
    });
  });

  it('keeps unconscious when finalized recovery does not raise HP above zero', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const patient = makeCharacter({
      status: { conditions: [{ instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' }] },
    });
    if (!patient.gcsData) throw new Error('Expected test character sheet');
    patient.gcsData.pools.HP.current = -1;
    renderActivity(true, patient);

    fireEvent.click(screen.getByTestId('resolve-button'));
    fireEvent.click(screen.getByTestId('roll-recovery-button'));
    fireEvent.click(screen.getByTestId('apply-recovery-button'));

    await waitFor(() => {
      const updated = JSON.parse(screen.getByTestId('patient-state').textContent ?? '{}');
      expect(updated.gcsData.pools.HP.current).toBe(0);
      expect(updated.status.conditions[0].conditionId).toBe('unconscious');
    });
  });

  it('leaves unrelated persistent conditions untouched during recovery', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const patient = makeCharacter({
      status: { conditions: [{ instanceId: 'poison', conditionId: 'poisoned', label: 'Poisoned' }] },
    });
    if (!patient.gcsData) throw new Error('Expected test character sheet');
    patient.gcsData.pools.HP.current = 0;
    renderActivity(true, patient);

    fireEvent.click(screen.getByTestId('resolve-button'));
    fireEvent.click(screen.getByTestId('roll-recovery-button'));
    fireEvent.click(screen.getByTestId('apply-recovery-button'));

    await waitFor(() => {
      const updated = JSON.parse(screen.getByTestId('patient-state').textContent ?? '{}');
      expect(updated.status.conditions[0].conditionId).toBe('poisoned');
    });
  });
});
