import type { CombatState, Participant, RevealState } from '../types/combatTracker';

export type ViewModeType = 'gm' | 'player';

export declare const ViewMode: {
  GM: 'gm';
  PLAYER: 'player';
};

/** Sentinel conditionId on player-view placeholders for half-revealed conditions. */
export declare const CONCEALED_CONDITION_ID: '__concealed__';

export function getCombatView(
  combatState: CombatState,
  revealState: RevealState | undefined,
  viewMode: ViewModeType
): { participants: Participant[] } | null;

export function hasHiddenInfo(participant: Participant): boolean;
