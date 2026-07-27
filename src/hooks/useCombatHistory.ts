/**
 * useCombatHistory — persistent undo/redo history for combat.
 *
 * Extracted from CombatTracker (Phase 11a decomposition).
 * Holds a HistoryState in React state so it persists across renders
 * and triggers re-renders when canUndo/canRedo change.
 *
 * The history resets whenever the active combat's ID changes.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useCombatStore } from './useCombatStore';
import {
  createHistoryState,
  createSnapshot,
  addAction,
  canUndo as histCanUndo,
  canRedo as histCanRedo,
  undo as histUndo,
  redo as histRedo,
} from '../utils/combatHistory';
import { syncRevealStateForParticipants } from '../utils/combatReveal';
import type {
  CombatState,
  HistoryState,
  RevealState,
} from '../types/combatTracker';
import type { UndoRedoResult } from '../utils/combatHistory';

export interface CombatHistoryResult {
  /** Current history state (for UI display — canUndo, canRedo, counts) */
  history: HistoryState;
  /** Record an action into the undo/redo stack */
  recordAction: (action: unknown) => void;
  /** Undo the last action */
  handleUndo: () => void;
  /** Redo the next action */
  handleRedo: () => void;
}

export function useCombatHistory(): CombatHistoryResult {
  const {
    combatActive,
    combatReveal,
    saveCombatActive,
    saveCombatReveal,
  } = useCombatStore();

  const combat = combatActive as CombatState | null;
  const reveal = combatReveal as RevealState | null;

  const [history, setHistory] = useState<HistoryState>(
    () => createHistoryState() as HistoryState,
  );

  // Track the combat ID so we reset history when combat changes
  const combatIdRef = useRef<string | null>(combat?.id ?? null);

  useEffect(() => {
    const currentId = combat?.id ?? null;
    if (currentId !== combatIdRef.current) {
      combatIdRef.current = currentId;
      setHistory(createHistoryState() as HistoryState);
    }
  }, [combat?.id]);

  // Keep a ref to the latest combat/reveal so callbacks don't go stale
  const combatRef = useRef(combat);
  combatRef.current = combat;
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const historyRef = useRef(history);
  historyRef.current = history;

  const recordAction = useCallback((action: unknown) => {
    const currentCombat = combatRef.current;
    const currentReveal = revealRef.current;
    const currentHistory = historyRef.current;
    if (!currentCombat || !currentHistory) return;

    const newHistory = addAction(
      currentHistory,
      action as Record<string, unknown>,
      currentCombat,
      currentReveal ?? undefined,
    ) as HistoryState;

    setHistory(newHistory);
    historyRef.current = newHistory;
  }, []);

  const handleUndo = useCallback(() => {
    const currentCombat = combatRef.current;
    const currentReveal = revealRef.current;
    const currentHistory = historyRef.current;
    if (!currentCombat || !currentHistory || !histCanUndo(currentHistory)) return;

    const baseState = createSnapshot(currentCombat);
    const result: UndoRedoResult = histUndo(
      baseState,
      currentHistory,
      currentCombat,
      currentReveal ?? undefined,
    );

    const newState: CombatState = result.newCombatState;
    const newHistory: HistoryState = result.newHistory;

    saveCombatActive(newState);
    setHistory(newHistory);
    historyRef.current = newHistory;

    if (result.newRevealState) {
      const syncedReveal = syncRevealStateForParticipants(
        result.newRevealState,
        newState.participants,
      );
      saveCombatReveal(syncedReveal ?? null);
    }
  }, [saveCombatActive, saveCombatReveal]);

  const handleRedo = useCallback(() => {
    const currentCombat = combatRef.current;
    const currentReveal = revealRef.current;
    const currentHistory = historyRef.current;
    if (!currentCombat || !currentHistory || !histCanRedo(currentHistory)) return;

    const baseState = createSnapshot(currentCombat);
    const result: UndoRedoResult = histRedo(
      baseState,
      currentHistory,
      currentCombat,
      currentReveal ?? undefined,
    );

    const newState: CombatState = result.newCombatState;
    const newHistory: HistoryState = result.newHistory;

    saveCombatActive(newState);
    setHistory(newHistory);
    historyRef.current = newHistory;

    if (result.newRevealState) {
      const syncedReveal = syncRevealStateForParticipants(
        result.newRevealState,
        newState.participants,
      );
      saveCombatReveal(syncedReveal ?? null);
    }
  }, [saveCombatActive, saveCombatReveal]);

  return { history, recordAction, handleUndo, handleRedo };
}
