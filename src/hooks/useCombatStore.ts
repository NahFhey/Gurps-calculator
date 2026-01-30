/**
 * useCombatStore Hook
 *
 * Provides access to combat state and actions from the campaign store.
 * This hook replaces the legacy CombatContext with direct store access.
 */

import { useMemo, useRef, useEffect } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';
import type { CombatCharacter, CombatSession, CombatItem, Character } from '../types/campaign';

/**
 * Hook to access combat state and actions from the campaign store.
 * Provides the same interface as the legacy CombatContext for easy migration.
 */
export function useCombatStore() {
  const { state, actions } = useCampaignStore();

  // Use a ref to always have access to the current session for functional updates
  const sessionRef = useRef(state.combat.activeSession);
  useEffect(() => {
    sessionRef.current = state.combat.activeSession;
  }, [state.combat.activeSession]);

  return useMemo(() => {
    // Convert normalized objects to arrays for legacy API compatibility
    const combatCharacters = denormalizeObject(state.entities.combatCharacters) as CombatCharacter[];
    const combatItems = denormalizeObject(state.entities.combatItems) as CombatItem[];
    const partyCharacters = denormalizeObject(state.entities.characters) as Character[];

    return {
      // ====================================================================
      // STATE (read-only)
      // ====================================================================

      /** Combat character library as array */
      combatCharacters,

      /** Party characters (from entities.characters) for combat integration */
      partyCharacters,

      /** Active combat session */
      combatActive: state.combat.activeSession,

      /** Past combat sessions */
      combatHistory: state.entities.combatHistory,

      /** Deleted characters referenced by history */
      combatTombstones: state.entities.combatTombstones,

      /** Combat rules preset */
      combatRulesPreset: state.combat.rulesPreset,

      /** Reveal state for GM mode */
      combatReveal: state.combat.reveal,

      /** Combat items inventory as array */
      combatItems,

      // ====================================================================
      // ACTIONS
      // ====================================================================

      /**
       * Save combat characters to storage.
       * Accepts an array and normalizes it internally.
       */
      saveCombatCharacters: (charactersArray: CombatCharacter[]) => {
        actions.setCombatCharacters(normalizeArray(charactersArray));
      },

      /**
       * Save active combat session.
       * Supports both direct values and functional updates.
       */
      saveCombatActive: (sessionOrUpdater: CombatSession | null | ((prev: CombatSession | null) => CombatSession | null)) => {
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

      /**
       * Save combat history.
       */
      saveCombatHistory: (history: CombatSession[]) => {
        actions.setCombatHistory(history);
      },

      /**
       * Save combat tombstones.
       */
      saveCombatTombstones: (tombstones: CombatCharacter[]) => {
        actions.setCombatTombstones(tombstones);
      },

      /**
       * Save combat rules preset.
       */
      saveCombatRulesPreset: (preset: string) => {
        actions.setCombatRulesPreset(preset);
      },

      /**
       * Save combat items to storage.
       * Accepts an array and normalizes it internally.
       */
      saveCombatItems: (itemsArray: CombatItem[]) => {
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
}
