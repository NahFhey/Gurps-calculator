// Template data for crafting items
export const TEMPLATES = {
  weapons: {
    'dagger': { weight: 1, hp: 8, damage: 'thr-1 imp', reach: 'C,1', parry: '-1', cost: 20, ST: 5, notes: '' },
    'main-gauche': { weight: 2, hp: 11, damage: 'thr imp', reach: 'C,1', parry: '0', cost: 50, ST: 6, notes: '' },
    'cutlass': { weight: 3, hp: 11, damage: 'sw cut', reach: '1', parry: '0', cost: 300, ST: 9, notes: '' },
    'shortsword': { weight: 3, hp: 12, damage: 'sw-1 cut', reach: '1', parry: '0', cost: 400, ST: 8, notes: '' },
    'broadsword': { weight: 4, hp: 13, damage: 'sw+1 cut', reach: '1', parry: '0', cost: 500, ST: 10, notes: '' },
    'longsword': { weight: 6, hp: 15, damage: 'sw+2 cut', reach: '1,2', parry: '0', cost: 700, ST: 11, notes: '' }
  },
  armor: {
    'cloth armor': { weight: 6, hp: 15, location: 'torso', DR: 1, cost: 30, LC: 4, notes: '' },
    'leather armor': { weight: 10, hp: 18, location: 'torso', DR: 2, cost: 100, LC: 4, notes: '' },
    'steel corselet': { weight: 35, hp: 27, location: 'torso', DR: 5, cost: 1300, LC: 3, notes: '' }
  },
  ranged: {
    'shortbow': { weight: 2, hp: 11, damage: 'thr+1 imp', Acc: 1, range: '150/200', RoF: 1, shots: '1(2)', cost: 50, ST: 7, bulk: -6, RCl: 1, LC: 4, notes: '' },
    'longbow': { weight: 3, hp: 12, damage: 'thr+2 imp', Acc: 2, range: '180/220', RoF: 1, shots: '1(2)', cost: 200, ST: 11, bulk: -8, RCl: 1, LC: 4, notes: '' }
  },
  explosives: {
    'grenade': { weight: 1, hp: 5, damage: '2d cr', fuse: '4 sec', cost: 30, LC: 1, notes: '' },
    'dynamite': { weight: 2, hp: 8, damage: '6d cr', fuse: '1-10 sec', cost: 50, LC: 1, notes: '' }
  }
};

export const MATERIALS = {
  'steel': { difficulty: 0, weightMod: 0, hpMod: 0, ht: 12 },
  'iron': { difficulty: -1, weightMod: 0.1, hpMod: 0, ht: 11 },
  'wood': { difficulty: -2, weightMod: -0.1, hpMod: 0, ht: 10 }
};

export const QUALITIES = {
  'cheap': { difficulty: 2, costMult: 1/3, htBonus: -2 },
  'good': { difficulty: 0, costMult: 1, htBonus: 0 },
  'fine': { difficulty: -3, costMult: 4, htBonus: 2 },
  'very fine': { difficulty: -6, costMult: 20, htBonus: 4 },
  'legendary': { difficulty: -9, costMult: 100, htBonus: 6 }
};

export const MODS = {
  'minor add-on': -1,
  'major add-on': -2,
  'structural overhaul': -3
};

// Alchemy system constants
export const ASPECTS = ['Water', 'Air', 'Fire', 'Earth', 'Vital', 'Mind', 'Shadow', 'Light'];

export const REFINEMENT_LEVELS = {
  crude: ['primary', 'secondary', 'tertiary'],
  prepared: ['primary', 'secondary'],
  refined: ['primary']
};

export const INGREDIENT_ROLES = ['Active', 'Catalyst', 'Stabilizer', 'Solvent', 'Binder', 'Vector', 'Signature', 'Tool'];

export const POTENCY_LEVELS = ['P0', 'P1', 'P2', 'P3', 'P4'];

export const HAZARD_TAGS = ['Flammable', 'Volatile', 'Reactive', 'Unstable', 'Toxic', 'Intoxicant', 'Hallucinogenic'];

export const CONFLICT_PAIRS = [
  ['Fire', 'Water'],
  ['Light', 'Shadow'],
  ['Shadow', 'Vital']
];

export const VECTORS = [
  { name: 'Potion', wrMod: 0, dmMod: 0, tbEfficiency: 1.0 },
  { name: 'Salve/Poultice', wrMod: 1, dmMod: -1, tbEfficiency: 1.0 },
  { name: 'Ink/Coating', wrMod: 1, dmMod: -1, tbEfficiency: 1.0 },
  { name: 'Aerosol/Smoke', wrMod: 2, dmMod: -2, tbEfficiency: 1.0 },
  { name: 'Bomb/Grenade', wrMod: 3, dmMod: -3, tbEfficiency: 1.0 }
];

