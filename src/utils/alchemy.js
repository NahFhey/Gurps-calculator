/**
 * @fileoverview GURPS 4th Edition Alchemy System - Core Calculation Engine (Enhanced)
 *
 * This module implements the complete GURPS 4e alchemy rules for formula design,
 * batch brewing, and work block mechanics. It handles the tier-based Work Requirement (WR)
 * and Difficulty Modifier (DM) calculations according to official GURPS rules, with
 * enhanced features for hazard evaluation, role coverage validation, and automatic
 * tier calculation from potency load.
 *
 * Key Concepts:
 * - **Work Requirement (WR)**: Number of Progress Points (PP) needed to complete a batch
 * - **Difficulty Modifier (DM)**: Modifier applied to Alchemy skill rolls
 * - **Aspects**: Magical properties (Fire, Water, Light, Shadow, etc.) that define formula effects
 * - **Tally**: Sum of aspect points from all active ingredients, weighted by refinement level
 * - **Reagent Roles**: Active (provides effects), Stabilizer (reduces mishaps), Catalyst (reduces difficulty)
 * - **Refinement Levels**: crude (primary only), prepared (+secondary), refined (+tertiary)
 * - **Tier System**: Potions are categorized by power level (Tier 1-5) which sets base WR/DM
 * - **Potency Load**: Sum of (potency index + concentration steps) across all active ingredients
 * - **Hazards**: Dangerous reagent properties (Volatile, Unstable, Flammable, etc.) that trigger special events
 *
 * WR/DM Calculation Steps (see calculateFormulaStats):
 * 1. Auto-calculate tier from potency load (or use override)
 * 2. Start with base WR/DM from tier and vector
 * 3. Apply role coverage penalties (missing required roles)
 * 4. Apply hazard modifiers from hazard rules
 * 5. Add complexity penalties for multiple active aspects
 * 6. Check coherence (dominant aspect should lead by 3+ points)
 * 7. Apply conflict penalties for opposing aspect pairs
 * 8. Apply concentration penalties/bonuses
 * 9. Apply refinement bonuses (prepared/refined ingredients help)
 * 10. Apply catalyst matching bonuses
 * 11. Reduce WR by Lab Rating (0-4)
 *
 * @module utils/alchemy
 * @see {@link https://gurps.fandom.com/wiki/Alchemy GURPS Alchemy Rules}
 */

import {
  REFINEMENT_LEVELS,
  TIER_DATA,
  VECTORS,
  POTENCY_LEVELS,
  TIER_THRESHOLDS,
  REQUIRED_ROLES_BY_VECTOR,
  ROLE_COVERAGE_PENALTIES,
  MAX_REAGENTS_PER_BATCH,
  MAX_UNITS_PER_REAGENT_BY_ROLE,
  HAZARD_RULES
} from '../constants';
import { determineQuality } from './helpers';

/**
 * Conflicting aspect pairs that increase WR/DM difficulty.
 * Each conflict pair present in a formula reduces DM by 1.
 * @constant {Array<[string, string]>}
 */
const CONFLICT_PAIRS = [
  ['Fire', 'Water'],
  ['Light', 'Shadow'],
  ['Shadow', 'Vital']
];

/**
 * Clamps a value to stay within a specified range.
 * @private
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} The clamped value
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalizes Lab Rating to the valid 0-4 range.
 * Lab Rating reduces Work Requirement (WR) by 1 per point.
 *
 * @param {number} lr - The raw lab rating value
 * @returns {number} Lab rating clamped to 0-4 range
 *
 * @example
 * normalizeLabRating(3) // returns 3
 * normalizeLabRating(-1) // returns 0 (clamped)
 * normalizeLabRating(10) // returns 4 (clamped)
 */
export function normalizeLabRating(lr) {
  return clamp(lr || 0, 0, 4);
}

/**
 * Counts the number of distinct aspects with non-zero points in a tally.
 * Used to determine complexity penalties (3+ aspects increase WR and reduce DM).
 *
 * @private
 * @param {Object<string, number>} tally - Aspect tally object mapping aspect names to point totals
 * @returns {number} Count of active aspects (aspects with > 0 points)
 */
function countActiveAspects(tally) {
  return Object.keys(tally).filter(aspect => aspect && tally[aspect] > 0).length;
}

/**
 * Counts the number of conflicting aspect pairs present in a tally.
 * Each conflict pair (e.g., Fire+Water) reduces DM by 1.
 *
 * @private
 * @param {Object<string, number>} tally - Aspect tally object
 * @returns {number} Number of conflict pairs detected
 *
 * @example
 * countConflictsFromTally({Fire: 5, Water: 3}) // returns 1
 * countConflictsFromTally({Fire: 5, Water: 3, Light: 2, Shadow: 1}) // returns 2
 */
