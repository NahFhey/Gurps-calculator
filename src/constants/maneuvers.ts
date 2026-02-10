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

export type MovementBudget = 'full' | 'half' | 'step' | 'none';

export interface Maneuver {
  id: string;
  label: string;
  group: string;
  requires: ManeuverRequirements;
  forbids: ManeuverForbids;
  prompts: ManeuverPrompts;
  notes: string;
  workflow?: ManeuverWorkflow;
  /** Movement budget for tactical grid combat. 'full'=basicMove, 'half'=floor(basicMove/2), 'step'=1 yard, 'none'=0. */
  movementBudget: MovementBudget;
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
    notes: 'Take no action; recover from stun and regain defenses.',
    movementBudget: 'none'
  },
  {
    id: 'move',
    label: 'Move',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: {},
    notes: 'Move up to full Move; no attack.',
    movementBudget: 'full'
  },
  {
    id: 'attack',
    label: 'Attack',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'One attack; normal defense allowed.',
    movementBudget: 'step',
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
    movementBudget: 'step',
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
    movementBudget: 'step',
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
    movementBudget: 'step',
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
    notes: 'Dodge twice; no attack.',
    movementBudget: 'step'
  },
  {
    id: 'aim',
    label: 'Aim',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAimPanel: true },
    notes: 'Aim a ranged weapon; bonuses accrue per turn.',
    movementBudget: 'step'
  },
  {
    id: 'evaluate',
    label: 'Evaluate',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true },
    notes: 'Study opponent for future attacks.',
    movementBudget: 'step'
  },
  {
    id: 'feint',
    label: 'Feint',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { needsTarget: true, allowsAttackPanel: true },
    notes: 'Contest of skills; sets up next attack.',
    movementBudget: 'step'
  },
  {
    id: 'ready',
    label: 'Ready',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: {},
    notes: 'Ready or reload an item.',
    movementBudget: 'step'
  },
  {
    id: 'concentrate',
    label: 'Concentrate',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: {},
    notes: 'Focus on a mental task or spell.',
    movementBudget: 'step'
  },
  {
    id: 'change_posture',
    label: 'Change Posture',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: {},
    prompts: {},
    notes: 'Stand up, kneel, or go prone.',
    movementBudget: 'none'
  },
  {
    id: 'wait',
    label: 'Wait',
    group: 'Core',
    requires: { notUnconscious: true },
    forbids: { stunned: true },
    prompts: { allowsWaitPanel: true },
    notes: 'Delay action until trigger occurs.',
    movementBudget: 'none'
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
// Movement Budget Helpers
// ============================================================================

/**
 * Compute the movement budget in yards for a given maneuver and participant.
 * Returns 0 if the combat has no map (abstract mode) or maneuver is unknown.
 *
 * @param maneuverId - Selected maneuver ID
 * @param basicMove - Participant's Basic Move stat (yards)
 * @param hasMap - Whether this combat has a linked tactical map
 * @returns Movement budget in yards
 */
export function getMovementBudgetYards(
  maneuverId: string | null | undefined,
  basicMove: number,
  hasMap: boolean
): number {
  if (!maneuverId || !hasMap) return 0;
  const maneuver = ManeuverCatalog.find(m => m.id === maneuverId);
  if (!maneuver) return 0;
  switch (maneuver.movementBudget) {
    case 'full': return basicMove;
    case 'half': return Math.floor(basicMove / 2);
    case 'step': return 1;
    case 'none': return 0;
  }
}
