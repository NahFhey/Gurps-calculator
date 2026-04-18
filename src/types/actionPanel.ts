import type { ConditionDuration, ConditionInstance } from './combatTracker';

export interface Modifier {
  label: string;
  value: number;
}

export interface HitLocation {
  key: string;
  label: string;
}

export interface LocationRoll {
  dice: number[];
  total: number;
}

export interface Attack {
  name: string;
  skill: number;
  damage?: string;
  hitLocation?: HitLocation | null;
  hitLocationRoll?: LocationRoll | null;
  success?: boolean;
}

export interface Defense {
  type: string;
  baseDefense: number;
  effectiveDefense: number;
  success?: boolean | null;
}

export interface ActionPanelParticipant {
  instanceId: string;
  id?: string;
  name: string;
  category: string;
  currentHP?: number;
  hp?: number;
  st?: number;
  isDead?: boolean;
  isUnconscious?: boolean;
  isStunned?: boolean;
  defenses?: {
    dodge?: number | { mode: string; value?: number };
    parry?: number | { mode: string; value?: number };
    block?: number | { mode: string; value?: number };
  };
  dodge?: number | { mode: string; value?: number };
  parry?: number | { mode: string; value?: number };
  block?: number | { mode: string; value?: number };
  conditions?: ConditionInstance[];
}

export interface ManeuverPrompts {
  allowsAttackPanel?: boolean;
  allowsDefensePanel?: boolean;
  allowsAimPanel?: boolean;
  allowsWaitPanel?: boolean;
}

export interface ManeuverWorkflow {
  attack?: { modifiers: Modifier[] };
  defense?: { modifiers: Modifier[] };
  damage?: { modifiers: Modifier[] };
}

export interface ManeuverSelection {
  selectedId: string | null;
  prompts: ManeuverPrompts;
  workflow: ManeuverWorkflow;
}

export interface TurnDecision {
  aim?: { targetInstanceId?: string; turnsAimed?: number };
  wait?: { triggerText?: string };
}

export interface AttackData {
  name: string;
  baseSkill: number;
  modifiers: Modifier[];
  injectedModifiers: Modifier[];
  effectiveSkill: number;
  rollTotal: number | null;
  margin: number | null;
  success: boolean | null;
  damage?: string;
  notes?: string;
  hitLocation: HitLocation | null;
  hitLocationRoll: LocationRoll | null;
}

export interface DefenseData {
  defense?: Defense;
}

export interface InjuryData {
  targetInstanceId?: string;
  newHP?: number;
}

export interface ActionData {
  maneuver: string | null;
  kind: 'attack' | 'defense' | 'injury' | 'note';
  attack?: Attack;
  defense?: Defense;
  injury?: InjuryData;
  note?: string;
  targetInstanceId?: string | null;
  newHP?: number;
}

export type WorkflowType = 'attack' | 'defense' | 'damage' | 'note' | 'conditions' | 'items' | null;

export interface ManeuverWorkflowUpdate {
  type: string;
  targetInstanceId?: string;
  turnsAimed?: number;
  triggerText?: string;
}

export interface ActionPanelProps {
  currentActor: ActionPanelParticipant;
  participants: ActionPanelParticipant[];
  combatState?: unknown;
  revealState?: unknown;
  viewMode?: string;
  onActionComplete: (data: ActionData) => void;
  combatRulesPreset?: string;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  maneuverSelection?: ManeuverSelection | null;
  onManeuverWorkflow?: (update: ManeuverWorkflowUpdate) => void;
  turnDecision?: TurnDecision | null;
  currentRound?: number;
  currentTurn?: number;
  onAddCondition?: (condition: ConditionInstance) => void;
  onRemoveCondition?: (conditionInstanceId: string) => void;
  onUpdateCondition?: (conditionInstanceId: string, newDuration: ConditionDuration) => void;
}
