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
 * - Work Sessions: Schedule and resolve downtime work blocks
 * - Tally Worksheet: Summarize reagent aspects for brewing calculations
 */

import { useState, useCallback, useMemo } from 'react';
import { FlaskConical, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useAlchemyData } from '../../../hooks/useAlchemyData';
import { AlchemyTaskForm } from './AlchemyTaskForm';
import { AlchemyTaskCard } from './AlchemyTaskCard';
import { ReagentsView } from '../../alchemy/ReagentsView';
import { AnalysisView } from '../../alchemy/AnalysisView';
import { ConcentrationRefinementView } from '../../alchemy/ConcentrationRefinementView';
import { FormulasView } from '../../alchemy/FormulasView';
import { BatchesView } from '../../alchemy/BatchesView';
import { TallyWorksheetView } from '../../alchemy/TallyWorksheetView';
import {
  selectTasksByActivityType,
  validateTaskCreation,
} from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import type { DowntimeTask, AlchemyData, TaskResults } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { AlchemyBatch } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

type AlchemySubView = 'reagents' | 'analysis' | 'processing' | 'formulas' | 'batches' | 'sessions' | 'tally';

interface AlchemyActivityProps {
  /** Current day key for task scheduling */
  currentDayKey: number;
  /** Current time slot for task scheduling */
  currentSlot: number;
}

// ============================================================================
// ALCHEMY RESOLUTION
// ============================================================================

/**
 * Calculate alchemy work block results based on task data.
 * Uses simplified mechanics - in production would use alchemy.js utilities.
 */
