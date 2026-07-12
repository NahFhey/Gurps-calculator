/**
 * useCombatConditions — Phase 12a.6 eye-state cycle handler.
 *
 * Add/remove/update flows are exercised through the combat integration
 * suite; this file covers the reveal-cycle handler added for the
 * condition-visibility eye control.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockSaveCombatActive } = vi.hoisted(() => ({
  mockSaveCombatActive: vi.fn(),
}));

vi.mock('../useCombatStore', () => ({
  useCombatStore: () => ({ saveCombatActive: mockSaveCombatActive }),
}));

import { useCombatConditions } from '../useCombatConditions';
import { ACTION_TYPES } from '../../utils/combatActions';
import type { CombatState, Participant, ConditionInstance } from '../../types/combatTracker';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
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
    basicSpeed: 5,
    basicMove: 5,
    ...overrides,
  };
}

function makeCondition(overrides: Partial<ConditionInstance> = {}): ConditionInstance {
  return {
    instanceId: 'ci-1',
    conditionId: 'poisoned',
    label: 'Poisoned',
    revealed: 'closed',
    ...overrides,
  };
}

function makeCombat(participants: Participant[]): CombatState {
  return {
    id: 'combat-1',
    name: 'Test Combat',
    startTime: 0,
    participants,
    turnOrder: participants.map((p) => p.instanceId),
    currentTurnIndex: 0,
    currentRound: 2,
    turnDecisions: {},
    log: [],
  };
}

function setup(condition: ConditionInstance | null, options: { withActor?: boolean } = {}) {
  const { withActor = true } = options;
  const actor = makeParticipant({
    conditions: condition ? [condition] : [],
  });
  const bystander = makeParticipant({
    instanceId: 'p-2',
    name: 'Goblin',
    conditions: [makeCondition({ instanceId: 'ci-other', revealed: 'open' })],
  });
  const combat = makeCombat([actor, bystander]);
  const recordAction = vi.fn();

  const { result } = renderHook(() =>
    useCombatConditions({
      combat,
      currentActorTruth: withActor ? actor : undefined,
      recordAction,
    }),
  );

  return { result, combat, recordAction };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCombatConditions.handleCycleConditionRevealed', () => {
  beforeEach(() => {
    mockSaveCombatActive.mockClear();
  });

  it('cycles closed → half on the targeted instance', () => {
    const { result } = setup(makeCondition({ revealed: 'closed' }));

    act(() => result.current.handleCycleConditionRevealed('ci-1'));

    expect(mockSaveCombatActive).toHaveBeenCalledTimes(1);
    const saved = mockSaveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.participants[0].conditions?.[0].revealed).toBe('half');
  });

  it('cycles half → open and open → closed', () => {
    const half = setup(makeCondition({ revealed: 'half' }));
    act(() => half.result.current.handleCycleConditionRevealed('ci-1'));
    let saved = mockSaveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.participants[0].conditions?.[0].revealed).toBe('open');

    mockSaveCombatActive.mockClear();

    const open = setup(makeCondition({ revealed: 'open' }));
    act(() => open.result.current.handleCycleConditionRevealed('ci-1'));
    saved = mockSaveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.participants[0].conditions?.[0].revealed).toBe('closed');
  });

  it('treats a missing reveal state as visible — first click hides', () => {
    const { result } = setup(makeCondition({ revealed: undefined }));

    act(() => result.current.handleCycleConditionRevealed('ci-1'));

    const saved = mockSaveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.participants[0].conditions?.[0].revealed).toBe('closed');
  });

  it('leaves other participants and instances untouched', () => {
    const { result } = setup(makeCondition({ revealed: 'closed' }));

    act(() => result.current.handleCycleConditionRevealed('ci-1'));

    const saved = mockSaveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.participants[1].conditions?.[0].revealed).toBe('open');
  });

  it('records an undoable update action without logging to the combat log', () => {
    const { result, recordAction } = setup(makeCondition({ revealed: 'closed' }));

    act(() => result.current.handleCycleConditionRevealed('ci-1'));

    expect(recordAction).toHaveBeenCalledTimes(1);
    const action = recordAction.mock.calls[0][0] as {
      type: string;
      payload: { fromCondition: ConditionInstance; toCondition: ConditionInstance };
    };
    expect(action.type).toBe(ACTION_TYPES.UPDATE_CONDITION);
    expect(action.payload.fromCondition.revealed).toBe('closed');
    expect(action.payload.toCondition.revealed).toBe('half');

    // Reveal state is GM-secret — the player-visible combat log stays clean
    const saved = mockSaveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.log).toHaveLength(0);
  });

  it('is a no-op when the instance is not on the current actor', () => {
    const { result, recordAction } = setup(makeCondition());

    act(() => result.current.handleCycleConditionRevealed('ci-missing'));

    expect(mockSaveCombatActive).not.toHaveBeenCalled();
    expect(recordAction).not.toHaveBeenCalled();
  });

  it('is a no-op without a current actor', () => {
    const { result, recordAction } = setup(makeCondition(), { withActor: false });

    act(() => result.current.handleCycleConditionRevealed('ci-1'));

    expect(mockSaveCombatActive).not.toHaveBeenCalled();
    expect(recordAction).not.toHaveBeenCalled();
  });
});
