/**
 * Mining Constants
 *
 * Constants for the mining downtime activity system.
 * Includes mineral definitions, deposit tables, event tables, and yield formulas.
 */

import type { MiningSkill, DepositSize } from '../types/downtime';

// ============================================================================
// SKILL LABELS
// ============================================================================

export const MINING_SKILL_LABELS: Record<MiningSkill, string> = {
  prospecting: 'Prospecting (IQ)',
  geology: 'Geology (IQ)',
  engineerMining: 'Engineer (Mining) (IQ)',
  mining: 'Mining (IQ)',
};

/** Skills valid for locate rolls */
export const LOCATE_SKILLS: MiningSkill[] = ['prospecting', 'geology'];

/** Skills valid for extraction rolls */
export const EXTRACTION_SKILLS: MiningSkill[] = ['engineerMining', 'mining', 'prospecting'];

// ============================================================================
// MINERAL / RESOURCE DEFINITIONS
// ============================================================================

export type MineralRarity = 'common' | 'uncommon' | 'rare' | 'veryRare';
export type MineralCategory = 'stone' | 'metal' | 'rare';

export interface MineralDef {
  id: string;
  name: string;
  rarity: MineralRarity;
  category: MineralCategory;
  yieldFormula: string;
  /** Descriptive type for inventory */
  typeId: string;
  inventoryKind: 'material';
}

export const MINERALS: MineralDef[] = [
  { id: 'stormslate',       name: 'Stormslate',          rarity: 'common',   category: 'stone', yieldFormula: '4d',   typeId: 'Soft Stone',        inventoryKind: 'material' },
  { id: 'wyrmstone_basalt', name: 'Wyrmstone Basalt',    rarity: 'common',   category: 'stone', yieldFormula: '3d',   typeId: 'Hard Stone',        inventoryKind: 'material' },
  { id: 'iron',             name: 'Iron Ore',            rarity: 'common',   category: 'metal', yieldFormula: '2d+2', typeId: 'Iron',              inventoryKind: 'material' },
  { id: 'copper',           name: 'Greenvein Copper',    rarity: 'uncommon', category: 'metal', yieldFormula: '2d',   typeId: 'Copper',            inventoryKind: 'material' },
  { id: 'coal',             name: 'Coal',                rarity: 'common',   category: 'metal', yieldFormula: '3d',   typeId: 'Coal/Fuel Rock',    inventoryKind: 'material' },
  { id: 'volcanic_salts',   name: 'Volcanic Salts',      rarity: 'uncommon', category: 'metal', yieldFormula: '1d+1', typeId: 'Volcanic Salts',    inventoryKind: 'material' },
  { id: 'nullron',          name: 'Nullron Ore',         rarity: 'rare',     category: 'rare',  yieldFormula: '1d',   typeId: 'Nullron Ore',       inventoryKind: 'material' },
  { id: 'mistglass',        name: 'Mistglass Crystal',   rarity: 'rare',     category: 'rare',  yieldFormula: '1d',   typeId: 'Mistglass Crystal', inventoryKind: 'material' },
];

export const MINERALS_BY_ID: Record<string, MineralDef> = Object.fromEntries(
  MINERALS.map((m) => [m.id, m])
);

export const MINERALS_BY_RARITY: Record<MineralRarity, MineralDef[]> = {
  common: MINERALS.filter((m) => m.rarity === 'common'),
  uncommon: MINERALS.filter((m) => m.rarity === 'uncommon'),
  rare: MINERALS.filter((m) => m.rarity === 'rare'),
  veryRare: MINERALS.filter((m) => m.rarity === 'rare'), // veryRare falls back to rare pool
};

// ============================================================================
// LOCATE MODIFIERS
// ============================================================================

export const LOCATE_MODIFIERS = {
  detailedMaps: +1,
  knownRichDeposit: +2,
  randomUnexplored: -2,
  supervisor15Plus: +5,
} as const;

// ============================================================================
// EXTRACTION MODIFIERS
// ============================================================================

