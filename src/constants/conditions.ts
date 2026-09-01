/**
 * Phase 6: Conditions Catalog
 *
 * Central registry of all combat conditions with metadata.
 * Conditions can be applied to combatants and track durations.
 */

// ============================================================================
// Condition IDs
// ============================================================================

export const ConditionId = {
  STUNNED: 'stunned',
  PRONE: 'prone',
  GRAPPLED: 'grappled',
  BLEEDING: 'bleeding',
  POISONED: 'poisoned',
  BURNING: 'burning',
  UNCONSCIOUS: 'unconscious',
  BLINDED: 'blinded',
  SLOWED: 'slowed',
  HASTE: 'haste',
  SHIELDED: 'shielded',
  FATIGUED: 'fatigued'
} as const;

export type ConditionIdType = typeof ConditionId[keyof typeof ConditionId];

// ============================================================================
// Duration Types
// ============================================================================

/**
 * Duration type constants
 */
export const DurationType = {
  TURNS: 'turns',                     // Expires after N actor turns
  ROUNDS: 'rounds',                   // Expires after N combat rounds
  UNTIL_END_OF_COMBAT: 'untilEndOfCombat',  // Lasts until combat ends
  PERMANENT: 'permanent'              // Lasts until manually removed
} as const;

export type DurationTypeValue = typeof DurationType[keyof typeof DurationType];

// ============================================================================
// Stacking Rules
// ============================================================================

/**
 * Stacking rule constants
 */
export const StackingRule = {
  REPLACE: 'replace',  // New application replaces old
  STACK: 'stack',      // Multiple instances can coexist
  MAX: 'max'           // Take longest duration if already present
} as const;

export type StackingRuleValue = typeof StackingRule[keyof typeof StackingRule];

// ============================================================================
// Condition Definitions
// ============================================================================

export interface ConditionDuration {
  type: DurationTypeValue;
  value: number | null;
}

export interface ConditionDefinition {
  id: ConditionIdType;
  label: string;
  description: string;
  defaultDuration: ConditionDuration;
  stackingRule: StackingRuleValue;
  isObvious: boolean;
  persistsAfterCombat: boolean;
  icon: string;
}

