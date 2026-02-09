/**
 * State Selectors
 *
 * Re-exports all domain-specific selectors for convenient importing.
 *
 * Usage:
 *   import { selectAllCharacters, selectCurrentLocation } from '../state/selectors';
 */

// Character selectors
export {
  selectCharactersRecord,
  selectAllCharacters,
  selectCharacterById,
  selectCharacterIds,
  selectCharacterCount,
  selectPlayerCharacters,
  selectNpcCharacters,
  selectWorkEnabledCharacters,
  selectCharactersBySkill,
  selectSelectedCharacterId,
  selectSelectedCharacter,
  selectCharacterPanelView,
  selectCharacterSkillLevel,
  selectCharacterExists
} from './characterSelectors';

// Inventory selectors
export {
  // Materials
  selectMaterialsRecord,
  selectAllMaterials,
  selectMaterialById,
  selectMaterialsByType,
  selectMaterialQuantityByType,
  // Foods
  selectFoodsRecord,
  selectAllFoods,
  selectFoodById,
  selectFoodsByType,
  selectFoodQuantityByType,
  // Recipes
  selectRecipesRecord,
  selectAllRecipes,
  selectRecipeById,
  selectRecipesBySkill,
  // Types
  selectFoodTypes,
  selectFoodTypeByName,
  selectMaterialTypes,
  selectMaterialTypeByName,
  // Inventory entities
  selectInventoriesRecord,
  selectAllInventories,
  selectInventoryById,
  selectInventoryByOwner,
  selectCharacterInventory,
  selectPartyInventory,
  // UI state
  selectInventoryActiveTab
} from './inventorySelectors';

// Gathering selectors
export {
  // Species
  selectGatheringSpeciesRecord,
  selectAllGatheringSpecies,
  selectGatheringSpeciesById,
  // Tools
  selectGatheringToolsRecord,
  selectAllGatheringTools,
  selectGatheringToolById,
  // Tables
  selectGatheringTablesRecord,
  selectAllGatheringTables,
  selectGatheringTableById,
  // Environments
  selectGatheringEnvironmentsRecord,
  selectAllGatheringEnvironments,
  selectGatheringEnvironmentById,
  // Sessions
  selectGatheringSessionsRecord,
  selectAllGatheringSessions,
  selectGatheringSessionById,
  selectActiveGatheringSessionId,
  selectActiveGatheringSession,
  // Bait
  selectGatheringBaitRecord,
  selectAllGatheringBait,
  selectGatheringBaitById,
  // Categories
  selectGatheringCategoriesRecord,
  selectAllGatheringCategories,
  selectGatheringCategoryById,
  // Items
  selectGatheringItemsRecord,
  selectAllGatheringItems,
  selectGatheringItemById,
  // Daily events
  selectGatheringDailyEvents
} from './gatheringSelectors';

// Alchemy selectors
export {
  // Reagents
  selectAlchemyReagentsRecord,
  selectAllAlchemyReagents,
  selectAlchemyReagentById,
  selectAlchemyReagentCount,
  // Formulas
  selectAlchemyFormulasRecord,
  selectAllAlchemyFormulas,
  selectAlchemyFormulaById,
  selectAlchemyFormulaCount,
  // Batches
  selectAlchemyBatchesRecord,
  selectAllAlchemyBatches,
  selectAlchemyBatchById,
  selectActiveAlchemyBatchId,
  selectActiveAlchemyBatch,
  selectAlchemyBatchCount,
  // Labs
  selectAlchemyLabsRecord,
  selectAllAlchemyLabs,
  selectAlchemyLabById,
  selectDefaultAlchemyLab,
  // Settings
  selectAlchemySettings,
  selectDefaultLabRating,
  selectWorkBlockMinutes
} from './alchemySelectors';

// Crafting selectors
export {
  // Crafts
  selectCraftsRecord,
  selectAllCrafts,
  selectCraftById,
  selectCraftsByPhase,
  selectActiveCrafts,
  selectCompletedCrafts,
  selectCraftCount,
  selectActiveCraftCount,
  // Craft designs
  selectCraftDesignsRecord,
  selectAllCraftDesigns,
  selectCraftDesignById,
  selectCraftDesignCount,
  // Custom templates
  selectCustomTemplates,
  selectCustomTemplatesByCategory,
  selectWeaponTemplates,
  selectArmorTemplates,
  selectRangedTemplates,
  selectExplosivesTemplates,
  // UI state
  selectCurrentCraftingProjectId,
  selectCurrentCraftingProject
} from './craftingSelectors';

// Combat selectors
export {
  // Combat characters
  selectCombatCharactersRecord,
  selectAllCombatCharacters,
  selectCombatCharacterById,
  selectCombatCharacterCount,
  // Combat items
  selectCombatItemsRecord,
  selectAllCombatItems,
  selectCombatItemById,
  // Combat session
  selectIsCombatActive,
  selectCombatEncounterId,
  selectActiveCombatSession,
  selectCombatRulesPreset,
  // Combat history
  selectCombatHistory,
  selectCombatTombstones,
  selectCombatHistoryCount,
  // Combat reveal
  selectRevealedTargets,
  selectRevealedHP,
  selectRevealedDefenseValues,
  selectIsTargetRevealed,
  selectIsHPRevealed,
  selectDefenseValuesForTarget
} from './combatSelectors';

// Location selectors
export {
  // Locations state
  selectLocationsState,
  selectLocationsRecord,
  selectAllLocations,
  selectLocationById,
  selectCurrentLocationId,
  selectCurrentLocation,
  selectLocationCount,
  // Weather
  selectCurrentWeather,
  selectWeatherForLocation,
  // Weather tables
  selectWeatherTablesRecord,
  selectAllWeatherTables,
  selectWeatherTableById,
  selectWeatherTableForLocation,
  // Travel
  selectActiveTravels,
  selectTravelById,
  selectTravelsByDestination,
  selectTravelsByOrigin,
  selectActiveTravelCount,
  selectIsPartyTraveling
} from './locationSelectors';
