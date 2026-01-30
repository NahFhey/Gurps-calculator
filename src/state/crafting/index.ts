/**
 * Crafting State Module
 *
 * Exports for the crafting system state slice.
 */

// Reducer
export { handleCraftingAction } from './craftingReducer';

// Actions
export {
  // Action type constants
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
  CUSTOM_TEMPLATE_ADD,
  // Type guard
  isCraftingAction,
  // Types
  type CraftingAction
} from './craftingActions';

// Re-export selectors from central location
export * from '../selectors/craftingSelectors';
