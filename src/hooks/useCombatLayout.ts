import { useMemo, useEffect } from 'react';
import { useCombatStore } from './useCombatStore';
import { useCampaignStore } from '../state/campaignStore';
import { useEffectiveRole } from './useEffectiveRole';
import { getCombatView, ViewMode } from '../utils/combatViewFilter';
import { filterLogForPlayerView } from '../utils/combatLogFilter';
import { createInitialRevealState } from '../utils/combatReveal';
import { ManeuverCatalog, getMovementBudgetYards } from '../constants/maneuvers';
import { deriveTurnContext } from '../utils/turnContext';
import { filterManeuvers } from '../utils/maneuverFilter';
import { clearShock } from '../utils/effectsEngine';
import { tickConditionsTurn, tickConditionsRound } from '../utils/conditionsEngine';
import { findTileGridPos } from '../utils/mapUtils';
import { createHistoryState, addAction } from '../utils/combatHistory';
import {
  createTurnAdvanceAction,
  createAddLogEntryAction,
  createSetTurnDecisionAction,
  createMoveParticipantAction,
} from '../utils/combatActions';
import {
  createManeuverLogEntry,
  createTurnLogEntry,
  createNoteLogEntry,
  createConditionLogEntry,
  createMovementLogEntry,
  generateId,
} from '../utils/combatHelpers';
import { roll, rollVsTarget } from '../utils/dice';
import { MAX_COMBAT_HISTORY } from '../constants';
import { useConfirmDialog } from '../components/ui';
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
} from '../types/combatTracker';
import type { CombatSession } from '../types/campaign';

const EMPTY_COMBAT_LOG: LogEntry[] = [];

interface CombatLayoutOptions {
  viewMode: string;
  selectedParticipantId: string | null;
  diceExpression: string;
  rollTarget: string;
}

