/**
 * Type declarations for the GURPS alchemy calculation engine (alchemy.js)
 */

export interface RoleCoverageResult {
  valid: boolean;
  missingRoles: string[];
  wrDelta: number;
  dmDelta: number;
  messages: string[];
}

export interface BatchValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HazardDetail {
  hazard: string;
  source?: string;
  effect: string;
  triggerOn: string[];
  wrMod: number;
  dmMod: number;
  severity?: string;
}

export interface HazardEvaluationResult {
  count: number;
  hazards: string[];
  details: HazardDetail[];
}

export interface FormulaStats {
  tier: number;
  calculatedTier: number;
  potencyLoad: number;
  isLegacyTier: boolean;
  baseWR: number;
  baseDM: number;
  dominantAspect: string | null;
  secondaryAspect: string | null;
  basePotency: string;
  concentrationSteps: number;
  finalPotency: string;
  totalConcentrationSteps: number;
  vector: string;
  traitBudget: number;
  hasMatchingStabilizer: boolean;
  coherent: boolean;
  activeAspectCount: number;
  conflicts: number;
  hazardCount: number;
  roleCoverage: RoleCoverageResult;
  batchValidation: BatchValidationResult;
  hazardEvaluation: HazardEvaluationResult;
}

export interface DominantSecondaryResult {
  dominant: string | null;
  dominantValue: number;
  secondary: string | null;
  secondaryValue: number;
}

export interface ProcessingDifficultyResult {
  alchemySkill: number;
  labRating: number;
  processStepDM: number;
  batchSizePenalty: number;
  potencyControlPenalty: number;
  effectiveSkill: number;
  breakdown: string;
}

export interface ProcessingResult {
  success: boolean;
  critical?: boolean;
  minor?: boolean;
  outputProduced: boolean;
  hazardAdded: string | null;
  message: string;
  reclaim?: boolean;
  complication?: boolean;
}

export interface HazardVisibility {
  hazardsPublic: Array<{ id: string; known: boolean; severity: string }>;
  gmHazards: Array<{
    id: string;
    hazard: string;
    source?: string;
    effect: string;
    triggerOn: string[];
    wrMod: number;
    dmMod: number;
    severity?: string;
  }>;
}

export interface StartBatchResult {
  ok: boolean;
  batch?: any;
  reagents?: any[];
  events?: unknown[];
  error?: {
    code: string;
    message: string;
    missing: Array<{
      reagentId: string;
      reagentName: string;
      needed: number;
      available: number;
    }>;
  };
}

export function normalizeLabRating(lr: number): number;

export function getReagentAspectPoints(
  reagent: any
): Record<string, number>;

export function tallyAspects(
  activeIngredients: any[],
  reagentsMap: Map<string, any>
): Record<string, number>;

export function computeDominantSecondary(
  tally: Record<string, number>
): DominantSecondaryResult;

export function getFinalPotency(
  basePotency: string,
  concentrationSteps: number
): string;

export function calculateConcentrationRefinement(
  reagent: any,
  steps?: number
): any;

export function calculatePotencyLoad(
  activeIngredients: any[],
  reagentsMap: Map<string, any>
): number;

export function calculateTierFromPotencyLoad(potencyLoad: number): number;

export function validateRoleCoverage(
  ingredients: any[],
  vectorName: string
): RoleCoverageResult;

export function validateBatchConstraints(
  ingredients: any[]
): BatchValidationResult;

export function evaluateHazards(
  ingredients: any[],
  reagentsMap?: Map<string, any>
): HazardEvaluationResult;

export function getEffectFamilyKey(
  aspect1: string,
  aspect2: string
): string | null;

export function calculateFormulaStats(
  formula: any,
  reagentsMap: Map<string, any>,
  vectorName?: string,
  options?: any
): FormulaStats;

export function applyWorkBlockResult(
  batch: any,
  skill: number,
  roll: number,
  worker: string,
  date: string
): any;

export function prepareHazardsWithVisibility(
  hazardEvaluation: HazardEvaluationResult | null | undefined,
  options?: { allKnown?: boolean }
): HazardVisibility;

export function getHazardForDisplay(
  hazardId: string,
  hazardsPublic: Array<{ id: string; known: boolean; severity: string }>,
  gmHazards: Array<any>
): any | null;

export function roll3d6(): number;

export function calculateProcessingDifficulty(
  params: any
): ProcessingDifficultyResult;

export function selectHazardForMinorFailure(
  existingHazards?: string[]
): string;

export function evaluateProcessingResult(
  roll: number,
  effectiveSkill: number,
  currentHazards?: string[]
): ProcessingResult;

export function createDerivedReagentName(
  baseName: string,
  refinement: string,
  concentrationSteps: number
): string;

export function startBatchFromFormula(
  formula: any,
  reagents: any[],
  batches: any[],
  forecastOrOptions?: any | null,
  microAssay?: unknown[] | null
): StartBatchResult;
