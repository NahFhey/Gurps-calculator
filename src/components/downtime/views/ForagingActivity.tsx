/**
 * Foraging Activity View
 *
 * Main view for the foraging downtime activity.
 * Displays pending and completed foraging tasks and allows
 * creation, resolution, and cancellation of tasks.
 */

import { useState, useCallback, useMemo } from 'react';
import { Leaf, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { ForagingTaskForm } from './ForagingTaskForm';
import { ForagingTaskCard } from './ForagingTaskCard';
import {
  selectTasksByActivityType,
  validateTaskCreation,
} from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import {
  roll3d6,
  calculateEffectiveForagingSkill,
  evaluateForagingRoll,
  determineForageFind,
  calculateForageYields,
} from '../../../utils/gathering';
import { selectCharacterFatigueStatus, getFatiguePenalty } from '../../../state/downtime/downtimeSelectors';
import type { DowntimeState, DowntimeTask, ForagingData, TaskResults } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { GatheringSpecies, GatheringEnvironment } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface ForagingActivityProps {
  /** Current day key for task scheduling */
  currentDayKey: number;
  /** Current time slot for task scheduling */
  currentSlot: number;
}

// ============================================================================
// FORAGING RESOLUTION
// ============================================================================

/**
 * Calculate foraging results using full GURPS 3d6 mechanics.
 * Uses the gathering.js utility functions for proper skill checks,
 * table-based loot, and yield calculations.
 */
function calculateForagingResultsAuto(
  task: DowntimeTask,
  targetNode: GatheringSpecies | undefined,
  biome: GatheringEnvironment | undefined,
  gatheringTables: any[],
  weatherGatheringMod: number,
  downtimeState?: DowntimeState
): TaskResults {
  const data = task.activityData as ForagingData;
  const nodeName = targetNode?.name ?? 'materials';
  const biomeName = biome?.name ?? 'the area';

  // Get leader's base skill (captured at task creation) or fallback
  const baseSkill = data.leaderSkill ?? 10;

  // Get environment modifier from biome
  const environmentMod = (biome as any)?.skillMod ?? 0;

  // Calculate fatigue penalty for the leader
  let fatiguePenalty = 0;
  let fatigueLabel = '';
  if (downtimeState) {
    const fatigueStatus = selectCharacterFatigueStatus(
      downtimeState,
      task.leaderId,
      task.dayKey,
      task.slot
    );
    fatiguePenalty = getFatiguePenalty(fatigueStatus);
    if (fatiguePenalty !== 0) {
      fatigueLabel = `Fatigue(${fatigueStatus}): ${fatiguePenalty}. `;
    }
  }

  // Calculate effective skill with all modifiers (including fatigue)
  const { effectiveSkill, breakdown } = calculateEffectiveForagingSkill({
    baseForagingSkill: baseSkill,
    toolBonus: data.skillModifier + fatiguePenalty,
    environmentMod: environmentMod + weatherGatheringMod,
  });

  // Roll 3d6 for foraging check
  const { total: roll } = roll3d6();

  // Evaluate the roll result
  const rollResult = evaluateForagingRoll(roll, effectiveSkill, !!data.nodeId);

  // Build skill breakdown string
  const breakdownParts: string[] = [`Base ${breakdown.base}`];
  if (breakdown.tool !== 0) breakdownParts.push(`Tools/Helpers ${breakdown.tool >= 0 ? '+' : ''}${breakdown.tool}`);
  if (breakdown.environment !== 0) breakdownParts.push(`Env ${breakdown.environment >= 0 ? '+' : ''}${breakdown.environment}`);
  const breakdownStr = breakdownParts.join(', ');

  // Handle failure
  if (!rollResult.success) {
    const hazardNote = rollResult.hazard ? ` Hazard: ${rollResult.hazard}` : '';
    return {
      success: false,
      message: rollResult.critFailure
        ? `${fatigueLabel}Critical Failure! Rolled ${roll} vs ${effectiveSkill} (${breakdownStr}). ${rollResult.description}${hazardNote}`
        : `${fatigueLabel}Failure. Rolled ${roll} vs ${effectiveSkill} (${breakdownStr}), MoF: ${Math.abs(rollResult.margin)}. ${rollResult.description}`,
      inventoryChanges: [],
      experienceGained: 3,
    };
  }

  // Determine what was found using biome's foraging find table
  const biomeDefaults = (biome as any)?.defaultsByMode?.Foraging;
  const findTableId = biomeDefaults?.randomCatchTableId ?? (data.tableId || null);
  const findTable = findTableId ? gatheringTables.find((t: any) => t.id === findTableId) : null;

  const findResult = determineForageFind({
    rollResult,
    findTable,
    targetItem: targetNode,
  });

  // Determine the found item for yield calculation
  const foundItem = findResult.item ?? targetNode;
  const foundName = foundItem?.name ?? nodeName;

  // Calculate yields
  const yieldResult = calculateForageYields({
    category: null,
    item: foundItem,
    yieldMultiplier: rollResult.yieldMultiplier ?? 1.0,
  });

  const yieldAmount = yieldResult.units;

  if (yieldAmount <= 0) {
    return {
      success: true,
      message: `${fatigueLabel}Rolled ${roll} vs ${effectiveSkill} (${breakdownStr}), MoS: ${rollResult.margin}. Found traces of ${foundName} but nothing harvestable.`,
      inventoryChanges: [],
      experienceGained: 5,
    };
  }

  return {
    success: true,
    message: rollResult.critSuccess
      ? `${fatigueLabel}Critical Success! Rolled ${roll} vs ${effectiveSkill} (${breakdownStr}). Found ${yieldAmount} ${foundName} in ${biomeName}!`
      : `${fatigueLabel}Success! Rolled ${roll} vs ${effectiveSkill} (${breakdownStr}), MoS: ${rollResult.margin}. Found ${yieldAmount} ${foundName} in ${biomeName}.`,
    inventoryChanges: [
      {
        itemId: foundItem?.id ?? data.nodeId,
        quantity: yieldAmount,
        itemName: foundName,
      },
    ],
    experienceGained: yieldAmount * 8,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ForagingActivity({ currentDayKey, currentSlot }: ForagingActivityProps) {
  const {
    state,
    characters,
    foragingBiomes,
    foragingNodes,
    gatheringTables,
    tools,
    createDowntimeTask,
    beginResolve,
    resolve,
    cancel,
  } = useDowntimeContext();

  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get foraging tasks for current slot
  const foragingTasks = useMemo(() => {
    return selectTasksByActivityType(state, 'foraging').filter(
      (t) => t.dayKey === currentDayKey && t.slot === currentSlot
    );
  }, [state, currentDayKey, currentSlot]);

  // Separate pending and completed tasks
  const pendingTasks = useMemo(
    () => foragingTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [foragingTasks]
  );

  const completedTasks = useMemo(
    () => foragingTasks.filter((t) => t.status === 'resolved' || t.status === 'cancelled'),
    [foragingTasks]
  );

  // Filter tools for foraging (show all tools for now)
  const foragingTools = useMemo(() => tools, [tools]);

  // Handle task creation
  const handleCreate = useCallback(
    (data: {
      leaderId: string;
      helperIds: string[];
      activityData: ForagingData;
    }) => {
      const payload: CreateTaskPayload = {
        activityType: 'foraging',
        dayKey: currentDayKey,
        slot: currentSlot,
        ...data,
      };

      // Pre-validate before attempting to create
      const validation = validateTaskCreation(state, payload);
      if (!validation.valid) {
        setValidationError(validation.message ?? 'Validation failed');
        return;
      }

      try {
        createDowntimeTask(payload);
        setIsCreating(false);
        setValidationError(null);
      } catch (error) {
        if (error instanceof DowntimeValidationError) {
          setValidationError(error.message);
        } else {
          setValidationError('Failed to create task');
        }
      }
    },
    [state, currentDayKey, currentSlot, createDowntimeTask]
  );

  // Handle task resolution
  const handleResolve = useCallback(
    (task: DowntimeTask) => {
      const data = task.activityData as ForagingData;
      const node = foragingNodes.find((n: any) => n.id === data.nodeId);
      const biome = foragingBiomes.find((b: any) => b.id === data.biomeId);

      // Begin resolution (mark as in_progress)
      beginResolve(task.id);

      // Calculate and apply results using full 3d6 GURPS mechanics
      // Weather modifier is 0 here — will be integrated in Phase 5
      const results = calculateForagingResultsAuto(task, node as any, biome as any, gatheringTables, 0, state);
      resolve(task.id, results);
    },
    [foragingNodes, foragingBiomes, gatheringTables, beginResolve, resolve, state]
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

  return (
    <div className="foraging-activity" data-testid="foraging-activity">
      {/* Header */}
      <header className="activity-header flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold">Foraging</h3>
        </div>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
            data-testid="new-foraging-task-button"
          >
            <Plus className="w-4 h-4" />
            New Foraging Task
          </button>
        )}
      </header>

      {/* Validation Error */}
      {validationError && (
        <div
          className="flex items-center gap-2 bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded mb-4"
          role="alert"
          data-testid="validation-error"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="ml-auto text-red-700 hover:text-red-900"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Creation Form */}
      {isCreating && (
        <ForagingTaskForm
          characters={characters}
          biomes={foragingBiomes}
          nodes={foragingNodes}
          tables={gatheringTables}
          tools={foragingTools}
          state={state}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
          onSubmit={handleCreate}
          onCancel={handleFormCancel}
        />
      )}

      {/* Pending Tasks */}
      <section className="pending-tasks mb-6" data-testid="pending-tasks-section">
        <h4 className="font-medium mb-2 text-gray-700">
          Pending ({pendingTasks.length})
        </h4>
        {pendingTasks.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No pending foraging tasks</p>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map((task) => (
              <ForagingTaskCard
                key={task.id}
                task={task}
                nodes={foragingNodes}
                biomes={foragingBiomes}
                characters={characters}
                onResolve={() => handleResolve(task)}
                onCancel={() => handleCancel(task.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Completed Tasks */}
      <section className="completed-tasks" data-testid="completed-tasks-section">
        <h4 className="font-medium mb-2 text-gray-700">
          Completed ({completedTasks.length})
        </h4>
        {completedTasks.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No completed foraging tasks</p>
        ) : (
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <ForagingTaskCard
                key={task.id}
                task={task}
                nodes={foragingNodes}
                biomes={foragingBiomes}
                characters={characters}
                readonly
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
