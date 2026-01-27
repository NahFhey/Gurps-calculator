import { createContext, useContext, useMemo, useRef, useEffect } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';

/**
 * Context for combat system (characters, sessions, and combat state)
 *
 * MIGRATION NOTE: This context now bridges to CampaignStore while maintaining
 * backward compatibility with the legacy API.
 *
 * @typedef {Object} CombatContextValue
 * @property {Array} characters - Combat character library
 * @property {Array} partyCharacters - Party characters (from entities.characters)
 * @property {Object} combatActive - Active combat session
 * @property {Object} combatActiveHistory - Undo/redo history for active combat
 * @property {Array} combatHistory - Past combat sessions
 * @property {Array} combatTombstones - Deleted characters referenced by history
 * @property {string} combatRulesPreset - Combat rules preset
 * @property {Object} combatReveal - Reveal state for GM mode
 * @property {Array} combatItems - Combat items inventory
 * @property {Function} saveCombatCharacters - Save characters to storage
 * @property {Function} saveCombatActive - Save active combat to storage
 * @property {Function} saveCombatActiveHistory - Save combat history to storage
 * @property {Function} saveCombatHistory - Save past sessions to storage
 * @property {Function} saveCombatTombstones - Save tombstones to storage
 * @property {Function} saveCombatRulesPreset - Save rules preset to storage
 * @property {Function} saveCombatReveal - Save reveal state to storage
 * @property {Function} saveCombatItems - Save combat items to storage
 */

const CombatContext = createContext(null);

/**
 * Combat Provider - Bridges CampaignStore to legacy API
 */
export function CombatProvider({ children }) {
  const { state, actions } = useCampaignStore();

  // Use a ref to always have access to the current session for functional updates
  const sessionRef = useRef(state.combat.activeSession);
  useEffect(() => {
    sessionRef.current = state.combat.activeSession;
  }, [state.combat.activeSession]);

  const value = useMemo(() => {
    // Convert normalized objects back to arrays for legacy API
    const combatCharacters = denormalizeObject(state.entities.combatCharacters);
    const combatItems = denormalizeObject(state.entities.combatItems);

    // Get party characters (from entities.characters) for combat integration
    const partyCharacters = denormalizeObject(state.entities.characters);

    return {
      // Characters
      combatCharacters,
      saveCombatCharacters: (charactersArray) => {
        actions.setCombatCharacters(normalizeArray(charactersArray));
      },

      // Party Characters (read-only, for combat integration)
      partyCharacters,

      // Active Combat
      combatActive: state.combat.activeSession,
      saveCombatActive: (sessionOrUpdater) => {
        // Support both direct values and functional updates
        if (typeof sessionOrUpdater === 'function') {
          // Use ref to get the latest session value (avoids stale closure issues)
          const currentSession = sessionRef.current;
          const newSession = sessionOrUpdater(currentSession);
          actions.setCombatActive(newSession);
          // Update ref immediately so subsequent calls in same tick get fresh value
          sessionRef.current = newSession;
        } else {
          actions.setCombatActive(sessionOrUpdater);
          // Update ref immediately for functional updates that follow
          sessionRef.current = sessionOrUpdater;
        }
      },

      // Combat History (legacy - stored in entities now)
      combatActiveHistory: null, // Deprecated in favor of checkpoints
      saveCombatActiveHistory: (history) => {
        console.warn('saveCombatActiveHistory deprecated - use checkpoints instead');
      },

      combatHistory: state.entities.combatHistory,
      saveCombatHistory: (history) => {
        actions.setCombatHistory(history);
      },

      combatTombstones: state.entities.combatTombstones,
      saveCombatTombstones: (tombstones) => {
        actions.setCombatTombstones(tombstones);
      },

      // Rules & Settings
      combatRulesPreset: state.combat.rulesPreset,
      saveCombatRulesPreset: (preset) => {
        actions.setCombatRulesPreset(preset);
      },

      // Reveal State (GM mode)
      combatReveal: state.combat.reveal,
      saveCombatReveal: (reveal) => {
        // Reveal state is managed through specific actions
        console.warn('saveCombatReveal deprecated - use registerCombatDamage/registerCombatDefenseSuccess');
      },

      // Combat Items
      combatItems,
      saveCombatItems: (itemsArray) => {
        actions.setCombatItems(normalizeArray(itemsArray));
      }
    };
  }, [
    state.entities.combatCharacters,
    state.entities.characters,
    state.combat.activeSession,
    state.entities.combatHistory,
    state.entities.combatTombstones,
    state.combat.rulesPreset,
    state.combat.reveal,
    state.entities.combatItems,
    actions
  ]);

  return <CombatContext.Provider value={value}>{children}</CombatContext.Provider>;
}

/**
 * Hook to access combat context
 * @returns {CombatContextValue}
 * @throws {Error} If used outside of CombatProvider
 */
export function useCombat() {
  const context = useContext(CombatContext);
  if (!context) {
    throw new Error('useCombat must be used within a CombatProvider');
  }
  return context;
}

export default CombatContext;
