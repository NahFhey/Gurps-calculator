import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../ui', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../../utils/effectsEngine', () => ({
  getActiveEffects: vi.fn(() => []),
}));

vi.mock('../../../utils/conditionsEngine', () => ({
  getActiveConditions: vi.fn(
    (participant: { conditions?: unknown[] }) => participant.conditions || []
  ),
  formatConditionDuration: vi.fn(() => 'Permanent'),
}));

vi.mock('../../../constants/conditions', () => ({
  getConditionIcon: vi.fn(() => '💫'),
  getCondition: vi.fn(() => null),
}));

import { ParticipantListView } from '../views/ParticipantListView';
import type { Participant, ConditionInstance } from '../../../types/combatTracker';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeCondition(n: number, overrides: Partial<ConditionInstance> = {}): ConditionInstance {
  return {
    instanceId: `ci-${n}`,
    conditionId: `cond-${n}`,
    label: `Condition ${n}`,
    ...overrides,
  };
}

function makeParticipant(conditions: ConditionInstance[]): Participant {
  return {
    instanceId: 'p-1',
    name: 'Ogre',
    category: 'enemy',
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    hp: 15,
    fp: 10,
    mp: 0,
    currentHP: 15,
    currentFP: 10,
    basicSpeed: 5,
    basicMove: 5,
    conditions,
  };
}

function renderList(
  conditions: ConditionInstance[],
  onOpenConditions?: (id: string, anchor: { x: number; y: number }) => void
) {
  return render(
    <ParticipantListView
      participants={[makeParticipant(conditions)]}
      currentActorInstanceId="p-1"
      viewMode="gm"
      onUpdateResource={vi.fn()}
      onOpenConditions={onOpenConditions}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ParticipantListView conditions (Phase 12a.6)', () => {
  const sixConditions = [1, 2, 3, 4, 5, 6].map((n) => makeCondition(n));

  it('caps inline badges at 4 and shows a "+N" pill', () => {
    renderList(sixConditions, vi.fn());

    expect(screen.getByLabelText('Condition 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Condition 4')).toBeInTheDocument();
    expect(screen.queryByLabelText('Condition 5')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Condition 6')).not.toBeInTheDocument();
    expect(screen.getByLabelText('2 more conditions')).toBeInTheDocument();
  });

  it('shows no pill at 4 or fewer conditions', () => {
    renderList(sixConditions.slice(0, 4), vi.fn());

    expect(screen.getByLabelText('Condition 4')).toBeInTheDocument();
    expect(screen.queryByLabelText(/more condition/)).not.toBeInTheDocument();
  });

  it('sorts urgent conditions into the visible set', () => {
    const withExpiring = [
      ...sixConditions.slice(0, 4),
      makeCondition(9, {
        label: 'Expiring',
        expiresAt: { type: 'turn', turnsRemaining: 0 },
      }),
    ];
    renderList(withExpiring, vi.fn());

    // The expiring condition displaces the last permanent one
    expect(screen.getByLabelText('Expiring')).toBeInTheDocument();
    expect(screen.queryByLabelText('Condition 4')).not.toBeInTheDocument();
    expect(screen.getByLabelText('1 more condition')).toBeInTheDocument();
  });

  it('pill click opens the popover with the participant id', () => {
    const onOpenConditions = vi.fn();
    renderList(sixConditions, onOpenConditions);

    fireEvent.click(screen.getByLabelText('2 more conditions'));
    expect(onOpenConditions).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
  });

  it('renders the manage button when onOpenConditions is provided — even with no conditions', () => {
    const onOpenConditions = vi.fn();
    renderList([], onOpenConditions);

    fireEvent.click(screen.getByLabelText('Manage conditions for Ogre'));
    expect(onOpenConditions).toHaveBeenCalledWith('p-1', expect.anything());
  });

  it('hides the manage button and renders a static pill without onOpenConditions (player view)', () => {
    renderList(sixConditions, undefined);

    expect(screen.queryByLabelText('Manage conditions for Ogre')).not.toBeInTheDocument();
    const pill = screen.getByLabelText('2 more conditions');
    expect(pill.tagName).toBe('SPAN');
  });

  it('renders no conditions section for a clean participant in player view', () => {
    renderList([], undefined);

    expect(screen.queryByText('Conditions:')).not.toBeInTheDocument();
  });
});
