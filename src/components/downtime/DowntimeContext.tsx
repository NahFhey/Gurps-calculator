/**
 * Downtime Context
 *
 * Provides downtime state management and access to gathering data
 * for all downtime activity components.
 */

import React, { createContext, useContext, useReducer, useMemo, useEffect, useRef } from 'react';
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
import {
  validateBatchToolExclusivity,
  validateTaskCreation,
} from '../../state/downtime/downtimeValidation';
import type { ValidationResult } from '../../state/downtime/downtimeErrors';
import type { DowntimeState, TaskResults } from '../../types/downtime';
import type {
  Character,
  GatheringSpecies,
  GatheringTool,
  GatheringEnvironment,
  GatheringTable,
  GatheringBait,
  AlchemyReagent,
  AlchemyFormula,
  AlchemyBatch,
  AlchemyLab,
  Recipe,
  Material,
  Facility,
  LegacyCharacterSkillSource,
} from '../../types/campaign';
import type { ForageZoneProfile, ForageItem, ForagingConfig } from '../../types/foraging';
import type { GatheringItemExtended } from '../../types/gathering';
import { DEFAULT_FORAGING_CONFIG } from '../../constants/foraging';
import { selectAllMaterials } from '../../state/selectors/inventorySelectors';
import { isAttachmentReachable } from '../../utils/facilityAccess';

// ============================================================================
// CONTEXT TYPE DEFINITIONS
// ============================================================================

interface DowntimeContextValue {
  /** Current downtime state */
  state: DowntimeState;
  /** Dispatch function for downtime actions */
  dispatch: React.Dispatch<DowntimeAction>;
  /** All party characters */
  characters: Array<Character & LegacyCharacterSkillSource>;
  /** Available fishing spots (environments at current location with Fishing mode) */
  fishingSpots: GatheringEnvironment[];
  /** All fish species */
  fishSpecies: GatheringSpecies[];
  /** All gathering tools */
  tools: GatheringTool[];
  /** Available fishing bait */
  fishingBait: GatheringBait[];
  /** Available foraging biomes (environments at current location with Foraging mode) */
  foragingBiomes: GatheringEnvironment[];
  /** Foraging nodes (plant and game species) - legacy */
  foragingNodes: GatheringSpecies[];
  /** Gathering tables for loot resolution */
  gatheringTables: GatheringTable[];
  /** Forage zone profiles at current location (revamped foraging) */
  forageZones: ForageZoneProfile[];
  /** All forage items (revamped foraging) */
  forageItems: ForageItem[];
  /** Foraging configuration flags */
  foragingConfig: ForagingConfig;
  /** Gathering items from the Items tab for per-item zone profile selection */
  gatheringItems: GatheringItemExtended[];
  /** Alchemy reagents */
  alchemyReagents: AlchemyReagent[];
  /** Alchemy formulas (saved recipes) */
  alchemyFormulas: AlchemyFormula[];
  /** Alchemy batches (active and completed) */
  alchemyBatches: AlchemyBatch[];
  /** Alchemy labs */
  alchemyLabs: AlchemyLab[];
  /** Crafting recipes */
  craftingRecipes: Recipe[];
  /** Materials for crafting */
  craftingMaterials: Material[];
  /** Crafting workshops */
  craftingWorkshops: Facility[];
  /** Current location ID from weather/location system */
  currentLocationId: string | null;
  /** Current location name for display */
  currentLocationName: string | null;
  /** Current day key */
  currentDayKey: number;
  /** Current time slot */
  currentSlot: number;
  /** Convenience action: create a task */
  createDowntimeTask: (payload: CreateTaskPayload) => void;
  /** Validate and atomically create a batch of normal single-leader tasks. */
  createDowntimeTasksBatch: (payloads: CreateTaskPayload[]) => ValidationResult[];
  /** Convenience action: begin resolving a task */
  beginResolve: (taskId: string) => void;
  /** Convenience action: resolve a task with results */
  resolve: (taskId: string, results: TaskResults) => void;
  /** Convenience action: cancel a task */
  cancel: (taskId: string) => void;
  /** Add a forage zone profile */
  addForageZoneProfile: (zone: ForageZoneProfile) => void;
  /** Update a forage zone profile */
  updateForageZoneProfile: (id: string, changes: Partial<ForageZoneProfile>) => void;
  /** Remove a forage zone profile */
  removeForageZoneProfile: (id: string) => void;
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
  const { state: campaignState, actions: campaignActions } = useCampaignStore();

