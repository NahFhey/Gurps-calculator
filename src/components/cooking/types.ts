import type { CookingRecipeIngredient, FacilityAttachment } from '../../types/campaign';

export interface Worker {
  id: string;
  name: string;
  skills: Record<string, number>;
  st?: number;
}

export interface Food {
  id: string;
  name: string;
  types: string[];
  quantity: number;
  [key: string]: unknown;
}

export interface Kitchen {
  id: string;
  name: string;
  rating: number;
  attachment?: FacilityAttachment;
  [key: string]: unknown;
}

export interface CookingSkill {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SelectedIngredient {
  id: string;
  foodId: string;
  amount: number;
}

export interface DiceRoll {
  dice: number[];
  total: number;
}

export interface Substitute {
  foodId: string | null;
  amount: number;
}

export interface RemakeIngredient {
  original: CookingRecipeIngredient;
  useOriginal: boolean;
  substitutes: Substitute[];
  penalty: number;
}

export interface RecipeStats {
  unique: number;
  total: number;
  diff: number;
  rolls: number;
}

export type CookingView = 'create' | 'library' | 'remake';
