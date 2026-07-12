/**
 * useCombatConditions — manages condition add/remove/update on participants.
 *
 * Extracted from CombatTracker (Phase 11a decomposition).
 */

import { useCallback } from 'react';
import { useCombatStore } from './useCombatStore';
import { createConditionLogEntry } from '../utils/combatHelpers';
import { cycleRevealed } from '../utils/conditionsEngine';
import {
  createAddConditionAction,
  createRemoveConditionAction,
  createUpdateConditionAction,
  createAddLogEntryAction,
} from '../utils/combatActions';
import type {
  Participant,
  CombatState,
  ConditionInstance,
  ConditionDuration,
} from '../types/combatTracker';

export interface CombatConditionHandlers {
  handleAddCondition: (conditionInstance: ConditionInstance) => void;
  handleRemoveCondition: (conditionInstanceId: string) => void;
  handleUpdateCondition: (
    conditionInstanceId: string,
    newDuration: ConditionDuration,
  ) => void;
  handleCycleConditionRevealed: (conditionInstanceId: string) => void;
}

interface CombatConditionDeps {
  combat: CombatState;
  currentActorTruth: Participant | undefined;
  recordAction: (action: unknown) => void;
}

export function useCombatConditions(
  deps: CombatConditionDeps,
): CombatConditionHandlers {
  const { saveCombatActive } = useCombatStore();
  const { combat, currentActorTruth, recordAction } = deps;

  const handleAddCondition = useCallback(
    (conditionInstance: ConditionInstance) => {
      if (!currentActorTruth) return;

      const conditionAction = createAddConditionAction(
        currentActorTruth.instanceId,
        conditionInstance,
      );

      const updatedParticipants = combat.participants.map((p) => {
        if (p.instanceId === currentActorTruth.instanceId) {
          const conditions = p.conditions || [];
          return { ...p, conditions: [...conditions, conditionInstance] };
        }
        return p;
      });

      const newCombat: CombatState = {
        ...combat,
        participants: updatedParticipants,
      };

      saveCombatActive(newCombat);
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

      saveCombatActive((prev: CombatState) => ({
        ...prev,
        log: [...prev.log, logEntry],
      }));

      recordAction(createAddLogEntryAction(logEntry));
    },
    [combat, currentActorTruth, recordAction, saveCombatActive],
  );

  const handleRemoveCondition = useCallback(
    (conditionInstanceId: string) => {
      if (!currentActorTruth) return;

      const conditions = currentActorTruth.conditions || [];
      const conditionToRemove = conditions.find(
        (c) => c.instanceId === conditionInstanceId,
      );
      if (!conditionToRemove) return;

      const conditionAction = createRemoveConditionAction(
        currentActorTruth.instanceId,
        conditionToRemove,
      );

      const updatedParticipants = combat.participants.map((p) => {
        if (p.instanceId === currentActorTruth.instanceId) {
          return {
            ...p,
            conditions: (p.conditions || []).filter(
              (c) => c.instanceId !== conditionInstanceId,
            ),
          };
        }
        return p;
      });

      const newCombat: CombatState = {
        ...combat,
        participants: updatedParticipants,
      };

      saveCombatActive(newCombat);
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

      saveCombatActive((prev: CombatState) => ({
        ...prev,
        log: [...prev.log, logEntry],
      }));

      recordAction(createAddLogEntryAction(logEntry));
    },
    [combat, currentActorTruth, recordAction, saveCombatActive],
  );

  const handleUpdateCondition = useCallback(
    (conditionInstanceId: string, newDuration: ConditionDuration) => {
      if (!currentActorTruth) return;

      const conditions = currentActorTruth.conditions || [];
      const conditionToUpdate = conditions.find(
        (c) => c.instanceId === conditionInstanceId,
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
        updatedCondition,
      );

      const updatedParticipants = combat.participants.map((p) => {
        if (p.instanceId === currentActorTruth.instanceId) {
          return {
            ...p,
            conditions: (p.conditions || []).map((c) =>
              c.instanceId === conditionInstanceId ? updatedCondition : c,
            ),
          };
        }
        return p;
      });

      const newCombat: CombatState = {
        ...combat,
        participants: updatedParticipants,
      };

      saveCombatActive(newCombat);
      recordAction(conditionAction);
    },
    [combat, currentActorTruth, recordAction, saveCombatActive],
  );

  // Phase 12a.6: cycle the GM-controlled eye state (closed → half → open).
  // No combat-log entry — reveal state is GM-secret and the log reaches
  // player view. Undo still works via the recorded update action.
  const handleCycleConditionRevealed = useCallback(
    (conditionInstanceId: string) => {
      if (!currentActorTruth) return;

      const conditions = currentActorTruth.conditions || [];
      const conditionToCycle = conditions.find(
        (c) => c.instanceId === conditionInstanceId,
      );
      if (!conditionToCycle) return;

      const updatedCondition: ConditionInstance = {
        ...conditionToCycle,
        revealed: cycleRevealed(conditionToCycle.revealed),
      };

      const conditionAction = createUpdateConditionAction(
        currentActorTruth.instanceId,
        conditionInstanceId,
        conditionToCycle,
        updatedCondition,
      );

      const updatedParticipants = combat.participants.map((p) => {
        if (p.instanceId === currentActorTruth.instanceId) {
          return {
            ...p,
            conditions: (p.conditions || []).map((c) =>
              c.instanceId === conditionInstanceId ? updatedCondition : c,
            ),
          };
        }
        return p;
      });

      saveCombatActive({ ...combat, participants: updatedParticipants });
      recordAction(conditionAction);
    },
    [combat, currentActorTruth, recordAction, saveCombatActive],
  );

  return {
    handleAddCondition,
    handleRemoveCondition,
    handleUpdateCondition,
    handleCycleConditionRevealed,
  };
}
