import React, { useState } from 'react';
import { ReagentsView } from './alchemy/ReagentsView';
import { FormulasView } from './alchemy/FormulasView';
import { BatchesView } from './alchemy/BatchesView';
import { TallyWorksheetView } from './alchemy/TallyWorksheetView';
import { AnalysisView } from './alchemy/AnalysisView';
import { ConcentrationRefinementView } from './alchemy/ConcentrationRefinementView';

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
 * @param {Object} props - Component props
 * @param {Array<Object>} props.reagents - Reagent inventory
 * @param {Array<Object>} props.formulas - Saved alchemical formulas
 * @param {Array<Object>} props.batches - Active and completed brewing batches
 * @param {Array<Object>} props.labs - Available alchemy labs with ratings
 * @param {Array<Object>} props.workers - Available workers with alchemy skills
 * @param {Object} props.alchemySettings - GM settings for alchemy system
 * @param {Function} props.saveReagents - Callback to persist reagent changes
 * @param {Function} props.saveFormulas - Callback to persist formula changes
 * @param {Function} props.saveBatches - Callback to persist batch changes
 * @param {Function} props.saveLabs - Callback to persist lab changes
 * @returns {JSX.Element} The alchemy tab interface with sub-navigation
 */
export function AlchemyTab({ reagents, formulas, batches, labs, workers, alchemySettings, saveReagents, saveFormulas, saveBatches, saveLabs }) {
  const [view, setView] = useState('reagents');

  // Count batches currently in brewing phase for badge display
  const activeCount = batches.filter(b => b.phase === 'brewing').length;

  return (
    <div>
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
