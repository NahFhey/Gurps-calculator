import { REFINEMENT_LEVELS } from '../constants';
import { determineQuality } from './helpers';

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

// Calculate formula stats
export function calculateFormulaStats(formula, reagentsMap) {
  const actives = formula.ingredients.filter(ing => ing.role === 'active');
  const stabilizers = formula.ingredients.filter(ing => ing.role === 'stabilizer');

  const tally = tallyAspects(actives, reagentsMap);
  const { dominant, secondary } = computeDominantSecondary(tally);

  const totalActiveUnits = actives.reduce((sum, ing) => sum + ing.unitsUsed, 0);
  let baseWR = Math.ceil(totalActiveUnits * 2);
  let baseDM = -Math.floor(totalActiveUnits / 2);

  const maxConcentrationSteps = Math.max(...actives.map(ing => {
    const r = reagentsMap.get(ing.reagentId);
    return r?.concentrationSteps || 0;
  }), 0);

  baseWR += maxConcentrationSteps * 2;
  baseDM -= maxConcentrationSteps;

  const hasMatchingStabilizer = stabilizers.some(stab => {
    const reagent = reagentsMap.get(stab.reagentId);
    if (!reagent) return false;
    const points = getReagentAspectPoints({ ...reagent, refinement: stab.refinement });
    return points[dominant] > 0;
  });

  if (!hasMatchingStabilizer && maxConcentrationSteps > 0) {
    baseDM -= maxConcentrationSteps;
  }

  const basePotency = Math.max(...actives.map(ing => {
    const r = reagentsMap.get(ing.reagentId);
    return (r?.potency || 1);
  }), 1);

  return {
    baseWR,
    baseDM,
    dominantAspect: dominant,
    secondaryAspect: secondary,
    potency: basePotency + maxConcentrationSteps,
    concentrationSteps: maxConcentrationSteps,
    hasMatchingStabilizer
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

// Atomic batch start from formula
export function startBatchFromFormula(formula, reagents, batches, forecast = null, microAssay = null) {
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

  const newBatch = {
    id: crypto.randomUUID(),
    formulaId: formula.id,
    formulaName: formula.name,
    phase: 'brewing',
    consumedIngredients: consumed,
    WR: formula.baseWR,
    DM: formula.baseDM,
    PP: 0,
    CP: 0,
    dominantAspect: formula.dominantAspect,
    secondaryAspect: formula.secondaryAspect,
    potency: formula.potency,
    forecast: forecast,
    microAssay: microAssay,
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
