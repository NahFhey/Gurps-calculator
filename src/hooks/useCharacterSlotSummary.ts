import { useMemo } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import {
  selectCharacterSlotSummary,
  selectAllCharacterSlotSummaries,
  type CharacterSlotSummary,
} from '../state/downtime/downtimeSelectors';

/**
 * Hook to get character status for current slot.
 * Uses existing useCampaignStore pattern.
 *
 * @param characterId - The character to get status for
 * @returns CharacterSlotSummary or null if downtime state is unavailable
 */
export function useCharacterSlotSummary(
  characterId: string
): CharacterSlotSummary | null {
  const { state } = useCampaignStore();

  return useMemo(() => {
    if (!state.downtime) return null;

    return selectCharacterSlotSummary(
      state.downtime,
      characterId,
      state.time?.day ?? 1,
      state.time?.slot ?? 0
    );
  }, [state.downtime, state.time?.day, state.time?.slot, characterId]);
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
  const { state } = useCampaignStore();

  return useMemo(() => {
    if (!state.downtime) return new Map();

    return selectAllCharacterSlotSummaries(
      state.downtime,
      characterIds,
      state.time?.day ?? 1,
      state.time?.slot ?? 0
    );
  }, [state.downtime, state.time?.day, state.time?.slot, characterIds]);
}
