/**
 * Foraging Activity View
 *
 * Main view for the foraging downtime activity.
 * Displays pending and completed foraging tasks and allows
 * creation, resolution, and cancellation of tasks.
 *
 * Uses the revamped foraging resolution engine with three modes:
 * General, Category, and Specific.
 *
 * Zone profile management is now in the Gathering Manager → Environments tab.
 * Resolved items are added to inventory (food/material).
 * No XP is awarded for foraging.
 */

import { useState, useCallback, useMemo } from 'react';
import { Leaf, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useCampaignStore } from '../../../state/campaignStore';
import { ForagingTaskForm } from './ForagingTaskForm';
import { ForagingTaskCard, type ResolutionMode } from './ForagingTaskCard';
import { ForagingResolutionPanel } from './ForagingResolutionPanel';
import {
  selectTasksByActivityType,
  validateTaskCreation,
} from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import { resolveForage } from '../../../utils/foraging';
import { selectCharacterFatigueStatus, getFatiguePenalty } from '../../../state/downtime/downtimeSelectors';
import { useWeatherModifiers } from '../../../hooks/useWeatherModifiers';
import type { DowntimeTask, ForagingData, TaskResults } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { ForageActionInput, ForageContextFlags } from '../../../types/foraging';
import type { AcquiredItem, InventoryOwner, AcquisitionSource } from '../../../types/campaign';

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
 * Bridge function: converts a DowntimeTask into a ForageActionInput,
 * calls the new resolution engine, and converts the result to TaskResults.
 * Also adds found items to inventory via campaignActions.
 */
