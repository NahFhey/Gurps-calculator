import type { CombatState, Participant, RevealState } from '../types/combatTracker';

export type ViewModeType = 'gm' | 'player';

export declare const ViewMode: {
  GM: 'gm';
  PLAYER: 'player';
};

export function getCombatView(
  combatState: CombatState,
  revealState: RevealState | undefined,
  viewMode: ViewModeType
): { participants: Participant[] } | null;

export function hasHiddenInfo(participant: Participant): boolean;
