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

// Conflict pairs for WR/DM calculation
const CONFLICT_PAIRS = [
  ['Fire', 'Water'],
  ['Light', 'Shadow'],
  ['Shadow', 'Vital']
];

// Helper: clamp value to range
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Helper: normalize Lab Rating to 0-4 range
export function normalizeLabRating(lr) {
  return clamp(lr || 0, 0, 4);
}

// Helper: count distinct active aspects
function countActiveAspects(tally) {
  return Object.keys(tally).filter(aspect => aspect && tally[aspect] > 0).length;
}

// Helper: count conflict pairs in tally
function countConflictsFromTally(tally) {
  let conflicts = 0;
  CONFLICT_PAIRS.forEach(([a, b]) => {
    if (tally[a] > 0 && tally[b] > 0) {
      conflicts++;
    }
  });
  return conflicts;
}

// Get active aspect points for a reagent based on refinement
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

// Tally aspects from multiple active ingredients
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

// Compute dominant and secondary aspects
export function computeDominantSecondary(tally) {
  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);

  return {
    dominant: entries[0]?.[0] || null,
    dominantValue: entries[0]?.[1] || 0,
    secondary: entries[1]?.[0] || null,
    secondaryValue: entries[1]?.[1] || 0
  };
}

// Get final potency from base potency + concentration steps
export function getFinalPotency(basePotency, concentrationSteps) {
  const baseIndex = POTENCY_LEVELS.indexOf(basePotency);
  if (baseIndex === -1) return basePotency;

  const finalIndex = Math.min(POTENCY_LEVELS.length - 1, baseIndex + concentrationSteps);
  return POTENCY_LEVELS[finalIndex];
}

// Calculate potency load from active ingredients
// Potency load = sum of (potency_index + concentration_steps) for each active ingredient
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

// Calculate tier from potency load using thresholds
export function calculateTierFromPotencyLoad(potencyLoad) {
  for (const threshold of TIER_THRESHOLDS) {
    if (potencyLoad >= threshold.minPotencyLoad && potencyLoad <= threshold.maxPotencyLoad) {
      return threshold.tier;
    }
  }
  // Fallback to tier 1 if somehow out of range
  return 1;
}

// Validate role coverage for a given vector
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

// Validate batch constraints (max reagents, max units per role)
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

// Evaluate hazards present in ingredients
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

// Canonical key for Effect Family Map (always Dominant/Secondary order)
export function getEffectFamilyKey(aspect1, aspect2) {
  if (!aspect1 && !aspect2) return null;
  if (!aspect2) return aspect1;

  // Always store in alphabetical order for consistency
  const [first, second] = [aspect1, aspect2].sort();
  return `${first}/${second}`;
}

// Calculate formula stats using GURPS 4e tier-based rules with proper WR/DM math
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

// Apply work block result to batch (GURPS complete crit rules)
export function applyWorkBlockResult(batch, skill, roll, worker, date) {
  const effectiveSkill = skill + batch.DM;
  let ppAdded = 0;
  let cpChange = 0;
  let result = '';

  const isCritSuccess =
    roll <= 4 ||
    (roll === 5 && effectiveSkill >= 15) ||
    (roll === 6 && effectiveSkill >= 16);

  const isCritFailure =
    roll === 18 ||
    (roll === 17 && effectiveSkill <= 15) ||
    (roll === 16 && effectiveSkill <= 6);

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

  const newShift = {
    id: crypto.randomUUID(),
    date,
    worker,
    skill,
    roll,
    effectiveSkill,
    result,
    ppAdded,
    cpChange
  };

  const newPP = batch.PP + ppAdded;
  const newCP = Math.max(0, batch.CP + cpChange);

  const updated = {
    ...batch,
    PP: newPP,
    CP: newCP,
    shifts: [...batch.shifts, newShift]
  };

  if (updated.PP >= updated.WR) {
    const quality = determineQuality(updated.CP);
    updated.phase = quality === 'Mishap' ? 'failed' : 'completed';
    updated.quality = quality;
    updated.completedDate = new Date().toISOString();
  }

  return updated;
}

// Atomic batch start from formula (backward-compatible with options overload)
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