export const EXTRACTION_MODIFIERS = {
  properTools: +2,
  improvisedTools: -2,
  supervisor15Plus: +5,
  /** Prospecting used for extraction instead of Engineer/Mining */
  prospectingExtractionPenalty: -2,
} as const;

/** Team bonus by number of workers (including leader) */
export function getTeamBonus(helperCount: number): number {
  if (helperCount >= 4) return 3; // 5+ workers total
  if (helperCount >= 2) return 2; // 3-4 workers
  if (helperCount >= 1) return 1; // 2 workers
  return 0;
}

// ============================================================================
// SEEK SPECIFIC RESOURCE PENALTIES
// ============================================================================

export const SPECIFIC_RESOURCE_PENALTIES: Record<MineralRarity, number> = {
  common: 0,
  uncommon: -2,
  rare: -4,
  veryRare: -6,
};

// ============================================================================
// DEPOSIT SIZE TABLE (units per deposit)
// ============================================================================

export const DEPOSIT_CAPACITY: Record<MineralCategory, Record<DepositSize, string>> = {
  stone: {
    Small: '20d',
    Medium: '50d',
    Large: '100d',
    Massive: '200d',
  },
  metal: {
    Small: '10d',
    Medium: '25d',
    Large: '50d+10',
    Massive: '100d+20',
  },
  rare: {
    Small: '5d',
    Medium: '12d',
    Large: '25d',
    Massive: '50d',
  },
};

// ============================================================================
// LOCATE OUTCOME TABLE (MoS → resource rarity + deposit size)
// ============================================================================

export interface LocateOutcome {
  rarity: MineralRarity;
  depositSize: DepositSize;
}

/**
 * Determine the locate outcome based on margin of success.
 * Success by 0-2: Common, Small
 * Success by 3-5: Uncommon OR Common Medium (player choice)
 * Success by 6+: Rare OR Mixed deposit, Large
 * Critical: upgrade size one step
 */
export function determineLocateOutcome(
  margin: number,
  isCritical: boolean,
): LocateOutcome {
  let rarity: MineralRarity;
  let depositSize: DepositSize;

  if (margin >= 6) {
    rarity = 'rare';
    depositSize = 'Large';
  } else if (margin >= 3) {
    rarity = 'uncommon';
    depositSize = 'Medium';
  } else {
    rarity = 'common';
    depositSize = 'Small';
  }

  if (isCritical) {
    depositSize = upgradeDepositSize(depositSize);
  }

  return { rarity, depositSize };
}

function upgradeDepositSize(size: DepositSize): DepositSize {
  switch (size) {
    case 'Small': return 'Medium';
    case 'Medium': return 'Large';
    case 'Large': return 'Massive';
    case 'Massive': return 'Massive';
  }
}

// ============================================================================
// EXTRACTION YIELD MULTIPLIERS
// ============================================================================

export type ExtractionOutcome = 'criticalSuccess' | 'success' | 'failure' | 'criticalFailure';

export const EXTRACTION_YIELD_MULTIPLIERS: Record<ExtractionOutcome, number> = {
  criticalSuccess: 1.5,
  success: 1.0,
  failure: 0.5,
  criticalFailure: 0,
};

// ============================================================================
// EVENT TABLES
// ============================================================================

export interface MiningEvent {
  id: string;
  name: string;
  description: string;
  severity: 'mild' | 'rare';
}

/**
 * Check if an event should trigger.
 * Roll 3d6: 3-6 = rare event, 7-10 = mild event, 11-18 = no event
 */
export function checkEventTrigger(eventRoll: number): 'rare' | 'mild' | 'none' {
  if (eventRoll <= 6) return 'rare';
  if (eventRoll <= 10) return 'mild';
  return 'none';
}

