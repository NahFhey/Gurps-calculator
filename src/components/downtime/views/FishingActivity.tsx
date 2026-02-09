/**
 * Fishing Activity View
 *
 * Main view for the fishing downtime activity.
 * Displays pending and completed fishing tasks and allows
 * creation, resolution, and cancellation of tasks.
 *
 * Implements proper GURPS fishing mechanics:
 * - 3d6 roll vs effective skill
 * - Method-specific fish counts (Line/Spear: 1-2, Net: 1 + 1 per 3 MoS)
 * - Bait modifiers (+1 correct, -2 wrong)
 * - Large fish penalty (-2) and struggle
 * - Retry mechanics (up to 3 attempts at cumulative -1)
 *
 * Supports both auto and manual resolution modes.
 */

import { useState, useCallback, useMemo } from 'react';
import { Fish, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useCampaignStore } from '../../../state/campaignStore';
import { FishingTaskForm } from './FishingTaskForm';
import { FishingTaskCard, type ResolutionMode } from './FishingTaskCard';
import { FishingResolutionPanel } from './FishingResolutionPanel';
import {
  selectTasksByActivityType,
  validateTaskCreation,
} from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import {
  evaluateFishingRoll,
  calculateEffectiveFishingSkill,
  rollNetCatch,
  rollOnCatchTable,
  resolveLargeFishStruggle,
  roll3d6,
} from '../../../utils/gathering';
import {
  DEFAULT_FISH_ST,
} from '../../../constants';
import { getCharacterSkills } from '../../../types/characterSheet';
import { selectCharacterFatigueStatus, getFatiguePenalty } from '../../../state/downtime/downtimeSelectors';
import { useWeatherModifiers } from '../../../hooks/useWeatherModifiers';
import type { DowntimeState, DowntimeTask, FishingData, TaskResults, InventoryDelta } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { GatheringSpecies, GatheringEnvironment, GatheringTable, GatheringBait, Food, Material } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface FishingActivityProps {
  /** Current day key for task scheduling */
  currentDayKey: number;
  /** Current time slot for task scheduling */
  currentSlot: number;
}

interface CaughtFish {
  species: GatheringSpecies;
  isLarge: boolean;
  struggled: boolean;
  struggleSuccess: boolean;
  meatYield: number;
  secondaryYield: number;
  secondaryType: string | null;
}

// ============================================================================
// AUTO FISHING RESOLUTION
// ============================================================================

/**
 * Calculate fishing results using proper GURPS mechanics (auto-roll mode).
 * Also saves results directly to foods/materials inventory.
 */
