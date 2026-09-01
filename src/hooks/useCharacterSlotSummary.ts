import { useMemo } from 'react';
import { useCampaignSelector } from '../state/campaignStore';
import type { CampaignState } from '../state/campaignReducer';
import {
  selectCharacterSlotSummary,
  selectAllCharacterSlotSummaries,
  type CharacterSlotSummary,
} from '../state/downtime/downtimeSelectors';

const selectDowntime = (state: CampaignState) => state.downtime;
const selectTimeDay = (state: CampaignState) => state.time?.day ?? 1;
const selectTimeSlot = (state: CampaignState) => state.time?.slot ?? 0;

/**
 * Hook to get character status for current slot.
 * Subscribes only to the downtime and time slices (Phase 15b).
 *
 * @param characterId - The character to get status for
 * @returns CharacterSlotSummary or null if downtime state is unavailable
 */
export function useCharacterSlotSummary(
  characterId: string
): CharacterSlotSummary | null {
  const downtime = useCampaignSelector(selectDowntime);
  const day = useCampaignSelector(selectTimeDay);
  const slot = useCampaignSelector(selectTimeSlot);

  return useMemo(() => {
    if (!downtime) return null;

    return selectCharacterSlotSummary(downtime, characterId, day, slot);
  }, [downtime, day, slot, characterId]);
}

/**
 * Batch hook for full party list.
 * More efficient than calling useCharacterSlotSummary multiple times.
 *
 * @param characterIds - Array of character IDs to get status for
 * @returns Map of characterId to CharacterSlotSummary
 */
export function useAllCharacterSlotSummaries(
  characterIds: string[]
): Map<string, CharacterSlotSummary> {
  const downtime = useCampaignSelector(selectDowntime);
  const day = useCampaignSelector(selectTimeDay);
  const slot = useCampaignSelector(selectTimeSlot);

  return useMemo(() => {
    if (!downtime) return new Map();

    return selectAllCharacterSlotSummaries(downtime, characterIds, day, slot);
  }, [downtime, day, slot, characterIds]);
}
