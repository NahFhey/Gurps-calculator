/**
 * Downtime Context
 *
 * Provides downtime state management and access to gathering data
 * for all downtime activity components.
 */

import React, { createContext, useContext, useReducer, useMemo } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import {
  downtimeReducer,
  type DowntimeAction,
  type CreateTaskPayload,
  createTask,
  beginResolveTask,
  resolveTask,
  cancelTask,
} from '../../state/downtime';
import type { DowntimeState, TaskResults } from '../../types/downtime';
import type { Character, GatheringSpecies, GatheringTool, GatheringEnvironment, GatheringTable } from '../../types/campaign';

// ============================================================================
// CONTEXT TYPE DEFINITIONS
// ============================================================================

interface DowntimeContextValue {
  /** Current downtime state */
  state: DowntimeState;
  /** Dispatch function for downtime actions */
  dispatch: React.Dispatch<DowntimeAction>;
  /** All party characters */
  characters: Character[];
  /** Available fishing spots (environments with Fishing mode) */
  fishingSpots: GatheringEnvironment[];
  /** All fish species */
  fishSpecies: GatheringSpecies[];
  /** All gathering tools */
  tools: GatheringTool[];
  /** Available foraging biomes (all environments) */
  foragingBiomes: GatheringEnvironment[];
  /** Foraging nodes (plant and game species) */
  foragingNodes: GatheringSpecies[];
  /** Gathering tables for loot resolution */
  gatheringTables: GatheringTable[];
  /** Current day key */
  currentDayKey: number;
  /** Current time slot */
  currentSlot: number;
  /** Convenience action: create a task */
  createDowntimeTask: (payload: CreateTaskPayload) => void;
  /** Convenience action: begin resolving a task */
  beginResolve: (taskId: string) => void;
  /** Convenience action: resolve a task with results */
  resolve: (taskId: string, results: TaskResults) => void;
  /** Convenience action: cancel a task */
  cancel: (taskId: string) => void;
}

const DowntimeContext = createContext<DowntimeContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface DowntimeProviderProps {
  children: React.ReactNode;
  /** Optional override for current day (defaults to campaign state) */
  currentDayKey?: number;
  /** Optional override for current slot (defaults to campaign state) */
  currentSlot?: number;
}

/**
 * Provides downtime state and gathering data to child components.
 *
 * Uses the downtime reducer for state management and pulls
 * character/gathering data from the campaign store.
 */
export function DowntimeProvider({
  children,
  currentDayKey: dayKeyOverride,
  currentSlot: slotOverride,
}: DowntimeProviderProps) {
  const { state: campaignState } = useCampaignStore();

  // Use local reducer for downtime state
  // Initial state comes from campaign store
  const [state, dispatch] = useReducer(
    downtimeReducer,
    campaignState.downtime
  );

  // Extract characters from campaign state (with null safety)
  const characters = useMemo(
    () => Object.values(campaignState.entities?.characters ?? {}),
    [campaignState.entities?.characters]
  );

  // Extract fishing spots (all environments for now - can add filtering later)
  const fishingSpots = useMemo(
    () => Object.values(campaignState.entities?.gatheringEnvironments ?? {}),
    [campaignState.entities?.gatheringEnvironments]
  );

  // Extract fish species (filter by 'fish' category)
  const fishSpecies = useMemo(() => {
    const species = Object.values(campaignState.entities?.gatheringSpecies ?? {});
    return species.filter((s) => s.category === 'fish');
  }, [campaignState.entities?.gatheringSpecies]);

  // Extract tools
  const tools = useMemo(
    () => Object.values(campaignState.entities?.gatheringTools ?? {}),
    [campaignState.entities?.gatheringTools]
  );

  // Extract foraging biomes (all environments)
  const foragingBiomes = useMemo(
    () => Object.values(campaignState.entities?.gatheringEnvironments ?? {}),
    [campaignState.entities?.gatheringEnvironments]
  );

  // Extract foraging nodes (plant and game species)
  const foragingNodes = useMemo(() => {
    const species = Object.values(campaignState.entities?.gatheringSpecies ?? {});
    return species.filter((s) => s.category === 'plant' || s.category === 'game');
  }, [campaignState.entities?.gatheringSpecies]);

  // Extract gathering tables
  const gatheringTables = useMemo(
    () => Object.values(campaignState.entities?.gatheringTables ?? {}),
    [campaignState.entities?.gatheringTables]
  );

  // Get current time from campaign state
  const currentDayKey = dayKeyOverride ?? campaignState.time?.day ?? 1;
  const currentSlot = slotOverride ?? campaignState.dayPlanner?.currentSlot ?? 0;

  // Create convenience action functions
  const createDowntimeTask = (payload: CreateTaskPayload) => {
    dispatch(createTask(payload));
  };

  const beginResolve = (taskId: string) => {
    dispatch(beginResolveTask(taskId));
  };

  const resolve = (taskId: string, results: TaskResults) => {
    dispatch(resolveTask(taskId, results));
  };

  const cancel = (taskId: string) => {
    dispatch(cancelTask(taskId));
  };

  const value = useMemo(
    () => ({
      state,
      dispatch,
      characters,
      fishingSpots,
      fishSpecies,
      tools,
      foragingBiomes,
      foragingNodes,
      gatheringTables,
      currentDayKey,
      currentSlot,
      createDowntimeTask,
      beginResolve,
      resolve,
      cancel,
    }),
    [
      state,
      characters,
      fishingSpots,
      fishSpecies,
      tools,
      foragingBiomes,
      foragingNodes,
      gatheringTables,
      currentDayKey,
      currentSlot,
    ]
  );

  return (
    <DowntimeContext.Provider value={value}>
      {children}
    </DowntimeContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access downtime context.
 * Must be used within a DowntimeProvider.
 */
export function useDowntimeContext(): DowntimeContextValue {
  const context = useContext(DowntimeContext);
  if (!context) {
    throw new Error('useDowntimeContext must be used within a DowntimeProvider');
  }
  return context;
}
