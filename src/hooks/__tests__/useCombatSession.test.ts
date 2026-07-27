import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../../../shared/session';
import type {
  CombatState,
  LogEntry,
  Participant,
  RevealState,
} from '../../types/combatTracker';
import { ACTION_TYPES } from '../../utils/combatActions';
import { ViewMode } from '../../utils/combatViewFilter';
import {
  resetCombatUI,
  setCombatUI,
} from '../combatUIStore';

vi.mock('../useCombatStore', () => ({
  useCombatStore: vi.fn(),
}));

vi.mock('../useCombatHistory', () => ({
  useCombatHistory: vi.fn(),
}));

vi.mock('../../state/campaignStore', () => ({
  useCampaignStore: vi.fn(),
}));

vi.mock('../useEffectiveRole', () => ({
  useEffectiveRole: vi.fn(),
}));

import { useCampaignStore } from '../../state/campaignStore';
import { useCombatHistory } from '../useCombatHistory';
import { useCombatSession } from '../useCombatSession';
import { useCombatStore } from '../useCombatStore';
import {
  type EffectiveRoleInfo,
  useEffectiveRole,
} from '../useEffectiveRole';

const mockedUseCampaignStore = vi.mocked(useCampaignStore);
const mockedUseCombatHistory = vi.mocked(useCombatHistory);
const mockedUseCombatStore = vi.mocked(useCombatStore);
const mockedUseEffectiveRole = vi.mocked(useEffectiveRole);
type CombatStoreValue = ReturnType<typeof useCombatStore>;

interface RecordedAction {
  type: string;
  payload: Record<string, unknown>;
}

function makeParticipant(
  overrides: Partial<Participant> = {},
): Participant {
  return {
    instanceId: 'hero',
    id: 'hero',
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
    shockPenalty: -2,
    conditions: [],
    ...overrides,
  };
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  const participants = [
    makeParticipant(),
    makeParticipant({
      instanceId: 'ogre',
      id: 'ogre',
      name: 'Ogre',
      category: 'enemy',
      hp: 15,
      maxHP: 15,
      currentHP: 15,
      shockPenalty: -3,
    }),
  ];

  return {
    id: 'combat-1',
    name: 'Bridge Ambush',
    startTime: 1_000,
    participants,
    turnOrder: participants.map((participant) => participant.instanceId),
    currentTurnIndex: 0,
    currentRound: 1,
    turnDecisions: {},
    log: [],
    ...overrides,
  };
}

function makeRole(canEdit: boolean): EffectiveRoleInfo {
  const role = canEdit ? Role.GM : Role.Player;
  return {
    effectiveRole: role,
    isOnline: !canEdit,
    isGM: canEdit,
    isPlayer: !canEdit,
    isSpectator: false,
    canEdit,
    displayName: canEdit ? null : 'Player',
  };
}

function makeStoreValue(options: {
  combat: CombatState | null;
  reveal: RevealState | null;
  saveCombatActive: CombatStoreValue['saveCombatActive'];
  saveCombatHistory: CombatStoreValue['saveCombatHistory'];
  saveCombatReveal: CombatStoreValue['saveCombatReveal'];
}): CombatStoreValue {
  return {
    combatCharacters: [],
    partyCharacters: [],
    combatActive:
      options.combat as unknown as CombatStoreValue['combatActive'],
    combatHistory: [],
    combatTombstones: [],
    combatRulesPreset: 'standard',
    combatReveal: options.reveal,
    combatItems: [],
    encounterTemplates: {},
    saveCombatCharacters: vi.fn(),
    saveCombatActive: options.saveCombatActive,
    saveCombatHistory: options.saveCombatHistory,
    saveCombatTombstones: vi.fn(),
    saveCombatRulesPreset: vi.fn(),
    saveCombatItems: vi.fn(),
    saveCombatReveal: options.saveCombatReveal,
    addEncounterTemplate: vi.fn(),
    updateEncounterTemplate: vi.fn(),
    removeEncounterTemplate: vi.fn(),
    updatePartyCharacter: vi.fn(),
  };
}

