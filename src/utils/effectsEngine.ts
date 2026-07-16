/**
 * Effects Engine
 * Handles injury effects: shock, major wounds, stun, consciousness, death, bleeding, crippling
 */

import { rollVsTarget } from './dice';
import type { RollVsTargetResult } from './dice';
import { applyCondition, removeConditionType } from './conditionsEngine';
import type { ConditionBearer, CreateConditionOptions } from './conditionsEngine';
import { ConditionId, DurationType } from '../constants/conditions';

interface HPChecks {
  consciousness: boolean;
  death: boolean;
  autoUnconsciousness: boolean;
  autoDeath: boolean;
}

interface HitLocationLike {
  isExtremity?: boolean;
  isLimb?: boolean;
  key?: string;
  label?: string;
}

interface EffectsTarget {
  ht?: number;
  id?: string;
  instanceId?: string;
  name?: string;
}

interface GenerateEffectsParams {
  injury: number;
  injuryResult: {
    injury?: number;
    location?: HitLocationLike | null;
  };
  currentHP: number;
  newHP: number;
  maxHP: number;
  combatRulesPreset?: string;
  target: EffectsTarget;
}

interface EffectPrompt {
  type: string;
  description: string;
  value?: number;
  autoApply?: boolean;
  checkType?: string;
  target?: number;
  penalty?: number;
  locationKey?: string;
  locationLabel?: string;
  optional?: boolean;
}

interface EffectBleeding {
  rate: number;
  lastCheckedAtRound?: number;
  round?: number;
}

interface EffectCombatant extends ConditionBearer {
  shockPenalty?: number;
  isDead?: boolean;
  bleeding?: EffectBleeding | null;
  crippled?: Array<string | undefined>;
}

interface EffectData {
  round?: number;
  turn?: number;
  value?: number;
  stunned?: boolean;
  unconscious?: boolean;
  dead?: boolean;
  bleeding?: boolean;
  rate?: number;
  locationKey?: string;
}

/**
 * Combat rules presets
 */
export const COMBAT_RULES_PRESETS = {
  LITE: 'lite',
  STANDARD: 'standard',
  CRUNCHY: 'crunchy'
};

/**
 * Calculate shock penalty from injury
 * @param {number} injury - Injury sustained
 * @param {number} maxHP - Maximum HP
 * @returns {number} Shock penalty (negative number, e.g., -4)
 */
export function calculateShockPenalty(injury: number, _maxHP: number): number {
  // Shock = -1 per full HP of injury, max -4
  const penalty = Math.min(4, Math.floor(injury));
  return -penalty;
}

/**
 * Check if injury qualifies as a major wound
 * @param {number} injury - Injury sustained in one blow
 * @param {number} maxHP - Maximum HP
 * @returns {boolean} True if major wound
 */
export function isMajorWound(injury: number, maxHP: number): boolean {
  // Major wound = injury > HP/2
  return injury > (maxHP / 2);
}

/**
 * Check if injury qualifies for knockdown/stun
 * @param {number} injury - Injury sustained
 * @param {number} maxHP - Maximum HP
 * @returns {boolean} True if knockdown check needed
 */
export function requiresKnockdownCheck(injury: number, maxHP: number): boolean {
  // Same threshold as major wound
  return isMajorWound(injury, maxHP);
}

/**
 * Determine consciousness/death checks based on HP
 * @param {number} currentHP - Current HP after injury
 * @param {number} maxHP - Maximum HP
 * @returns {Object} Check requirements
 */
export function getHPChecks(currentHP: number, maxHP: number): HPChecks {
  const checks = {
    consciousness: false,
    death: false,
    autoUnconsciousness: false,
    autoDeath: false
  };

  // At 0 or below: consciousness check
  if (currentHP <= 0) {
    checks.consciousness = true;
  }

  // At -1×HP or below: death check every turn
  if (currentHP <= -maxHP) {
    checks.death = true;
  }

  // At -5×HP: automatic death
  if (currentHP <= -5 * maxHP) {
    checks.autoDeath = true;
    checks.death = false; // No check needed, already dead
  }

  // At -10×HP or total destruction: automatic death
  if (currentHP <= -10 * maxHP) {
    checks.autoDeath = true;
    checks.death = false;
  }

  return checks;
}

