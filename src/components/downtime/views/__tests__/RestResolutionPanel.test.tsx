import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RestResolutionPanel } from '../RestResolutionPanel';
import { CampaignStoreProvider } from '../../../../state/campaignStore';
import { createCampaignState } from '../../../../state/campaignReducer';
import { DowntimeProvider } from '../../DowntimeContext';
import { createDefaultGCSData } from '../../../../types/characterSheet';
import { rollVsTarget } from '../../../../utils/dice';
import type { RollVsTargetResult } from '../../../../utils/dice';
import type { Character } from '../../../../types/campaign';
import type { DowntimeTask } from '../../../../types/downtime';
import type { RestTask } from '../RestTaskCard';

vi.mock('../../../../utils/dice', () => ({ rollVsTarget: vi.fn() }));
const mockedRollVsTarget = vi.mocked(rollVsTarget);

function result(total: number, target: number, success: boolean): RollVsTargetResult {
  return { expression: '3d6', dice: [3, 3, total - 6], modifier: 0, total, valid: true, target, margin: target - total, success };
}

function makeLeader(withSheet = true): Character {
  const gcsData = createDefaultGCSData();
  gcsData.attributes.HT = 11;
  gcsData.pools.HP.current = 7;
  gcsData.pools.FP.current = 6;
  return {
    id: 'patient',
    name: 'Aldric',
    work: { skills: {} },
    ...(withSheet ? { gcsData } : {}),
  };
}

const task: RestTask = {
  id: 'rest-1', activityType: 'rest', dayKey: 1, slot: 0, leaderId: 'patient', helperIds: [], status: 'pending',
  activityData: { type: 'rest', restType: 'sleep', recoveryBonus: 0 }, createdAt: 1, updatedAt: 1,
};

function renderPanel({ leader = makeLeader(), otherTask }: { leader?: Character; otherTask?: DowntimeTask } = {}) {
  const state = createCampaignState();
  state.entities.characters[leader.id] = leader;
  if (otherTask) {
    state.downtime.tasksById[otherTask.id] = otherTask;
    state.downtime.taskOrder.push(otherTask.id);
  }
  const onFinalize = vi.fn();
  render(
    <CampaignStoreProvider initialCampaignState={state}>
      <DowntimeProvider currentDayKey={1} currentSlot={0}>
        <RestResolutionPanel task={task} leader={leader} healer={null} onFinalize={onFinalize} onCancel={vi.fn()} />
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
  return onFinalize;
}

describe('RestResolutionPanel', () => {
  beforeEach(() => mockedRollVsTarget.mockReset());

  it('rolls once and applies a deterministic recovery result', () => {
    mockedRollVsTarget.mockReturnValueOnce(result(9, 11, true));
    const onFinalize = renderPanel();
    const apply = screen.getByTestId('apply-recovery-button');
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByTestId('roll-recovery-button'));
    expect(screen.getByText(/HP restored: 1/)).toBeInTheDocument();
    expect(screen.getByText(/FP restored: 4/)).toBeInTheDocument();
    expect(screen.getByTestId('roll-recovery-button')).toBeDisabled();
    fireEvent.click(apply);
    expect(onFinalize).toHaveBeenCalledOnce();
    expect(onFinalize.mock.calls[0]?.[0].message).toContain('rolled 9 vs 11');
  });

  it('shows the full-day warning and allows a GM override', () => {
    const otherTask: DowntimeTask = {
      id: 'work-1', activityType: 'crafting', dayKey: 1, slot: 1, leaderId: 'patient', helperIds: [], status: 'resolved',
      activityData: {
        type: 'crafting', recipeId: 'recipe', materialInstanceIds: [], toolInstanceIds: [], qualityTarget: 'basic', skillModifier: 0,
      },
      createdAt: 1, updatedAt: 1,
    };
    mockedRollVsTarget.mockReturnValueOnce(result(9, 11, true));
    renderPanel({ otherTask });
    expect(screen.getByText(/worked other tasks today/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('full-day-override'));
    fireEvent.click(screen.getByTestId('roll-recovery-button'));
    expect(screen.getByText(/HP restored: 1/)).toBeInTheDocument();
  });

  it('resolves without pool math when the leader has no character sheet', () => {
    const onFinalize = renderPanel({ leader: makeLeader(false) });
    expect(screen.getByText(/recovery will not be tracked/i)).toBeInTheDocument();
    expect(screen.queryByTestId('roll-recovery-button')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('apply-recovery-button'));
    expect(onFinalize).toHaveBeenCalledWith(
      { success: true, message: 'No character sheet — recovery not tracked.' },
      null,
    );
  });
});
