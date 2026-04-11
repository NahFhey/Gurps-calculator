import type { CombatState, HistoryState, RevealState } from '../types/combatTracker';

export interface UndoRedoResult {
  newHistory: HistoryState;
  newCombatState: CombatState;
  newRevealState?: RevealState;
}

export function createHistoryState(): HistoryState;
export function createSnapshot(combatState: CombatState): unknown;

export function addAction(
  historyState: HistoryState,
  action: Record<string, unknown>,
  currentCombatState: CombatState,
  currentRevealState?: RevealState
): HistoryState;

export function canUndo(historyState: HistoryState): boolean;
export function canRedo(historyState: HistoryState): boolean;
export function getUndoCount(historyState: HistoryState): number;
export function getRedoCount(historyState: HistoryState): number;

export function undo(
  baseState: CombatState,
  historyState: HistoryState,
  currentCombatState: CombatState | null,
  baseRevealState?: RevealState
): UndoRedoResult;

export function redo(
  baseState: CombatState,
  historyState: HistoryState,
  currentCombatState: CombatState | null,
  baseRevealState?: RevealState
): UndoRedoResult;