export function useCombatLayout({
  viewMode,
  selectedParticipantId,
  diceExpression,
  rollTarget,
}: CombatLayoutOptions) {
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
  const { canEdit } = useEffectiveRole();

  const endCombatDialog = useConfirmDialog({
    title: 'End Combat Session',
    message: 'Are you sure you want to end this combat session? The session will be saved to history.',
    confirmLabel: 'End Combat',
    variant: 'warning',
  });

  const combat = combatActive as CombatState | null;
  const reveal = combatReveal as RevealState | null;

  const history = createHistoryState() as HistoryState;
  const recordAction = (action: unknown) => {
    if (combat && reveal) {
      addAction(history as never, action as never, combat as never, reveal as never);
    }
  };

  useEffect(() => {
    if (combat && !reveal) {
      const initialReveal = createInitialRevealState(combat.id, combat.participants);
      saveCombatReveal(initialReveal as never);
    }
  }, [combat, reveal, saveCombatReveal]);

  const combatView = useMemo(
    () =>
      combat
        ? (getCombatView(combat, reveal as never, viewMode) as { participants: Participant[] })
        : { participants: [] },
    [combat, reveal, viewMode],
  );

  const combatLog = combat?.log;
  const displayLog = useMemo(
    () =>
      combat && viewMode === ViewMode.PLAYER && reveal
        ? (filterLogForPlayerView(combatLog ?? EMPTY_COMBAT_LOG, reveal, combat) as LogEntry[])
        : combatLog ?? EMPTY_COMBAT_LOG,
    [combat, combatLog, reveal, viewMode],
  );

  const turnOrder = combat?.turnOrder ?? [];
  const currentActorInstanceId = combat ? combat.turnOrder[combat.currentTurnIndex] ?? '' : '';
  const currentActor = useMemo(
    () => combatView.participants.find((participant) => participant.instanceId === currentActorInstanceId),
    [combatView.participants, currentActorInstanceId],
  );
  const currentActorTruth = useMemo(
    () => combat?.participants.find((participant) => participant.instanceId === currentActorInstanceId),
    [combat, currentActorInstanceId],
  );

  const turnDecisionKey =
    combat && currentActorInstanceId
      ? `${combat.currentRound}_${combat.currentTurnIndex}_${currentActorInstanceId}`
      : null;
  const turnDecisions = combat?.turnDecisions ?? {};
  const currentTurnDecision = turnDecisionKey ? turnDecisions[turnDecisionKey] ?? {} : {};
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

  const hasLinkedMap = !!combat?.mapId;
  const linkedMap = hasLinkedMap && combat ? campaignState.maps.mapsById[combat.mapId!] : null;
  const movementBudgetYards = useMemo(
    () =>
      hasLinkedMap && selectedManeuverId && currentActorTruth
        ? getMovementBudgetYards(selectedManeuverId, currentActorTruth.basicMove, true)
        : 0,
    [hasLinkedMap, selectedManeuverId, currentActorTruth],
  );
  const hasMovedThisTurn = !!(currentTurnDecision as TurnDecision)?.movement;
  const losOverlayTileIds = useMemo<string[] | undefined>(() => undefined, []);

  const updateTurnDecisionState = (previous: TurnDecision | null, next: TurnDecision | null) => {
    if (!combat || !turnDecisionKey) return;
    const updated = { ...turnDecisions };
    if (next) updated[turnDecisionKey] = next;
    else delete updated[turnDecisionKey];
    saveCombatActive({ ...combat, turnDecisions: updated });
    recordAction(createSetTurnDecisionAction(turnDecisionKey, previous, next));
  };

  const handleSelectManeuver = (maneuverId: string | null) => {
    if (!canEdit || !combat || !currentActorTruth || !turnDecisionKey) return;

    const previousDecision = turnDecisions[turnDecisionKey] || null;
    const previousMovement = previousDecision?.movement;
    if (previousMovement) {
      const updatedParticipants = combat.participants.map((participant) =>
        participant.instanceId === currentActorTruth.instanceId
          ? { ...participant, position: previousMovement.fromPosition }
          : participant,
      );
      saveCombatActive({ ...combat, participants: updatedParticipants });
      recordAction(
        createMoveParticipantAction(
          currentActorTruth.instanceId,
          previousMovement.toPosition,
          previousMovement.fromPosition,
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
      (ManeuverCatalog as Maneuver[]).find((maneuver) => maneuver.id === maneuverId)?.label ||
      maneuverId;
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
    saveCombatActive((previousCombat: CombatState) => ({
      ...previousCombat,
      log: [...previousCombat.log, logEntry],
    }));
    recordAction(createAddLogEntryAction(logEntry));
  };

  const handleNextTurn = () => {
    if (!canEdit || !combat) return;

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
    const nextActor = combat.participants.find((participant) => participant.instanceId === nextActorInstanceId);

    let updatedParticipants = combat.participants.map((participant) =>
      participant.instanceId === nextActorInstanceId ? (clearShock(participant) as Participant) : participant,
    );

    const expiredConditions: Array<{ participant: Participant; condition: ConditionInstance }> = [];
    if (isNewRound) {
      updatedParticipants = updatedParticipants.map((participant) => {
        const result = tickConditionsRound(participant, toRound) as {
          combatant: Participant;
          expired: ConditionInstance[];
        };
        if (result.expired.length > 0) {
          expiredConditions.push(...result.expired.map((condition) => ({ participant, condition })));
        }
        return result.combatant;
      });
    }

    const nextActorUpdated = updatedParticipants.find(
      (participant) => participant.instanceId === nextActorInstanceId,
    );
    if (nextActorUpdated) {
      const result = tickConditionsTurn(nextActorUpdated, toRound) as {
        combatant: Participant;
        expired: ConditionInstance[];
      };
      if (result.expired.length > 0) {
        expiredConditions.push(
          ...result.expired.map((condition) => ({
            participant: nextActorUpdated,
            condition,
          })),
        );
      }
      updatedParticipants = updatedParticipants.map((participant) =>
        participant.instanceId === nextActorInstanceId ? result.combatant : participant,
      );
    }

    const logEntries: LogEntry[] = [];
    if (isNewRound) {
      logEntries.push(createTurnLogEntry(toRound, toTurnIndex, '', `=== Round ${toRound} ===`));
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
    logEntries.forEach((entry) => recordAction(createAddLogEntryAction(entry)));
  };

  const handlePrevTurn = () => {
    if (!canEdit || !combat) return;

    const previousIndex = combat.currentTurnIndex - 1;
    const isPreviousRound = previousIndex < 0;
    const toTurnIndex = isPreviousRound ? combat.turnOrder.length - 1 : previousIndex;
    const toRound = isPreviousRound ? Math.max(1, combat.currentRound - 1) : combat.currentRound;
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
    if (!canEdit || !combat) return;

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
    const newHistory = [endedCombat, ...(combatHistory as CombatSession[])].slice(0, MAX_COMBAT_HISTORY);
    saveCombatHistory(newHistory as CombatSession[]);
    saveCombatActive(null);
  };

  const updateResource = (instanceId: string, resource: string, newValue: number) => {
    if (!combat) return;
    const participant = combat.participants.find((entry) => entry.instanceId === instanceId);
    if (!participant) return;

    const resourceKey = `current${resource}` as keyof Participant;
    const oldValue = participant[resourceKey] as number | undefined;
    if (oldValue === newValue) return;

    const updatedParticipants = combat.participants.map((entry) =>
      entry.instanceId === instanceId ? { ...entry, [resourceKey]: newValue } : entry,
    );
    saveCombatActive({ ...combat, participants: updatedParticipants });
  };

  const handleMoveTo = (tileId: string, path: string[], costYards: number) => {
    if (!canEdit || !combat || !currentActorTruth || !turnDecisionKey || hasMovedThisTurn || !linkedMap) {
      return;
    }
    if (costYards > movementBudgetYards) return;

    const fromPosition = currentActorTruth.position;
    if (!fromPosition) return;
    const destinationPosition = findTileGridPos(linkedMap, tileId);
    if (!destinationPosition) return;
    const toPosition = { q: destinationPosition.col, r: destinationPosition.row };

    const updatedParticipants = combat.participants.map((participant) =>
      participant.instanceId === currentActorTruth.instanceId
        ? { ...participant, position: toPosition }
        : participant,
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

  const handleGmPlaceToken = (instanceId: string, _tileId: string, row: number, col: number) => {
    if (!canEdit || !combat || !linkedMap) return;

    const participant = combat.participants.find((entry) => entry.instanceId === instanceId);
    if (!participant) return;

    const fromPosition = participant.position ?? { q: 0, r: 0 };
    const toPosition = { q: col, r: row };
    const updatedParticipants = combat.participants.map((entry) =>
      entry.instanceId === instanceId ? { ...entry, position: toPosition } : entry,
    );
    saveCombatActive({ ...combat, participants: updatedParticipants });
    recordAction(createMoveParticipantAction(instanceId, fromPosition, toPosition, [], 0));
  };

  const handleRoll = () => {
    if (!canEdit || !combat || !diceExpression.trim()) return;

    let rollResult: RollData;
    if (rollTarget.trim()) {
      const target = parseInt(rollTarget, 10);
      if (Number.isNaN(target)) return;
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
        ? `Rolled ${rollResult.expression} = ${rollResult.total} vs ${rollResult.target} -> ${rollResult.margin !== undefined ? (rollResult.margin >= 0 ? 'Success' : 'Failure') : '?'}`
        : `Rolled ${rollResult.expression} = ${rollResult.total}`,
      data: rollResult,
    };

    saveCombatActive((previousCombat: CombatState) => ({
      ...previousCombat,
      log: [...previousCombat.log, logEntry],
    }));
  };

  return {
    combat,
    participants: combatView.participants,
    turnOrder,
    currentActorInstanceId,
    currentActor,
    selectedParticipantId,
    availableManeuvers,
    selectedManeuverId,
    handleSelectManeuver,
    handleNextTurn,
    handlePrevTurn,
    handleEndCombat,
    hasLinkedMap,
    linkedMap,
    movementBudgetYards,
    hasMovedThisTurn,
    handleMoveTo,
    handleGmPlaceToken,
    losOverlayTileIds,
    updateResource,
    diceExpression,
    rollTarget,
    handleRoll,
    displayLog,
    combatRulesPreset: (combatRulesPreset as string) || 'standard',
    endCombatDialogProps: endCombatDialog.dialogProps,
  };
}