export const RARE_EVENTS: MiningEvent[] = [
  { id: 'tunnel_collapse',    name: 'Tunnel Collapse',             description: 'The tunnel collapses! Damage + blocks access to site.',         severity: 'rare' },
  { id: 'toxic_gas',          name: 'Toxic Gas Pocket',            description: 'A pocket of toxic gas is released. HT roll or take damage.',    severity: 'rare' },
  { id: 'rare_vein',          name: 'Rare Mineral Vein',           description: 'A rich vein is uncovered! Deposit size upgraded or +bonus units.', severity: 'rare' },
  { id: 'creature_attack',    name: 'Burrowing Creature Attack',   description: 'A burrowing creature attacks the miners!',                     severity: 'rare' },
  { id: 'hidden_chamber',     name: 'Hidden Subterranean Chamber', description: 'A hidden chamber is discovered underground.',                  severity: 'rare' },
  { id: 'water_source',       name: 'Underground Water Source',    description: 'Water floods the area — risk of flooding or useful aquifer.',   severity: 'rare' },
  { id: 'unstable_vein',      name: 'Unstable Vein',               description: 'Bonus units but next extraction at -2 or triggers event on failure.', severity: 'rare' },
  { id: 'unusual_metal',      name: 'Unusual Metal Formation',     description: 'A new material node or research tag is discovered.',            severity: 'rare' },
  { id: 'rockfall',           name: 'Rockfall!',                   description: 'Rocks fall from above! Dodge or take damage.',                 severity: 'rare' },
  { id: 'geological_phenom',  name: 'Strange Geological Phenomenon', description: 'Something unusual and unexplained occurs.',                  severity: 'rare' },
  { id: 'ancient_fossil',     name: 'Ancient Fossil',              description: 'An ancient fossil is discovered — potentially valuable.',       severity: 'rare' },
];

export const MILD_EVENTS: MiningEvent[] = [
  { id: 'loose_footing',      name: 'Loose Footing',              description: 'Half yield this extraction.',                                   severity: 'mild' },
  { id: 'unexpected_quality',  name: 'Unexpected Ore Quality',     description: '-1 yield die OR "Low Quality" flag.',                           severity: 'mild' },
  { id: 'minor_rockslide',    name: 'Minor Rockslide',            description: 'Lose this extraction slot\'s yield.',                           severity: 'mild' },
  { id: 'fossil_fragment',    name: 'Unusual Fossil Fragment',     description: 'A small fossil fragment — curiosity value.',                    severity: 'mild' },
  { id: 'airflow_disruption', name: 'Airflow Disruption',          description: '-1 to rolls this session.',                                    severity: 'mild' },
  { id: 'no_event',           name: 'No Event',                    description: 'Nothing unusual happens.',                                     severity: 'mild' },
  { id: 'water_seepage',      name: 'Unexpected Water Seepage',    description: '+1 to next extraction roll in this site.',                     severity: 'mild' },
  { id: 'unusual_formation',  name: 'Unusual Rock Formation',      description: 'Bonus value if extracted carefully; tag it.',                   severity: 'mild' },
  { id: 'rich_vein_detected', name: 'Rich Vein Detected',          description: '+1 next extraction roll.',                                     severity: 'mild' },
  { id: 'efficient_workday',  name: 'Efficient Workday',           description: 'Gain an extra extraction attempt if time slots remain.',       severity: 'mild' },
  { id: 'stronger_material',  name: 'Stronger Material Found',     description: 'Quality Upgrade OR +1 yield die.',                             severity: 'mild' },
];

/**
 * Select an event from the appropriate table using a 2d6 roll.
 * Maps roll 2-12 to an event index.
 */
export function selectEvent(severity: 'rare' | 'mild', roll2d6: number): MiningEvent {
  const table = severity === 'rare' ? RARE_EVENTS : MILD_EVENTS;
  const index = Math.max(0, Math.min(roll2d6 - 2, table.length - 1));
  return table[index];
}

// ============================================================================
// ULKOGR ZONE MINERALS
// ============================================================================

/** Default mineral resource sets for Ulkogr zones */
export const ULKOGR_MINERALS = {
  common: ['stormslate', 'wyrmstone_basalt'],
  uncommon: ['copper'],
  rare: ['mistglass'],
  mixed: [
    ['stormslate', 'copper'],
    ['wyrmstone_basalt', 'copper'],
    ['copper', 'mistglass'],
  ],
} as const;
