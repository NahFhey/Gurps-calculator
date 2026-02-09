/**
 * Alchemy Activity View
 *
 * Full alchemy interface integrated into the Downtime panel.
 * Provides sub-navigation between all alchemy subsystems:
 * - Reagents: View and manage reagent inventory
 * - Analysis: Identify unknown reagents through skill rolls
 * - Processing: Refine and concentrate reagents
 * - Formulas: Create and manage alchemical recipes
 * - Batches: Track active brewing projects
 * - Tally Worksheet: Summarize reagent aspects for brewing calculations
 */

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useAlchemyData } from '../../../hooks/useAlchemyData';
import { ReagentsView } from '../../alchemy/ReagentsView';
import { AnalysisView } from '../../alchemy/AnalysisView';
import { ConcentrationRefinementView } from '../../alchemy/ConcentrationRefinementView';
import { FormulasView } from '../../alchemy/FormulasView';
import { BatchesView } from '../../alchemy/BatchesView';
import { TallyWorksheetView } from '../../alchemy/TallyWorksheetView';

// ============================================================================
// TYPES
// ============================================================================

type AlchemySubView = 'reagents' | 'analysis' | 'processing' | 'formulas' | 'batches' | 'tally';

interface AlchemyActivityProps {
  /** Current day key for task scheduling */
  currentDayKey: number;
  /** Current time slot for task scheduling */
  currentSlot: number;
}

// ============================================================================
// TAB CONFIGURATION
// ============================================================================

const TABS: { key: AlchemySubView; label: string; getBadge?: (ctx: { reagentCount: number; formulaCount: number; activeCount: number }) => string | null }[] = [
  { key: 'reagents', label: 'Reagents', getBadge: (ctx) => `${ctx.reagentCount}` },
  { key: 'analysis', label: 'Analysis' },
  { key: 'processing', label: 'Processing' },
  { key: 'formulas', label: 'Formulas', getBadge: (ctx) => `${ctx.formulaCount}` },
  { key: 'batches', label: 'Batches', getBadge: (ctx) => ctx.activeCount > 0 ? `${ctx.activeCount}` : null },
  { key: 'tally', label: 'Tally' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function AlchemyActivity({ currentDayKey, currentSlot }: AlchemyActivityProps) {
  // Downtime context for task management
  const {
    state,
    dispatch,
  } = useDowntimeContext();

  // Alchemy data hook for sub-views (with save callbacks)
  const {
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
    weather,
  } = useAlchemyData();

  // Sub-view navigation
  const [activeTab, setActiveTab] = useState<AlchemySubView>('reagents');

  // Badge context for tab labels
  const badgeCtx = { reagentCount: reagents.length, formulaCount: formulas.length, activeCount };

  return (
    <div className="alchemy-activity" data-testid="alchemy-activity">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical className="w-6 h-6 text-purple-400" />
        <h3 className="text-lg font-semibold text-gray-100">Alchemy</h3>
      </div>

      {/* Weather Effects Banner */}
      {weather.hasEffect && (
        <div className="mb-4 px-3 py-2 rounded bg-blue-900/30 border border-blue-700/50">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-400">Weather Effect:</span>
            <span className="text-gray-300">{weather.effectDescription}</span>
            {weather.locationName && <span className="text-gray-500 text-xs">at {weather.locationName}</span>}
          </div>
        </div>
      )}

      {/* Sub-view Tab Bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-700 overflow-x-auto">
        {TABS.map((tab) => {
          const badge = tab.getBadge?.(badgeCtx);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-purple-500 text-purple-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
              {badge && <span className="ml-1 text-xs text-gray-500">({badge})</span>}
            </button>
          );
        })}
      </div>

      {/* Sub-view Content */}
      {activeTab === 'reagents' && (
        <ReagentsView reagents={reagents} alchemySettings={alchemySettings} />
      )}

      {activeTab === 'analysis' && (
        <AnalysisView
          reagents={reagents}
          labs={labs}
          workers={workers}
          _alchemySettings={alchemySettings}
          saveReagents={saveReagents}
          downtimeState={state}
          downtimeDispatch={dispatch}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
        />
      )}

      {activeTab === 'processing' && (
        <ConcentrationRefinementView
          reagents={reagents}
          labs={labs}
          workers={workers}
          saveReagents={saveReagents}
          downtimeState={state}
          downtimeDispatch={dispatch}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
        />
      )}

      {activeTab === 'formulas' && (
        <FormulasView
          reagents={reagents}
          formulas={formulas}
          batches={batches}
          saveReagents={saveReagents}
          saveBatches={saveBatches}
        />
      )}

      {activeTab === 'batches' && (
        <BatchesView
          batches={batches as any}
          workers={workers}
          formulas={formulas}
          reagents={reagents}
          labs={labs}
          saveBatches={saveBatches}
          saveFormulas={saveFormulas}
          saveReagents={saveReagents}
          downtimeState={state}
          downtimeDispatch={dispatch}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
        />
      )}

      {activeTab === 'tally' && (
        <TallyWorksheetView reagents={reagents} />
      )}
    </div>
  );
}
