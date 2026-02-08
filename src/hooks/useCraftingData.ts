/**
 * useCraftingData Hook
 *
 * Shared hook that provides crafting data derivation and save callbacks.
 * Extracted from CraftingTab to be reused by the Downtime CraftingActivity.
 *
 * Handles:
 * - Denormalization of crafting entities from the campaign store
 * - Worker derivation from characters
 * - Save callbacks with normalization
 * - Weather modifier integration
 */

import { useMemo, useCallback } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';
import { useWeatherModifiers } from './useWeatherModifiers';
import type {
  Craft,
  CraftDesign,
  Material,
  MaterialType,
  CustomTemplates,
} from '../types/campaign';

// ============================================================================
// Types
// ============================================================================

export interface CraftingWorker {
  id: string;
  name: string;
  skills: Record<string, number>;
  st?: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useCraftingData() {
  const { state, actions } = useCampaignStore();

  // Get weather modifiers for crafting
  const weatherResult = useWeatherModifiers('crafting');

  // Derive data from normalized state
  const materials = useMemo(() =>
    denormalizeObject(state.entities.materials) as Material[],
    [state.entities.materials]
  );

  const materialTypes = (state.entities.materialTypes ?? []) as MaterialType[];

  const crafts = useMemo(() =>
    denormalizeObject(state.entities.crafts) as Craft[],
    [state.entities.crafts]
  );

  const craftDesigns = useMemo(() =>
    denormalizeObject(state.entities.craftDesigns) as CraftDesign[],
    [state.entities.craftDesigns]
  );

  const customTemplates = (state.entities.customTemplates ?? {
    weapons: {},
    armor: {},
    ranged: {},
    explosives: {},
  }) as CustomTemplates;

  // Derive workers from characters (same pattern as CraftingTab / AlchemyTab)
  const workers = useMemo(() =>
    Object.values(state.entities.characters).map((character: any) => ({
      id: character.id,
      name: character.name,
      skills: character.work?.skills || {},
      st: character.st
    })) as CraftingWorker[],
    [state.entities.characters]
  );

  // Save callbacks that normalize arrays back to records
  const saveMaterials = useCallback((materialsArray: Material[]) => {
    actions.setMaterials(normalizeArray(materialsArray));
  }, [actions]);

  const saveCrafts = useCallback((craftsArray: Craft[]) => {
    actions.setCrafts(normalizeArray(craftsArray));
  }, [actions]);

  const saveCraftDesigns = useCallback((designsArray: CraftDesign[]) => {
    actions.setCraftDesigns(normalizeArray(designsArray));
  }, [actions]);

  // Expose addLogEntry for activity logging
  const addLogEntry = useCallback((entry: any) => {
    actions.addLogEntry(entry);
  }, [actions]);

  // Computed values
  const activeCraftCount = crafts.filter(c => !c.completed).length;
  const designCount = (craftDesigns ?? []).length;

  return {
    materials,
    materialTypes,
    crafts,
    craftDesigns,
    customTemplates,
    workers,
    saveMaterials,
    saveCrafts,
    saveCraftDesigns,
    addLogEntry,
    activeCraftCount,
    designCount,
    weather: {
      hasEffect: weatherResult.hasEffect,
      effectDescription: weatherResult.effectDescription,
      locationName: weatherResult.locationName,
      skillBonus: weatherResult.skillBonus,
    },
  };
}
