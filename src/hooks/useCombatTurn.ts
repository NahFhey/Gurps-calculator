import { useCallback } from 'react';
import {
  createAddConditionAction,
  createAddLogEntryAction,
  createRemoveConditionAction,
  createSetResourceAction,
  createTurnAdvanceAction,
  createUpdateConditionAction,
} from '../utils/combatActions';
import {
  createConditionLogEntry,
  createResourceLogEntry,
  createTurnLogEntry,
} from '../utils/combatHelpers';
import { tickConditionsRound, tickConditionsTurn } from '../utils/conditionsEngine';
import { clearShock } from '../utils/effectsEngine';
import type {
  CombatState,
  ConditionDuration,
  ConditionInstance,
  LogEntry,
  Participant,
} from '../types/combatTracker';

export type CombatResource = 'HP' | 'FP' | 'MP';

interface UseCombatTurnOptions {
  combat: CombatState | null;
  currentActorTruth: Participant | undefined;
  recordAction: (action: unknown) => void;
  saveCombatActive: (sessionOrUpdater: unknown) => void;
}

interface UseCombatTurnResult {
  handleNextTurn: () => void;
  handlePrevTurn: () => void;
  updateResource: (instanceId: string, resource: CombatResource, newValue: number) => void;
  handleAddCondition: (conditionInstance: ConditionInstance) => void;
  handleRemoveCondition: (conditionInstanceId: string) => void;
  handleUpdateCondition: (conditionInstanceId: string, newDuration: ConditionDuration) => void;
}

