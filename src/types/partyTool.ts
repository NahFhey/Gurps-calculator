export type Id = string;

export interface WorkSettings {
  enabled: boolean;
  skills: Record<string, number>;
}

export interface Character {
  id: Id;
  name?: string;
  isPlayer?: boolean;
  work: WorkSettings;
}

export interface ItemInstance {
  id: Id;
  name?: string;
  quantity?: number;
}

export interface MaterialEntry {
  id: Id;
  quantity: number;
}

export interface FoodEntry {
  id: Id;
  quantity: number;
}

export interface ToolModifierSet {
  skillBonus?: number;
  yieldFlat?: number;
  yieldPercent?: number;
  timeBonus?: number;
  riskModifier?: number;
  qualityModifier?: number;
}

export interface ToolTemplate {
  templateId: Id;
  name: string;
  activityCategories: Record<string, ToolModifierSet>;
}

export interface ToolInstance {
  toolId: Id;
  templateId: Id;
  conditionId: Id;
  notes?: string;
}

export interface Inventory {
  id: Id;
  ownerType: 'party' | 'character';
  ownerId: Id | null;
  currency: Record<string, number>;
  items: ItemInstance[];
  tools: ToolInstance[];
  materials: MaterialEntry[];
  food: FoodEntry[];
}

export interface CurrencyLog {
  id: Id;
  sourceInventoryId: Id;
  targetInventoryId: Id;
  currencyKey?: string;
  amount?: number;
  itemInstanceId?: Id;
  toolId?: Id;
  timestamp: number;
}

export interface GlobalState {
  characters: Record<Id, Character>;
  inventories: Record<Id, Inventory>;
  toolTemplates: Record<Id, ToolTemplate>;
  toolInstances: Record<Id, ToolInstance>;
  currencyLogs: CurrencyLog[];
}