/**
 * Check if limb/extremity is crippled
 * @param {Object} location - Hit location
 * @param {number} injury - Injury sustained
 * @param {number} maxHP - Maximum HP
 * @returns {boolean} True if location crippled
 */
export function isLocationCrippled(
  location: HitLocationLike | null | undefined,
  injury: number,
  maxHP: number
): boolean {
  if (!location) return false;

  // Extremities: crippled at > HP/3 injury
  if (location.isExtremity) {
    return injury > (maxHP / 3);
  }

  // Limbs: crippled at > HP/2 injury
  if (location.isLimb) {
    return injury > (maxHP / 2);
  }

  return false;
}

/**
 * Generate effects prompts based on injury and rules preset
 * @param {Object} params - Effect parameters
 * @returns {Array} Array of effect prompt objects
 */
export function generateEffectsPrompts({
  injury,
  injuryResult,
  currentHP: _currentHP,
  newHP,
  maxHP,
  combatRulesPreset = 'standard',
  target
}: GenerateEffectsParams): EffectPrompt[] {
  const prompts: EffectPrompt[] = [];

  // Skip all effects for lite preset except HP checks
  if (combatRulesPreset === 'lite') {
    // Only check for death/unconsciousness
    const hpChecks = getHPChecks(newHP, maxHP);
    if (hpChecks.autoDeath) {
      prompts.push({
        type: 'autoDeath',
        description: 'Target has reached -5×HP or worse and is automatically dead'
      });
    } else if (hpChecks.death) {
      prompts.push({
        type: 'deathCheck',
        description: 'Target must make a HT roll to avoid death',
        checkType: 'HT',
        target: target.ht
      });
    } else if (hpChecks.consciousness) {
      prompts.push({
        type: 'consciousnessCheck',
        description: 'Target must make a HT roll to stay conscious',
        checkType: 'HT',
        target: target.ht
      });
    }
    return prompts;
  }

  // Standard and Crunchy presets

  // 1. Shock (always applied automatically if injury > 0)
  if (injury > 0) {
    const shockPenalty = calculateShockPenalty(injury, maxHP);
    prompts.push({
      type: 'shock',
      description: `Shock penalty: ${shockPenalty} until next turn`,
      value: shockPenalty,
      autoApply: true
    });
  }

  // 2. Major wound check
  if (isMajorWound(injury, maxHP)) {
    prompts.push({
      type: 'majorWound',
      description: `Major wound! (Injury ${injury} > HP/2 ${Math.floor(maxHP/2)})`,
      autoApply: true
    });

    // 3. Knockdown/Stun check (follows major wound)
    prompts.push({
      type: 'knockdownStun',
      description: 'Roll HT to avoid knockdown and stunning',
      checkType: 'HT',
      target: target.ht,
      penalty: 0
    });
  }

  // 4. HP-based consciousness/death checks
  const hpChecks = getHPChecks(newHP, maxHP);

  if (hpChecks.autoDeath) {
    prompts.push({
      type: 'autoDeath',
      description: 'Target has reached -5×HP or worse and is automatically dead',
      autoApply: true
    });
  } else if (hpChecks.death) {
    prompts.push({
      type: 'deathCheck',
      description: `HT roll to avoid death (HP at ${newHP}, death threshold -${maxHP})`,
      checkType: 'HT',
      target: target.ht
    });
  } else if (hpChecks.consciousness) {
    prompts.push({
      type: 'consciousnessCheck',
      description: `HT roll to stay conscious (HP at ${newHP})`,
      checkType: 'HT',
      target: target.ht
    });
  }

  // Crunchy additions
  if (combatRulesPreset === 'crunchy') {
    // 5. Crippling injury check
    const location = injuryResult.location;
    if (location && isLocationCrippled(location, injury, maxHP)) {
      prompts.push({
        type: 'crippling',
        description: `${location.label} crippled! (Injury ${injury} exceeds crippling threshold)`,
        locationKey: location.key,
        locationLabel: location.label,
        autoApply: true
      });
    }

    // 6. Bleeding (major wounds can cause bleeding)
    if (isMajorWound(injury, maxHP)) {
      prompts.push({
        type: 'bleeding',
        description: 'Start bleeding? (GM decision)',
        optional: true
      });
    }
  }

  return prompts;
}

