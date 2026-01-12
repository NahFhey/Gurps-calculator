import React, { useState } from 'react';
import { ReagentsView } from './alchemy/ReagentsView';
import { FormulasView } from './alchemy/FormulasView';
import { BatchesView } from './alchemy/BatchesView';
import { TallyWorksheetView } from './alchemy/TallyWorksheetView';
import { AnalysisView } from './alchemy/AnalysisView';
import { ConcentrationRefinementView } from './alchemy/ConcentrationRefinementView';

export function AlchemyTab({ reagents, formulas, batches, workers, alchemySettings, saveReagents, saveFormulas, saveBatches }) {
  const [view, setView] = useState('reagents');

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
          Concentration & Refinement
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
      {view === 'analysis' && <AnalysisView reagents={reagents} workers={workers} alchemySettings={alchemySettings} saveReagents={saveReagents} />}
      {view === 'processing' && <ConcentrationRefinementView reagents={reagents} saveReagents={saveReagents} />}
      {view === 'formulas' && <FormulasView reagents={reagents} formulas={formulas} batches={batches} saveReagents={saveReagents} saveFormulas={saveFormulas} saveBatches={saveBatches} />}
      {view === 'batches' && <BatchesView batches={batches} workers={workers} formulas={formulas} reagents={reagents} saveBatches={saveBatches} saveFormulas={saveFormulas} saveReagents={saveReagents} />}
      {view === 'tally' && <TallyWorksheetView reagents={reagents} />}
    </div>
  );
}
