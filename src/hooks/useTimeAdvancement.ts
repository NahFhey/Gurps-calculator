import { useMemo, useCallback } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import {
  selectCanAdvanceSlot,
  type AdvancementCheck,
} from '../state/downtime/downtimeSelectors';

export interface UseTimeAdvancementResult {
  /** Whether time can advance past the current slot */
  advancementCheck: AdvancementCheck;
  /** Navigate to the first blocking task (implemented by parent) */
  jumpToBlockingTasks: () => void;
}

/**
 * Hook to check if time can advance and provide navigation to blocking tasks.
 *
 * Uses the current day/slot from campaign time state.
 * Provides a stable AdvancementCheck result for the TimeAdvancementBlocker component.
 *
 * @param onJumpToTasks - Callback to navigate to blocking tasks (e.g., scroll to task list)
 * @returns Object containing advancement check result and jump callback
 */
export function useTimeAdvancement(
  onJumpToTasks: () => void
): UseTimeAdvancementResult {
  const { state } = useCampaignStore();

  const advancementCheck = useMemo((): AdvancementCheck => {
    // If no downtime state, allow advancement (no tasks to block)
    if (!state.downtime) {
      return {
        canAdvance: true,
        blockingTaskIds: [],
      };
    }

    const dayKey = state.time?.day ?? 1;
    const slot = state.time?.slot ?? 0;

    return selectCanAdvanceSlot(state.downtime, dayKey, slot);
  }, [state.downtime, state.time?.day, state.time?.slot]);

  // Stable callback that doesn't change unless onJumpToTasks changes
  const jumpToBlockingTasks = useCallback(() => {
    onJumpToTasks();
  }, [onJumpToTasks]);

  return {
    advancementCheck,
    jumpToBlockingTasks,
  };
}
