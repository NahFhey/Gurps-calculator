/**
 * combatUIStore — lightweight external store for ephemeral combat UI state.
 *
 * Shared across components via useSyncExternalStore so that
 * useCombatSession() consumers all see the same selectedParticipantId,
 * gmMode, viewMode, dice expression, etc. without a React Context.
 */

import { useSyncExternalStore } from 'react';
import { ViewMode, type ViewModeType } from '../utils/combatViewFilter';

export interface CombatUIState {
  selectedParticipantId: string | null;
  gmMode: boolean;
  viewMode: ViewModeType;
  diceExpression: string;
  rollTarget: string;
}

const initialState: CombatUIState = {
  selectedParticipantId: null,
  gmMode: false,
  viewMode: ViewMode.PLAYER,
  diceExpression: '3d6',
  rollTarget: '',
};

let state: CombatUIState = { ...initialState };
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return state;
}

export function setCombatUI(partial: Partial<CombatUIState>) {
  state = { ...state, ...partial };
  emitChange();
}

export function resetCombatUI() {
  state = { ...initialState };
  emitChange();
}

export function useCombatUI(): CombatUIState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