  // Use local reducer for downtime state
  // Initial state comes from campaign store
  const [state, dispatch] = useReducer(
    downtimeReducer,
    campaignState.downtime
  );

  // Sync local downtime state back to campaign store
  // so that the party panel (which reads from campaign store) sees task assignments.
  // Use a ref guard to skip no-op dispatches (e.g., during StrictMode double-renders).
  const prevDowntimeStateRef = useRef(state);
  useEffect(() => {
    if (prevDowntimeStateRef.current !== state) {
      prevDowntimeStateRef.current = state;
      campaignActions.setDowntime(state);
    }
  }, [state, campaignActions]);

  // Extract characters from campaign state (with null safety)
  const characters = useMemo(
    () => Object.values(campaignState.entities?.characters ?? {}),
    [campaignState.entities?.characters]
  );

  // Get current location from weather/location system
  const currentLocationId = campaignState.locations?.currentLocationId ?? null;
  const currentLocationName = useMemo(() => {
    if (!currentLocationId) return null;
    const loc = campaignState.locations?.locations?.[currentLocationId];
    return loc?.name ?? null;
  }, [currentLocationId, campaignState.locations?.locations]);

  // Extract fishing spots: only environments linked to current location with Fishing mode
  const fishingSpots = useMemo(() => {
    if (!currentLocationId) return [];
    const allEnvs = Object.values(campaignState.entities?.gatheringEnvironments ?? {});
    return allEnvs.filter(
      (e) =>
        (e as any).locationId === currentLocationId &&
        (e.supportedModes?.includes('Fishing') ?? false)
    );
  }, [campaignState.entities?.gatheringEnvironments, currentLocationId]);

  // Extract fish species (filter by fish-related types)
  // Note: GatheringSpeciesExtended uses 'type' field, not 'category'
  const fishSpecies = useMemo(() => {
    const species = Object.values(campaignState.entities?.gatheringSpecies ?? {});
    return species.filter((s) => {
      // Check both 'type' (modern) and 'category' (legacy saves) for compatibility
      return (
        s.type === 'fish' ||
        s.type === 'shellfish' ||
        s.type === 'crustacean' ||
        s.category === 'fish'
      );
    });
  }, [campaignState.entities?.gatheringSpecies]);

  // Extract tools
  const tools = useMemo(
    () => Object.values(campaignState.entities?.gatheringTools ?? {}),
    [campaignState.entities?.gatheringTools]
  );

  // Extract fishing bait (filter to items with quantity > 0)
  const fishingBait = useMemo(() => {
    const bait = Object.values(campaignState.entities?.gatheringBait ?? {});
    return bait.filter((b) => (b.quantity ?? 0) > 0);
  }, [campaignState.entities?.gatheringBait]);

  // Extract foraging biomes: only environments linked to current location with Foraging mode
  const foragingBiomes = useMemo(() => {
    if (!currentLocationId) return [];
    const allEnvs = Object.values(campaignState.entities?.gatheringEnvironments ?? {});
    return allEnvs.filter(
      (e) =>
        e.locationId === currentLocationId &&
        (e.supportedModes?.includes('Foraging') ?? false)
    );
  }, [campaignState.entities?.gatheringEnvironments, currentLocationId]);

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

  // Extract forage zone profiles at current location (revamped foraging)
  const forageZones = useMemo(() => {
    if (!currentLocationId) return [];
    return Object.values(campaignState.entities?.forageZoneProfiles ?? {}).filter(
      (z) => z.locationId === currentLocationId
    );
  }, [campaignState.entities?.forageZoneProfiles, currentLocationId]);

  // Extract all forage items (revamped foraging)
  const forageItems = useMemo(
    () => Object.values(campaignState.entities?.forageItems ?? {}),
    [campaignState.entities?.forageItems]
  );

  // Extract foraging config
  const foragingConfig = useMemo(
    () => campaignState.entities?.foragingConfig ?? DEFAULT_FORAGING_CONFIG,
    [campaignState.entities?.foragingConfig]
  );

  // Extract gathering items (from Items tab) for per-item zone profile selection
  const gatheringItems = useMemo(
    () => Object.values(campaignState.entities?.gatheringItems ?? {}) as unknown as GatheringItemExtended[],
    [campaignState.entities?.gatheringItems]
  );

