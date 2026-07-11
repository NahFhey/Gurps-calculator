/**
 * CombatContext — shared combat state for the shell-level combat layout.
 *
 * When combat has a linked map, the shell transforms: Party→participants,
 * Rail→maneuvers, Center→map.  This context provides the data & handlers
 * those panels need without duplicating all of CombatTracker's logic.
 */

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { useCombatStore } from '../../hooks/useCombatStore';
import { useCampaignStore } from '../../state/campaignStore';
import { useEffectiveRole } from '../../hooks/useEffectiveRole';
import { getCombatView, ViewMode } from '../../utils/combatViewFilter';
import { filterLogForPlayerView } from '../../utils/combatLogFilter';
import {
  createInitialRevealState,
} from '../../utils/combatReveal';
import { ManeuverCatalog, getMovementBudgetYards } from '../../constants/maneuvers';
import { deriveTurnContext } from '../../utils/turnContext';
import { filterManeuvers } from '../../utils/maneuverFilter';
import { clearShock } from '../../utils/effectsEngine';
import { tickConditionsTurn, tickConditionsRound } from '../../utils/conditionsEngine';
import { findTileGridPos } from '../../utils/mapUtils';
import {
  createHistoryState,
  addAction,
} from '../../utils/combatHistory';
import {
  createTurnAdvanceAction,
  createAddLogEntryAction,
  createSetTurnDecisionAction,
  createMoveParticipantAction,
} from '../../utils/combatActions';
import {
  createManeuverLogEntry,
  createTurnLogEntry,
  createNoteLogEntry,
  createConditionLogEntry,
  createMovementLogEntry,
  generateId,
} from '../../utils/combatHelpers';
import { roll, rollVsTarget } from '../../utils/dice';
import { MAX_COMBAT_HISTORY } from '../../constants';
import { useConfirmDialog, ConfirmDialog } from '../ui';
import type {
  Participant,
  CombatState,
  TurnDecision,
  HistoryState,
  RevealState,
  Maneuver,
  TurnContext,
  LogEntry,
  RollData,
  ConditionInstance,
} from '../../types/combatTracker';
import type { CombatSession } from '../../types/campaign';

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------

export interface CombatContextValue {
  /** The raw combat state (truth) */
  combat: CombatState;
  /** View-filtered participants */
  participants: Participant[];
  /** Turn order (instanceIds) */
  turnOrder: string[];
  /** Current actor instance ID */
  currentActorInstanceId: string;
  /** Current actor (view-filtered) */
  currentActor: Participant | undefined;
  /** Currently selected participant (for map sync) */
  selectedParticipantId: string | null;
  setSelectedParticipantId: (id: string | null) => void;
  /** Maneuvers available to the current actor */
  availableManeuvers: Array<Maneuver & { disabled?: boolean; reason?: string }>;
  /** Currently selected maneuver ID */
  selectedManeuverId: string | null;
  handleSelectManeuver: (id: string | null) => void;
  /** Turn navigation */
  handleNextTurn: () => void;
  handlePrevTurn: () => void;
  /** End combat (with confirmation dialog) */
  handleEndCombat: () => void;
  /** GM / view mode */
  gmMode: boolean;
  setGmMode: (v: boolean) => void;
  viewMode: string;
  setViewMode: (v: string) => void;
  /** Map data */
  hasLinkedMap: boolean;
  linkedMap: any | null;
  movementBudgetYards: number;
  hasMovedThisTurn: boolean;
  handleMoveTo: (tileId: string, path: string[], costYards: number) => void;
  handleGmPlaceToken: (instanceId: string, tileId: string, row: number, col: number) => void;
  losOverlayTileIds: string[] | undefined;
  /** Resource editing */
  updateResource: (instanceId: string, resource: string, newValue: number) => void;
  /** Dice */
  diceExpression: string;
  setDiceExpression: (v: string) => void;
  rollTarget: string;
  setRollTarget: (v: string) => void;
  handleRoll: () => void;
  /** Combat log (view-filtered) */
  displayLog: LogEntry[];
  /** The combat rules preset */
  combatRulesPreset: string;
}

const CombatCtx = createContext<CombatContextValue | null>(null);

