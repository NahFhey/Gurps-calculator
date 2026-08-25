export interface Material {
  id: string;
  name: string;
  type: string;
  quantity: number;
  [key: string]: unknown;
}

export interface Food {
  id: string;
  name: string;
  types: string[];
  quantity: number;
  [key: string]: unknown;
}

export interface MaterialType {
  name: string;
  difficulty: number;
  ht: number;
  weightMod?: number;
  hpMod?: number;
  [key: string]: unknown;
}

export interface FoodType {
  name: string;
  color: string;
}

export interface DeleteConfirm {
  type: 'mat' | 'food';
  id: string;
  name: string;
}

export interface TransferState {
  type: 'item' | 'tool' | 'currency';
  itemId?: string;
  toolId?: string;
  currencyKey?: string;
  amount?: string;
  sourceInventoryId: string;
  targetInventoryId: string;
}

export type InventoryView = 'materials' | 'foods' | 'stash';
