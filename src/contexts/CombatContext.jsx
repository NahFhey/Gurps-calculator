import { createContext, useContext } from 'react';

const CombatContext = createContext(null);

export function useCombat() {
  const context = useContext(CombatContext);
  if (!context) {
    throw new Error('useCombat must be used within a CombatContext.Provider');
  }
  return context;
}

export default CombatContext;