function calculateFishingResultsAuto(
  task: DowntimeTask,
  leader: any | undefined,
  species: GatheringSpecies[],
  bait: GatheringBait[],
  gatheringTables: GatheringTable[],
  spot: GatheringEnvironment | undefined,
  campaignActions: { addFood: (food: Food) => void; addMaterial: (material: Material) => void; addGatheringBait: (bait: GatheringBait) => void },
  downtimeState?: DowntimeState,
  weatherModifier: number = 0
): TaskResults {
  const data = task.activityData as FishingData;
  const method = data.method || 'Line';
  const isRandomCatch = data.isRandomCatch ?? true;

  // Get merged skills from all sources (GCS, work.skills, direct skills)
  const leaderSkills = leader ? getCharacterSkills(leader) : {};

  // Get base skill (Fishing for Line/Net, Spear for spear fishing)
  const baseSkill = method === 'Spear'
    ? (leaderSkills.spear ?? leaderSkills.fishing ?? 10)
    : (leaderSkills.fishing ?? 10);

  // Spear Fishing: Stealth approach roll first
  let stealthPenalty = 0;
  let stealthMessage = '';
  if (method === 'Spear') {
    const stealthSkill = leaderSkills.stealth ?? leaderSkills.survival ?? 10;
    const stealthRoll = roll3d6();
    const stealthSuccess = stealthRoll.total <= stealthSkill;

    if (!stealthSuccess) {
      stealthPenalty = -2;
      stealthMessage = `Stealth approach failed (${stealthRoll.total} vs ${stealthSkill}), -2 to strike. `;
    } else {
      stealthMessage = `Good approach (${stealthRoll.total} vs ${stealthSkill}). `;
    }
  }

  // Get bait item and check compatibility
  const baitItem = data.baitId ? bait.find(b => b.id === data.baitId) : null;
  const targetSpecies = !isRandomCatch && data.speciesId
    ? species.find(s => s.id === data.speciesId)
    : null;

  // Check bait compatibility for targeted fishing
  let hasCorrectBait = false;
  let hasInappropriateBait = false;
  if (baitItem && targetSpecies && !isRandomCatch) {
    const attractsSpeciesIds = (baitItem as any).attractsSpeciesIds;
    if (Array.isArray(attractsSpeciesIds)) {
      hasCorrectBait = attractsSpeciesIds.includes(data.speciesId);
      hasInappropriateBait = !hasCorrectBait;
    }
  }

  // Check if targeting large fish
  const targetIsLarge = targetSpecies
    ? ((targetSpecies as any).tags?.includes('LargeFish') ?? false)
    : false;
  const targetingLargeFish = !isRandomCatch && targetIsLarge;

  // Calculate fatigue penalty for the leader
  let fatiguePenalty = 0;
  let fatigueLabel = '';
  if (downtimeState && leader) {
    const fatigueStatus = selectCharacterFatigueStatus(
      downtimeState,
      leader.id ?? task.leaderId,
      task.dayKey,
      task.slot
    );
    fatiguePenalty = getFatiguePenalty(fatigueStatus);
    if (fatiguePenalty !== 0) {
      fatigueLabel = ` Fatigue(${fatigueStatus}): ${fatiguePenalty}.`;
    }
  }

  // Calculate effective skill (include stealth penalty for spear fishing + fatigue)
  const effectiveSkillResult = calculateEffectiveFishingSkill({
    baseFishingSkill: baseSkill,
    toolBonus: data.skillModifier + stealthPenalty + fatiguePenalty + weatherModifier,
    hasCorrectBait,
    hasInappropriateBait,
    targetingLargeFish,
    retryPenalty: -(data.retryAttempt ?? 0),
    environmentMod: spot?.skillMod ?? 0,
  });

  const effectiveSkill = typeof effectiveSkillResult === 'number'
    ? effectiveSkillResult
    : effectiveSkillResult.effectiveSkill;

  // Roll 3d6 for fishing/strike
  const fishingRollResult = roll3d6();
  const roll = fishingRollResult.total;

  // Evaluate the roll
  const rollResult = evaluateFishingRoll(roll, effectiveSkill, method);

  // Handle failure
  if (!rollResult.success) {
    const canRetry = !rollResult.critFailure && (data.retryAttempt ?? 0) < 2;
    const message = rollResult.critFailure
      ? `${stealthMessage}${fatigueLabel ? fatigueLabel + ' ' : ''}Critical Failure! (Rolled ${roll} vs ${effectiveSkill}) - ${rollResult.description}`
      : `${stealthMessage}${fatigueLabel ? fatigueLabel + ' ' : ''}Failure (Rolled ${roll} vs ${effectiveSkill}) - ${rollResult.description}${canRetry ? ` You may retry.` : ''}`;

    return {
      success: false,
      message,
      inventoryChanges: [],
    };
  }

  // Calculate fish count
  let fishCount = rollResult.fish;
  if (method === 'Net' && rollResult.critSuccess && fishCount < 2) {
    fishCount = 2;
  }

  // Determine caught fish
  const caughtFish: CaughtFish[] = [];
  const inventoryChanges: InventoryDelta[] = [];

  // Get random catch table for the spot
  const spotDefaults = spot?.defaultsByMode?.Fishing ?? (spot as any)?.defaultTables;
  const catchTableId = spotDefaults?.randomCatchTableId;
  const catchTable = catchTableId
    ? gatheringTables.find(t => t.id === catchTableId)
    : null;

  for (let i = 0; i < fishCount; i++) {
    let caughtSpecies: GatheringSpecies | undefined;

    if (!isRandomCatch && targetSpecies) {
      caughtSpecies = targetSpecies;
    } else if (catchTable) {
      try {
        let tableEntry;
        if (method === 'Net') {
          tableEntry = rollNetCatch(catchTable as any, species as any);
        } else {
          const baitRollBonus = baitItem ? ((baitItem as any).rollBonus ?? 0) : 0;
          tableEntry = rollOnCatchTable(catchTable as any, baitRollBonus);
        }

        if (tableEntry.resultType === 'species' && tableEntry.speciesId) {
          caughtSpecies = species.find(s => s.id === tableEntry.speciesId);
        }
      } catch (error) {
        // Fall through to use fallback
      }
    }

    // Fallback: if no catch table or species lookup failed, use first species
    if (!caughtSpecies && species.length > 0) {
      // Randomly pick a species from available list for more variety
      caughtSpecies = species[Math.floor(Math.random() * species.length)];
    }

    if (!caughtSpecies) continue;

    // Check if fish is large
    const isLarge = (caughtSpecies as any).tags?.includes('LargeFish') ?? false;
    let struggleSuccess = true;

    // Large fish struggle (Line and Spear only, not Net)
    if (isLarge && method !== 'Net') {
      const characterST = leader?.st ?? 10;
      const fishST = (caughtSpecies as any).st ?? DEFAULT_FISH_ST;
      const struggleResult = resolveLargeFishStruggle(characterST, fishST);
      struggleSuccess = struggleResult.success;
    }

    // Calculate yields if struggle succeeded
    let meatYield = 0;
    let secondaryYield = 0;
    let secondaryType: string | null = null;

    if (struggleSuccess) {
      // Roll yield dice
      const meatFormula = (caughtSpecies as any)?.yieldMeatFormula ?? '1d';
      meatYield = rollYieldDice(meatFormula);

      // Only roll for secondary if species has secondary material type
      const speciesSecondaryType = (caughtSpecies as any)?.secondaryMaterialType;
      if (speciesSecondaryType && speciesSecondaryType !== 'None' && speciesSecondaryType !== '') {
        const secondaryFormula = (caughtSpecies as any)?.yieldSecondaryFormula ?? '1d-2';
        secondaryType = speciesSecondaryType;
        secondaryYield = rollYieldDice(secondaryFormula);
      }
    }

    caughtFish.push({
      species: caughtSpecies,
      isLarge,
      struggled: isLarge && method !== 'Net',
      struggleSuccess,
      meatYield,
      secondaryYield,
      secondaryType,
    });

    // Add to inventory and campaign
    if (struggleSuccess && meatYield > 0) {
      const foodId = `fish-${caughtSpecies.id}-${Date.now()}-${i}`;
      const foodName = `${caughtSpecies.name} Meat`;
      // Use the species' foodType instead of hardcoded 'fish'
      const foodType = (caughtSpecies as any).foodType ?? 'fish';

      campaignActions.addFood({
        id: foodId,
        name: foodName,
        types: [foodType],
        quantity: meatYield,
        source: `Fishing at ${spot?.name ?? 'unknown'}`,
      } as Food);

      inventoryChanges.push({
        itemId: foodId,
        quantity: meatYield,
        itemName: foodName,
      });

      if (secondaryYield > 0 && secondaryType) {
        const materialId = `material-${caughtSpecies.id}-${secondaryType}-${Date.now()}-${i}`;
        const materialName = `${caughtSpecies.name} ${secondaryType.charAt(0).toUpperCase() + secondaryType.slice(1)}`;

        campaignActions.addMaterial({
          id: materialId,
          name: materialName,
          type: secondaryType,
          quantity: secondaryYield,
          source: `Fishing at ${spot?.name ?? 'unknown'}`,
        } as Material);

        inventoryChanges.push({
          itemId: materialId,
          quantity: secondaryYield,
          itemName: materialName,
        });
      }
    }
  }

  // Build result message
  const successfulCatches = caughtFish.filter(f => f.struggleSuccess);
  const escapedLarge = caughtFish.filter(f => f.isLarge && !f.struggleSuccess);

  let message = stealthMessage + (fatigueLabel ? fatigueLabel + ' ' : '') + (rollResult.critSuccess
    ? `Critical Success! (Rolled ${roll} vs ${effectiveSkill})`
    : `Success! (Rolled ${roll} vs ${effectiveSkill}, MoS: ${rollResult.margin})`);

  if (successfulCatches.length > 0) {
    const catchList = successfulCatches
      .map(f => f.species.name)
      .reduce((acc, name) => {
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const catchStrings = Object.entries(catchList).map(([name, count]) =>
      count > 1 ? `${count}x ${name}` : name
    );

    message += ` Caught: ${catchStrings.join(', ')}.`;
  }

  if (escapedLarge.length > 0) {
    message += ` ${escapedLarge.length} large fish escaped during struggle.`;
  }

  // Consume bait (decrement quantity by 1 per fishing attempt)
  if (baitItem && (baitItem as any).quantity > 0) {
    const updatedBait = { ...baitItem, quantity: (baitItem as any).quantity - 1 } as GatheringBait;
    campaignActions.addGatheringBait(updatedBait);
    message += ` (1 ${baitItem.name} consumed)`;
  }

  return {
    success: successfulCatches.length > 0,
    message,
    inventoryChanges,
  };
}

/**
 * Roll dice for yield formulas like "2d+1" or "1d-2"
 */
function rollYieldDice(formula: string): number {
  const match = formula.match(/(\d+)d([+-]\d+)?/);
  if (match) {
    const diceCount = parseInt(match[1], 10);
    const modifier = match[2] ? parseInt(match[2], 10) : 0;
    let total = 0;
    for (let i = 0; i < diceCount; i++) {
      total += Math.floor(Math.random() * 6) + 1;
    }
    return Math.max(0, total + modifier);
  }
  return 1;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FishingActivity({ currentDayKey, currentSlot }: FishingActivityProps) {
  const {
    state,
    characters,
    fishingSpots,
    fishSpecies,
    tools,
    fishingBait,
    gatheringTables,
    createDowntimeTask,
    beginResolve,
    resolve,
    cancel,
  } = useDowntimeContext();

  const { actions: campaignActions } = useCampaignStore();
  const { skillBonus: gatheringWeatherMod } = useWeatherModifiers('gathering');

  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resolvingTask, setResolvingTask] = useState<DowntimeTask | null>(null);

  // Get fishing tasks for current slot
  const fishingTasks = useMemo(() => {
    return selectTasksByActivityType(state, 'fishing').filter(
      (t) => t.dayKey === currentDayKey && t.slot === currentSlot
    );
  }, [state, currentDayKey, currentSlot]);

  // Separate pending and completed tasks
  const pendingTasks = useMemo(
    () => fishingTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [fishingTasks]
  );

  const completedTasks = useMemo(
    () => fishingTasks.filter((t) => t.status === 'resolved' || t.status === 'cancelled'),
    [fishingTasks]
  );

  // Filter tools for fishing
  const fishingTools = useMemo(() => tools, [tools]);

  // Handle task creation
  const handleCreate = useCallback(
    (data: {
      leaderId: string;
      helperIds: string[];
      activityData: FishingData;
    }) => {
      const payload: CreateTaskPayload = {
        activityType: 'fishing',
        dayKey: currentDayKey,
        slot: currentSlot,
        ...data,
      };

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
    (task: DowntimeTask, mode: ResolutionMode) => {
      if (mode === 'manual') {
        // Open manual resolution panel
        setResolvingTask(task);
      } else {
        // Auto-resolve
        const data = task.activityData as FishingData;
        const leader = characters.find(c => c.id === task.leaderId) as any;
        const spot = fishingSpots.find(s => s.id === data.spotId);

        beginResolve(task.id);

        const results = calculateFishingResultsAuto(
          task,
          leader,
          fishSpecies as any[],
          fishingBait as any[],
          gatheringTables as any[],
          spot,
          campaignActions,
          state,
          gatheringWeatherMod
        );
        resolve(task.id, results);
      }
    },
    [characters, fishSpecies, fishingBait, fishingSpots, gatheringTables, campaignActions, beginResolve, resolve, state, gatheringWeatherMod]
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
    <div className="fishing-activity" data-testid="fishing-activity">
      {/* Header */}
      <header className="activity-header flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Fish className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Fishing</h3>
        </div>
        {!isCreating && !resolvingTask && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
            data-testid="new-fishing-task-button"
          >
            <Plus className="w-4 h-4" />
            New Fishing Task
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

      {/* Manual Resolution Panel */}
      {resolvingTask && (
        <div className="mb-4">
          <FishingResolutionPanel
            task={resolvingTask}
            leader={resolvingLeader}
            species={fishSpecies}
            spots={fishingSpots}
            bait={fishingBait}
            gatheringTables={gatheringTables}
            onFinalize={handleManualFinalize}
            onCancel={handleManualCancel}
          />
        </div>
      )}

      {/* Creation Form */}
      {isCreating && !resolvingTask && (
        <FishingTaskForm
          characters={characters}
          spots={fishingSpots}
          species={fishSpecies}
          tools={fishingTools}
          bait={fishingBait}
          gatheringTables={gatheringTables}
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
            <p className="text-gray-500 text-sm italic">No pending fishing tasks</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <FishingTaskCard
                  key={task.id}
                  task={task}
                  species={fishSpecies}
                  spots={fishingSpots}
                  characters={characters}
                  bait={fishingBait}
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
            <p className="text-gray-500 text-sm italic">No completed fishing tasks</p>
          ) : (
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <FishingTaskCard
                  key={task.id}
                  task={task}
                  species={fishSpecies}
                  spots={fishingSpots}
                  characters={characters}
                  bait={fishingBait}
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
