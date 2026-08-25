/**
 * useCombatConditions — manages condition add/remove/update on participants.
 *
 * Extracted from CombatTracker (Phase 11a decomposition).
 *
 * Phase 12a.6 session 3: handlers generalized to target any participant by
 * instanceId (the condition popover opens from tracker rows, timeline tokens,
 * and map tokens — not just the current actor). The original actor-bound
 * handlers remain as thin wrappers.
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
  /** Actor-bound wrappers (current actor only) — pre-12a.6 API. */
  handleAddCondition: (conditionInstance: ConditionInstance) => void;
  handleRemoveCondition: (conditionInstanceId: string) => void;
  handleUpdateCondition: (
    conditionInstanceId: string,
    newDuration: ConditionDuration,
  ) => void;
  handleCycleConditionRevealed: (conditionInstanceId: string) => void;
  /** Participant-targeted variants for the two-surface condition popover. */
  addConditionTo: (
    participantInstanceId: string,
    conditionInstance: ConditionInstance,
  ) => void;
  removeConditionFrom: (
    participantInstanceId: string,
    conditionInstanceId: string,
  ) => void;
  cycleConditionRevealedOn: (
    participantInstanceId: string,
    conditionInstanceId: string,
  ) => void;
}

interface CombatConditionDeps {
  /** Null while no combat is active (CombatContext calls hooks before its guard). */
  combat: CombatState | null;
  currentActorTruth: Participant | undefined;
  recordAction: (action: unknown) => void;
}

export function useCombatConditions(
  deps: CombatConditionDeps,
): CombatConditionHandlers {
  const { saveCombatActive } = useCombatStore();
  const { combat, currentActorTruth, recordAction } = deps;

  const addConditionTo = useCallback(
    (participantInstanceId: string, conditionInstance: ConditionInstance) => {
      if (!combat) return;
      const target = combat.participants.find(
        (p) => p.instanceId === participantInstanceId,
      );
      if (!target) return;

      const conditionAction = createAddConditionAction(
        participantInstanceId,
        conditionInstance,
      );

      const updatedParticipants = combat.participants.map((p) => {
        if (p.instanceId === participantInstanceId) {
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
        targetInstanceId: participantInstanceId,
        targetName: target.name,
        changeType: 'applied',
        conditionId: conditionInstance.conditionId,
        conditionLabel: conditionInstance.label,
        duration: conditionInstance.duration,
        source: conditionInstance.source,
      });

      saveCombatActive((prev) => (prev ? { ...prev, log: [...prev.log, logEntry] } : prev));

      recordAction(createAddLogEntryAction(logEntry));
    },
    [combat, recordAction, saveCombatActive],
  );

  const removeConditionFrom = useCallback(
    (participantInstanceId: string, conditionInstanceId: string) => {
      if (!combat) return;
      const target = combat.participants.find(
        (p) => p.instanceId === participantInstanceId,
      );
      if (!target) return;

      const conditions = target.conditions || [];
      const conditionToRemove = conditions.find(
        (c) => c.instanceId === conditionInstanceId,
      );
      if (!conditionToRemove) return;

      const conditionAction = createRemoveConditionAction(
        participantInstanceId,
        conditionToRemove,
      );

      const updatedParticipants = combat.participants.map((p) => {
        if (p.instanceId === participantInstanceId) {
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
        targetInstanceId: participantInstanceId,
        targetName: target.name,
        changeType: 'removed',
        conditionId: conditionToRemove.conditionId,
        conditionLabel: conditionToRemove.label,
      });

      saveCombatActive((prev) => (prev ? { ...prev, log: [...prev.log, logEntry] } : prev));

      recordAction(createAddLogEntryAction(logEntry));
    },
    [combat, recordAction, saveCombatActive],
  );

  // Cycle the GM-controlled eye state (closed → half → open). No combat-log
  // entry — reveal state is GM-secret and the log reaches player view. Undo
  // still works via the recorded update action.
  const cycleConditionRevealedOn = useCallback(
    (participantInstanceId: string, conditionInstanceId: string) => {
      if (!combat) return;
      const target = combat.participants.find(
        (p) => p.instanceId === participantInstanceId,
      );
      if (!target) return;

      const conditions = target.conditions || [];
      const conditionToCycle = conditions.find(
        (c) => c.instanceId === conditionInstanceId,
      );
      if (!conditionToCycle) return;

      const updatedCondition: ConditionInstance = {
        ...conditionToCycle,
        revealed: cycleRevealed(conditionToCycle.revealed),
      };

      const conditionAction = createUpdateConditionAction(
        participantInstanceId,
        conditionInstanceId,
        conditionToCycle,
        updatedCondition,
      );

      const updatedParticipants = combat.participants.map((p) => {
        if (p.instanceId === participantInstanceId) {
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
    [combat, recordAction, saveCombatActive],
  );

  const handleAddCondition = useCallback(
    (conditionInstance: ConditionInstance) => {
      if (!currentActorTruth) return;
      addConditionTo(currentActorTruth.instanceId, conditionInstance);
    },
    [addConditionTo, currentActorTruth],
  );

  const handleRemoveCondition = useCallback(
    (conditionInstanceId: string) => {
      if (!currentActorTruth) return;
      removeConditionFrom(currentActorTruth.instanceId, conditionInstanceId);
    },
    [currentActorTruth, removeConditionFrom],
  );

  const handleCycleConditionRevealed = useCallback(
    (conditionInstanceId: string) => {
      if (!currentActorTruth) return;
      cycleConditionRevealedOn(currentActorTruth.instanceId, conditionInstanceId);
    },
    [currentActorTruth, cycleConditionRevealedOn],
  );

  const handleUpdateCondition = useCallback(
    (conditionInstanceId: string, newDuration: ConditionDuration) => {
      if (!combat || !currentActorTruth) return;

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

  return {
    handleAddCondition,
    handleRemoveCondition,
    handleUpdateCondition,
    handleCycleConditionRevealed,
    addConditionTo,
    removeConditionFrom,
    cycleConditionRevealedOn,
  };
}