export const TIER_DATA = {
  1: { baseWR: 4, baseDM: 0, traitBudget: 10 },
  2: { baseWR: 8, baseDM: -1, traitBudget: 25 },
  3: { baseWR: 12, baseDM: -2, traitBudget: 50 },
  4: { baseWR: 16, baseDM: -4, traitBudget: 100 }
};

export const QUALITY_OUTCOMES = {
  0: 'Clean',
  1: 'Minor Flaw',
  2: 'Unstable',
  3: 'Flawed',
  4: 'Mishap'
};

// Tier calculation thresholds based on potency load of active ingredients
// Potency load = sum of (potency index + concentration steps) for all actives
export const TIER_THRESHOLDS = [
  { tier: 1, minPotencyLoad: 0, maxPotencyLoad: 3 },   // P0-P1 actives
  { tier: 2, minPotencyLoad: 4, maxPotencyLoad: 6 },   // P2 actives
  { tier: 3, minPotencyLoad: 7, maxPotencyLoad: 9 },   // P3 actives
  { tier: 4, minPotencyLoad: 10, maxPotencyLoad: 999 } // P4+ actives
];

// Required roles per vector type
export const REQUIRED_ROLES_BY_VECTOR = {
  'Potion': ['Active', 'Stabilizer', 'Solvent', 'Tool'],
  'Salve/Poultice': ['Active', 'Binder', 'Tool'],
  'Ink/Coating': ['Active', 'Binder', 'Tool'],
  'Aerosol/Smoke': ['Active', 'Catalyst', 'Tool'],
  'Bomb/Grenade': ['Active', 'Catalyst', 'Stabilizer', 'Tool']
};

// Penalty Scheme A: WR/DM adjustments for missing required roles
export const ROLE_COVERAGE_PENALTIES = {
  'Active': { wr: 999, dm: -999, message: 'Cannot brew without Active ingredient' },
  'Tool': { wr: 999, dm: -999, message: 'Cannot brew without Tool ingredient' },
  'Stabilizer': { wr: 2, dm: -1, message: 'Missing Stabilizer: +2 WR, -1 DM' },
  'Solvent': { wr: 2, dm: -1, message: 'Missing Solvent: +2 WR, -1 DM' },
  'Binder': { wr: 2, dm: -1, message: 'Missing Binder: +2 WR, -1 DM' },
  'Catalyst': { wr: 1, dm: 0, message: 'Missing Catalyst: +1 WR' }
};

// Maximum constraints for batch composition
export const MAX_REAGENTS_PER_BATCH = 8;

export const MAX_UNITS_PER_REAGENT_BY_ROLE = {
  'Active': 3,
  'Catalyst': 2,
  'Stabilizer': 2,
  'Solvent': 5,     // Can use more for dilution
  'Binder': 3,
  'Vector': 1,
  'Signature': 1,
  'Tool': 1
};

// Hazard rules: triggers and effects
export const HAZARD_RULES = {
  'Flammable': {
    triggerOn: ['mishap', 'quality_unstable_or_worse'],
    effect: 'Fire damage to lab and workers',
    wrMod: 1,
    dmMod: 0,
    severity: 'high'
  },
  'Volatile': {
    triggerOn: ['failure', 'mishap'],
    effect: 'Explosion - batch destroyed, possible injury',
    wrMod: 2,
    dmMod: 0,
    severity: 'critical'
  },
  'Reactive': {
    triggerOn: ['conflict_pairs_present'],
    effect: 'Increased instability from aspect conflicts',
    wrMod: 1,
    dmMod: -1,
    severity: 'medium'
  },
  'Unstable': {
    triggerOn: ['any_failure'],
    effect: 'Additional contamination on failure (CP +1 extra)',
    wrMod: 1,
    dmMod: 0,
    severity: 'medium'
  },
  'Toxic': {
    triggerOn: ['exposure', 'mishap'],
    effect: 'HT roll or take toxic damage',
    wrMod: 0,
    dmMod: 0,
    severity: 'high'
  },
  'Intoxicant': {
    triggerOn: ['exposure'],
    effect: 'IQ/DX penalties, possible unconsciousness',
    wrMod: 0,
    dmMod: 0,
    severity: 'medium'
  },
  'Hallucinogenic': {
    triggerOn: ['exposure'],
    effect: 'Mental effects, hallucinations',
    wrMod: 0,
    dmMod: 0,
    severity: 'medium'
  }
};
