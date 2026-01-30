/**
 * Crafting Selectors
 *
 * Centralized selectors for accessing crafting system data (crafts, designs,
 * custom templates) from the campaign state.
 */

import type { CampaignState } from '../campaignReducer';
import type { Id, Craft, CraftDesign, CustomTemplates, CraftPhase } from '../../types/campaign';

// ============================================================================
// CRAFT SELECTORS
// ============================================================================

/**
 * Select all crafts as a record
 */
export const selectCraftsRecord = (state: CampaignState): Record<Id, Craft> =>
  state.entities.crafts;

/**
 * Select all crafts as an array
 */
export const selectAllCrafts = (state: CampaignState): Craft[] =>
  Object.values(state.entities.crafts);

/**
 * Select a craft by ID
 */
export const selectCraftById = (state: CampaignState, id: Id): Craft | undefined =>
  state.entities.crafts[id];

/**
 * Select crafts by phase
 */
export const selectCraftsByPhase = (state: CampaignState, phase: CraftPhase): Craft[] =>
  Object.values(state.entities.crafts).filter((c) => c.phase === phase);

/**
 * Select active (non-complete) crafts
 */
export const selectActiveCrafts = (state: CampaignState): Craft[] =>
  Object.values(state.entities.crafts).filter((c) => c.phase !== 'complete');

/**
 * Select completed crafts
 */
export const selectCompletedCrafts = (state: CampaignState): Craft[] =>
  Object.values(state.entities.crafts).filter((c) => c.phase === 'complete');

/**
 * Select craft count
 */
export const selectCraftCount = (state: CampaignState): number =>
  Object.keys(state.entities.crafts).length;

/**
 * Select active craft count
 */
export const selectActiveCraftCount = (state: CampaignState): number =>
  Object.values(state.entities.crafts).filter((c) => c.phase !== 'complete').length;

// ============================================================================
// CRAFT DESIGN SELECTORS
// ============================================================================

/**
 * Select all craft designs as a record
 */
export const selectCraftDesignsRecord = (state: CampaignState): Record<Id, CraftDesign> =>
  state.entities.craftDesigns;

/**
 * Select all craft designs as an array
 */
export const selectAllCraftDesigns = (state: CampaignState): CraftDesign[] =>
  Object.values(state.entities.craftDesigns);

/**
 * Select a craft design by ID
 */
export const selectCraftDesignById = (state: CampaignState, id: Id): CraftDesign | undefined =>
  state.entities.craftDesigns[id];

/**
 * Select craft design count
 */
export const selectCraftDesignCount = (state: CampaignState): number =>
  Object.keys(state.entities.craftDesigns).length;

// ============================================================================
// CUSTOM TEMPLATES SELECTORS
// ============================================================================

/**
 * Select all custom templates
 */
export const selectCustomTemplates = (state: CampaignState): CustomTemplates =>
  state.entities.customTemplates;

/**
 * Select custom templates by category
 */
export const selectCustomTemplatesByCategory = <K extends keyof CustomTemplates>(
  state: CampaignState,
  category: K
): CustomTemplates[K] => state.entities.customTemplates[category];

/**
 * Select weapon templates
 */
export const selectWeaponTemplates = (state: CampaignState): CustomTemplates['weapons'] =>
  state.entities.customTemplates.weapons;

/**
 * Select armor templates
 */
export const selectArmorTemplates = (state: CampaignState): CustomTemplates['armor'] =>
  state.entities.customTemplates.armor;

/**
 * Select ranged templates
 */
export const selectRangedTemplates = (state: CampaignState): CustomTemplates['ranged'] =>
  state.entities.customTemplates.ranged;

/**
 * Select explosives templates
 */
export const selectExplosivesTemplates = (state: CampaignState): CustomTemplates['explosives'] =>
  state.entities.customTemplates.explosives;

// ============================================================================
// UI STATE SELECTORS
// ============================================================================

/**
 * Select current crafting project ID from UI state
 */
export const selectCurrentCraftingProjectId = (state: CampaignState): string | null | undefined =>
  state.crafting.currentProject;

/**
 * Select current crafting project
 */
export const selectCurrentCraftingProject = (state: CampaignState): Craft | undefined => {
  const id = state.crafting.currentProject;
  return id ? state.entities.crafts[id] : undefined;
};
