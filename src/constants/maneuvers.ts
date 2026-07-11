/**
 * Phase 7: Maneuver Catalog
 * Structured list of supported combat maneuvers with constraints and prompts.
 */

// ============================================================================
// Types
// ============================================================================

export interface ManeuverModifier {
  label: string;
  value: number;
}

export interface ManeuverWorkflow {
  attack?: {
    modifiers: ManeuverModifier[];
  };
  defense?: {
    modifiers: ManeuverModifier[];
  };
  damage?: {
    modifiers: ManeuverModifier[];
  };
  restrictions?: {
    attackerActiveDefensesDisabled?: boolean;
  };
}

export interface ManeuverRequirements {
  notUnconscious?: boolean;
}

export interface ManeuverForbids {
  stunned?: boolean;
}

export interface ManeuverPrompts {
  needsTarget?: boolean;
  allowsAttackPanel?: boolean;
  allowsDefensePanel?: boolean;
  allowsAimPanel?: boolean;
  allowsWaitPanel?: boolean;
}

export interface Maneuver {
  id: string;
  label: string;
  group: string;
  requires: ManeuverRequirements;
  forbids: ManeuverForbids;
  prompts: ManeuverPrompts;
  notes: string;
  workflow?: ManeuverWorkflow;
}

// ============================================================================
// Maneuver Catalog
// ============================================================================

export const ManeuverCatalog: Maneuver[] = [
  {
    id: 'do_nothing',
    label: 'Do Nothing',
    group: 'Core',
    requires: {},
    forbids: {},
    prompts: {},
    notes: 'Take no action; recover from stun and regain defenses.'
  },
  {
    id: 'move',
    label: 'Move',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: {},
    notes: 'Move up to full Move; no attack.'
  },
  {
    id: 'attack',
    label: 'Attack',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'One attack; normal defense allowed.',
    workflow: {
      attack: { modifiers: [] },
      damage: { modifiers: [] },
      restrictions: {}
    }
  },
  {
    id: 'all_out_attack_determined',
    label: 'All-Out Attack (Determined)',
    group: 'All-Out Attack',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'One attack at +4; no active defenses.',
    workflow: {
      attack: { modifiers: [{ label: 'All-Out (Determined)', value: 4 }] },
      damage: { modifiers: [] },
      restrictions: { attackerActiveDefensesDisabled: true }
    }
  },
  {
    id: 'all_out_attack_strong',
    label: 'All-Out Attack (Strong)',
    group: 'All-Out Attack',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'One attack at +2 damage; no active defenses.',
    workflow: {
      attack: { modifiers: [] },
      damage: { modifiers: [{ label: 'All-Out (Strong)', value: 2 }] },
      restrictions: { attackerActiveDefensesDisabled: true }
    }
  },
  {
    id: 'all_out_defense_increased',
    label: 'All-Out Defense (Increased Defense)',
    group: 'All-Out Defense',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: { allowsDefensePanel: true },
    notes: '+2 to one active defense; no attack.',
    workflow: {
      defense: { modifiers: [{ label: 'All-Out Defense (Increased)', value: 2 }] },
      restrictions: { attackerActiveDefensesDisabled: false }
    }
  },
  {
    id: 'all_out_defense_dodge',
    label: 'All-Out Defense (Dodge)',
    group: 'All-Out Defense',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: { allowsDefensePanel: true },
    notes: 'Dodge twice; no attack.'
  },
  {
    id: 'aim',
    label: 'Aim',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAimPanel: true },
    notes: 'Aim a ranged weapon; bonuses accrue per turn.'
  },
  {
    id: 'evaluate',
    label: 'Evaluate',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true },
    notes: 'Study opponent for future attacks.'
  },
  {
    id: 'feint',
    label: 'Feint',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'Contest of skills; sets up next attack.'
  },
  {
    id: 'ready',
    label: 'Ready',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: {},
    notes: 'Ready or reload an item.'
  },
  {
    id: 'concentrate',
    label: 'Concentrate',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: {},
    notes: 'Focus on a mental task or spell.'
  },
  {
    id: 'change_posture',
    label: 'Change Posture',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: {},
    notes: 'Stand up, kneel, or go prone.'
  },
  {
    id: 'wait',
    label: 'Wait',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { allowsWaitPanel: true },
    notes: 'Delay action until trigger occurs.'
  }
];

// ============================================================================
// Maneuver ID Lookup
// ============================================================================

export const ManeuverIds: Record<string, string> = ManeuverCatalog.reduce((acc, maneuver) => {
  acc[maneuver.id] = maneuver.id;
  return acc;
}, {} as Record<string, string>);

// ============================================================================
// Movement Budget Helper
// ============================================================================

/** Maneuvers that grant full Move */
const FULL_MOVE_MANEUVERS = new Set(['move', 'move_and_attack']);
/** Maneuvers that grant half Move */
const HALF_MOVE_MANEUVERS = new Set(['all_out_attack_determined', 'all_out_attack_strong']);
/** Maneuvers that grant no movement */
const NO_MOVE_MANEUVERS = new Set(['aim', 'concentrate', 'do_nothing']);

/**
 * Returns the movement budget in yards for a given maneuver + basicMove.
 * GURPS rules: Move = full, Attack/most = 1-yard step, AoA = half Move step,
 * Aim/Concentrate/Do Nothing = 0.
 *
 * @param maneuverId  The maneuver chosen this turn
 * @param basicMove   The character's Basic Move stat
 * @param isCombatMap Whether on a tactical (hex/grid) map
 */
export function getMovementBudgetYards(
  maneuverId: string,
  basicMove: number,
  _isCombatMap = true,
): number {
  if (FULL_MOVE_MANEUVERS.has(maneuverId)) return basicMove;
  if (HALF_MOVE_MANEUVERS.has(maneuverId)) return Math.max(1, Math.floor(basicMove / 2));
  if (NO_MOVE_MANEUVERS.has(maneuverId)) return 0;
  // Default: 1-yard step for Attack, Feint, Ready, Evaluate, All-Out Defense, etc.
  return 1;
}
