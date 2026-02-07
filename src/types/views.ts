/**
 * View Component Prop Types
 *
 * TypeScript interfaces for all manager view components.
 * These define the props each view expects from ManagerTab.
 */

import type {
  Id,
  FoodType,
  MaterialType,
  Material,
  Food,
  Recipe,
  AlchemyLab,
  AlchemyBatch,
  AlchemySettings,
  Kitchen,
  Craft,
  CraftDesign,
  CustomTemplates,
  EffectFamilyMap,
  GatheringSpecies,
  GatheringTool,
  GatheringTable,
  GatheringEnvironment,
  GatheringBait,
  GatheringCategory,
  GatheringItem,
} from './campaign';

// ============================================================================
// SHARED TYPES
// ============================================================================

/**
 * Common delete handler signature used across views
 * @param type - The entity type being deleted
 * @param name - Display name for confirmation
 * @param data - Additional data (usually contains id)
 */
export type OnDeleteHandler = (
  type: string,
  name: string,
  data?: { id?: Id; templateType?: string }
) => void;

// ============================================================================
// COOKING SKILL TYPE
// ============================================================================

export interface CookingSkill {
  id: Id;
  name: string;
}

// ============================================================================
// WORKER TYPE
// ============================================================================

export interface Worker {
  id: Id;
  name: string;
  skills?: {
    cooking?: number;
    designing?: number;
    crafting?: number;
    alchemy?: number;
    survival?: number;
    naturalist?: number;
    herbLore?: number;
    fishing?: number;
  };
}

// ============================================================================
// ALCHEMY REAGENT TYPE (Extended)
// ============================================================================

export interface AlchemyReagent {
  id: Id;
  name: string;
  quantity: number;
  aspects?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
  refinement?: 'crude' | 'prepared' | 'refined';
  basePotency?: string;
  concentrationSteps?: number;
  roles?: string[];
  primaryRole?: string;
  hazards?: string[];
  processingNotes?: string;
  identificationLevel?: number;
  analysisHistory?: unknown[];
  falseProfile?: {
    aspects?: {
      primary?: string;
      secondary?: string;
      tertiary?: string;
    };
    basePotency?: string;
    concentrationSteps?: number;
    refinement?: string;
    roles?: string[];
    primaryRole?: string;
    hazards?: string[];
    processingNotes?: string;
  } | null;
}

// ============================================================================
// ALCHEMY FORMULA TYPE
// ============================================================================

export interface FormulaIngredient {
  reagentId: Id;
  reagentName: string;
  role: string;
  unitsUsed: number;
  refinement: 'crude' | 'prepared' | 'refined';
  aspects?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
}

export interface FormulaTrait {
  name: string;
  cost: number;
}

export interface AlchemyFormula {
  id: Id;
  name: string;
  ingredients?: FormulaIngredient[];
  tier?: number;
  calculatedTier?: number;
  potencyLoad?: number;
  vector?: string;
  baseWR?: number;
  baseDM?: number;
  dominantAspect?: string;
  secondaryAspect?: string;
  basePotency?: string;
  finalPotency?: string;
  concentrationSteps?: number;
  totalConcentrationSteps?: number;
  traitBudget?: number;
  hasMatchingStabilizer?: boolean;
  traits?: FormulaTrait[];
  roleCoverage?: unknown;
  hazards?: string[];
  potency?: number | string; // Legacy field
}

// ============================================================================
// EFFECT FAMILY MAP TYPE (Extended)
// ============================================================================

export interface EffectDefinition {
  id: Id;
  name: string;
  keywords: string;
  notes: string;
  gmNotes: string;
  gmNotesVisible: boolean;
}

export interface EffectPairData {
  summary?: string;
  effects?: EffectDefinition[];
}

export type EffectFamilyMapExtended = Record<string, EffectPairData>;

// ============================================================================
// VIEW PROPS INTERFACES
// ============================================================================

export interface SkillsViewProps {
  cookingSkills: CookingSkill[];
  saveCookingSkills: (skills: CookingSkill[]) => void;
  gmMode: boolean;
  onDelete: OnDeleteHandler;
}

export interface FoodTypesViewProps {
  foodTypes: (FoodType | string)[];
  saveFoodTypes: (types: (FoodType | string)[]) => void;
  onDelete: OnDeleteHandler;
}

export interface WorkersViewProps {
  workers: Worker[];
  saveWorkers: (workers: Worker[]) => void;
  onDelete: OnDeleteHandler;
}

export interface ProjectsViewProps {
  crafts: (Craft & { completed?: boolean; completedDate?: string; name?: string })[];
  onDelete: OnDeleteHandler;
}

export interface AlchemySettingsViewProps {
  alchemySettings: AlchemySettings & {
    autoSaveRecipes?: boolean;
    showObviousRoles?: boolean;
  };
  saveAlchemySettings: (settings: AlchemySettings & {
    autoSaveRecipes?: boolean;
    showObviousRoles?: boolean;
  }) => void;
}