function countConflictsFromTally(tally) {
  let conflicts = 0;
  CONFLICT_PAIRS.forEach(([a, b]) => {
    if (tally[a] > 0 && tally[b] > 0) {
      conflicts++;
    }
  });
  return conflicts;
}

/**
 * Calculates aspect points contributed by a reagent based on its refinement level.
 *
 * Refinement levels determine which aspect slots are active:
 * - **crude**: primary only (3 points)
 * - **prepared**: primary (3 pts) + secondary (2 pts)
 * - **refined**: primary (3 pts) + secondary (2 pts) + tertiary (1 pt)
 *
 * @param {Object} reagent - The reagent object
 * @param {Object} reagent.aspects - Aspect configuration
 * @param {string} reagent.aspects.primary - Primary aspect name
 * @param {string} [reagent.aspects.secondary] - Secondary aspect name
 * @param {string} [reagent.aspects.tertiary] - Tertiary aspect name
 * @param {string} reagent.refinement - Refinement level ('crude', 'prepared', or 'refined')
 * @returns {Object<string, number>} Map of aspect names to point values
 *
 * @example
 * const reagent = {
 *   aspects: { primary: 'Fire', secondary: 'Light', tertiary: 'Vital' },
 *   refinement: 'prepared'
 * };
 * getReagentAspectPoints(reagent)
 * // returns { Fire: 3, Light: 2 } (tertiary not active at 'prepared')
 */
export function getReagentAspectPoints(reagent) {
  if (!reagent.aspects?.primary) return {};

  const activeSlots = REFINEMENT_LEVELS[reagent.refinement] || REFINEMENT_LEVELS.crude;
  const points = {};

  if (activeSlots.includes('primary') && reagent.aspects.primary) {
    points[reagent.aspects.primary] = (points[reagent.aspects.primary] || 0) + 3;
  }
  if (activeSlots.includes('secondary') && reagent.aspects.secondary) {
    points[reagent.aspects.secondary] = (points[reagent.aspects.secondary] || 0) + 2;
  }
  if (activeSlots.includes('tertiary') && reagent.aspects.tertiary) {
    points[reagent.aspects.tertiary] = (points[reagent.aspects.tertiary] || 0) + 1;
  }

  return points;
}

/**
 * Tallies aspect points from all active ingredients in a formula.
 * The tally determines the dominant and secondary aspects of the potion.
 *
 * @param {Array<Object>} activeIngredients - Array of active ingredient entries
 * @param {Map<string, Object>} reagentsMap - Map of reagent IDs to reagent objects
 * @returns {Object<string, number>} Tally object mapping aspect names to total points
 */
export function tallyAspects(activeIngredients, reagentsMap) {
  const tally = {};

  activeIngredients.forEach(ing => {
    const reagent = reagentsMap.get(ing.reagentId);
    if (!reagent || !reagent.aspects?.primary) return;

    const tempReagent = { ...reagent, refinement: ing.refinement };
    const points = getReagentAspectPoints(tempReagent);

    Object.keys(points).forEach(aspect => {
      if (aspect) {
        tally[aspect] = (tally[aspect] || 0) + (points[aspect] * ing.unitsUsed);
      }
    });
  });

  return tally;
}

/**
 * Identifies the dominant and secondary aspects from a tally.
 * The two aspects with the highest point totals become the formula's primary characteristics.
 *
 * @param {Object<string, number>} tally - Aspect tally object from tallyAspects()
 * @returns {Object} Aspect analysis result
 * @returns {string|null} returns.dominant - Name of the dominant aspect (highest points)
 * @returns {number} returns.dominantValue - Point value of dominant aspect
 * @returns {string|null} returns.secondary - Name of the secondary aspect (second highest)
 * @returns {number} returns.secondaryValue - Point value of secondary aspect
 */
export function computeDominantSecondary(tally) {
  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);

  return {
    dominant: entries[0]?.[0] || null,
    dominantValue: entries[0]?.[1] || 0,
    secondary: entries[1]?.[0] || null,
    secondaryValue: entries[1]?.[1] || 0
  };
}

/**
 * Calculates final potency after applying concentration steps.
 * Concentration increases potency up through the POTENCY_LEVELS scale:
 * P0 → P1 → P2 → P3 → P4 (each step adds one level)
 *
 * @param {string} basePotency - Starting potency level (e.g., 'P1', 'P2')
 * @param {number} concentrationSteps - Number of concentration steps to apply
 * @returns {string} Final potency level after concentration
 */
