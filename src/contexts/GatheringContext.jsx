import { createContext, useContext, useMemo } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';
import { gatheringLog } from '../utils/activityLogger';
import { getCurrentWeather, getCurrentLocation } from '../utils/weatherSystem';

/**
 * Context for gathering system (fishing, foraging, and day planner)
 *
 * MIGRATION NOTE: This context now bridges to CampaignStore while maintaining
 * backward compatibility with the legacy API.
 *
 * @typedef {Object} GatheringContextValue
 * @property {Array} gatheringSpecies - Available fish/creature species
 * @property {Array} gatheringTools - Available gathering tools
 * @property {Array} gatheringTables - Loot/result tables
 * @property {Array} gatheringEnvironments - Gathering environments
 * @property {Array} gatheringSessions - Historical gathering sessions
 * @property {Object} gatheringDailyEvents - Daily events by day
 * @property {Array} gatheringBait - Available bait types
 * @property {Array} gatheringCategories - Foraging categories
 * @property {Array} gatheringItems - Forageable items
 * @property {number} currentDay - Current campaign day
 * @property {Array} timeSlots - Day planner time slots
 * @property {Array} taskAssignments - Task assignments for time slots
 * @property {Object} pendingDayLedger - Pending results for current day
 * @property {number} currentSlot - Current active time slot (0-2)
 * @property {Function} saveGatheringSpecies - Save species to storage
 * @property {Function} saveGatheringTools - Save tools to storage
 * @property {Function} saveGatheringTables - Save tables to storage
 * @property {Function} saveGatheringEnvironments - Save environments to storage
 * @property {Function} saveGatheringSessions - Save sessions to storage
 * @property {Function} saveGatheringDailyEvents - Save daily events to storage
 * @property {Function} saveGatheringBait - Save bait to storage
 * @property {Function} saveGatheringCategories - Save categories to storage
 * @property {Function} saveGatheringItems - Save items to storage
 * @property {Function} saveCurrentDay - Save current day to storage
 * @property {Function} saveTimeSlots - Save time slots to storage
 * @property {Function} saveTaskAssignments - Save task assignments to storage
 * @property {Function} savePendingDayLedger - Save pending ledger to storage
 * @property {Function} saveCurrentSlot - Save current slot to storage
 */

const GatheringContext = createContext(null);

/**
 * Gathering Provider - Bridges CampaignStore to legacy API
 */
export function GatheringProvider({ children }) {
  const { state, actions } = useCampaignStore();

  const value = useMemo(() => {
    // Convert normalized objects back to arrays for legacy API
    const gatheringSpecies = denormalizeObject(state.entities.gatheringSpecies);
    const gatheringTools = denormalizeObject(state.entities.gatheringTools);
    const gatheringTables = denormalizeObject(state.entities.gatheringTables);
    const gatheringEnvironments = denormalizeObject(state.entities.gatheringEnvironments);
    const gatheringSessions = denormalizeObject(state.entities.gatheringSessions);
    const gatheringBait = denormalizeObject(state.entities.gatheringBait);
    const gatheringCategories = denormalizeObject(state.entities.gatheringCategories);
    const gatheringItems = denormalizeObject(state.entities.gatheringItems);

    return {
      // Species
      gatheringSpecies,
      saveGatheringSpecies: (speciesArray) => {
        actions.setGatheringSpecies(normalizeArray(speciesArray));
      },

      // Tools
      gatheringTools,
      saveGatheringTools: (toolsArray) => {
        actions.setGatheringTools(normalizeArray(toolsArray));
      },

      // Tables
      gatheringTables,
      saveGatheringTables: (tablesArray) => {
        actions.setGatheringTables(normalizeArray(tablesArray));
      },

      // Environments
      gatheringEnvironments,
      saveGatheringEnvironments: (environmentsArray) => {
        actions.setGatheringEnvironments(normalizeArray(environmentsArray));
      },

      // Sessions
      gatheringSessions,
      saveGatheringSessions: (sessionsArray) => {
        actions.setGatheringSessions(normalizeArray(sessionsArray));
      },

      // Daily Events (already an object)
      gatheringDailyEvents: state.entities.gatheringDailyEvents,
      saveGatheringDailyEvents: (events) => {
        actions.setGatheringDailyEvents(events);
      },

      // Bait
      gatheringBait,
      saveGatheringBait: (baitArray) => {
        actions.setGatheringBait(normalizeArray(baitArray));
      },

      // Categories
      gatheringCategories,
      saveGatheringCategories: (categoriesArray) => {
        actions.setGatheringCategories(normalizeArray(categoriesArray));
      },

      // Items
      gatheringItems,
      saveGatheringItems: (itemsArray) => {
        actions.setGatheringItems(normalizeArray(itemsArray));
      },

      // Time tracking (from time state)
      currentDay: state.time.day,
      saveCurrentDay: (day) => {
        // Will need to add a setCurrentDay action or use existing time mutations
        // For now, this maintains compatibility
        console.warn('saveCurrentDay deprecated - use time.day from CampaignStore');
      },

      // Day Planner
      timeSlots: state.dayPlanner.timeSlots,
      saveTimeSlots: (slots) => {
        actions.setTimeSlots(slots);
      },

      taskAssignments: state.dayPlanner.taskAssignments,
      saveTaskAssignments: (assignments) => {
        actions.setTaskAssignments(assignments);
      },

      pendingDayLedger: state.dayPlanner.pendingDayLedger,
      savePendingDayLedger: (ledger) => {
        actions.setPendingDayLedger(ledger);
      },

      currentSlot: state.dayPlanner.currentSlot,
      saveCurrentSlot: (slot) => {
        // Update through dayPlanner state
        console.warn('saveCurrentSlot deprecated - use dayPlanner.currentSlot from CampaignStore');
      },

      // Logging support
      addLogEntry: actions.addLogEntry,
      gatheringLog,

      // Weather modifiers for gathering activities (Phase 5)
      weatherModifiers: (() => {
        const weather = getCurrentWeather(state.locations);
        const location = getCurrentLocation(state.locations);
        if (!weather || !location) return null;
        return {
          gathering: weather.effects.gathering + (location.modifiers?.gathering ?? 0),
          hunting: weather.effects.hunting + (location.modifiers?.hunting ?? 0),
          foraging: weather.effects.gathering + (location.modifiers?.foraging ?? 0),
          description: weather.description,
          locationName: location.name
        };
      })()
    };
  }, [
    state.entities.gatheringSpecies,
    state.entities.gatheringTools,
    state.entities.gatheringTables,
    state.entities.gatheringEnvironments,
    state.entities.gatheringSessions,
    state.entities.gatheringDailyEvents,
    state.entities.gatheringBait,
    state.entities.gatheringCategories,
    state.entities.gatheringItems,
    state.time.day,
    state.dayPlanner.timeSlots,
    state.dayPlanner.taskAssignments,
    state.dayPlanner.pendingDayLedger,
    state.dayPlanner.currentSlot,
    state.locations,
    actions
  ]);

  return <GatheringContext.Provider value={value}>{children}</GatheringContext.Provider>;
}

/**
 * Hook to access gathering context
 * @returns {GatheringContextValue}
 * @throws {Error} If used outside of GatheringProvider
 */
export function useGathering() {
  const context = useContext(GatheringContext);
  if (!context) {
    throw new Error('useGathering must be used within a GatheringProvider');
  }
  return context;
}

export default GatheringContext;
