import type { Participant, TurnContext } from '../types/combatTracker';

export function deriveTurnContext(combatant: Participant | null | undefined): TurnContext;
