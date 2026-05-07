/**
 * Crafting Actions
 *
 * Action type constants and type definitions for crafting-related state changes.
 */

import type { Id, Craft, CraftDesign, CustomTemplates } from '../../types/campaign';

// ============================================================================
// ACTION TYPE CONSTANTS
// ============================================================================

// Craft actions
export const CRAFT_ADD = 'addCraft' as const;
export const CRAFT_UPDATE = 'updateCraft' as const;
export const CRAFT_REMOVE = 'removeCraft' as const;
export const CRAFT_COMPLETE = 'completeCraft' as const;
export const CRAFTS_SET = 'setCrafts' as const;

// CraftDesign actions
export const CRAFT_DESIGN_ADD = 'addCraftDesign' as const;
export const CRAFT_DESIGN_UPDATE = 'updateCraftDesign' as const;
export const CRAFT_DESIGN_REMOVE = 'removeCraftDesign' as const;
export const CRAFT_DESIGNS_SET = 'setCraftDesigns' as const;

// CustomTemplates actions
export const CUSTOM_TEMPLATES_SET = 'setCustomTemplates' as const;
export const CUSTOM_TEMPLATE_ADD = 'addCustomTemplate' as const;

// ============================================================================
// ACTION TYPES
// ============================================================================

export type AddCraftAction = { type: typeof CRAFT_ADD; payload: Craft };
export type UpdateCraftAction = {
  type: typeof CRAFT_UPDATE;
  payload: { id: Id; changes: Partial<Craft> };
};
export type RemoveCraftAction = { type: typeof CRAFT_REMOVE; payload: Id };
export type CompleteCraftAction = {
  type: typeof CRAFT_COMPLETE;
  payload: { id: Id; finalStats: Craft['finalStats'] };
};
export type SetCraftsAction = { type: typeof CRAFTS_SET; payload: Record<Id, Craft> };

export type AddCraftDesignAction = { type: typeof CRAFT_DESIGN_ADD; payload: CraftDesign };
export type UpdateCraftDesignAction = {
  type: typeof CRAFT_DESIGN_UPDATE;
  payload: { id: Id; changes: Partial<CraftDesign> };
};
export type RemoveCraftDesignAction = { type: typeof CRAFT_DESIGN_REMOVE; payload: Id };
export type SetCraftDesignsAction = {
  type: typeof CRAFT_DESIGNS_SET;
  payload: Record<Id, CraftDesign>;
};

export type SetCustomTemplatesAction = {
  type: typeof CUSTOM_TEMPLATES_SET;
  payload: CustomTemplates;
};
export type AddCustomTemplateAction = {
  type: typeof CUSTOM_TEMPLATE_ADD;
  payload: { category: keyof CustomTemplates; templateName: string; template: any };
};

// ============================================================================
// UNION TYPE
// ============================================================================

export type CraftingAction =
  | AddCraftAction
  | UpdateCraftAction
  | RemoveCraftAction
  | CompleteCraftAction
  | SetCraftsAction
  | AddCraftDesignAction
  | UpdateCraftDesignAction
  | RemoveCraftDesignAction
  | SetCraftDesignsAction
  | SetCustomTemplatesAction
  | AddCustomTemplateAction;

// ============================================================================
// TYPE GUARD
// ============================================================================

const CRAFTING_ACTION_TYPES = new Set([
  CRAFT_ADD,
  CRAFT_UPDATE,
  CRAFT_REMOVE,
  CRAFT_COMPLETE,
  CRAFTS_SET,
  CRAFT_DESIGN_ADD,
  CRAFT_DESIGN_UPDATE,
  CRAFT_DESIGN_REMOVE,
  CRAFT_DESIGNS_SET,
  CUSTOM_TEMPLATES_SET,
  CUSTOM_TEMPLATE_ADD
]);

export function isCraftingAction(action: { type: string }): action is CraftingAction {
  return CRAFTING_ACTION_TYPES.has(action.type as typeof CRAFT_ADD);
}