export function useCombatTurn({
  combat,
  currentActorTruth,
  recordAction,
  saveCombatActive,
}: UseCombatTurnOptions): UseCombatTurnResult {
  const handleNextTurn = useCallback(() => {
    if (!combat) return;

    const fromRound = combat.currentRound;
    const fromTurnIndex = combat.currentTurnIndex;

    const nextIndex = combat.currentTurnIndex + 1;
    const isNewRound = nextIndex >= combat.turnOrder.length;

    const toTurnIndex = isNewRound ? 0 : nextIndex;
    const toRound = isNewRound ? combat.currentRound + 1 : combat.currentRound;

    const action = createTurnAdvanceAction(fromRound, fromTurnIndex, toRound, toTurnIndex);

    const nextActorInstanceId = combat.turnOrder[toTurnIndex];
    const nextActor = combat.participants.find((participant) => participant.instanceId === nextActorInstanceId);

    let updatedParticipants = combat.participants.map((participant) =>
      participant.instanceId === nextActorInstanceId ? (clearShock(participant) as Participant) : participant
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
      (participant) => participant.instanceId === nextActorInstanceId
    );
    if (nextActorUpdated) {
      const result = tickConditionsTurn(nextActorUpdated, toRound) as {
        combatant: Participant;
        expired: ConditionInstance[];
      };
      if (result.expired.length > 0) {
        expiredConditions.push(
          ...result.expired.map((condition) => ({ participant: nextActorUpdated, condition }))
        );
      }

      updatedParticipants = updatedParticipants.map((participant) =>
        participant.instanceId === nextActorInstanceId ? result.combatant : participant
      );
    }

    const newCombat: CombatState = {
      ...combat,
      currentRound: toRound,
      currentTurnIndex: toTurnIndex,
      participants: updatedParticipants,
    };

    saveCombatActive(newCombat);
    recordAction(action);

    const logEntries: LogEntry[] = [];

    if (isNewRound) {
      const roundLogEntry = createTurnLogEntry(toRound, toTurnIndex, 'round', `=== Round ${toRound} ===`);
      recordAction(createAddLogEntryAction(roundLogEntry));
      logEntries.push(roundLogEntry);
    }

    const turnLogEntry = createTurnLogEntry(
      toRound,
      toTurnIndex,
      nextActorInstanceId || 'unknown',
      nextActor?.name || 'Unknown'
    );
    recordAction(createAddLogEntryAction(turnLogEntry));
    logEntries.push(turnLogEntry);

    expiredConditions.forEach(({ participant, condition }) => {
      const conditionLogEntry = createConditionLogEntry({
        round: toRound,
        turn: toTurnIndex,
        targetInstanceId: participant.instanceId,
        targetName: participant.name,
        changeType: 'expired',
        conditionId: condition.conditionId,
        conditionLabel: condition.label,
      });
      recordAction(createAddLogEntryAction(conditionLogEntry));
      logEntries.push(conditionLogEntry);
    });

    saveCombatActive((previousCombat: CombatState) => ({
      ...previousCombat,
      log: [...previousCombat.log, ...logEntries],
    }));
  }, [combat, recordAction, saveCombatActive]);

  const handlePrevTurn = useCallback(() => {
    if (!combat) return;

    const fromRound = combat.currentRound;
    const fromTurnIndex = combat.currentTurnIndex;

    const prevIndex = combat.currentTurnIndex - 1;
    const isPrevRound = prevIndex < 0;

    const toTurnIndex = isPrevRound ? combat.turnOrder.length - 1 : prevIndex;
    const toRound = isPrevRound ? Math.max(1, combat.currentRound - 1) : combat.currentRound;

    const action = createTurnAdvanceAction(fromRound, fromTurnIndex, toRound, toTurnIndex);

    saveCombatActive({
      ...combat,
      currentRound: toRound,
      currentTurnIndex: toTurnIndex,
    });
    recordAction(action);
  }, [combat, recordAction, saveCombatActive]);

  const updateResource = useCallback(
    (instanceId: string, resource: CombatResource, newValue: number) => {
      if (!combat) return;

      const participant = combat.participants.find((entry) => entry.instanceId === instanceId);
      if (!participant) return;

      const resourceKey = `current${resource}` as keyof Participant;
      const oldValueRaw = participant[resourceKey] as number | undefined;
      const oldValue = oldValueRaw || 0;
      if (oldValue === newValue) return;

      const resourceAction = createSetResourceAction(instanceId, resource, oldValue, newValue);

      const updatedParticipants = combat.participants.map((entry) =>
        entry.instanceId === instanceId ? { ...entry, [resourceKey]: newValue } : entry
      );

      saveCombatActive({
        ...combat,
        participants: updatedParticipants,
      });
      recordAction(resourceAction);

      const logEntry = createResourceLogEntry(
        combat.currentRound,
        combat.currentTurnIndex,
        instanceId,
        participant.name,
        resource,
        oldValue,
        newValue
      );

      saveCombatActive((previousCombat: CombatState) => ({
        ...previousCombat,
        log: [...previousCombat.log, logEntry],
      }));

      recordAction(createAddLogEntryAction(logEntry));
    },
    [combat, recordAction, saveCombatActive]
  );

  const handleAddCondition = useCallback(
    (conditionInstance: ConditionInstance) => {
      if (!combat || !currentActorTruth) return;

      const conditionAction = createAddConditionAction(currentActorTruth.instanceId, conditionInstance);

      const updatedParticipants = combat.participants.map((participant) => {
        if (participant.instanceId === currentActorTruth.instanceId) {
          return {
            ...participant,
            conditions: [...(participant.conditions || []), conditionInstance],
          };
        }
        return participant;
      });

      saveCombatActive({
        ...combat,
        participants: updatedParticipants,
      });
      recordAction(conditionAction);

      const logEntry = createConditionLogEntry({
        round: combat.currentRound,
        turn: combat.currentTurnIndex,
        targetInstanceId: currentActorTruth.instanceId,
        targetName: currentActorTruth.name,
        changeType: 'applied',
        conditionId: conditionInstance.conditionId,
        conditionLabel: conditionInstance.label,
        duration: conditionInstance.duration,
        source: conditionInstance.source,
      });

      saveCombatActive((previousCombat: CombatState) => ({
        ...previousCombat,
        log: [...previousCombat.log, logEntry],
      }));

      recordAction(createAddLogEntryAction(logEntry));
    },
    [combat, currentActorTruth, recordAction, saveCombatActive]
  );

  const handleRemoveCondition = useCallback(
    (conditionInstanceId: string) => {
      if (!combat || !currentActorTruth) return;

      const conditionToRemove = (currentActorTruth.conditions || []).find(
        (condition) => condition.instanceId === conditionInstanceId
      );
      if (!conditionToRemove) return;

      const conditionAction = createRemoveConditionAction(
        currentActorTruth.instanceId,
        conditionToRemove
      );

      const updatedParticipants = combat.participants.map((participant) => {
        if (participant.instanceId === currentActorTruth.instanceId) {
          return {
            ...participant,
            conditions: (participant.conditions || []).filter(
              (condition) => condition.instanceId !== conditionInstanceId
            ),
          };
        }
        return participant;
      });

      saveCombatActive({
        ...combat,
        participants: updatedParticipants,
      });
      recordAction(conditionAction);

      const logEntry = createConditionLogEntry({
        round: combat.currentRound,
        turn: combat.currentTurnIndex,
        targetInstanceId: currentActorTruth.instanceId,
        targetName: currentActorTruth.name,
        changeType: 'removed',
        conditionId: conditionToRemove.conditionId,
        conditionLabel: conditionToRemove.label,
      });

      saveCombatActive((previousCombat: CombatState) => ({
        ...previousCombat,
        log: [...previousCombat.log, logEntry],
      }));

      recordAction(createAddLogEntryAction(logEntry));
    },
    [combat, currentActorTruth, recordAction, saveCombatActive]
  );

  const handleUpdateCondition = useCallback(
    (conditionInstanceId: string, newDuration: ConditionDuration) => {
      if (!combat || !currentActorTruth) return;

      const conditionToUpdate = (currentActorTruth.conditions || []).find(
        (condition) => condition.instanceId === conditionInstanceId
      );
      if (!conditionToUpdate) return;

      const updatedCondition: ConditionInstance = {
        ...conditionToUpdate,
        duration: newDuration,
      };

      const conditionAction = createUpdateConditionAction(
        currentActorTruth.instanceId,
        conditionInstanceId,
        conditionToUpdate,
        updatedCondition
      );

      const updatedParticipants = combat.participants.map((participant) => {
        if (participant.instanceId === currentActorTruth.instanceId) {
          return {
            ...participant,
            conditions: (participant.conditions || []).map((condition) =>
              condition.instanceId === conditionInstanceId ? updatedCondition : condition
            ),
          };
        }
        return participant;
      });

      saveCombatActive({
        ...combat,
        participants: updatedParticipants,
      });
      recordAction(conditionAction);
    },
    [combat, currentActorTruth, recordAction, saveCombatActive]
  );

  return {
    handleNextTurn,
    handlePrevTurn,
    updateResource,
    handleAddCondition,
    handleRemoveCondition,
    handleUpdateCondition,
  };
}