function makeCampaignStoreValue(): ReturnType<typeof useCampaignStore> {
  return {
    state: {
      maps: {
        mapsById: {},
      },
    },
    actions: {},
  } as unknown as ReturnType<typeof useCampaignStore>;
}

function setup(options: {
  combat?: CombatState | null;
  reveal?: RevealState | null;
  canEdit?: boolean;
} = {}) {
  const combat =
    options.combat === undefined ? makeCombat() : options.combat;
  const reveal = options.reveal ?? null;
  const saveCombatActive =
    vi.fn<CombatStoreValue['saveCombatActive']>();
  const saveCombatHistory =
    vi.fn<CombatStoreValue['saveCombatHistory']>();
  const saveCombatReveal =
    vi.fn<CombatStoreValue['saveCombatReveal']>();
  const recordAction = vi.fn();

  mockedUseCombatStore.mockReturnValue(
    makeStoreValue({
      combat,
      reveal,
      saveCombatActive,
      saveCombatHistory,
      saveCombatReveal,
    }),
  );
  mockedUseCampaignStore.mockReturnValue(makeCampaignStoreValue());
  mockedUseEffectiveRole.mockReturnValue(makeRole(options.canEdit ?? true));
  mockedUseCombatHistory.mockReturnValue({
    history: {
      version: 1,
      actions: [],
      cursor: 0,
      checkpoints: [],
      checkpointEvery: 25,
      maxActions: 500,
      maxCheckpoints: 30,
    },
    recordAction,
    handleUndo: vi.fn(),
    handleRedo: vi.fn(),
  });

  const hook = renderHook(() => useCombatSession());

  return {
    ...hook,
    combat,
    saveCombatActive,
    saveCombatHistory,
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

describe('useCombatSession lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCombatUI();
  });

  afterEach(() => {
    resetCombatUI();
    vi.restoreAllMocks();
  });

  it('returns null when no combat session is active', () => {
    const { result } = setup({ combat: null });

    expect(result.current).toBeNull();
  });

  it('initializes reveal state and exposes the first actor for an active session', () => {
    const { result, saveCombatReveal } = setup();

    expect(result.current).not.toBeNull();
    expect(result.current?.combat.name).toBe('Bridge Ambush');
    expect(result.current?.currentActorInstanceId).toBe('hero');
    expect(result.current?.currentActor?.name).toBe('Aria');
    expect(result.current?.selectedManeuverId).toBeNull();
    expect(result.current?.availableManeuvers.length).toBeGreaterThan(0);
    expect(saveCombatReveal).toHaveBeenCalledOnce();

    const initialized = saveCombatReveal.mock.calls[0][0] as RevealState;
    expect(initialized).toMatchObject({
      version: 1,
      combatId: 'combat-1',
      byInstanceId: {
        hero: expect.objectContaining({ name: 'full' }),
        ogre: expect.objectContaining({ name: 'hidden' }),
      },
    });
    expect(initialized).not.toHaveProperty('encounterId');
  });

  it('selects a maneuver, persists the turn decision, logs it, and records history', () => {
    const { result, saveCombatActive, recordAction } = setup({
      reveal: {
        combatId: 'combat-1',
        byInstanceId: {},
      },
    });

    act(() => result.current?.handleSelectManeuver('attack'));

    expect(saveCombatActive).toHaveBeenCalledTimes(2);
    const decisionState = saveCombatActive.mock.calls[0][0] as CombatState;
    expect(decisionState.turnDecisions['1_0_hero']).toEqual({
      maneuverId: 'attack',
      movement: undefined,
    });

    const appendLog = saveCombatActive.mock.calls[1][0] as (
      previous: CombatState,
    ) => CombatState;
    const withLog = appendLog(decisionState);
    expect(withLog.log).toHaveLength(1);
    expect(withLog.log[withLog.log.length - 1]).toMatchObject({
      entryType: 'maneuver',
      maneuver: 'attack',
      text: 'Aria: Turn Maneuver: Attack',
    });
    expect(recordedActions(recordAction).map((action) => action.type)).toEqual([
      ACTION_TYPES.SET_TURN_DECISION,
      ACTION_TYPES.ADD_LOG_ENTRY,
    ]);
  });

  it('does not allow a player role to select a maneuver', () => {
    const { result, saveCombatActive, recordAction } = setup({
      canEdit: false,
      reveal: {
        combatId: 'combat-1',
        byInstanceId: {},
      },
    });

    act(() => result.current?.handleSelectManeuver('attack'));

    expect(saveCombatActive).not.toHaveBeenCalled();
    expect(recordAction).not.toHaveBeenCalled();
  });

  it('advances to the next actor in the same round and clears that actor shock', () => {
    const { result, saveCombatActive, recordAction } = setup({
      reveal: {
        combatId: 'combat-1',
        byInstanceId: {},
      },
    });

    act(() => result.current?.handleNextTurn());

    const saved = saveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.currentRound).toBe(1);
    expect(saved.currentTurnIndex).toBe(1);
    expect(
      saved.participants.find(
        (participant) => participant.instanceId === 'ogre',
      )?.shockPenalty,
    ).toBe(0);
    expect(saved.log[saved.log.length - 1]).toMatchObject({
      entryType: 'turn',
      round: 1,
      turn: 1,
      text: "Ogre's turn",
    });
    expect(recordedActions(recordAction).map((action) => action.type)).toEqual([
      ACTION_TYPES.TURN_ADVANCE,
      ACTION_TYPES.ADD_LOG_ENTRY,
    ]);
  });

  it('wraps the last turn into a new round and emits round and actor entries', () => {
    const combat = makeCombat({
      currentTurnIndex: 1,
      currentRound: 3,
    });
    const { result, saveCombatActive, recordAction } = setup({
      combat,
      reveal: {
        combatId: 'combat-1',
        byInstanceId: {},
      },
    });

    act(() => result.current?.handleNextTurn());

    const saved = saveCombatActive.mock.calls[0][0] as CombatState;
    expect(saved.currentRound).toBe(4);
    expect(saved.currentTurnIndex).toBe(0);
    expect(
      saved.participants.find(
        (participant) => participant.instanceId === 'hero',
      )?.shockPenalty,
    ).toBe(0);
    expect(saved.log.slice(-2).map((entry) => entry.text)).toEqual([
      "=== Round 4 ==='s turn",
      "Aria's turn",
    ]);
    expect(recordedActions(recordAction).map((action) => action.type)).toEqual([
      ACTION_TYPES.TURN_ADVANCE,
      ACTION_TYPES.ADD_LOG_ENTRY,
      ACTION_TYPES.ADD_LOG_ENTRY,
    ]);
  });

  it('ends combat by timestamping and archiving the session before clearing active state', () => {
    vi.spyOn(Date, 'now').mockReturnValue(9_999);
    const { result, saveCombatActive, saveCombatHistory } = setup({
      reveal: {
        combatId: 'combat-1',
        byInstanceId: {},
      },
    });

    act(() => result.current?.handleEndCombat());

    expect(saveCombatHistory).toHaveBeenCalledOnce();
    const history = saveCombatHistory.mock.calls[0][0] as unknown as CombatState[];
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: 'combat-1',
      endTime: 9_999,
    });
    expect(
      (history[0].log[history[0].log.length - 1] as LogEntry).text,
    ).toBe('Combat ended');
    expect(saveCombatActive).toHaveBeenCalledWith(null);
  });

  it('does not allow a player role to end combat', () => {
    const { result, saveCombatActive, saveCombatHistory } = setup({
      canEdit: false,
      reveal: {
        combatId: 'combat-1',
        byInstanceId: {},
      },
    });

    act(() => result.current?.handleEndCombat());

    expect(saveCombatHistory).not.toHaveBeenCalled();
    expect(saveCombatActive).not.toHaveBeenCalled();
  });

  it('forces player view when the effective role is not GM', () => {
    act(() => {
      setCombatUI({ gmMode: true, viewMode: ViewMode.GM });
    });
    const { result } = setup({
      canEdit: false,
      reveal: {
        combatId: 'combat-1',
        byInstanceId: {},
      },
    });

    expect(result.current?.gmMode).toBe(false);
    expect(result.current?.viewMode).toBe(ViewMode.PLAYER);
  });
});
