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
  AlchemyLab,
  AlchemySettings,
  Kitchen,
  Craft,
  CustomTemplates,
  EffectFamilyMap,
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
  ingredients: FormulaIngredient[];
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
  potency?: string; // Legacy field
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