export function getFinalPotency(basePotency, concentrationSteps) {
  const baseIndex = POTENCY_LEVELS.indexOf(basePotency);
  if (baseIndex === -1) return basePotency;

  const finalIndex = Math.min(POTENCY_LEVELS.length - 1, baseIndex + concentrationSteps);
  return POTENCY_LEVELS[finalIndex];
}

/**
 * Calculates potency load from active ingredients for automatic tier determination.
 * Potency load = sum of (potency_index + concentration_steps) * units_used for each active ingredient.
 *
 * This value is used with TIER_THRESHOLDS to automatically determine formula tier.
 *
 * @param {Array<Object>} activeIngredients - Array of active ingredient entries
 * @param {Map<string, Object>} reagentsMap - Map of reagent IDs to reagent objects
 * @returns {number} Total potency load value
 *
 * @example
 * // 2 units of P1 reagent (index 1) with 0 concentration = (1+0)*2 = 2
 * // 1 unit of P2 reagent (index 2) with 1 concentration = (2+1)*1 = 3
 * // Total potency load = 5
 */
export function calculatePotencyLoad(activeIngredients, reagentsMap) {
  let totalLoad = 0;

  activeIngredients.forEach(ing => {
    const reagent = reagentsMap.get(ing.reagentId);
    if (!reagent) return;

    // Get base potency index (P0=0, P1=1, P2=2, P3=3, P4=4)
    const basePotency = reagent.basePotency || reagent.potency || 'P1';
    const potencyIndex = POTENCY_LEVELS.indexOf(basePotency);
    const concentrationSteps = reagent.concentrationSteps || 0;

    // Potency load contribution = (base potency index + concentration steps) * units used
    const contribution = (potencyIndex + concentrationSteps) * (ing.unitsUsed || 1);
    totalLoad += contribution;
  });

  return totalLoad;
}

/**
 * Calculates tier from potency load using tier thresholds.
 * Automatically determines formula power level based on total reagent potency.
 *
 * @param {number} potencyLoad - Total potency load from calculatePotencyLoad()
 * @returns {number} Formula tier (1-5)
 *
 * @example
 * calculateTierFromPotencyLoad(3) // returns 1 (Tier 1: 0-4 range)
 * calculateTierFromPotencyLoad(12) // returns 3 (Tier 3: 10-16 range)
 */
export function calculateTierFromPotencyLoad(potencyLoad) {
  for (const threshold of TIER_THRESHOLDS) {
    if (potencyLoad >= threshold.minPotencyLoad && potencyLoad <= threshold.maxPotencyLoad) {
      return threshold.tier;
    }
  }
  // Fallback to tier 1 if somehow out of range
  return 1;
}

/**
 * Validates that a formula includes all required reagent roles for a delivery vector.
 * Different vectors (Potion, Pill, Salve, etc.) require different role combinations.
 *
 * Missing required roles incur severe WR/DM penalties or make the formula impossible.
 *
 * @param {Array<Object>} ingredients - Formula ingredients list
 * @param {string} vectorName - Delivery vector name ('Potion', 'Pill', etc.)
 * @returns {Object} Validation result
 * @returns {boolean} returns.valid - Whether all required roles are present
 * @returns {Array<string>} returns.missingRoles - List of missing required roles
 * @returns {number} returns.wrDelta - WR penalty for missing roles
 * @returns {number} returns.dmDelta - DM penalty for missing roles
 * @returns {Array<string>} returns.messages - Human-readable penalty descriptions
 */
export function validateRoleCoverage(ingredients, vectorName) {
  const requiredRoles = REQUIRED_ROLES_BY_VECTOR[vectorName] || [];
  const presentRoles = new Set(ingredients.map(ing => ing.role).filter(Boolean));

  const missingRoles = [];
  let wrPenalty = 0;
  let dmPenalty = 0;
  const messages = [];

  requiredRoles.forEach(requiredRole => {
    if (!presentRoles.has(requiredRole)) {
      missingRoles.push(requiredRole);
      const penalty = ROLE_COVERAGE_PENALTIES[requiredRole];
      if (penalty) {
        wrPenalty += penalty.wr;
        dmPenalty += penalty.dm;
        messages.push(penalty.message);
      }
    }
  });

  return {
    valid: missingRoles.length === 0 && wrPenalty < 999,
    missingRoles,
    wrDelta: wrPenalty,
    dmDelta: dmPenalty,
    messages
  };
}

