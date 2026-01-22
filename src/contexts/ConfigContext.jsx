import { createContext, useContext } from 'react';

/**
 * Context for configuration (workers, kitchens, cooking, and GM settings)
 *
 * @typedef {Object} ConfigContextValue
 * @property {Array} workers - Available workers with skills
 * @property {Array} recipes - Cooking recipes
 * @property {Array} kitchens - Available kitchens
 * @property {Array} cookingSkills - Cooking skill definitions
 * @property {boolean} gmMode - GM mode enabled/disabled
 * @property {Object} gmLockData - GM lock data for encrypted imports
 * @property {Function} saveWorkers - Save workers to storage
 * @property {Function} saveRecipes - Save recipes to storage
 * @property {Function} saveKitchens - Save kitchens to storage
 * @property {Function} saveCookingSkills - Save cooking skills to storage
 * @property {Function} setGmMode - Set GM mode
 * @property {Function} setGmLockData - Set GM lock data
 */

const ConfigContext = createContext(null);

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
