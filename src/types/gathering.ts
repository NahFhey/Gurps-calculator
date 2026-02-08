/**
 * Gathering System Types
 *
 * TypeScript interfaces for the gathering system (fishing, foraging).
 * These extend the base types from campaign.ts with view-specific details.
 */

import type { Id } from './campaign';

// ============================================================================
// SPECIES TYPES
// ============================================================================

export interface GatheringSpeciesExtended {
  id: Id;
  name: string;
  type: 'fish' | 'shellfish' | 'crustacean';
  tags: string[];
  foodType: string;
  yieldMeatFormula: string;
  secondaryMaterialType: string | null;
  yieldSecondaryFormula: string | null;
  secondaryNameOverride: string | null;
  st: number | null;
  specialRules: string[];
}

// ============================================================================
// TOOL TYPES
// ============================================================================

export interface ToolBonus {
  type: 'skill_bonus' | 'yield_bonus';
  skill?: string;
  value?: number;
  typeId?: string;
  categoryId?: string; // Legacy support
  dice?: number;
}

export interface GatheringToolExtended {
  id: Id;
  name: string;
  toolType: string;
  allowedModes: string[];
  allowedMethods: string[];
  bonuses: ToolBonus[];
  durability: number | null;
  notes: string;
}

// ============================================================================
// TABLE TYPES
// ============================================================================

export interface TableEntry {
  id: Id;
  rollValue: number;
  resultType: 'species' | 'item' | 'nothing' | 'event' | 'special';
  speciesId: string | null;
  itemId?: string | null;
  text: string;
}

export interface GatheringTableExtended {
  id: Id;
  name: string;
  tableType: string;
  rollMethod: '1d6' | '2d6' | '3d6';
  entries: TableEntry[];
}

// ============================================================================
// ENVIRONMENT TYPES
// ============================================================================

export interface ModeDefaults {
  randomCatchTableId: string | null;
  mildEventTableId: string | null;
  rareEventTableId: string | null;
}

export interface GatheringEnvironmentExtended {
  id: Id;
  name: string;
  supportedModes: string[];
  defaultsByMode: {
    Fishing?: ModeDefaults;
    Foraging?: ModeDefaults;
  };
  skillMod: number;
  /** Links this environment to a Location. Environments without a locationId are hidden from activities. */
  locationId?: string;
}

// ============================================================================
// BAIT TYPES
// ============================================================================

export interface GatheringBaitExtended {
  id: Id;
  name: string;
  consumableType: 'bait';
  baitTags: string[];
  attractsSpeciesIds: string[];
  quantity: number;
  rollBonus: number;
}

// ============================================================================
// CATEGORY TYPES
// ============================================================================

export interface GatheringCategoryExtended {
  id: Id;
  name: string;
  yieldFormula: string;
  inventoryKind: 'food' | 'material';
  typeId: string;
  description: string;
}

// ============================================================================
// ITEM TYPES
// ============================================================================

export interface GatheringItemExtended {
  id: Id;
  name: string;
  inventoryKind: 'food' | 'material';
  typeId: string;
  yieldFormula: string;
  rarity: string;
  description: string;
}

// ============================================================================
// VIEW PROPS INTERFACES
// ============================================================================

export type OnDeleteHandler = (
  type: string,
  id: Id,
  name: string
) => void;

export interface SpeciesViewProps {
  species: GatheringSpeciesExtended[];
  foodTypes: string[];
  saveSpecies: (species: GatheringSpeciesExtended[]) => void;
  onDelete: OnDeleteHandler;
}

export interface ItemsViewProps {
  items: GatheringItemExtended[];
  foodTypes: string[];
  materialTypes: string[];
  saveItems: (items: GatheringItemExtended[]) => void;
  onDelete: OnDeleteHandler;
}

export interface ToolsViewProps {
  tools: GatheringToolExtended[];
  foodTypes: string[];
  materialTypes: string[];
  saveTools: (tools: GatheringToolExtended[]) => void;
  onDelete: OnDeleteHandler;
}

export interface TablesViewProps {
  tables: GatheringTableExtended[];
  species: GatheringSpeciesExtended[];
  items: GatheringItemExtended[];
  saveTables: (tables: GatheringTableExtended[]) => void;
  onDelete: OnDeleteHandler;
}

export interface EnvironmentsViewProps {
  environments: GatheringEnvironmentExtended[];
  tables: GatheringTableExtended[];
  /** Available locations for linking environments */
  locations: Array<{ id: string; name: string }>;
  saveEnvironments: (environments: GatheringEnvironmentExtended[]) => void;
  onDelete: OnDeleteHandler;
}

export interface BaitViewProps {
  bait: GatheringBaitExtended[];
  species: GatheringSpeciesExtended[];
  saveBait: (bait: GatheringBaitExtended[]) => void;
  onDelete: OnDeleteHandler;
}

export interface CampaignDayViewProps {
  currentDay: number;
  saveCurrentDay: (day: number) => void;
}

// ============================================================================
// GATHERING MANAGER PROPS
// ============================================================================

export interface GatheringManagerProps {
  species: GatheringSpeciesExtended[];
  tools: GatheringToolExtended[];
  tables: GatheringTableExtended[];
  environments: GatheringEnvironmentExtended[];
  bait: GatheringBaitExtended[];
  categories: GatheringCategoryExtended[];
  items: GatheringItemExtended[];
  currentDay: number;
  foodTypes: Array<{ name: string; color?: string } | string>;
  materialTypes: Array<{ name: string; color?: string } | string>;
  saveSpecies: (species: GatheringSpeciesExtended[]) => void;
  saveTools: (tools: GatheringToolExtended[]) => void;
  saveTables: (tables: GatheringTableExtended[]) => void;
  saveEnvironments: (environments: GatheringEnvironmentExtended[]) => void;
  saveBait: (bait: GatheringBaitExtended[]) => void;
  saveCategories: (categories: GatheringCategoryExtended[]) => void;
  saveItems: (items: GatheringItemExtended[]) => void;
  saveCurrentDay: (day: number) => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type GatheringView =
  | 'species'
  | 'items'
  | 'tools'
  | 'tables'
  | 'environments'
  | 'bait'
  | 'campaign';

export interface DeleteConfirmState {
  type: string;
  id: Id;
  name: string;
}
