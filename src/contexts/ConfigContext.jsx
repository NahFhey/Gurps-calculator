import { createContext, useContext, useMemo, useState } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';

/**
 * Context for configuration (workers, kitchens, cooking, and GM settings)
 *
 * MIGRATION NOTE: This context now bridges to CampaignStore. Workers are now
 * stored as Characters in the unified state, but this context exposes them
 * with the legacy "workers" API for backward compatibility.
 *
 * @typedef {Object} ConfigContextValue
 * @property {Array} workers - Available workers with skills (mapped from characters)
 * @property {Array} recipes - Cooking recipes
 * @property {Array} kitchens - Available kitchens
 * @property {Array} cookingSkills - Cooking skill definitions
 * @property {Object} effectFamilyMap - Effect family mappings
 * @property {boolean} gmMode - GM mode enabled/disabled
 * @property {Object} gmLockData - GM lock data for encrypted imports
 * @property {Function} saveWorkers - Save workers to storage
 * @property {Function} saveRecipes - Save recipes to storage
 * @property {Function} saveKitchens - Save kitchens to storage
 * @property {Function} saveCookingSkills - Save cooking skills to storage
 * @property {Function} saveEffectFamilyMap - Save effect family map
 * @property {Function} setGmMode - Set GM mode
 * @property {Function} setGmLockData - Set GM lock data
 */

const ConfigContext = createContext(null);

/**
 * Config Provider - Bridges CampaignStore to legacy API
 */
export function ConfigProvider({ children }) {
  const { state, actions } = useCampaignStore();

  // GM state managed locally until fully migrated to CampaignStore
  const [localGmMode, setLocalGmMode] = useState(state.ui.gmModeEnabled);
  const [gmLockData, setGmLockData] = useState(null);

  const value = useMemo(() => {
    // Convert characters to legacy "workers" format
    const workers = Object.values(state.entities.characters).map((character) => ({
      id: character.id,
      name: character.name,
      skills: character.work?.skills || {},
      st: character.st
    }));

    const recipes = denormalizeObject(state.entities.recipes);
    const kitchens = denormalizeObject(state.entities.kitchens);

    return {
      // Workers (mapped from characters)
      workers,
      saveWorkers: (workersArray) => {
        // Convert workers to characters format
        const characters = {};
        workersArray.forEach((worker) => {
          characters[worker.id] = {
            id: worker.id,
            name: worker.name,
            isPlayer: false,
            work: {
              enabled: true,
              skills: worker.skills || {}
            },
            st: worker.st
          };
        });
        actions.setCharacters(characters);
      },

      // Recipes
      recipes,
      saveRecipes: (recipesArray) => {
        actions.setRecipes(normalizeArray(recipesArray));
      },

      // Kitchens
      kitchens,
      saveKitchens: (kitchensArray) => {
        actions.setKitchens(normalizeArray(kitchensArray));
      },

      // Cooking Skills
      cookingSkills: state.entities.cookingSkills,
      saveCookingSkills: (skills) => {
        actions.setCookingSkills(skills);
      },

      // Effect Family Map
      effectFamilyMap: state.entities.effectFamilyMap,
      saveEffectFamilyMap: (map) => {
        actions.setEffectFamilyMap(map);
      },

      // GM Mode (will eventually use state.ui.gmModeEnabled)
      gmMode: localGmMode,
      setGmMode: (enabled) => {
        setLocalGmMode(enabled);
        if (enabled) {
          actions.toggleGmMode();
        }
      },

      // GM Lock Data (local state)
      gmLockData,
      setGmLockData
    };
  }, [
    state.entities.characters,
    state.entities.recipes,
    state.entities.kitchens,
    state.entities.cookingSkills,
    state.entities.effectFamilyMap,
    localGmMode,
    gmLockData,
    actions
  ]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/**
 * Hook to access config context
 * @returns {ConfigContextValue}
 * @throws {Error} If used outside of ConfigProvider
 */
export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

export default ConfigContext;
