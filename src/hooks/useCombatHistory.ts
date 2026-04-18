import { useCallback, useMemo } from 'react';
import {
  addAction,
  canRedo,
  canUndo,
  createSnapshot,
  redo,
  undo,
} from '../utils/combatHistory';
import { createSetTurnDecisionAction } from '../utils/combatActions';
import { syncRevealStateForParticipants } from '../utils/combatReveal';
import type { CombatState, HistoryState, RevealState, TurnDecision } from '../types/combatTracker';

interface UseCombatHistoryOptions {
  combat: CombatState | null;
  history: HistoryState;
  reveal: RevealState | null;
  currentActorInstanceId?: string | null;
  saveCombatActive: (sessionOrUpdater: unknown) => void;
  saveCombatActiveHistory: (history: HistoryState | null) => void;
  saveCombatReveal: (revealState: RevealState | null) => void;
}

interface UseCombatHistoryResult {
  turnDecisionKey: string | null;
  turnDecisions: Record<string, TurnDecision>;
  currentTurnDecision: TurnDecision;
  recordAction: (action: unknown) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  updateTurnDecisionState: (
    previousDecision: TurnDecision | null,
    nextDecision: TurnDecision | null
  ) => void;
}

export function useCombatHistory({
  combat,
  history,
  reveal,
  currentActorInstanceId,
  saveCombatActive,
  saveCombatActiveHistory,
  saveCombatReveal,
}: UseCombatHistoryOptions): UseCombatHistoryResult {
  const baseState = useMemo(() => (combat ? createSnapshot(combat) : null), [combat]);

  const turnDecisionKey = useMemo(
    () =>
      combat && currentActorInstanceId
        ? `${combat.currentRound}_${combat.currentTurnIndex}_${currentActorInstanceId}`
        : null,
    [combat, currentActorInstanceId]
  );

  const turnDecisions = useMemo(() => combat?.turnDecisions || {}, [combat]);
  const currentTurnDecision = useMemo(
    () => (turnDecisionKey ? turnDecisions[turnDecisionKey] || {} : {}),
    [turnDecisionKey, turnDecisions]
  );

  const recordAction = useCallback(
    (action: unknown) => {
      if (!combat) return;
      const newHistory = addAction(history as any, action as any, combat as any, (reveal as any) || undefined);
      saveCombatActiveHistory(newHistory as HistoryState);
    },
    [combat, history, reveal, saveCombatActiveHistory]
  );

  const normalizeTurnDecision = useCallback((decision: TurnDecision | null): TurnDecision | null => {
    if (!decision) return null;

    const hasManeuver = Boolean(decision.maneuverId);
    const hasNotes = Boolean(decision.notes && decision.notes.trim());
    const hasAim = Boolean(decision.aim?.targetInstanceId || decision.aim?.turnsAimed);
    const hasWait = Boolean(decision.wait?.triggerText && decision.wait.triggerText.trim());

    if (!hasManeuver && !hasNotes && !hasAim && !hasWait) {
      return null;
    }

    return {
      ...decision,
      notes: decision.notes || undefined,
      aim: decision.aim || undefined,
      wait: decision.wait || undefined,
    };
  }, []);

  const updateTurnDecisionState = useCallback(
    (previousDecision: TurnDecision | null, nextDecision: TurnDecision | null) => {
      if (!combat || !turnDecisionKey) return;

      const normalizedDecision = normalizeTurnDecision(nextDecision);
      const updatedTurnDecisions = { ...turnDecisions };

      if (normalizedDecision) {
        updatedTurnDecisions[turnDecisionKey] = normalizedDecision;
      } else {
        delete updatedTurnDecisions[turnDecisionKey];
      }

      saveCombatActive({
        ...combat,
        turnDecisions: updatedTurnDecisions,
      });

      recordAction(
        createSetTurnDecisionAction(turnDecisionKey, previousDecision || null, normalizedDecision)
      );
    },
    [
      combat,
      normalizeTurnDecision,
      recordAction,
      saveCombatActive,
      turnDecisionKey,
      turnDecisions,
    ]
  );

  const handleUndo = useCallback(() => {
    if (!combat || !baseState || !canUndo(history)) return;

    const result = undo(baseState as any, history as any, combat as any, (reveal as any) || undefined) as {
      newCombatState: CombatState;
      newHistory: HistoryState;
      newRevealState?: RevealState;
    };

    saveCombatActive(result.newCombatState);
    saveCombatActiveHistory(result.newHistory);

    if (result.newRevealState) {
      const syncedReveal = syncRevealStateForParticipants(
        result.newRevealState,
        result.newCombatState.participants
      ) as RevealState;
      saveCombatReveal(syncedReveal);
    }
  }, [
    baseState,
    combat,
    history,
    reveal,
    saveCombatActive,
    saveCombatActiveHistory,
    saveCombatReveal,
  ]);

  const handleRedo = useCallback(() => {
    if (!combat || !baseState || !canRedo(history)) return;

    const result = redo(baseState as any, history as any, combat as any, (reveal as any) || undefined) as {
      newCombatState: CombatState;
      newHistory: HistoryState;
      newRevealState?: RevealState;
    };

    saveCombatActive(result.newCombatState);
    saveCombatActiveHistory(result.newHistory);

    if (result.newRevealState) {
      const syncedReveal = syncRevealStateForParticipants(
        result.newRevealState,
        result.newCombatState.participants
      ) as RevealState;
      saveCombatReveal(syncedReveal);
    }
  }, [
    baseState,
    combat,
    history,
    reveal,
    saveCombatActive,
    saveCombatActiveHistory,
    saveCombatReveal,
  ]);

  return {
    turnDecisionKey,
    turnDecisions,
    currentTurnDecision,
    recordAction,
    handleUndo,
    handleRedo,
    updateTurnDecisionState,
  };
}