export interface LabsViewProps {
  alchemyLabs: AlchemyLab[];
  saveAlchemyLabs: (labs: AlchemyLab[]) => void;
  onDelete: OnDeleteHandler;
}

export interface KitchensViewProps {
  kitchens: Kitchen[];
  saveKitchens: (kitchens: Kitchen[]) => void;
  onDelete: OnDeleteHandler;
}

export interface MaterialTypesViewProps {
  materialTypes: MaterialType[];
  saveMaterialTypes: (types: MaterialType[]) => void;
  renameMaterialType: (oldName: string, newName: string) => void;
  onDelete: OnDeleteHandler;
}

export interface EffectFamilyMapViewProps {
  effectFamilyMap: EffectFamilyMapExtended;
  saveEffectFamilyMap: (map: EffectFamilyMapExtended) => void;
}

export interface TemplatesViewProps {
  customTemplates: CustomTemplates;
  materialTypes: MaterialType[];
  saveCustomTemplates: (templates: CustomTemplates) => void;
  onDelete: OnDeleteHandler;
}

export interface ReagentsViewProps {
  alchemyReagents: AlchemyReagent[];
  saveAlchemyReagents: (reagents: AlchemyReagent[]) => void;
  onDelete: OnDeleteHandler;
}

export interface FormulasViewProps {
  alchemyReagents: AlchemyReagent[];
  alchemyFormulas: AlchemyFormula[];
  saveAlchemyFormulas: (formulas: AlchemyFormula[]) => void;
  onDelete: OnDeleteHandler;
}

// ============================================================================
// GM LOCK DATA TYPE
// ============================================================================

export interface GMLockData {
  encryptedData?: string;
  iv?: string;
  salt?: string;
}

// ============================================================================
// MANAGER TAB PROPS
// ============================================================================

export interface ManagerTabProps {
  // Inventory
  foodTypes: (FoodType | string)[];
  materialTypes: MaterialType[];
  materials: Material[];
  foods: Food[];

  // Workers and crafting
  workers: Worker[];
  crafts: (Craft & { completed?: boolean; completedDate?: string; name?: string })[];
  craftDesigns: CraftDesign[];
  customTemplates: CustomTemplates;

  // Alchemy
  effectFamilyMap: EffectFamilyMapExtended;
  alchemySettings: AlchemySettings & {
    autoSaveRecipes?: boolean;
    showObviousRoles?: boolean;
  };
  alchemyReagents: AlchemyReagent[];
  alchemyFormulas: AlchemyFormula[];
  alchemyBatches: AlchemyBatch[];
  alchemyLabs: AlchemyLab[];

  // Cooking
  kitchens: Kitchen[];
  cookingSkills: CookingSkill[];
  recipes: Recipe[];

  // GM Mode
  gmMode: boolean;
  gmLockData?: GMLockData | null;
  setGmMode: (mode: boolean) => void;
  setGmLockData: (data: GMLockData | null) => void;

  // Save functions
  saveMaterials: (materials: Material[]) => void;
  saveFoods: (foods: Food[]) => void;
  saveRecipes: (recipes: Recipe[]) => void;
  saveFoodTypes: (types: (FoodType | string)[]) => void;
  saveMaterialTypes: (types: MaterialType[]) => void;
  saveWorkers: (workers: Worker[]) => void;
  saveCrafts: (crafts: Craft[]) => void;
  saveCraftDesigns: (designs: CraftDesign[]) => void;
  saveCustomTemplates: (templates: CustomTemplates) => void;
  saveEffectFamilyMap: (map: EffectFamilyMapExtended) => void;
  saveAlchemySettings: (settings: AlchemySettings) => void;
  saveAlchemyReagents: (reagents: AlchemyReagent[]) => void;
  saveAlchemyFormulas: (formulas: AlchemyFormula[]) => void;
  saveAlchemyBatches: (batches: AlchemyBatch[]) => void;
  saveAlchemyLabs: (labs: AlchemyLab[]) => void;
  saveKitchens: (kitchens: Kitchen[]) => void;
  saveCookingSkills: (skills: CookingSkill[]) => void;
  renameMaterialType: (oldName: string, newName: string) => void;

  // Gathering system
  gatheringSpecies: GatheringSpecies[];
  gatheringTools: GatheringTool[];
  gatheringTables: GatheringTable[];
  gatheringEnvironments: GatheringEnvironment[];
  gatheringBait: GatheringBait[];
  gatheringCategories: GatheringCategory[];
  gatheringItems: GatheringItem[];
  currentDay: number;
  saveGatheringSpecies: (species: GatheringSpecies[]) => void;
  saveGatheringTools: (tools: GatheringTool[]) => void;
  saveGatheringTables: (tables: GatheringTable[]) => void;
  saveGatheringEnvironments: (environments: GatheringEnvironment[]) => void;
  saveGatheringBait: (bait: GatheringBait[]) => void;
  saveGatheringCategories: (categories: GatheringCategory[]) => void;
  saveGatheringItems: (items: GatheringItem[]) => void;
  saveCurrentDay: (day: number) => void;
}
