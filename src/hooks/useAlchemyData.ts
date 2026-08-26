/**
 * useAlchemyData Hook
 *
 * Shared hook that provides alchemy data derivation and save callbacks.
 * Extracted from AlchemyTab to be reused by the Downtime AlchemyActivity.
 *
 * Handles:
 * - Denormalization of alchemy entities from the campaign store
 * - Phase mapping for batch backward compatibility
 * - Worker derivation from characters
 * - Save callbacks with normalization and activity logging
 * - Weather modifier integration
 */

import { useMemo, useCallback, useRef } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';
import { alchemyLog } from '../utils/activityLogger';
import { useWeatherModifiers } from './useWeatherModifiers';
import { getCharacterSkills, ACTIVITY_SKILL_REQUIREMENTS } from '../types/characterSheet';
import type {
  AlchemyReagent,
  AlchemyFormula,
  AlchemyBatch,
  AlchemyLab,
} from '../types/campaign';

// ============================================================================
// Types
// ============================================================================

export interface AlchemyWorker {
  id: string;
  name: string;
  skills: Record<string, number>;
  st?: number;
}

export type AlchemyBatchWithPhase = AlchemyBatch & {
  phase: 'brewing' | 'completed' | 'failed';
};

// ============================================================================
// Hook
// ============================================================================

export function useAlchemyData() {
  const { state, actions } = useCampaignStore();

  // Get weather modifiers for alchemy
  const { hasEffect, effectDescription, locationName } = useWeatherModifiers('alchemy');

  // Derive data from normalized state
  const reagents = useMemo(() =>
    denormalizeObject(state.entities.alchemyReagents) as AlchemyReagent[],
    [state.entities.alchemyReagents]
  );

  const formulas = useMemo(() =>
    denormalizeObject(state.entities.alchemyFormulas) as AlchemyFormula[],
    [state.entities.alchemyFormulas]
  );

  // Map batches to include 'phase' field for backward compatibility with child components
  const batches = useMemo(() => {
    const rawBatches = denormalizeObject(state.entities.alchemyBatches) as AlchemyBatch[];
    return rawBatches.map(batch => ({
      ...batch,
      // Map 'status' to 'phase' for legacy components
      phase: (batch.status === 'brewing' ? 'brewing' : batch.status === 'complete' ? 'completed' : batch.status) as 'brewing' | 'completed' | 'failed'
    }));
  }, [state.entities.alchemyBatches]);

  const labs = useMemo(() =>
    denormalizeObject(state.entities.alchemyLabs) as AlchemyLab[],
    [state.entities.alchemyLabs]
  );

  const alchemySettings = state.entities.alchemySettings;

  // Derive workers from characters (same pattern as ConfigContext)
  // Merge GCS-derived activity keys so character sheet skills auto-fill in activity views
  // Only include characters with the alchemy skill
  const alchemySkills = ACTIVITY_SKILL_REQUIREMENTS.alchemy;
  const workers = useMemo(() =>
    Object.values(state.entities.characters)
      .map((character: any) => ({
        id: character.id,
        name: character.name,
        skills: getCharacterSkills(character),
        st: character.st,
      }))
      .filter(w => alchemySkills.some(sk => w.skills[sk] !== undefined && w.skills[sk] > 0)) as AlchemyWorker[],
    [state.entities.characters]
  );

  // Track previous batches for change detection
  const prevBatchesRef = useRef<AlchemyBatch[]>(batches);

  // Save callbacks that normalize arrays back to records
  // Note: These accept 'any' to accommodate the legacy JSX components that may pass
  // objects with additional properties not in our type definitions
  const saveReagents = useCallback((reagentsArray: any[]) => {
    actions.setAlchemyReagents(normalizeArray(reagentsArray) as Record<string, AlchemyReagent>);
  }, [actions]);

  const saveFormulas = useCallback((formulasArray: any[]) => {
    actions.setAlchemyFormulas(normalizeArray(formulasArray) as Record<string, AlchemyFormula>);
  }, [actions]);

  const saveBatches = useCallback((batchesArray: any[]) => {
    const prevBatches = prevBatchesRef.current;
    const prevBatchIds = new Set(prevBatches.map(b => b.id));
    const prevBatchMap = new Map(prevBatches.map(b => [b.id, b]));

    // Detect new batches (started)
    for (const batch of batchesArray) {
      const phase = batch.phase || batch.status;
      if (!prevBatchIds.has(batch.id) && phase === 'brewing') {
        const workerId = workers.find(worker => worker.name === batch.worker)?.id;
        actions.addLogEntry(alchemyLog.batchStarted(
          batch.formulaName || 'Unknown',
          undefined,
          {
            ...(workerId ? { characterIds: [workerId] } : {}),
            ...(batch.worker ? { characterNames: [batch.worker] } : {}),
            taskId: batch.id,
          }
        ));
      }
    }

    // Detect completed or failed batches
    for (const batch of batchesArray) {
      const prevBatch = prevBatchMap.get(batch.id);
      const phase = batch.phase || batch.status;
      const prevPhase = prevBatch?.phase || prevBatch?.status;
      if (prevBatch && prevPhase === 'brewing') {
        const workerId = workers.find(worker => worker.name === batch.worker)?.id;
        const meta = {
          ...(workerId ? { characterIds: [workerId] } : {}),
          ...(batch.worker ? { characterNames: [batch.worker] } : {}),
          taskId: batch.id,
        };
        if (phase === 'completed' || phase === 'complete') {
          actions.addLogEntry(alchemyLog.batchCompleted(
            batch.formulaName || 'Unknown',
            batch.quality || 'Unknown',
            undefined,
            meta
          ));
        } else if (phase === 'failed') {
          actions.addLogEntry(alchemyLog.batchFailed(
            batch.formulaName || 'Unknown',
            undefined,
            meta
          ));
        }
      }
    }

    // Map phase back to status when saving
    const normalizedBatches = batchesArray.map(batch => {
      const { phase, ...rest } = batch;
      // If batch has phase but not status, convert phase to status
      if (phase && !rest.status) {
        rest.status = phase === 'completed' ? 'complete' : phase;
      }
      return rest;
    });

    prevBatchesRef.current = batchesArray;
    actions.setAlchemyBatches(normalizeArray(normalizedBatches) as Record<string, AlchemyBatch>);
  }, [actions, workers]);

  // Count batches currently in brewing phase for badge display
  const activeCount = batches.filter(b => b.phase === 'brewing' || b.status === 'brewing').length;

  return {
    reagents,
    formulas,
    batches,
    labs,
    workers,
    alchemySettings,
    saveReagents,
    saveFormulas,
    saveBatches,
    activeCount,
    weather: { hasEffect, effectDescription, locationName },
  };
}