export const ConditionCatalog: Record<ConditionIdType, ConditionDefinition> = {
  [ConditionId.STUNNED]: {
    id: ConditionId.STUNNED,
    label: 'Stunned',
    description: 'Cannot take actions; Do Nothing maneuver; Defend at -4',
    defaultDuration: { type: 'turns', value: 1 },
    stackingRule: 'replace',  // replace, stack, max
    isObvious: true,           // Visible in Player View without reveal
    persistsAfterCombat: false,
    icon: '💫'
  },

  [ConditionId.PRONE]: {
    id: ConditionId.PRONE,
    label: 'Prone',
    description: 'On the ground; -4 to attack, -3 to defend vs melee, harder to hit at range',
    defaultDuration: { type: 'permanent', value: null },
    stackingRule: 'replace',
    isObvious: true,
    persistsAfterCombat: false,
    icon: '⬇️'
  },

  [ConditionId.GRAPPLED]: {
    id: ConditionId.GRAPPLED,
    label: 'Grappled',
    description: 'Held by opponent; limited actions; cannot move freely',
    defaultDuration: { type: 'permanent', value: null },
    stackingRule: 'replace',
    isObvious: true,
    persistsAfterCombat: false,
    icon: '🤝'
  },

  [ConditionId.BLEEDING]: {
    id: ConditionId.BLEEDING,
    label: 'Bleeding',
    description: 'Losing blood; takes ongoing HP damage each turn',
    defaultDuration: { type: 'untilEndOfCombat', value: null },
    stackingRule: 'stack',  // Can bleed from multiple wounds
    isObvious: true,
    persistsAfterCombat: false,
    icon: '🩸'
  },

  [ConditionId.POISONED]: {
    id: ConditionId.POISONED,
    label: 'Poisoned',
    description: 'Affected by toxin; effects vary by poison type',
    defaultDuration: { type: 'rounds', value: 10 },
    stackingRule: 'stack',
    isObvious: false,  // May not be visible
    persistsAfterCombat: true,
    icon: '☠️'
  },

  [ConditionId.BURNING]: {
    id: ConditionId.BURNING,
    label: 'Burning',
    description: 'On fire; takes ongoing damage each turn',
    defaultDuration: { type: 'untilEndOfCombat', value: null },
    stackingRule: 'stack',
    isObvious: true,
    persistsAfterCombat: false,
    icon: '🔥'
  },

  [ConditionId.UNCONSCIOUS]: {
    id: ConditionId.UNCONSCIOUS,
    label: 'Unconscious',
    description: 'Knocked out; cannot act or defend',
    defaultDuration: { type: 'permanent', value: null },
    stackingRule: 'replace',
    isObvious: true,
    persistsAfterCombat: true,
    icon: '😵'
  },

  [ConditionId.BLINDED]: {
    id: ConditionId.BLINDED,
    label: 'Blinded',
    description: 'Cannot see; -10 to attacks and active defenses',
    defaultDuration: { type: 'rounds', value: 3 },
    stackingRule: 'max',  // Take longest duration
    isObvious: false,
    persistsAfterCombat: true,
    icon: '👁️'
  },

  [ConditionId.SLOWED]: {
    id: ConditionId.SLOWED,
    label: 'Slowed',
    description: 'Movement and actions reduced; -2 to Speed-based skills',
    defaultDuration: { type: 'rounds', value: 3 },
    stackingRule: 'max',
    isObvious: false,
    persistsAfterCombat: false,
    icon: '🐌'
  },

  [ConditionId.HASTE]: {
    id: ConditionId.HASTE,
    label: 'Haste',
    description: 'Enhanced speed; +2 to Speed-based skills, extra move',
    defaultDuration: { type: 'rounds', value: 3 },
    stackingRule: 'max',
    isObvious: false,
    persistsAfterCombat: false,
    icon: '⚡'
  },

  [ConditionId.SHIELDED]: {
    id: ConditionId.SHIELDED,
    label: 'Shielded',
    description: 'Protected by magical or technological barrier; +X to defense',
    defaultDuration: { type: 'rounds', value: 3 },
    stackingRule: 'stack',  // Multiple shields can overlap
    isObvious: false,
    persistsAfterCombat: false,
    icon: '🛡️'
  },

  [ConditionId.FATIGUED]: {
    id: ConditionId.FATIGUED,
    label: 'Fatigued',
    description: 'Exhausted; ongoing FP drain; penalties to physical actions',
    defaultDuration: { type: 'untilEndOfCombat', value: null },
    stackingRule: 'stack',
    isObvious: false,
    persistsAfterCombat: false,
    icon: '😓'
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get condition definition by ID
 */
export function getCondition(conditionId: string): ConditionDefinition | null {
  return ConditionCatalog[conditionId as ConditionIdType] || null;
}

/**
 * Get all condition definitions as array
 */
export function getAllConditions(): ConditionDefinition[] {
  return Object.values(ConditionCatalog);
}

/**
 * Check if a condition is obvious (visible in Player View)
 */
export function isConditionObvious(conditionId: string): boolean {
  const condition = getCondition(conditionId);
  return condition?.isObvious ?? false;
}

/** Whether a condition should cross the post-combat boundary. Unknown IDs do not persist. */
export function conditionPersistsAfterCombat(conditionId: string): boolean {
  return getCondition(conditionId)?.persistsAfterCombat ?? false;
}

/**
 * Get condition label
 */
export function getConditionLabel(conditionId: string): string {
  const condition = getCondition(conditionId);
  return condition?.label || conditionId;
}

/**
 * Get condition icon
 */
export function getConditionIcon(conditionId: string): string {
  const condition = getCondition(conditionId);
  return condition?.icon || '❓';
}