  // Extract alchemy reagents
  const alchemyReagents = useMemo(
    () => Object.values(campaignState.entities?.alchemyReagents ?? {}),
    [campaignState.entities?.alchemyReagents]
  );

  // Extract alchemy formulas
  const alchemyFormulas = useMemo(
    () => Object.values(campaignState.entities?.alchemyFormulas ?? {}),
    [campaignState.entities?.alchemyFormulas]
  );

  // Extract alchemy batches
  const alchemyBatches = useMemo(
    () => Object.values(campaignState.entities?.alchemyBatches ?? {}),
    [campaignState.entities?.alchemyBatches]
  );

  // Extract alchemy labs
  const alchemyLabs = useMemo(
    () => Object.values(campaignState.entities?.alchemyLabs ?? {}),
    [campaignState.entities?.alchemyLabs]
  );

  // Extract crafting recipes
  const craftingRecipes = useMemo(
    () => Object.values(campaignState.entities?.recipes ?? {}),
    [campaignState.entities?.recipes]
  );

  // Extract crafting materials
  const craftingMaterials = useMemo(
    () => selectAllMaterials(campaignState),
    [campaignState]
  );

  // Extract crafting workshops (facilities with type 'workshop')
  const craftingWorkshops = useMemo(() => {
    const facilities = Object.values(campaignState.entities?.facilities ?? {});
    const leaderId = campaignState.entities.travelGroups?.[campaignState.ui.activeTravelGroupId ?? '']?.memberIds[0] ?? '';
    return facilities.filter((f) => f.facilityType === 'workshop'
      && isAttachmentReachable(campaignState, f.attachment, leaderId));
  }, [campaignState]);

  // Get current time from campaign state
  const currentDayKey = dayKeyOverride ?? campaignState.time?.day ?? 1;
  const currentSlot = slotOverride ?? campaignState.dayPlanner?.currentSlot ?? 0;

  // Create convenience action functions
  const createDowntimeTask = (payload: CreateTaskPayload) => {
    dispatch(createTask(payload));
  };

  const createDowntimeTasksBatch = (payloads: CreateTaskPayload[]): ValidationResult[] => {
    const intraBatchResults = validateBatchToolExclusivity(payloads);
    const results = payloads.map((payload, index) => {
      const stateResult = validateTaskCreation(state, payload);
      return stateResult.valid ? intraBatchResults[index] : stateResult;
    });

    if (results.some((result) => !result.valid)) {
      return results;
    }

    for (const payload of payloads) {
      dispatch(createTask(payload));
    }

    return results;
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

  const addForageZoneProfile = (zone: ForageZoneProfile) => {
    campaignActions.addForageZoneProfile(zone);
  };

  const updateForageZoneProfile = (id: string, changes: Partial<ForageZoneProfile>) => {
    campaignActions.updateForageZoneProfile(id, changes);
  };

  const removeForageZoneProfile = (id: string) => {
    campaignActions.removeForageZoneProfile(id);
  };

  const value = useMemo(
    () => ({
      state,
      dispatch,
      characters,
      fishingSpots,
      fishSpecies,
      tools,
      fishingBait,
      foragingBiomes,
      foragingNodes,
      gatheringTables,
      forageZones,
      forageItems,
      foragingConfig,
      gatheringItems,
      alchemyReagents,
      alchemyFormulas,
      alchemyBatches,
      alchemyLabs,
      craftingRecipes,
      craftingMaterials,
      craftingWorkshops,
      currentLocationId,
      currentLocationName,
      currentDayKey,
      currentSlot,
      createDowntimeTask,
      createDowntimeTasksBatch,
      beginResolve,
      resolve,
      cancel,
      addForageZoneProfile,
      updateForageZoneProfile,
      removeForageZoneProfile,
    }),
    [
      state,
      characters,
      fishingSpots,
      fishSpecies,
      tools,
      fishingBait,
      foragingBiomes,
      foragingNodes,
      gatheringTables,
      forageZones,
      forageItems,
      foragingConfig,
      gatheringItems,
      alchemyReagents,
      alchemyFormulas,
      alchemyBatches,
      alchemyLabs,
      craftingRecipes,
      craftingMaterials,
      craftingWorkshops,
      currentLocationId,
      currentLocationName,
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

/** Returns the context when a form is mounted below a provider. */
export function useOptionalDowntimeContext(): DowntimeContextValue | undefined {
  return useContext(DowntimeContext);
}