function calculateAlchemyResults(
  task: DowntimeTask,
  batch: AlchemyBatch | undefined,
  formulaName: string
): TaskResults {
  const data = task.activityData as AlchemyData;

  if (!batch) {
    return {
      success: false,
      message: 'Batch not found - work session could not be completed.',
      inventoryChanges: [],
      experienceGained: 0,
    };
  }

  // Simple work block simulation
  // In production, this would use applyWorkBlockResult from alchemy.js
  const skillRoll = Math.floor(Math.random() * 16) + 3; // 3-18 range (3d6)
  const effectiveSkill = 12 + (data.aspectModifiers?.skill ?? 0);
  const margin = effectiveSkill - skillRoll;

  // Calculate progress and contamination
  const ppGained = margin >= 0 ? Math.max(1, Math.floor(margin / 2) + 1) : 0;
  const cpGained = margin < 0 ? 1 : 0;

  // Check if batch would complete
  const currentPP = batch.PP ?? 0;
  const workRequired = batch.WR ?? 10;
  const newPP = currentPP + ppGained;
  const wouldComplete = newPP >= workRequired;

  if (wouldComplete) {
    const quality = cpGained > 0 ? 'Minor Flaw' : 'Clean';
    return {
      success: true,
      message: `Batch complete! ${formulaName} finished with ${quality} quality. Produced ${data.batchSize} dose(s).`,
      inventoryChanges: [
        {
          itemId: data.formulaId,
          quantity: data.batchSize,
          itemName: formulaName,
        },
      ],
      experienceGained: 25 * data.batchSize,
    };
  }

  if (margin >= 0) {
    return {
      success: true,
      message: `Work block successful! Added ${ppGained} PP to ${formulaName}. Progress: ${newPP}/${workRequired}`,
      inventoryChanges: [],
      experienceGained: 10,
    };
  }

  return {
    success: false,
    message: `Work block had issues. ${formulaName} gained contamination. Progress: ${newPP}/${workRequired}, CP: ${batch.CP ?? 0 + cpGained}`,
    inventoryChanges: [],
    experienceGained: 5,
  };
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
  { key: 'sessions', label: 'Work Sessions' },
  { key: 'tally', label: 'Tally' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function AlchemyActivity({ currentDayKey, currentSlot }: AlchemyActivityProps) {
  // Downtime context for task management
  const {
    state,
    characters,
    alchemyBatches: contextBatches,
    alchemyFormulas: contextFormulas,
    alchemyReagents: contextReagents,
    alchemyLabs: contextLabs,
    tools,
    createDowntimeTask,
    beginResolve,
    resolve,
    cancel,
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

  // Work session state
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get alchemy tasks for current slot
  const alchemyTasks = useMemo(
    () => selectTasksByActivityType(state, 'alchemy'),
    [state]
  );

  // Filter to pending and completed tasks
  const pendingTasks = useMemo(
    () => alchemyTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [alchemyTasks]
  );

  const completedTasks = useMemo(
    () => alchemyTasks.filter((t) => t.status === 'resolved' || t.status === 'cancelled'),
    [alchemyTasks]
  );

  // Get active batches (in brewing phase)
  const activeBatches = useMemo(
    () => contextBatches.filter((b) => b.status === 'brewing'),
    [contextBatches]
  );

  // Handle form submission
  const handleFormSubmit = useCallback(
    (data: { leaderId: string; helperIds: string[]; activityData: AlchemyData }) => {
      const payload: CreateTaskPayload = {
        activityType: 'alchemy',
        dayKey: currentDayKey,
        slot: currentSlot,
        leaderId: data.leaderId,
        helperIds: data.helperIds,
        activityData: data.activityData,
      };

      // Validate before creating
      try {
        validateTaskCreation(state, payload);
        createDowntimeTask(payload);
        setIsCreating(false);
        setValidationError(null);
      } catch (error) {
        if (error instanceof DowntimeValidationError) {
          setValidationError(error.message);
        } else {
          setValidationError('An unexpected error occurred');
        }
      }
    },
    [state, currentDayKey, currentSlot, createDowntimeTask]
  );

  // Handle task resolution
  const handleResolve = useCallback(
    (task: DowntimeTask) => {
      const data = task.activityData as AlchemyData;

      // Find the batch
      const batch = contextBatches.find((b) => b.id === data.formulaId);

      // Find the formula name
      const formula = contextFormulas.find((f) => f.id === data.recipeId);
      const formulaName = formula?.name ?? 'Unknown Potion';

      beginResolve(task.id);
      const results = calculateAlchemyResults(task, batch, formulaName);
      resolve(task.id, results);
    },
    [contextBatches, contextFormulas, beginResolve, resolve]
  );

  // Handle task cancellation
  const handleCancel = useCallback(
    (taskId: string) => {
      cancel(taskId);
    },
    [cancel]
  );

  // Handle form cancel
  const handleFormCancel = useCallback(() => {
    setIsCreating(false);
    setValidationError(null);
  }, []);

  // Dismiss validation error
  const dismissError = useCallback(() => {
    setValidationError(null);
  }, []);

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
        />
      )}

      {activeTab === 'processing' && (
        <ConcentrationRefinementView
          reagents={reagents}
          labs={labs}
          workers={workers}
          saveReagents={saveReagents}
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
        />
      )}

      {activeTab === 'tally' && (
        <TallyWorksheetView reagents={reagents} />
      )}

      {/* Work Sessions Sub-view */}
      {activeTab === 'sessions' && (
        <div data-testid="work-sessions-view">
          {/* Active Batches Summary */}
          {activeBatches.length > 0 && (
            <div className="mb-4 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg" data-testid="active-batches-summary">
              <h4 className="text-sm font-medium text-purple-300 mb-2">
                Active Batches ({activeBatches.length})
              </h4>
              <div className="space-y-1">
                {activeBatches.slice(0, 3).map((batch) => (
                  <div key={batch.id} className="text-sm text-purple-200/80">
                    {batch.formulaName ?? batch.id} - {batch.PP ?? 0}/{batch.WR ?? '?'} PP
                  </div>
                ))}
                {activeBatches.length > 3 && (
                  <div className="text-xs text-purple-400/60">
                    +{activeBatches.length - 3} more batches...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <div
              className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg flex items-start gap-2"
              data-testid="validation-error"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{validationError}</p>
              </div>
              <button
                type="button"
                onClick={dismissError}
                className="text-red-400 hover:text-red-200"
                aria-label="Dismiss error"
                data-testid="dismiss-error-button"
              >
                &times;
              </button>
            </div>
          )}

          {/* New Task Button or Form */}
          {!isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="mb-4 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              data-testid="new-alchemy-task-button"
            >
              <Plus className="w-4 h-4" />
              New Work Session
            </button>
          ) : (
            <AlchemyTaskForm
              characters={characters}
              batches={activeBatches}
              formulas={contextFormulas}
              reagents={contextReagents}
              labs={contextLabs}
              tools={tools}
              state={state}
              currentDayKey={currentDayKey}
              currentSlot={currentSlot}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
            />
          )}

          {/* No Batches Message */}
          {activeBatches.length === 0 && !isCreating && (
            <div className="mb-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
              <p className="text-sm text-gray-400">
                No active batches. Switch to the Batches tab to start a new batch.
              </p>
            </div>
          )}

          {/* Pending Tasks */}
          <div className="mb-6" data-testid="pending-tasks-section">
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Pending ({pendingTasks.length})
            </h4>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No pending alchemy tasks</p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <AlchemyTaskCard
                    key={task.id}
                    task={task}
                    batches={contextBatches}
                    formulas={contextFormulas}
                    characters={characters}
                    onResolve={() => handleResolve(task)}
                    onCancel={() => handleCancel(task.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completed Tasks */}
          <div data-testid="completed-tasks-section">
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Completed ({completedTasks.length})
            </h4>
            {completedTasks.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No completed alchemy tasks</p>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <AlchemyTaskCard
                    key={task.id}
                    task={task}
                    batches={contextBatches}
                    formulas={contextFormulas}
                    characters={characters}
                    readonly
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
