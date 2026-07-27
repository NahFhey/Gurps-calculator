import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActionCompleteData,
  CombatState,
  Participant,
  RevealState,
} from '../../types/combatTracker';
import { ACTION_TYPES } from '../../utils/combatActions';
import { createInitialRevealState } from '../../utils/combatReveal';

vi.mock('../useCombatStore', () => ({
  useCombatStore: vi.fn(),
}));

import { useActionResolution } from '../useActionResolution';
import { useCombatStore } from '../useCombatStore';

const mockedUseCombatStore = vi.mocked(useCombatStore);
type CombatStoreValue = ReturnType<typeof useCombatStore>;

interface RecordedAction {
  type: string;
  payload: Record<string, unknown>;
  revealUpdate?: {
    set: Record<string, unknown>;
  };
}

function makeParticipant(
  overrides: Partial<Participant> = {},
): Participant {
  return {
    instanceId: 'hero',
    name: 'Aria',
    category: 'player',
    st: 11,
    dx: 12,
    iq: 10,
    ht: 11,
    hp: 12,
    fp: 11,
    mp: 0,
    maxHP: 12,
    currentHP: 12,
    basicSpeed: 5.75,
    basicMove: 5,
    conditions: [],
    ...overrides,
  };
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  const participants = [
    makeParticipant(),
    makeParticipant({
      instanceId: 'ogre',
      name: 'Ogre',
      category: 'enemy',
      hp: 15,
      maxHP: 15,
      currentHP: 15,
    }),
  ];

  return {
    id: 'combat-1',
    name: 'Bridge Ambush',
    startTime: 1_000,
    participants,
    turnOrder: participants.map((participant) => participant.instanceId),
    currentTurnIndex: 0,
    currentRound: 2,
    turnDecisions: {},
    log: [],
    ...overrides,
  };
}

function makeReveal(combat: CombatState): RevealState {
  const initial = createInitialRevealState(combat.id, combat.participants);
  return {
    version: initial.version,
    combatId: combat.id,
    byInstanceId: initial.byInstanceId,
  };
}

function makeStoreValue(
  saveCombatActive: CombatStoreValue['saveCombatActive'],
  saveCombatReveal: CombatStoreValue['saveCombatReveal'],
): CombatStoreValue {
  return {
    combatCharacters: [],
    partyCharacters: [],
    combatActive: null,
    combatHistory: [],
    combatTombstones: [],
    combatRulesPreset: 'standard',
    combatReveal: null,
    combatItems: [],
    encounterTemplates: {},
    saveCombatCharacters: vi.fn(),
    saveCombatActive,
    saveCombatHistory: vi.fn(),
    saveCombatTombstones: vi.fn(),
    saveCombatRulesPreset: vi.fn(),
    saveCombatItems: vi.fn(),
    saveCombatReveal,
    addEncounterTemplate: vi.fn(),
    updateEncounterTemplate: vi.fn(),
    removeEncounterTemplate: vi.fn(),
    updatePartyCharacter: vi.fn(),
  };
}

function setup(options: {
  combat?: CombatState;
  reveal?: RevealState | null;
} = {}) {
  const combat = options.combat ?? makeCombat();
  const reveal =
    options.reveal === undefined ? makeReveal(combat) : options.reveal;
  const saveCombatActive =
    vi.fn<CombatStoreValue['saveCombatActive']>();
  const saveCombatReveal =
    vi.fn<CombatStoreValue['saveCombatReveal']>();
  const recordAction = vi.fn();

  mockedUseCombatStore.mockReturnValue(
    makeStoreValue(saveCombatActive, saveCombatReveal),
  );

  const hook = renderHook(() =>
    useActionResolution({
      combat,
      reveal,
      currentActorInstanceId: 'hero',
      currentActorName: 'Aria',
      selectedManeuver: 'attack',
      recordAction,
    }),
  );

  return {
    ...hook,
    combat,
    reveal,
    saveCombatActive,
    saveCombatReveal,
    recordAction,
  };
}

function recordedActions(
  recordAction: ReturnType<typeof vi.fn>,
): RecordedAction[] {
  return recordAction.mock.calls.map(
    ([action]) => action as RecordedAction,
  );
}