export function useCombatContext() {
  const ctx = useContext(CombatCtx);
  if (!ctx) throw new Error('useCombatContext must be used inside <CombatContextProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CombatContextProvider({ children }: { children: ReactNode }) {
  const {
    combatActive,
    saveCombatActive,
    combatHistory,
    saveCombatHistory,
    combatRulesPreset,
    combatReveal,
    saveCombatReveal,
  } = useCombatStore();
  const { state: campaignState } = useCampaignStore();

  // Role-based enforcement
  const { isGM: effectiveIsGM, canEdit } = useEffectiveRole();

  // Local UI state — default gmMode based on effective role
  const [viewMode, setViewModeLocal] = useState(ViewMode.PLAYER);
  const [gmMode, setGmModeLocal] = useState(effectiveIsGM);

  // Force player view when not GM
  useEffect(() => {
    if (!effectiveIsGM) {
      setGmModeLocal(false);
      setViewModeLocal(ViewMode.PLAYER);
    }
  }, [effectiveIsGM]);

  // Wrap setters to prevent non-GM from switching to GM view
  const setGmMode = (v: boolean) => { if (effectiveIsGM) setGmModeLocal(v); };
  const setViewMode = (v: string) => {
    if (!effectiveIsGM && v === ViewMode.GM) return;
    setViewModeLocal(v as string);
  };
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [diceExpression, setDiceExpression] = useState('3d6');
  const [rollTarget, setRollTarget] = useState('');

  // End-combat confirmation
  const endCombatDialog = useConfirmDialog({
    title: 'End Combat Session',
    message: 'Are you sure you want to end this combat session? The session will be saved to history.',
    confirmLabel: 'End Combat',
    variant: 'warning',
  });

  // Cast
  const combat = combatActive as CombatState | null;
  const reveal = combatReveal as RevealState | null;

  // History stub (undo/redo is only supported in CombatTracker's abstract mode for now)
  const history = createHistoryState() as HistoryState;
  const saveCombatActiveHistory = (_h: HistoryState | null) => {};
  const recordAction = (action: unknown) => {
    if (combat && reveal !== null && reveal !== undefined) {
      addAction(history as any, action as any, combat as any, reveal as any);
    }
  };

  // Ensure reveal state is initialised
  useEffect(() => {
    if (combat && !reveal) {
      const init = createInitialRevealState(combat.id, combat.participants);
      saveCombatReveal(init as any);
    }
  }, [combat, reveal]);

  // GM mode sync — switch viewMode to PLAYER when gmMode is toggled off
  useEffect(() => {
    if (!gmMode && viewMode === ViewMode.GM) setViewMode(ViewMode.PLAYER);
  }, [gmMode]);

  // Early return — render children with null context if no combat
  if (!combat || !combat.participants || !combat.turnOrder) {
    return <>{children}</>;
  }

  // ---------------------------------------------------------------------------
  // Derived state (memoized to avoid recomputation on every render)
  // ---------------------------------------------------------------------------
  const combatView = useMemo(
    () => getCombatView(combat, reveal as any, viewMode) as { participants: Participant[] },
    [combat, reveal, viewMode],
  );
  const combatLog = combat.log || [];
  const displayLog = useMemo(
    () =>
      viewMode === ViewMode.PLAYER && reveal
        ? (filterLogForPlayerView(combatLog, reveal, combat) as LogEntry[])
        : combatLog,
    [combatLog, viewMode, reveal, combat],
  );

  const currentActorInstanceId = combat.turnOrder[combat.currentTurnIndex];
  const currentActor = useMemo(
    () => combatView.participants.find((p) => p.instanceId === currentActorInstanceId),
    [combatView.participants, currentActorInstanceId],
  );
  const currentActorTruth = useMemo(
    () => combat.participants.find((p) => p.instanceId === currentActorInstanceId),
    [combat.participants, currentActorInstanceId],
  );

  const turnDecisionKey = currentActorInstanceId
    ? `${combat.currentRound}_${combat.currentTurnIndex}_${currentActorInstanceId}`
    : null;
  const turnDecisions = combat.turnDecisions || {};
  const currentTurnDecision = turnDecisionKey
    ? turnDecisions[turnDecisionKey] || {}
    : {};
  const turnContext = useMemo(
    () => deriveTurnContext(currentActorTruth || ({} as Participant)) as TurnContext,
    [currentActorTruth],
  );
  const availableManeuvers = useMemo(
    () =>
      filterManeuvers(
        ManeuverCatalog as Maneuver[],
        turnContext,
        (combatRulesPreset as string) || 'standard',
      ) as Array<Maneuver & { disabled?: boolean; reason?: string }>,
    [turnContext, combatRulesPreset],
  );
  const selectedManeuverId = (currentTurnDecision as TurnDecision)?.maneuverId || null;

  const hasLinkedMap = !!combat.mapId;
  const linkedMap = hasLinkedMap ? campaignState.maps.mapsById[combat.mapId!] : null;
  const movementBudgetYards = useMemo(
    () =>
      hasLinkedMap && selectedManeuverId && currentActorTruth
        ? getMovementBudgetYards(selectedManeuverId, currentActorTruth.basicMove, true)
        : 0,
    [hasLinkedMap, selectedManeuverId, currentActorTruth],
  );
  const hasMovedThisTurn = !!(currentTurnDecision as TurnDecision)?.movement;

  // LoS overlay (Phase F) — stub until losUtils is implemented
  const losOverlayTileIds = useMemo<string[] | undefined>(() => {
    return undefined;
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const updateTurnDecisionState = (prev: TurnDecision | null, next: TurnDecision | null) => {
    if (!turnDecisionKey) return;
    const updated = { ...turnDecisions };
    if (next) updated[turnDecisionKey] = next;
    else delete updated[turnDecisionKey];
    saveCombatActive({ ...combat, turnDecisions: updated });
    recordAction(createSetTurnDecisionAction(turnDecisionKey, prev, next));
  };

  const handleSelectManeuver = (maneuverId: string | null) => {
    if (!canEdit) return;
    if (!currentActorTruth || !turnDecisionKey) return;

    const previousDecision = turnDecisions[turnDecisionKey] || null;

    // Revert movement if actor already moved
    const prevMovement = previousDecision?.movement;
    if (prevMovement) {
      const updatedParticipants = combat.participants.map((p) =>
        p.instanceId === currentActorTruth.instanceId
          ? { ...p, position: prevMovement.fromPosition }
          : p,
      );
      saveCombatActive({ ...combat, participants: updatedParticipants });
      recordAction(
        createMoveParticipantAction(
          currentActorTruth.instanceId,
          prevMovement.toPosition,
          prevMovement.fromPosition,
          [],
          0,
        ),
      );
    }

    const nextDecision: TurnDecision = {
      ...(previousDecision || {}),
      maneuverId: maneuverId || undefined,
      movement: undefined,
    };
    updateTurnDecisionState(previousDecision, nextDecision);

    if (!maneuverId) return;

    const maneuverLabel =
      (ManeuverCatalog as Maneuver[]).find((m) => m.id === maneuverId)?.label || maneuverId;
    const logEntry = createManeuverLogEntry({
      round: combat.currentRound,
      turn: combat.currentTurnIndex,
      actorInstanceId: currentActorTruth.instanceId,
      actorName: currentActorTruth.name,
      maneuverId,
      maneuverLabel,
      aim: nextDecision.aim || null,
      wait: nextDecision.wait || null,
      constraints: {
        isStunned: turnContext.isStunned,
        isProne: turnContext.isProne,
        isGrappled: turnContext.isGrappled,
        isUnconscious: turnContext.isUnconscious,
        shockPenalty: turnContext.shockPenalty,
      },
    });
    saveCombatActive((prev: CombatState) => ({
      ...prev,
      log: [...prev.log, logEntry],
    }));
    recordAction(createAddLogEntryAction(logEntry));
  };

  const handleNextTurn = () => {
    if (!canEdit) return;
    const nextIndex = combat.currentTurnIndex + 1;
    const isNewRound = nextIndex >= combat.turnOrder.length;
    const toTurnIndex = isNewRound ? 0 : nextIndex;
    const toRound = isNewRound ? combat.currentRound + 1 : combat.currentRound;

    const action = createTurnAdvanceAction(
      combat.currentRound,
      combat.currentTurnIndex,
      toRound,
      toTurnIndex,
    );

    const nextActorInstanceId = combat.turnOrder[toTurnIndex];
    const nextActor = combat.participants.find((p) => p.instanceId === nextActorInstanceId);

    let updatedParticipants = combat.participants.map((p) =>
      p.instanceId === nextActorInstanceId ? (clearShock(p) as Participant) : p,
    );

    const expiredConditions: Array<{ participant: Participant; condition: ConditionInstance }> = [];

    if (isNewRound) {
      updatedParticipants = updatedParticipants.map((p) => {
        const result = tickConditionsRound(p, toRound) as {
          combatant: Participant;
          expired: ConditionInstance[];
        };
        if (result.expired.length > 0)
          expiredConditions.push(
            ...result.expired.map((c) => ({ participant: p, condition: c })),
          );
        return result.combatant;
      });
    }

    const nextActorUpdated = updatedParticipants.find(
      (p) => p.instanceId === nextActorInstanceId,
    );
    if (nextActorUpdated) {
      const result = tickConditionsTurn(nextActorUpdated, toRound) as {
        combatant: Participant;
        expired: ConditionInstance[];
      };
      if (result.expired.length > 0)
        expiredConditions.push(
          ...result.expired.map((c) => ({ participant: nextActorUpdated, condition: c })),
        );
      updatedParticipants = updatedParticipants.map((p) =>
        p.instanceId === nextActorInstanceId ? result.combatant : p,
      );
    }

    const logEntries: LogEntry[] = [];
    if (isNewRound) {
      logEntries.push(
        createTurnLogEntry(toRound, toTurnIndex, '', `=== Round ${toRound} ===`),
      );
    }
    logEntries.push(
      createTurnLogEntry(toRound, toTurnIndex, nextActorInstanceId || '', nextActor?.name || ''),
    );

    for (const { participant, condition } of expiredConditions) {
      logEntries.push(
        createConditionLogEntry({
          round: toRound,
          turn: toTurnIndex,
          targetInstanceId: participant.instanceId,
          targetName: participant.name,
          changeType: 'expired',
          conditionId: condition.conditionId,
          conditionLabel: condition.label,
        }),
      );
    }

    const newCombat: CombatState = {
      ...combat,
      currentRound: toRound,
      currentTurnIndex: toTurnIndex,
      participants: updatedParticipants,
      log: [...combat.log, ...logEntries],
    };
    saveCombatActive(newCombat);
    recordAction(action);
    logEntries.forEach((e) => recordAction(createAddLogEntryAction(e)));
  };

  const handlePrevTurn = () => {
    if (!canEdit) return;
    const prevIndex = combat.currentTurnIndex - 1;
    const isPrevRound = prevIndex < 0;
    const toTurnIndex = isPrevRound ? combat.turnOrder.length - 1 : prevIndex;
    const toRound = isPrevRound
      ? Math.max(1, combat.currentRound - 1)
      : combat.currentRound;

    const action = createTurnAdvanceAction(
      combat.currentRound,
      combat.currentTurnIndex,
      toRound,
      toTurnIndex,
    );
    saveCombatActive({
      ...combat,
      currentRound: toRound,
      currentTurnIndex: toTurnIndex,
    });
    recordAction(action);
  };

  const handleEndCombat = async () => {
    if (!canEdit) return;
    const confirmed = await endCombatDialog.confirm();
    if (!confirmed) return;

    const endLogEntry = createNoteLogEntry(
      combat.currentRound,
      combat.currentTurnIndex,
      '',
      '',
      'Combat ended',
    );
    const endedCombat: CombatState = {
      ...combat,
      endTime: Date.now(),
      log: [...combat.log, endLogEntry],
    };
    const newHistory = [endedCombat, ...(combatHistory as CombatSession[])].slice(
      0,
      MAX_COMBAT_HISTORY,
    );
    saveCombatHistory(newHistory as CombatSession[]);
    saveCombatActive(null);
    saveCombatActiveHistory(null);
  };

  const updateResource = (instanceId: string, resource: string, newValue: number) => {
    const participant = combat.participants.find((p) => p.instanceId === instanceId);
    if (!participant) return;
    const resourceKey = `current${resource}` as keyof Participant;
    const oldValue = participant[resourceKey] as number | undefined;
    if (oldValue === newValue) return;

    const updatedParticipants = combat.participants.map((p) =>
      p.instanceId === instanceId ? { ...p, [resourceKey]: newValue } : p,
    );
    saveCombatActive({ ...combat, participants: updatedParticipants });
  };

  const handleMoveTo = (tileId: string, path: string[], costYards: number) => {
    if (!canEdit) return;
    if (!currentActorTruth || !turnDecisionKey || hasMovedThisTurn) return;
    if (costYards > movementBudgetYards || !linkedMap) return;

    const fromPosition = currentActorTruth.position;
    if (!fromPosition) return;
    const destPos = findTileGridPos(linkedMap, tileId);
    if (!destPos) return;
    const toPosition = { q: destPos.col, r: destPos.row };

    const updatedParticipants = combat.participants.map((p) =>
      p.instanceId === currentActorTruth.instanceId ? { ...p, position: toPosition } : p,
    );

    const previousDecision = turnDecisions[turnDecisionKey] || null;
    const nextDecision: TurnDecision = {
      ...(previousDecision || {}),
      movement: { fromPosition, toPosition, path, costYards },
    };
    const updatedTurnDecisions = { ...turnDecisions, [turnDecisionKey]: nextDecision };

    const logEntry = createMovementLogEntry({
      round: combat.currentRound,
      turn: combat.currentTurnIndex,
      actorInstanceId: currentActorTruth.instanceId,
      actorName: currentActorTruth.name,
      yardsSpent: costYards,
    });

    saveCombatActive({
      ...combat,
      participants: updatedParticipants,
      turnDecisions: updatedTurnDecisions,
      log: [...combat.log, logEntry],
    });
    recordAction(
      createMoveParticipantAction(
        currentActorTruth.instanceId,
        fromPosition,
        toPosition,
        path,
        costYards,
      ),
    );
    recordAction(createSetTurnDecisionAction(turnDecisionKey, previousDecision, nextDecision));
    recordAction(createAddLogEntryAction(logEntry));
  };

  const handleGmPlaceToken = (
    instanceId: string,
    _tileId: string,
    row: number,
    col: number,
  ) => {
    if (!canEdit) return;
    if (!linkedMap) return;
    const participant = combat.participants.find((p) => p.instanceId === instanceId);
    if (!participant) return;
    const fromPosition = participant.position ?? { q: 0, r: 0 };
    const toPosition = { q: col, r: row };
    const updatedParticipants = combat.participants.map((p) =>
      p.instanceId === instanceId ? { ...p, position: toPosition } : p,
    );
    saveCombatActive({ ...combat, participants: updatedParticipants });
    recordAction(createMoveParticipantAction(instanceId, fromPosition, toPosition, [], 0));
  };

  const handleRoll = () => {
    if (!canEdit) return;
    if (!diceExpression.trim()) return;
    let rollResult: RollData;
    if (rollTarget?.trim()) {
      const target = parseInt(rollTarget);
      if (isNaN(target)) return;
      rollResult = rollVsTarget(diceExpression, target) as RollData;
    } else {
      rollResult = roll(diceExpression) as RollData;
    }
    if (!rollResult.valid) return;

    const logEntry = {
      id: generateId(),
      type: 'roll' as const,
      timestamp: Date.now(),
      round: combat.currentRound,
      turn: combat.currentTurnIndex,
      actorInstanceId: currentActorInstanceId,
      actorName: currentActor?.name || 'Unknown',
      text: rollResult.target
        ? `Rolled ${rollResult.expression} = ${rollResult.total} vs ${rollResult.target} → ${rollResult.margin !== undefined ? (rollResult.margin >= 0 ? 'Success' : 'Failure') : '?'}`
        : `Rolled ${rollResult.expression} = ${rollResult.total}`,
      data: rollResult,
    };

    saveCombatActive((prev: CombatState) => ({
      ...prev,
      log: [...prev.log, logEntry],
    }));
  };

  // ---------------------------------------------------------------------------
  // Context value (memoized to reduce consumer re-renders)
  // ---------------------------------------------------------------------------
  const value: CombatContextValue = useMemo(() => ({
    combat,
    participants: combatView.participants,
    turnOrder: combat.turnOrder,
    currentActorInstanceId,
    currentActor,
    selectedParticipantId,
    setSelectedParticipantId,
    availableManeuvers,
    selectedManeuverId,
    handleSelectManeuver,
    handleNextTurn,
    handlePrevTurn,
    handleEndCombat,
    gmMode,
    setGmMode,
    viewMode,
    setViewMode,
    hasLinkedMap,
    linkedMap,
    movementBudgetYards,
    hasMovedThisTurn,
    handleMoveTo,
    handleGmPlaceToken,
    losOverlayTileIds,
    updateResource,
    diceExpression,
    setDiceExpression,
    rollTarget,
    setRollTarget,
    handleRoll,
    displayLog,
    combatRulesPreset: (combatRulesPreset as string) || 'standard',
  }), [
    combat, combatView.participants, currentActorInstanceId, currentActor,
    selectedParticipantId, availableManeuvers, selectedManeuverId,
    gmMode, viewMode, hasLinkedMap, linkedMap, movementBudgetYards,
    hasMovedThisTurn, losOverlayTileIds, diceExpression, rollTarget,
    displayLog, combatRulesPreset,
  ]);

  return (
    <CombatCtx.Provider value={value}>
      {children}
      <ConfirmDialog {...endCombatDialog.dialogProps} />
    </CombatCtx.Provider>
  );
}
