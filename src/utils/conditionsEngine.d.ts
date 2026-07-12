import type {
  ConditionDuration,
  ConditionInstance,
  ConditionRevealState,
} from '../types/combatTracker';

/** Minimal shape the engine needs from a combatant/participant. */
export interface ConditionBearer {
  conditions?: ConditionInstance[];
}

export interface CreateConditionOptions {
  round?: number;
  turn?: number;
  duration?: ConditionDuration | null;
  severity?: number | null;
  source?: string | null;
  notes?: string | null;
  revealed?: ConditionRevealState | null;
}

export function createConditionInstance(
  conditionId: string,
  options?: CreateConditionOptions
): ConditionInstance | null;

export function applyCondition<T extends ConditionBearer>(
  combatant: T,
  conditionId: string,
  options?: CreateConditionOptions
): T;

export function removeCondition<T extends ConditionBearer>(
  combatant: T,
  instanceId: string,
  removeAll?: boolean
): T;

export function removeConditionType<T extends ConditionBearer>(
  combatant: T,
  conditionId: string
): T;

export function updateConditionDuration<T extends ConditionBearer>(
  combatant: T,
  instanceId: string,
  newDuration: ConditionDuration,
  currentRound: number,
  currentTurn: number
): T;

export function tickConditionsTurn<T extends ConditionBearer>(
  combatant: T,
  currentRound: number
): { combatant: T; expired: ConditionInstance[] };

export function tickConditionsRound<T extends ConditionBearer>(
  combatant: T,
  currentRound: number
): { combatant: T; expired: ConditionInstance[] };

export function clearEndOfCombatConditions<T extends ConditionBearer>(combatant: T): T;

export function getActiveConditions(combatant: ConditionBearer): ConditionInstance[];

export function hasCondition(combatant: ConditionBearer, conditionId: string): boolean;

export function getConditionInstances(
  combatant: ConditionBearer,
  conditionId: string
): ConditionInstance[];

export function formatConditionDuration(
  conditionInstance: Pick<ConditionInstance, 'expiresAt'>,
  currentRound?: number
): string;

export function formatConditionTooltip(
  conditionInstance: Partial<ConditionInstance>,
  currentRound?: number
): string;

export function cycleRevealed(
  revealed: ConditionRevealState | undefined
): ConditionRevealState;

export function cycleConditionRevealed<T extends ConditionBearer>(
  combatant: T,
  instanceId: string
): T;

export function ensureParticipantConditionVisibility<T>(participant: T): T;
