import { useState, useMemo, useCallback, useRef } from 'react';
import { ReagentsView } from './alchemy/ReagentsView';
import { FormulasView } from './alchemy/FormulasView';
import { BatchesView } from './alchemy/BatchesView';
import { TallyWorksheetView } from './alchemy/TallyWorksheetView';
import { AnalysisView } from './alchemy/AnalysisView';
import { ConcentrationRefinementView } from './alchemy/ConcentrationRefinementView';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';
import { alchemyLog } from '../utils/activityLogger';
import { useWeatherModifiers } from '../hooks/useWeatherModifiers';

// ============================================================================
// Types
// ============================================================================

type AlchemyView = 'reagents' | 'analysis' | 'processing' | 'formulas' | 'batches' | 'tally';

interface Worker {
  id: string;
  name: string;
  skills: Record<string, number>;
  st?: number;
}

interface AlchemyReagent {
  id: string;
  [key: string]: unknown;
}

interface AlchemyFormula {
  id: string;
  [key: string]: unknown;
}

interface AlchemyBatch {
  id: string;
  phase: string;
  [key: string]: unknown;
}

interface AlchemyLab {
  id: string;
  [key: string]: unknown;
}

interface AlchemySettings {
  defaultLabRating: number;
  workBlockMinutes: number;
}

// ============================================================================
// AlchemyTab Component
// ============================================================================

/**
 * AlchemyTab Component - Main container for GURPS alchemy system
 *
 * This component provides navigation between the major alchemy subsystems:
 * - Reagents: View and manage reagent inventory
 * - Analysis: Identify unknown reagents through skill rolls
 * - Processing: Refine and concentrate reagents
 * - Formulas: Create and manage alchemical recipes
 * - Batches: Track active brewing projects
 * - Tally Worksheet: Summarize reagent aspects for brewing calculations
 *
 * MIGRATED: Now uses useCampaignStore directly instead of bridge contexts.
 */
export function AlchemyTab() {
  const { state, actions } = useCampaignStore();
  const [view, setView] = useState<AlchemyView>('reagents');

  // Get weather modifiers for alchemy
  const { modifiers: weatherModifiers, hasEffect, effectDescription, locationName } = useWeatherModifiers('alchemy');

  // Derive data from normalized state
  const reagents = useMemo(() =>
    denormalizeObject(state.entities.alchemyReagents) as AlchemyReagent[],
    [state.entities.alchemyReagents]
  );

  const formulas = useMemo(() =>
    denormalizeObject(state.entities.alchemyFormulas) as AlchemyFormula[],
    [state.entities.alchemyFormulas]
  );

  const batches = useMemo(() =>
    denormalizeObject(state.entities.alchemyBatches) as AlchemyBatch[],
    [state.entities.alchemyBatches]
  );

  const labs = useMemo(() =>
    denormalizeObject(state.entities.alchemyLabs) as AlchemyLab[],
    [state.entities.alchemyLabs]
  );

  const alchemySettings = state.entities.alchemySettings as AlchemySettings;

  // Derive workers from characters (same pattern as ConfigContext)
  const workers = useMemo(() =>
    Object.values(state.entities.characters).map((character: any) => ({
      id: character.id,
      name: character.name,
      skills: character.work?.skills || {},
      st: character.st
    })) as Worker[],
    [state.entities.characters]
  );

  // Track previous batches for change detection
  const prevBatchesRef = useRef<AlchemyBatch[]>(batches);

  // Save callbacks that normalize arrays back to records
  const saveReagents = useCallback((reagentsArray: AlchemyReagent[]) => {
    actions.setAlchemyReagents(normalizeArray(reagentsArray));
  }, [actions]);

  const saveFormulas = useCallback((formulasArray: AlchemyFormula[]) => {
    actions.setAlchemyFormulas(normalizeArray(formulasArray));
  }, [actions]);

  const saveBatches = useCallback((batchesArray: AlchemyBatch[]) => {
    const prevBatches = prevBatchesRef.current;
    const prevBatchIds = new Set(prevBatches.map(b => b.id));
    const prevBatchMap = new Map(prevBatches.map(b => [b.id, b]));

    // Detect new batches (started)
    for (const batch of batchesArray) {
      if (!prevBatchIds.has(batch.id) && batch.phase === 'brewing') {
        actions.addLogEntry(alchemyLog.batchStarted(batch.formulaName || 'Unknown'));
      }
    }

    // Detect completed or failed batches
    for (const batch of batchesArray) {
      const prevBatch = prevBatchMap.get(batch.id);
      if (prevBatch && prevBatch.phase === 'brewing') {
        if (batch.phase === 'completed') {
          actions.addLogEntry(alchemyLog.batchCompleted(
            batch.formulaName || 'Unknown',
            (batch as any).quality || 'Unknown'
          ));
        } else if (batch.phase === 'failed') {
          actions.addLogEntry(alchemyLog.batchFailed(batch.formulaName || 'Unknown'));
        }
      }
    }

    prevBatchesRef.current = batchesArray;
    actions.setAlchemyBatches(normalizeArray(batchesArray));
  }, [actions]);

  // Count batches currently in brewing phase for badge display
  const activeCount = batches.filter(b => b.phase === 'brewing').length;

  return (
    <div>
      {/* Weather Effects Banner */}
      {hasEffect && (
        <div className="mb-4 px-3 py-2 rounded bg-blue-900/30 border border-blue-700/50">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-400">Weather Effect:</span>
            <span className="text-gray-300">{effectDescription}</span>
            {locationName && <span className="text-gray-500 text-xs">at {locationName}</span>}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-gray-700">
        <button
          onClick={() => setView('reagents')}
          className={`px-4 py-2 ${view === 'reagents' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
        >
          Reagents ({reagents.length})
        </button>
        <button
          onClick={() => setView('analysis')}
          className={`px-4 py-2 ${view === 'analysis' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
        >
          Analysis
        </button>
        <button
          onClick={() => setView('processing')}
          className={`px-4 py-2 ${view === 'processing' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
        >
          Processing
        </button>
        <button
          onClick={() => setView('formulas')}
          className={`px-4 py-2 ${view === 'formulas' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
        >
          Formulas ({formulas.length})
        </button>
        <button
          onClick={() => setView('batches')}
          className={`px-4 py-2 ${view === 'batches' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
        >
          Batches ({activeCount} active)
        </button>
        <button
          onClick={() => setView('tally')}
          className={`px-4 py-2 ${view === 'tally' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
        >
          Tally Worksheet
        </button>
      </div>

      {view === 'reagents' && <ReagentsView reagents={reagents} alchemySettings={alchemySettings} />}
      {view === 'analysis' && <AnalysisView reagents={reagents} labs={labs} workers={workers} alchemySettings={alchemySettings} saveReagents={saveReagents} />}
      {view === 'processing' && <ConcentrationRefinementView reagents={reagents} labs={labs} workers={workers} saveReagents={saveReagents} />}
      {view === 'formulas' && <FormulasView reagents={reagents} formulas={formulas} batches={batches} saveReagents={saveReagents} saveFormulas={saveFormulas} saveBatches={saveBatches} />}
      {view === 'batches' && <BatchesView batches={batches} workers={workers} formulas={formulas} reagents={reagents} saveBatches={saveBatches} saveFormulas={saveFormulas} saveReagents={saveReagents} />}
      {view === 'tally' && <TallyWorksheetView reagents={reagents} />}
    </div>
  );
}
