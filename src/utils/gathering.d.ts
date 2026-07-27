/**
 * Type definitions for gathering.js utilities
 */

import type { GatheringItem } from '../types/campaign';

/** Table shape matching what the JS rolling functions actually access. */
interface RollableTable {
  entries: Array<{
    id?: string;
    rollValue?: number;
    resultType?: string;
    speciesId?: string | null;
    itemId?: string | null;
    categoryId?: string | null;
    text?: string;
  }>;
  rollMethod?: string;
}

// Roll result types
export interface TableEntry {
  id?: string;
  resultType?: string;
  speciesId?: string | null;
  itemId?: string | null;
  categoryId?: string | null;
  result?: string;
  rerollCount?: number;
  rawRoll?: number;
  modifiedRoll?: number;
  rollBonus?: number;
  text?: string;
}

export interface ForageFind {
  type: 'species' | 'item' | 'nothing' | 'event' | 'special' | 'category';
  categoryId?: string | null;
  itemId?: string | null;
  item?: GatheringItem | null;
  source?: string;
  text?: string;
  tableEntry?: TableEntry;
}

export interface FishingResult {
  success: boolean;
  fish: number;
  critSuccess?: boolean;
  critFailure?: boolean;
  outcome?: string;
  margin?: number;
  isCritical?: boolean;
  description?: string;
}

export interface ForagingResult {
  success: boolean;
  randomFallback?: boolean;
  outcome?: string;
  critFailure?: boolean;
  critSuccess?: boolean;
  margin?: number;
  yieldMultiplier?: number;
  hazard?: string;
  bonusFind?: boolean;
  description?: string;
}

export interface FishYield {
  meatUnits: number;
  meatRolls?: number[];
  meatFormula?: string;
  secondaryUnits: number;
  secondaryRolls?: number[];
  secondaryFormula?: string;
  secondaryType?: string;
  foodType?: string;
}

export interface ForageYield {
  units: number;
  baseFormula?: string;
  modifiedFormula?: string;
  rolls?: number[];
  rawTotal?: number;
  multiplier?: number;
  finalUnits?: number;
}

export interface LargeFishStruggleResult {
  success: boolean;
  characterRoll: number;
  characterMargin: number;
  fishRoll: number;
  fishMargin: number;
  characterST: number;
  fishST: number;
  description: string;
}

export interface GatheringSession {
  id: string;
  dateKey: number;
  mode: string;
  environmentId: string;
  method: string;
  leaderCharacterId: string;
  helperCharacterIds: string[];
  intent: { targetedSpeciesId: string | null; randomCatch: boolean };
  selectedToolIds: string[];
  selectedConsumableIds: string[];
  modifiers: {
    effectiveSkill: number;
    breakdown: Record<string, number | undefined>;
  } | null;
  tablesResolved: {
    randomCatchTableId: string | null | undefined;
    mildEventTableId: string | null | undefined;
    rareEventTableId: string | null | undefined;
  };
  dailyEvent: {
    rolled: boolean;
    roll?: number;
    resultType: string | null;
    eventEntryId?: string | null;
    eventText?: string | null;
  };
  resolution: {
    fishingRoll: FishingResult | null | undefined;
    fishCaught: unknown[];
    yields: unknown[];
    inventoryDelta: unknown[] | {
      foods: Record<string, number>;
      materials: Record<string, number>;
    };
  };
  committedToInventory: boolean;
  createdAt: string;
  completedAt?: string;
}

// Dice utilities
export function parseDiceFormula(formula: string): { count: number; sides: number; modifier: number };
export function evaluateDiceFormula(formula: string): { total: number; rolls: number[]; modifier: number; formula: string };
export function roll3d6(): { total: number; rolls: number[] };

// Critical success/failure checks
export function isCriticalSuccess(roll: number, effectiveSkill: number): boolean;
export function isCriticalFailure(roll: number, effectiveSkill: number): boolean;

// Skill utilities
export function evaluateFishingRoll(roll: number, effectiveSkill: number, method: string): FishingResult;
export function calculateEffectiveFishingSkill(params: any): { effectiveSkill: number; breakdown: any };
export function evaluateForagingRoll(roll: number, effectiveSkill: number, isTargeted?: boolean): ForagingResult;
export function calculateEffectiveForagingSkill(params: { baseForagingSkill: number; toolBonus?: number; hasMapGuide?: boolean; isUnfamiliar?: boolean; isPeakSeason?: boolean; targetRarity?: string | null; environmentMod?: number }): { effectiveSkill: number; breakdown: any };

// Table rolling
export function rollOnCatchTable(table: RollableTable | null, rollBonus?: number): TableEntry;
export function rollNetCatch(table: RollableTable, species: Array<{ id: string; tags?: string[] }>): TableEntry;

// Fish struggle
export function resolveLargeFishStruggle(characterST: number, fishST?: number): LargeFishStruggleResult;

// Fish yields
export function calculateFishYields(species: GatheringSpecies | null, success?: boolean, margin?: number): FishYield | any[];

// Foraging
export function determineForageFind(options: {
  rollResult: ForagingResult;
  findTable: RollableTable | null;
  _targetCategory?: string | null;
  targetItem?: { id: string; name?: string } | null;
}): ForageFind;

export function calculateForageYields(params: { category?: any; item?: any; yieldMultiplier?: number; yieldDiceBonus?: number; yieldDicePenalty?: number }): ForageYield;
export function getToolYieldBonus(tools: any[], typeId: string): number;

// Session management
export function createGatheringSession(data: {
  mode: string;
  environmentId: string;
  method: string;
  leaderCharacterId: string;
  helperCharacterIds?: string[];
  intent?: {
    targetedSpeciesId?: string | null;
    randomCatch?: boolean;
  };
  selectedToolIds?: string[];
  selectedConsumableIds?: string[];
  currentDay: number;
}): GatheringSession;
export function generateGroupKey(leaderId: string, helperIds?: string[]): string;
export function hasDailyEventBeenRolled(dailyEventLog: any, currentDay: any, groupKey: any): boolean;
export function determineDynamicEventType(roll?: number): 'rare' | 'mild' | 'none';

// Tool utilities
export function filterToolsForMethod(tools: any[], mode: string, method: string): any[];