/**
 * Validates batch constraints including maximum reagents and units per role.
 * Ensures formula doesn't exceed system limits.
 *
 * @param {Array<Object>} ingredients - Formula ingredients list
 * @returns {Object} Validation result
 * @returns {boolean} returns.valid - Whether all constraints are met
 * @returns {Array<string>} returns.errors - Critical errors (block formula creation)
 * @returns {Array<string>} returns.warnings - Non-critical warnings
 */
export function validateBatchConstraints(ingredients) {
  const errors = [];
  const warnings = [];

  // Check max reagents
  if (ingredients.length > MAX_REAGENTS_PER_BATCH) {
    errors.push(`Too many reagents: ${ingredients.length}/${MAX_REAGENTS_PER_BATCH} max`);
  }

  // Check max units per role
  ingredients.forEach((ing, idx) => {
    const role = ing.role;
    const maxUnits = MAX_UNITS_PER_REAGENT_BY_ROLE[role];
    if (maxUnits && ing.unitsUsed > maxUnits) {
      warnings.push(`${ing.reagentName || `Ingredient ${idx + 1}`}: ${role} role limited to ${maxUnits}U (using ${ing.unitsUsed}U)`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Evaluates hazards present in formula ingredients.
 * Hazards are dangerous reagent properties that trigger special events during brewing.
 *
 * Common hazards:
 * - **Volatile**: Batch explodes on failure/mishap
 * - **Unstable**: Extra CP on failures
 * - **Flammable**: Triggers on poor quality completion
 *
 * @param {Array<Object>} ingredients - Formula ingredients list
 * @param {Map<string, Object>} reagentsMap - Map of reagent IDs to reagent objects
 * @returns {Object} Hazard evaluation result
 * @returns {number} returns.count - Number of distinct hazards
 * @returns {Array<string>} returns.hazards - Array of hazard names
 * @returns {Array<Object>} returns.details - Detailed hazard information with effects and triggers
 */
export function evaluateHazards(ingredients, reagentsMap) {
  const hazardsPresent = new Set();
  const hazardDetails = [];

  ingredients.forEach(ing => {
    const reagent = reagentsMap.get(ing.reagentId);
    if (!reagent || !reagent.hazards) return;

    reagent.hazards.forEach(hazard => {
      if (!hazard || !hazard.trim()) return;

      const hazardName = hazard.trim();
      if (!hazardsPresent.has(hazardName)) {
        hazardsPresent.add(hazardName);
        const rule = HAZARD_RULES[hazardName];
        if (rule) {
          hazardDetails.push({
            hazard: hazardName,
            source: reagent.name || ing.reagentName,
            effect: rule.effect,
            triggerOn: rule.triggerOn,
            wrMod: rule.wrMod || 0,
            dmMod: rule.dmMod || 0,
            severity: rule.severity
          });
        }
      }
    });
  });

  return {
    count: hazardsPresent.size,
    hazards: Array.from(hazardsPresent),
    details: hazardDetails
  };
}

/**
 * Creates a canonical key for Effect Family Map lookups.
 * Always returns aspects in alphabetical order for consistency.
 *
 * Effect families represent potion effect categories based on aspect combinations
 * (e.g., Fire/Light might be "Radiance" effects, Fire/Shadow might be "Destruction" effects).
 *
 * @param {string} aspect1 - First aspect name
 * @param {string} aspect2 - Second aspect name
 * @returns {string|null} Canonical key in "Aspect1/Aspect2" format (alphabetical), or null if no aspects
 *
 * @example
 * getEffectFamilyKey('Fire', 'Light') // returns 'Fire/Light'
 * getEffectFamilyKey('Light', 'Fire') // returns 'Fire/Light' (same key, alphabetical)
 * getEffectFamilyKey('Fire', null) // returns 'Fire'
 */
export function getEffectFamilyKey(aspect1, aspect2) {
  if (!aspect1 && !aspect2) return null;
  if (!aspect2) return aspect1;

  // Always store in alphabetical order for consistency
  const [first, second] = [aspect1, aspect2].sort();
  return `${first}/${second}`;
}

/**
 * Calculates complete formula statistics using GURPS 4e tier-based alchemy rules (enhanced version).
 * This is the core function that implements the complete WR/DM calculation algorithm with
 * automatic tier calculation, role coverage validation, and hazard evaluation.
 *
 * The calculation follows these steps:
 * 1. Auto-calculate tier from potency load (or use override for backward compatibility)
 * 2. Start with base WR/DM from tier and delivery vector
 * 3. Apply role coverage penalties (missing required roles)
 * 4. Apply hazard modifiers from hazard evaluation rules
 * 5. Apply complexity penalties for multiple active aspects (3+ aspects)
 * 6. Check coherence (dominant aspect should lead secondary by 3+ points)
 * 7. Apply conflict penalties for opposing aspect pairs
 * 8. Apply concentration penalties/bonuses (increases WR, reduces DM)
 * 9. Apply refinement bonuses (prepared/refined ingredients reduce WR)
 * 10. Apply catalyst matching bonuses (matching aspects reduce WR and DM)
 * 11. Reduce WR by Lab Rating (0-4 range)
 *
 * @param {Object} formula - The formula object containing ingredients list
 * @param {Map<string, Object>} reagentsMap - Map of reagent IDs to full reagent objects
 * @param {string} [vectorName='Potion'] - Delivery vector ('Potion', 'Pill', 'Salve', etc.)
 * @param {Object} [options={}] - Optional calculation parameters
 * @param {boolean} [options.overrideTier=false] - Set true to use manual tier instead of auto-calculated
 * @param {number} [options.tier] - Manual tier override (1-5) when overrideTier is true
 * @param {number} [options.labRating=0] - Lab Rating (0-4) for WR reduction
 * @returns {Object} Complete formula statistics including validation results
 */
export function calculateFormulaStats(formula, reagentsMap, vectorName = 'Potion', options = {}) {
  const actives = formula.ingredients.filter(ing => ing.role === 'active' || ing.role === 'Active');
  const stabilizers = formula.ingredients.filter(ing => ing.role === 'stabilizer' || ing.role === 'Stabilizer');
  const catalysts = formula.ingredients.filter(ing => ing.role === 'catalyst' || ing.role === 'Catalyst');

  // Calculate aspect tally for dominant/secondary
  const tally = tallyAspects(actives, reagentsMap);
  const { dominant, dominantValue, secondary, secondaryValue } = computeDominantSecondary(tally);

  // TIER CALCULATION: Auto-calculate from potency load, but allow override for backward compat
  const potencyLoad = calculatePotencyLoad(actives, reagentsMap);
  const calculatedTier = calculateTierFromPotencyLoad(potencyLoad);
  const tier = options.overrideTier ? (options.tier || formula.tier || 1) : calculatedTier;
  const tierData = TIER_DATA[tier];
  const isLegacyTier = options.overrideTier || (formula.tier && formula.tier !== calculatedTier);

  // ROLE COVERAGE VALIDATION
  const roleCoverage = validateRoleCoverage(formula.ingredients, vectorName);

  // BATCH CONSTRAINTS VALIDATION
  const batchValidation = validateBatchConstraints(formula.ingredients);

  // HAZARD EVALUATION
  const hazardEvaluation = evaluateHazards(formula.ingredients, reagentsMap);

  // Get vector modifiers
  const vector = VECTORS.find(v => v.name === vectorName) || VECTORS[0];

  // Start with base WR and DM from tier and vector
  let WR = tierData.baseWR + vector.wrMod;
  let DM = tierData.baseDM + vector.dmMod;

  // APPLY ROLE COVERAGE PENALTIES
  if (!roleCoverage.valid) {
    WR += roleCoverage.wrDelta;
    DM += roleCoverage.dmDelta;
  }

  // APPLY HAZARD MODIFIERS (from rules, not just count)
  hazardEvaluation.details.forEach(h => {
    // Only apply WR/DM from hazard rules if they trigger on formula creation
    if (h.triggerOn.includes('conflict_pairs_present') || h.wrMod > 0) {
      WR += h.wrMod;
      DM += h.dmMod;
    }
  });

  // 1. Active aspect complexity
  const activeAspectCount = countActiveAspects(tally);
  if (activeAspectCount === 3) {
    WR += 1;
    DM -= 1;
  } else if (activeAspectCount >= 4) {
    WR += 2;
    DM -= 2;
  }

  // 2. Coherence check (dominant should lead secondary by 3+ tally points)
  const coherent = dominantValue >= secondaryValue + 3;
  if (!coherent && secondary) {
    WR += 1;
  }

  // 3. Conflict pairs
  const conflicts = countConflictsFromTally(tally);
  DM -= conflicts;

  // 4. Hazard load - already applied above via evaluateHazards
  // Keep count for display but don't double-apply WR penalty
  const hazardCount = hazardEvaluation.count;

  // 5. Concentration (max concentration steps from actives)
  let maxConcentrationSteps = 0;
  actives.forEach(ing => {
    const r = reagentsMap.get(ing.reagentId);
    if (r) {
      const concentrationSteps = r.concentrationSteps || 0;
      if (concentrationSteps > maxConcentrationSteps) {
        maxConcentrationSteps = concentrationSteps;
      }
    }
  });
  if (maxConcentrationSteps > 0) {
    WR += 2 * maxConcentrationSteps;
    DM -= maxConcentrationSteps;
  }

  // 6. Refinement help (check if any/all actives are processed)
  const activeRefinements = actives.map(ing => ing.refinement || 'crude');
  const anyProcessed = activeRefinements.some(ref => ref === 'prepared' || ref === 'refined');
  const allRefined = activeRefinements.length > 0 && activeRefinements.every(ref => ref === 'refined');

  if (allRefined) {
    WR -= 2;
  } else if (anyProcessed) {
    WR -= 1;
  }

  // 7. Catalyst matching bonus
  let catalystBonus = 0;
  catalysts.forEach(cat => {
    const reagent = reagentsMap.get(cat.reagentId);
    if (!reagent) return;
    const points = getReagentAspectPoints({ ...reagent, refinement: cat.refinement });

    const matchesDominant = points[dominant] > 0;
    const matchesSecondary = points[secondary] > 0;

    if (matchesDominant && matchesSecondary) {
      catalystBonus = Math.max(catalystBonus, 2);
    } else if (matchesDominant || matchesSecondary) {
      catalystBonus = Math.max(catalystBonus, 1);
    }
  });

  if (catalystBonus > 0) {
    WR -= catalystBonus;
    DM -= 1;
  }

  // 8. Lab Rating reduction (0-4 reduces WR)
  const labRating = normalizeLabRating(options.labRating ?? 0);
  WR -= labRating;

  // Ensure minimum WR of 1
  WR = Math.max(1, WR);

  // Check for matching stabilizer (flag only, NOT a DM modifier)
  const hasMatchingStabilizer = stabilizers.some(stab => {
    const reagent = reagentsMap.get(stab.reagentId);
    if (!reagent) return false;
    const points = getReagentAspectPoints({ ...reagent, refinement: stab.refinement });
    return points[dominant] > 0;
  });

  // Get highest base potency from actives
  let highestBasePotency = 'P0';
  actives.forEach(ing => {
    const r = reagentsMap.get(ing.reagentId);
    if (r) {
      const basePotency = r.basePotency || r.potency || 'P1';
      const currentIndex = POTENCY_LEVELS.indexOf(basePotency);
      const highestIndex = POTENCY_LEVELS.indexOf(highestBasePotency);
      if (currentIndex > highestIndex) {
        highestBasePotency = basePotency;
      }
    }
  });

  // Calculate final potency
  const finalPotency = getFinalPotency(highestBasePotency, maxConcentrationSteps);

  // Calculate total concentration steps (for display/tracking)
  const totalConcentrationSteps = formula.ingredients.reduce((sum, ing) => {
    const r = reagentsMap.get(ing.reagentId);
    return sum + ((r?.concentrationSteps || 0) * ing.unitsUsed);
  }, 0);

  return {
    tier,
    calculatedTier,
    potencyLoad,
    isLegacyTier,
    baseWR: WR,
    baseDM: DM,
    dominantAspect: dominant,
    secondaryAspect: secondary,
    basePotency: highestBasePotency,
    concentrationSteps: maxConcentrationSteps,
    finalPotency: finalPotency,
    totalConcentrationSteps: totalConcentrationSteps,
    vector: vectorName,
    traitBudget: tierData.traitBudget,
    hasMatchingStabilizer,
    coherent,
    activeAspectCount,
    conflicts,
    hazardCount,
    // Validation results
    roleCoverage,
    batchValidation,
    hazardEvaluation
  };
}

/**
 * Applies the result of a work block (skill roll) to an alchemy batch.
 * Implements complete GURPS critical success/failure rules, progress tracking, and hazard triggering.
 *
 * **GURPS Critical Success Rules:**
 * - Always on 3-4
 * - On 5 if effective skill 15+
 * - On 6 if effective skill 16+
 *
 * **GURPS Critical Failure Rules:**
 * - Always on 18
 * - On 17 if effective skill 15 or less
 * - On 16 if effective skill 6 or less (very rare)
 *
 * **Progress Mechanics:**
 * - Critical Success: +2 PP, -1 CP (exceptional progress, reduces mishap risk)
 * - Success: +1 PP + floor(MoS/2), no CP change (steady progress)
 * - Failure: +0 PP, +1 CP (no progress, increases mishap risk)
 * - Critical Failure: +0 PP, +2 CP (major setback, high mishap risk)
 *
 * **Hazard Triggering:**
 * - Volatile: Batch explodes on failure/mishap (instant destruction)
 * - Unstable: Extra +1 CP on failures
 * - Flammable: Triggers on low quality completion
 *
 * @param {Object} batch - The current batch state
 * @param {number} skill - Base Alchemy skill level (before DM)
 * @param {number} roll - 3d6 skill roll result (3-18)
 * @param {string} worker - Name of the alchemist performing the work
 * @param {string} date - Date string for the work block
 * @returns {Object} Updated batch object with new PP, CP, shifts, hazard events, and possibly completed status
 */
export function applyWorkBlockResult(batch, skill, roll, worker, date) {
  const effectiveSkill = skill + batch.DM;
  let ppAdded = 0;
  let cpChange = 0;
  let result = '';
  const hazardEvents = [];

  const isCritSuccess =
    roll <= 4 ||
    (roll === 5 && effectiveSkill >= 15) ||
    (roll === 6 && effectiveSkill >= 16);

  const isCritFailure =
    roll === 18 ||
    (roll === 17 && effectiveSkill <= 15) ||
    (roll === 16 && effectiveSkill <= 6);

  const isFailure = !isCritSuccess && roll > effectiveSkill;
  const isMishap = isCritFailure;

  if (isCritSuccess) {
    ppAdded = 2;
    cpChange = -1;
    result = 'Critical Success';
  } else if (isCritFailure) {
    ppAdded = 0;
    cpChange = 2;
    result = 'Critical Failure (Mishap!)';
  } else if (roll <= effectiveSkill) {
    const margin = effectiveSkill - roll;
    ppAdded = 1 + Math.floor(margin / 2);
    cpChange = 0;
    result = `Success (MoS ${margin})`;
  } else {
    const margin = roll - effectiveSkill;
    ppAdded = 0;
    cpChange = 1;
    result = `Failure (MoF ${margin})`;
  }

  // HAZARD TRIGGERING - check if any hazards trigger
  const hazardDetails = batch.hazardDetails || [];
  hazardDetails.forEach(hazard => {
    let triggered = false;
    let reason = '';

    if (hazard.triggerOn.includes('any_failure') && isFailure) {
      triggered = true;
      reason = 'failure';
    } else if (hazard.triggerOn.includes('failure') && isFailure && !isCritFailure) {
      triggered = true;
      reason = 'failure';
    } else if (hazard.triggerOn.includes('mishap') && isMishap) {
      triggered = true;
      reason = 'mishap';
    }

    // Apply hazard effects
    if (triggered) {
      if (hazard.hazard === 'Unstable') {
        cpChange += 1; // Extra contamination
      } else if (hazard.hazard === 'Volatile') {
        // Volatile causes batch destruction on failure/mishap
        hazardEvents.push({
          hazard: hazard.hazard,
          effect: 'BATCH DESTROYED - Volatile explosion',
          severity: 'critical'
        });
      }

      hazardEvents.push({
        hazard: hazard.hazard,
        effect: hazard.effect,
        severity: hazard.severity,
        trigger: reason
      });
    }
  });

  const newShift = {
    id: crypto.randomUUID(),
    date,
    worker,
    skill,
    roll,
    effectiveSkill,
    result,
    ppAdded,
    cpChange,
    hazardEvents: hazardEvents.length > 0 ? hazardEvents : undefined
  };

  const newPP = batch.PP + ppAdded;
  const newCP = Math.max(0, batch.CP + cpChange);

  const updated = {
    ...batch,
    PP: newPP,
    CP: newCP,
    shifts: [...batch.shifts, newShift]
  };

  // Check if Volatile hazard destroyed the batch
  const volatileDestroyed = hazardEvents.some(e => e.hazard === 'Volatile' && e.effect.includes('DESTROYED'));
  if (volatileDestroyed) {
    updated.phase = 'failed';
    updated.quality = 'Destroyed (Volatile Explosion)';
    updated.completedDate = new Date().toISOString();
    return updated;
  }

  if (updated.PP >= updated.WR) {
    const quality = determineQuality(updated.CP);
    updated.phase = quality === 'Mishap' ? 'failed' : 'completed';
    updated.quality = quality;
    updated.completedDate = new Date().toISOString();

    // CHECK HAZARDS ON COMPLETION
    const completionHazards = [];
    hazardDetails.forEach(hazard => {
      // Flammable triggers on Unstable or worse
      if (hazard.hazard === 'Flammable' && ['Unstable', 'Flawed', 'Mishap'].includes(quality)) {
        completionHazards.push({
          hazard: 'Flammable',
          effect: hazard.effect,
          severity: 'high',
          trigger: `quality_${quality.toLowerCase()}`
        });
      }
      // Mishap-triggered hazards
      else if (hazard.triggerOn.includes('mishap') && quality === 'Mishap') {
        completionHazards.push({
          hazard: hazard.hazard,
          effect: hazard.effect,
          severity: hazard.severity,
          trigger: 'mishap_quality'
        });
      }
    });

    if (completionHazards.length > 0) {
      updated.completionHazards = completionHazards;
    }
  }

  return updated;
}

/**
 * Creates a new brewing batch from a formula, consuming reagents atomically.
 * This is the primary function for starting the brewing process.
 *
 * The function:
 * 1. Validates reagent availability (alerts and returns null if insufficient)
 * 2. Creates a snapshot of consumed ingredients (preserves exact aspects/refinement)
 * 3. Deducts reagent quantities from inventory
 * 4. Creates a new batch object ready for work blocks
 * 5. Returns both the updated reagent list and new batch (atomic operation)
 *
 * **Backward Compatibility:**
 * Supports two signatures:
 * - Old: `(formula, reagents, batches, forecast, microAssay)`
 * - New: `(formula, reagents, batches, options)` where options = { forecast, microAssay, overrideWR, overrideDM }
 *
 * @param {Object} formula - The formula to brew
 * @param {Array<Object>} reagents - Current reagent inventory
 * @param {Array<Object>} batches - Current batch list (unused but kept for API compatibility)
 * @param {Object|Array|null} [forecastOrOptions=null] - Options object OR legacy forecast array
 * @param {Array|null} [microAssay=null] - Legacy: micro-assay data (use options.microAssay instead)
 * @returns {Object|null} Result object with newReagents and newBatch, or null if insufficient reagents
 */
export function startBatchFromFormula(formula, reagents, batches, forecastOrOptions = null, microAssay = null) {
  // Support both old signature (formula, reagents, batches, forecast, microAssay)
  // and new signature (formula, reagents, batches, options)
  let options = {};
  if (forecastOrOptions && typeof forecastOrOptions === 'object' && !Array.isArray(forecastOrOptions)) {
    // New signature with options object
    options = forecastOrOptions;
  } else {
    // Old signature - build options from positional params
    options = {
      forecast: forecastOrOptions,
      microAssay: microAssay
    };
  }

  // Check reagent availability
  for (const ing of formula.ingredients) {
    const reagent = reagents.find(r => r.id === ing.reagentId);
    if (!reagent || reagent.quantity < ing.unitsUsed) {
      alert(`Insufficient ${ing.reagentName}: need ${ing.unitsUsed}U, have ${reagent?.quantity || 0}U`);
      return null;
    }
  }

  const consumed = formula.ingredients.map(ing => {
    const reagent = reagents.find(r => r.id === ing.reagentId);
    return {
      reagentId: ing.reagentId,
      reagentName: ing.reagentName,
      role: ing.role,
      unitsUsed: ing.unitsUsed,
      refinement: ing.refinement,
      aspects: {...ing.aspects},
      potency: reagent.potency,
      concentrationSteps: reagent.concentrationSteps
    };
  });

  const newReagents = reagents.map(r => {
    const used = formula.ingredients.find(ing => ing.reagentId === r.id);
    if (used) {
      return {...r, quantity: Math.max(0, r.quantity - used.unitsUsed)};
    }
    return r;
  });

  // Allow per-batch WR/DM overrides if provided in options
  const batchWR = options.overrideWR ?? formula.baseWR;
  const batchDM = options.overrideDM ?? formula.baseDM;

  const newBatch = {
    id: crypto.randomUUID(),
    formulaId: formula.id,
    formulaName: formula.name,
    phase: 'brewing',
    consumedIngredients: consumed,
    tier: formula.tier || 1,
    vector: formula.vector || 'Potion',
    WR: batchWR,
    DM: batchDM,
    PP: 0,
    CP: 0,
    dominantAspect: formula.dominantAspect,
    secondaryAspect: formula.secondaryAspect,
    basePotency: formula.basePotency || formula.potency || 'P1',
    finalPotency: formula.finalPotency || formula.potency || 'P1',
    concentrationSteps: formula.concentrationSteps || 0,
    traitBudget: formula.traitBudget || 10,
    traits: formula.traits || [],
    forecast: options.forecast || null,
    microAssay: options.microAssay || null,
    hasMatchingStabilizer: formula.hasMatchingStabilizer || false,
    shifts: [],
    quality: null,
    startDate: new Date().toISOString(),
    completedDate: null
  };

  return {
    newReagents,
    newBatch
  };
}