/**
 * Perform a HT check and return result
 * @param {number} ht - HT attribute
 * @param {number} penalty - Penalty to apply (e.g., -4)
 * @returns {Object} Roll result with success/failure
 */
export function performHTCheck(ht: number, penalty: number = 0): RollVsTargetResult {
  const target = ht + penalty;
  return rollVsTarget('3d6', target);
}

/**
 * Apply effect result to combatant state
 *
 * Since Phase 12a.6, stun and unconsciousness are written to conditions[]
 * (permanent duration — sticky until removed, matching the old bool
 * semantics) instead of the removed isStunned/isUnconscious booleans.
 * Pass effectData.round/turn for provenance on the created condition.
 *
 * @param {Object} combatant - Combatant object
 * @param {string} effectType - Type of effect
 * @param {*} effectData - Effect-specific data
 * @returns {Object} Updated combatant state
 */
export function applyEffect(
  combatant: EffectCombatant,
  effectType: string,
  effectData: EffectData
): EffectCombatant {
  const conditionOptions: CreateConditionOptions = {
    round: effectData?.round ?? 0,
    turn: effectData?.turn ?? 0,
    duration: { type: DurationType.PERMANENT, value: null }
  };
  const updates: EffectCombatant = { ...combatant };

  switch (effectType) {
    case 'shock':
      updates.shockPenalty = effectData.value;
      break;

    case 'stunned':
      return effectData.stunned
        ? applyCondition(combatant, ConditionId.STUNNED, conditionOptions)
        : removeConditionType(combatant, ConditionId.STUNNED);

    case 'unconscious':
      return effectData.unconscious
        ? applyCondition(combatant, ConditionId.UNCONSCIOUS, conditionOptions)
        : removeConditionType(combatant, ConditionId.UNCONSCIOUS);

    case 'dead':
      updates.isDead = effectData.dead;
      break;

    case 'bleeding':
      updates.bleeding = effectData.bleeding ? {
        rate: effectData.rate || 1,
        lastCheckedAtRound: effectData.round
      } : null;
      break;

    case 'crippling':
      if (!updates.crippled) {
        updates.crippled = [];
      }
      if (!updates.crippled.includes(effectData.locationKey)) {
        updates.crippled.push(effectData.locationKey);
      }
      break;

    default:
      break;
  }

  return updates;
}

/**
 * Clear shock penalty (call at start of combatant's turn)
 * @param {Object} combatant - Combatant object
 * @returns {Object} Updated combatant state
 */
export function clearShock<T extends EffectCombatant>(combatant: T): T & { shockPenalty: number } {
  return {
    ...combatant,
    shockPenalty: 0
  };
}

/**
 * Get all active effects summary for display
 *
 * Stun and unconsciousness are deliberately absent: since Phase 12a.6 they
 * live in conditions[] and render as condition badges — listing them here
 * would display them twice.
 *
 * @param {Object} combatant - Combatant object
 * @returns {Array} Array of effect descriptions
 */
export function getActiveEffects(combatant: EffectCombatant): string[] {
  const effects: string[] = [];

  if (combatant.shockPenalty && combatant.shockPenalty < 0) {
    effects.push(`Shock ${combatant.shockPenalty}`);
  }

  if (combatant.isDead) {
    effects.push('Dead');
  }

  if (combatant.bleeding) {
    effects.push(`Bleeding (${combatant.bleeding.rate}/turn)`);
  }

  if (combatant.crippled && combatant.crippled.length > 0) {
    effects.push(`Crippled: ${combatant.crippled.join(', ')}`);
  }

  return effects;
}
