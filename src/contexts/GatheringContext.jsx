import { createContext, useContext } from 'react';

/**
 * Context for gathering system (fishing, foraging, and day planner)
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
