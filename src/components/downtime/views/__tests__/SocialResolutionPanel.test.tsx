import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rollVsTarget } from '../../../../utils/dice';
import { SocialResolutionPanel } from '../SocialResolutionPanel';
import type { Character, ContactEntry } from '../../../../types/campaign';
import type { RollVsTargetResult } from '../../../../utils/dice';
import type { SocialTask } from '../SocialTaskCard';

vi.mock('../../../../utils/dice', () => ({ rollVsTarget: vi.fn() }));
const mockedRollVsTarget = vi.mocked(rollVsTarget);
const leader: Character = { id: 'rina', name: 'Rina', work: { skills: { carousing: 12 } } };
const task: SocialTask = { id: 'social-1', activityType: 'social', dayKey: 1, slot: 0, leaderId: 'rina', helperIds: [], status: 'pending', activityData: { type: 'social', contactId: 'guild', contactName: 'Guild', skillKey: 'carousing' }, createdAt: 1, updatedAt: 1 };
const contact: ContactEntry = { id: 'guild', name: 'Guild', kind: 'faction', modifier: 1, history: [], createdAt: 1, updatedAt: 1 };

function result(total: number, target: number): RollVsTargetResult {
  return { expression: '3d6', dice: [3, 3, total - 6], modifier: 0, total, valid: true, target, margin: target - total, success: total <= target };
}

describe('SocialResolutionPanel', () => {
  beforeEach(() => mockedRollVsTarget.mockReset());

  it('rolls once and applies the attempt', () => {
    mockedRollVsTarget.mockReturnValue(result(10, 13));
    const onFinalize = vi.fn();
    render(<SocialResolutionPanel task={task} leader={leader} contact={contact} onFinalize={onFinalize} onCancel={vi.fn()} />);
    expect(screen.getByTestId('apply-social-button')).toBeDisabled();
    fireEvent.click(screen.getByTestId('roll-social-button'));
    expect(screen.getByText(/Success/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('apply-social-button'));
    expect(onFinalize.mock.calls[0]?.[1]).toMatchObject({ effectiveTarget: 13, delta: 1 });
  });

  it('shows a cap note when the rolled delta cannot fully apply', () => {
    mockedRollVsTarget.mockReturnValue(result(4, 16));
    render(<SocialResolutionPanel task={task} leader={leader} contact={{ ...contact, modifier: 4 }} onFinalize={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('roll-social-button'));
    expect(screen.getByTestId('social-cap-note')).toHaveTextContent(/already at the cap/i);
    expect(screen.getByText(/new standing \+4/i)).toBeInTheDocument();
  });
});
