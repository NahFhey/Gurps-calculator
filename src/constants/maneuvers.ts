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

/**
 * Get movement budget in yards for a given maneuver.
 *
 * GURPS movement rules by maneuver:
 * - Move: full Move
 * - Attack, Feint, Ready, Evaluate, Concentrate: step (1 yard) normally, full Move on map
 * - All-Out Attack: half Move (round up)
 * - All-Out Defense: half Move (round up)
 * - Aim: step only (1 yard)
 * - Change Posture, Do Nothing: 0
 * - Wait: depends on triggered action (treat as full for budget)
 *
 * @param maneuverId - The selected maneuver ID
 * @param basicMove - The character's Basic Move stat
 * @param hasMap - Whether combat is linked to a map (affects step vs full move)
 * @returns Movement budget in yards
 */
export function getMovementBudgetYards(
  maneuverId: string,
  basicMove: number = 5,
  hasMap: boolean = false,
): number {
  const move = Math.max(basicMove, 1);

  switch (maneuverId) {
    case 'move':
    case 'wait':
      return move;

    case 'all_out_attack_determined':
    case 'all_out_attack_strong':
    case 'all_out_defense_increased':
    case 'all_out_defense_dodge':
      return Math.ceil(move / 2);

    case 'attack':
    case 'feint':
    case 'ready':
    case 'evaluate':
    case 'concentrate':
      // On a tactical map these maneuvers allow a step (1 yard)
      // Without a map, treat as no movement tracking
      return hasMap ? 1 : 0;

    case 'aim':
      return hasMap ? 1 : 0;

    case 'change_posture':
    case 'do_nothing':
    default:
      return 0;
  }
}

// ============================================================================
// Maneuver ID Lookup
// ============================================================================

export const ManeuverIds: Record<string, string> = ManeuverCatalog.reduce((acc, maneuver) => {
  acc[maneuver.id] = maneuver.id;
  return acc;
}, {} as Record<string, string>);