function resolveForagingTask(
  task: DowntimeTask,
  ctx: ReturnType<typeof useDowntimeContext>,
  campaignActions: {
    acquireItem: (item: AcquiredItem, owner: InventoryOwner, source: AcquisitionSource) => void;
  },
  weatherModifier: number
): TaskResults {
  const data = task.activityData as ForagingData;

  // Lookup zone
  const zone = ctx.forageZones.find((z) => z.id === data.zoneId);

  // Lookup leader name
  const leader = ctx.characters.find((c) => c.id === task.leaderId);
  const leaderName = leader?.name ?? 'Worker';

  // Calculate fatigue penalty for the leader
  let fatiguePenalty = 0;
  const fatigueStatus = selectCharacterFatigueStatus(
    ctx.state,
    task.leaderId,
    task.dayKey,
    task.slot
  );
  fatiguePenalty = getFatiguePenalty(fatigueStatus);

  // Compute tool bonuses
  let toolSkillBonus = 0;
  let toolYieldBonus = 0;
  const toolIds = data.toolIds ?? [];
  for (const toolId of toolIds) {
    const tool = ctx.tools.find((t) => t.id === toolId);
    if (!tool) continue;
    toolSkillBonus += tool.skillBonus ?? 0;
    toolYieldBonus += tool.yieldBonus ?? 0;
  }

  // Check for supervisor (helper with skill 15+)
  let supervisorSkill15Plus = false;
  for (const helperId of task.helperIds) {
    const helper = ctx.characters.find((c) => c.id === helperId);
    if (helper) {
      const helperSkills = helper.skills ?? helper.characterSheet?.skills ?? [];
      const found = helperSkills.find((s) => {
        const name = typeof s === 'string' ? s : (s.name ?? '');
        return name.toLowerCase().includes('survival') ||
               name.toLowerCase().includes('naturalist') ||
               name.toLowerCase().includes('herb lore');
      });
      if (found) {
        const level = typeof found === 'string' ? 10 : (found.level ?? found.points ?? 10);
        if (level >= 15) {
          supervisorSkill15Plus = true;
          break;
        }
      }
    }
  }

  // Build context flags
  const flags: ForageContextFlags = data.contextFlags ?? {
    hasMapOrGuide: false,
    isUnfamiliarOrHostile: false,
    isPeakSeason: false,
    isOffSeason: false,
    hasProperTools: false,
    isDenseOrDangerousTerrain: false,
  };

  // Build the engine input
  const input: ForageActionInput = {
    actorId: task.leaderId,
    zoneId: data.zoneId,
    mode: data.mode ?? 'general',
    targetCategory: data.targetCategory,
    targetItemId: data.targetItemId,
    skillUsed: data.skillUsed ?? 'survival',
    baseSkillLevel: data.leaderSkill ?? 10,
    contextFlags: flags,
    toolIds,
    helperCount: task.helperIds.length,
    supervisorSkill15Plus,
    toolSkillBonus: toolSkillBonus + fatiguePenalty,
    toolYieldBonus,
    weatherModifier,
  };

  // Resolve using the engine — pass gatheringItems for per-item selection
  const result = resolveForage(
    input,
    zone,
    ctx.forageItems,
    ctx.foragingConfig,
    leaderName,
    ctx.gatheringItems
  );

  // Convert ForageActionResult → TaskResults
  const success = result.tierOutcome !== 'nothing' && result.tierOutcome !== 'scraps' && result.found.length > 0;

  const inventoryChanges = result.found.map((stack) => ({
    itemId: stack.itemId,
    quantity: stack.quantity,
    itemName: stack.itemName,
  }));

  // Add found items to inventory
  const zoneName = zone?.name ?? 'unknown zone';
  for (const stack of result.found) {
    const itemId = `forage-${stack.itemId}-${Date.now()}`;
    if (stack.inventoryKind === 'food') {
      campaignActions.acquireItem({
        kind: 'food',
        id: itemId,
        name: stack.itemName,
        types: [stack.typeId],
        quantity: stack.quantity,
        source: `Foraging at ${zoneName}`,
      }, 'party', 'gathering');
    } else {
      campaignActions.acquireItem({
        kind: 'material',
        id: itemId,
        name: stack.itemName,
        type: stack.typeId,
        quantity: stack.quantity,
        source: `Foraging at ${zoneName}`,
      }, 'party', 'gathering');
    }
  }

  // No XP awarded for foraging
  const experienceGained = 0;

  // Build message
  let message = result.logText;
  if (result.event?.notes) {
    message += ` Event: ${result.event.notes}`;
  }

  return {
    success,
    message,
    inventoryChanges: inventoryChanges.length > 0 ? inventoryChanges : [],
    experienceGained,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ForagingActivity({ currentDayKey, currentSlot }: ForagingActivityProps) {
  const ctx = useDowntimeContext();
  const { actions: campaignActions } = useCampaignStore();
  const { skillBonus: gatheringWeatherMod } = useWeatherModifiers('gathering');
  const {
    state,
    characters,
    tools,
    forageZones,
    forageItems,
    foragingConfig,
    createDowntimeTask,
    beginResolve,
    resolve,
    cancel,
  } = ctx;

  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resolvingTask, setResolvingTask] = useState<DowntimeTask | null>(null);

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

  // Handle task resolution using the new foraging engine
  const handleResolve = useCallback(
    (task: DowntimeTask, mode: ResolutionMode) => {
      if (mode === 'manual') {
        // Open manual resolution panel
        setResolvingTask(task);
      } else {
        // Auto-resolve
        beginResolve(task.id);
        const results = resolveForagingTask(task, ctx, campaignActions, gatheringWeatherMod);
        resolve(task.id, results);
      }
    },
    [ctx, campaignActions, beginResolve, resolve, gatheringWeatherMod]
  );

  // Handle manual resolution finalize
  const handleManualFinalize = useCallback(
    (results: TaskResults) => {
      if (resolvingTask) {
        beginResolve(resolvingTask.id);
        resolve(resolvingTask.id, results);
        setResolvingTask(null);
      }
    },
    [resolvingTask, beginResolve, resolve]
  );

  // Handle manual resolution cancel
  const handleManualCancel = useCallback(() => {
    setResolvingTask(null);
  }, []);

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

  // Get leader for resolution panel
  const resolvingLeader = resolvingTask
    ? characters.find(c => c.id === resolvingTask.leaderId)
    : undefined;

  return (
    <div className="foraging-activity" data-testid="foraging-activity">
      {/* Header */}
      <header className="activity-header flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-gray-100">Foraging</h3>
        </div>
        {!isCreating && !resolvingTask && (
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
          className="flex items-center gap-2 bg-red-900/30 border border-red-500 text-red-300 px-3 py-2 rounded mb-4"
          role="alert"
          data-testid="validation-error"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="ml-auto text-red-300 hover:text-red-100"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Manual Resolution Panel */}
      {resolvingTask && (
        <div className="mb-4">
          <ForagingResolutionPanel
            task={resolvingTask}
            leader={resolvingLeader}
            onFinalize={handleManualFinalize}
            onCancel={handleManualCancel}
          />
        </div>
      )}

      {/* Creation Form */}
      {isCreating && !resolvingTask && (
        <ForagingTaskForm
          characters={characters}
          zones={forageZones}
          forageItems={forageItems}
          tools={foragingTools}
          foragingConfig={foragingConfig}
          state={state}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
          onSubmit={handleCreate}
          onCancel={handleFormCancel}
        />
      )}

      {/* Pending Tasks */}
      {!resolvingTask && (
        <section className="pending-tasks mb-6" data-testid="pending-tasks-section">
          <h4 className="font-medium mb-2 text-gray-200">
            Pending ({pendingTasks.length})
          </h4>
          {pendingTasks.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No pending foraging tasks</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <ForagingTaskCard
                  key={task.id}
                  task={task}
                  zones={forageZones}
                  forageItems={forageItems}
                  characters={characters}
                  onResolve={(mode) => handleResolve(task, mode)}
                  onCancel={() => handleCancel(task.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Completed Tasks */}
      {!resolvingTask && (
        <section className="completed-tasks" data-testid="completed-tasks-section">
          <h4 className="font-medium mb-2 text-gray-200">
            Completed ({completedTasks.length})
          </h4>
          {completedTasks.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No completed foraging tasks</p>
          ) : (
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <ForagingTaskCard
                  key={task.id}
                  task={task}
                  zones={forageZones}
                  forageItems={forageItems}
                  characters={characters}
                  readonly
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