describe('useActionResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies injury, HP, all resolved effects, reveal changes, and history actions', () => {
    const {
      result,
      saveCombatActive,
      saveCombatReveal,
      recordAction,
    } = setup();
    const action: ActionCompleteData = {
      kind: 'injury',
      targetInstanceId: 'ogre',
      newHP: -1,
      injury: {
        hitLocation: { locationLabel: 'Right Arm' },
        damageBreakdown: {
          injuryApplied: 16,
          raw: 18,
          dr: 2,
          penetrating: 16,
          damageType: 'cut',
        },
        effects: [
          { type: 'shock', autoApplied: true, value: -4 },
          { type: 'knockdownStun', success: false },
          { type: 'consciousnessCheck', success: false },
          { type: 'deathCheck', success: false },
          { type: 'bleeding', outcome: 'yes' },
          {
            type: 'crippling',
            autoApplied: true,
            locationKey: 'right-arm',
            locationLabel: 'Right Arm',
          },
        ],
      },
    };

    act(() => result.current.handleActionComplete(action));

    expect(saveCombatActive).toHaveBeenCalledOnce();
    const saved = saveCombatActive.mock.calls[0][0] as CombatState;
    const target = saved.participants.find(
      (participant) => participant.instanceId === 'ogre',
    );
    expect(target).toMatchObject({
      currentHP: -1,
      shockPenalty: -4,
      isDead: true,
      bleeding: { rate: 1, lastCheckedAtRound: 2 },
      crippled: ['right-arm'],
    });
    expect(target?.conditions?.map((condition) => condition.conditionId)).toEqual(
      expect.arrayContaining(['stunned', 'unconscious']),
    );
    expect(saved.log.map((entry) => entry.entryType)).toEqual([
      'injury',
      'effect',
      'effect',
      'effect',
      'effect',
      'effect',
      'effect',
    ]);

    expect(saveCombatReveal).toHaveBeenCalledOnce();
    const nextReveal = saveCombatReveal.mock.calls[0][0] as RevealState;
    expect(nextReveal.byInstanceId.ogre.name).toBe('full');
    expect(nextReveal.byInstanceId.ogre.hp.mode).toBe('exact');

    const actions = recordedActions(recordAction);
    expect(actions).toHaveLength(8);
    expect(actions[0]).toMatchObject({
      type: ACTION_TYPES.SET_RESOURCE,
      payload: { instanceId: 'ogre', resource: 'HP', from: 15, to: -1 },
      revealUpdate: {
        set: {
          ogre: expect.objectContaining({
            name: 'full',
            hp: { mode: 'exact' },
          }),
        },
      },
    });
    expect(
      actions.slice(1).every((entry) => entry.type === ACTION_TYPES.ADD_LOG_ENTRY),
    ).toBe(true);
  });

  it('logs an injury against an unknown target without inventing a resource action', () => {
    const { result, saveCombatActive, recordAction } = setup();

    act(() =>
      result.current.handleActionComplete({
        kind: 'injury',
        targetInstanceId: 'missing',
        newHP: 3,
        injury: {
          damageBreakdown: { injuryApplied: 4 },
          effects: [],
        },
      }),
    );

    const saved = saveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.participants).toEqual(makeCombat().participants);
    expect(saved.log[0].text).toContain('Unknown takes 4 injury');
    expect(recordedActions(recordAction).map((entry) => entry.type)).toEqual([
      ACTION_TYPES.ADD_LOG_ENTRY,
    ]);
  });

  it('writes maneuver-prefixed notes and records the log addition', () => {
    const { result, saveCombatActive, recordAction } = setup();

    act(() =>
      result.current.handleActionComplete({
        kind: 'note',
        maneuver: 'Wait',
        note: 'Trigger when the door opens',
      }),
    );

    const saved = saveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.log).toHaveLength(1);
    expect(saved.log[0]).toMatchObject({
      entryType: 'note',
      text: 'Aria: [Wait] Trigger when the door opens',
    });
    expect(recordedActions(recordAction)[0].type).toBe(
      ACTION_TYPES.ADD_LOG_ENTRY,
    );
  });

  it('reveals a successful active defense and attaches the reveal diff to history', () => {
    const { result, saveCombatReveal, recordAction } = setup();

    act(() =>
      result.current.handleActionComplete({
        kind: 'defense',
        targetInstanceId: 'ogre',
        defense: { type: 'parry', success: true },
      }),
    );

    const nextReveal = saveCombatReveal.mock.calls[0][0] as RevealState;
    expect(nextReveal.byInstanceId.ogre.defenses.parry).toBe('exact');
    expect(recordedActions(recordAction)).toHaveLength(1);
    expect(recordedActions(recordAction)[0]).toMatchObject({
      type: ACTION_TYPES.ADD_LOG_ENTRY,
      revealUpdate: {
        set: {
          ogre: expect.objectContaining({
            defenses: expect.objectContaining({ parry: 'exact' }),
          }),
        },
      },
    });
  });

  it('does not change reveal state for a failed defense', () => {
    const { result, saveCombatActive, saveCombatReveal } = setup();

    act(() =>
      result.current.handleActionComplete({
        kind: 'defense',
        targetInstanceId: 'ogre',
        defense: { type: 'dodge', success: false },
      }),
    );

    expect(saveCombatActive).toHaveBeenCalledOnce();
    expect(saveCombatReveal).not.toHaveBeenCalled();
  });

  it('supports legacy damage by changing HP and revealing a downed target', () => {
    const { result, saveCombatActive, saveCombatReveal, recordAction } = setup();

    act(() =>
      result.current.handleActionComplete({
        kind: 'damage',
        maneuver: 'Attack',
        targetInstanceId: 'ogre',
        newHP: 0,
        damage: { penetrating: 15 },
      }),
    );

    const saved = saveCombatActive.mock.calls[0][0] as CombatState;
    expect(
      saved.participants.find((participant) => participant.instanceId === 'ogre')
        ?.currentHP,
    ).toBe(0);
    expect(saved.log[0].entryType).toBe('action');

    const nextReveal = saveCombatReveal.mock.calls[0][0] as RevealState;
    expect(nextReveal.byInstanceId.ogre).toMatchObject({
      name: 'full',
      hp: { mode: 'exact' },
    });
    expect(recordedActions(recordAction).map((entry) => entry.type)).toEqual([
      ACTION_TYPES.SET_RESOURCE,
      ACTION_TYPES.ADD_LOG_ENTRY,
    ]);
    expect(recordedActions(recordAction)[1].revealUpdate).toBeDefined();
  });

  it('still creates a generic action log when injury data is incomplete', () => {
    const { result, saveCombatActive, recordAction } = setup({
      reveal: null,
    });

    act(() =>
      result.current.handleActionComplete({
        kind: 'injury',
        targetInstanceId: 'ogre',
      }),
    );

    const saved = saveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.log[0]).toMatchObject({
      entryType: 'action',
      text: 'Aria',
    });
    expect(recordedActions(recordAction)[0].type).toBe(
      ACTION_TYPES.ADD_LOG_ENTRY,
    );
  });
});
