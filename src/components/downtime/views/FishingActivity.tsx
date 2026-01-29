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
 */

import { useState, useCallback, useMemo } from 'react';
import { Fish, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { FishingTaskForm } from './FishingTaskForm';
import { FishingTaskCard } from './FishingTaskCard';
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
  calculateFishYields,
  roll3d6,
} from '../../../utils/gathering';
import {
  BAIT_MODIFIERS,
  LARGE_FISH_TARGETING_PENALTY,
  DEFAULT_FISH_ST,
} from '../../../constants';
import type { DowntimeTask, FishingData, TaskResults, InventoryDelta } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { GatheringSpecies, GatheringEnvironment, GatheringTable, GatheringBait } from '../../../types/campaign';

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
// FISHING RESOLUTION
// ============================================================================

/**
 * Calculate fishing results using proper GURPS mechanics.
 *
 * Steps:
 * 1. Calculate effective skill with all modifiers
 * 2. Roll 3d6 vs effective skill
 * 3. Determine fish count based on method and outcome
 * 4. For each fish, determine species (targeted or random)
 * 5. Handle large fish struggle if needed
 * 6. Calculate yields for successful catches
 */
function calculateFishingResults(
  task: DowntimeTask,
  leader: { st?: number; skills?: { fishing?: number; spear?: number } } | undefined,
  species: GatheringSpecies[],
  bait: GatheringBait[],
  gatheringTables: GatheringTable[],
  spot: GatheringEnvironment | undefined
): TaskResults {
  const data = task.activityData as FishingData;
  const method = data.method || 'Line';
  const isRandomCatch = data.isRandomCatch ?? true;

  // Get base skill (Fishing for Line/Net, could be Spear for spear fishing)
  const baseSkill = method === 'Spear'
    ? (leader?.skills?.spear ?? leader?.skills?.fishing ?? 10)
    : (leader?.skills?.fishing ?? 10);

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

  // Calculate effective skill
  const effectiveSkillResult = calculateEffectiveFishingSkill({
    baseFishingSkill: baseSkill,
    toolBonus: data.skillModifier, // Already includes tool bonus from form
    hasCorrectBait,
    hasInappropriateBait,
    targetingLargeFish,
    retryPenalty: -(data.retryAttempt ?? 0), // Negative cumulative penalty
    environmentMod: spot?.skillMod ?? 0,
  });

  const effectiveSkill = typeof effectiveSkillResult === 'number'
    ? effectiveSkillResult
    : effectiveSkillResult.effectiveSkill;

  // Roll 3d6 for fishing
  const fishingRollResult = roll3d6();
  const roll = fishingRollResult.total;

  // Evaluate the roll
  const rollResult = evaluateFishingRoll(roll, effectiveSkill, method);

  // Handle failure
  if (!rollResult.success) {
    const canRetry = !rollResult.critFailure && (data.retryAttempt ?? 0) < 2;
    const message = rollResult.critFailure
      ? `Critical Failure! (Rolled ${roll} vs ${effectiveSkill}) - ${rollResult.description}`
      : `Failure (Rolled ${roll} vs ${effectiveSkill}) - ${rollResult.description}${canRetry ? ` You may retry.` : ''}`;

    return {
      success: false,
      message,
      inventoryChanges: [],
      experienceGained: 5, // Small consolation XP
    };
  }

  // Calculate fish count
  let fishCount = rollResult.fish;

  // Net fishing: 1 fish + 1 per 3 MoS (already handled in evaluateFishingRoll)
  // Make sure we have at least 2 on crit for Net
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
      // Targeted fishing - catch the target species
      caughtSpecies = targetSpecies;
    } else if (catchTable) {
      // Random catch - roll on table
      try {
        let tableEntry;
        if (method === 'Net') {
          // Net fishing rerolls large fish
          tableEntry = rollNetCatch(catchTable as any, species as any);
        } else {
          // Get bait roll bonus for random Line fishing
          const baitRollBonus = baitItem ? ((baitItem as any).rollBonus ?? 0) : 0;
          tableEntry = rollOnCatchTable(catchTable as any, baitRollBonus);
        }

        if (tableEntry.resultType === 'species' && tableEntry.speciesId) {
          caughtSpecies = species.find(s => s.id === tableEntry.speciesId);
        }
      } catch (error) {
        // Table error - skip this fish
        continue;
      }
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
      const yields = calculateFishYields(caughtSpecies as any);
      if (yields && typeof yields === 'object' && 'meatUnits' in yields) {
        meatYield = yields.meatUnits ?? 0;
        secondaryYield = yields.secondaryUnits ?? 0;
        secondaryType = yields.secondaryType ?? null;
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

    // Add to inventory changes
    if (struggleSuccess && meatYield > 0) {
      const foodType = (caughtSpecies as any).foodType ?? 'fish';
      inventoryChanges.push({
        itemId: caughtSpecies.id,
        quantity: meatYield,
        itemName: `${caughtSpecies.name} ${foodType.charAt(0).toUpperCase() + foodType.slice(1)}`,
      });

      if (secondaryYield > 0 && secondaryType) {
        inventoryChanges.push({
          itemId: `${caughtSpecies.id}_secondary`,
          quantity: secondaryYield,
          itemName: `${caughtSpecies.name} ${secondaryType.charAt(0).toUpperCase() + secondaryType.slice(1)}`,
        });
      }
    }
  }

  // Build result message
  const successfulCatches = caughtFish.filter(f => f.struggleSuccess);
  const escapedLarge = caughtFish.filter(f => f.isLarge && !f.struggleSuccess);

  let message = rollResult.critSuccess
    ? `Critical Success! (Rolled ${roll} vs ${effectiveSkill})`
    : `Success! (Rolled ${roll} vs ${effectiveSkill}, MoS: ${rollResult.margin})`;

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

  // Calculate total yield for XP
  const totalYield = successfulCatches.reduce((sum, f) => sum + f.meatYield, 0);

  return {
    success: successfulCatches.length > 0,
    message,
    inventoryChanges,
    experienceGained: Math.max(10, totalYield * 5),
  };
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

  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  // Filter tools for fishing (show all tools for now - can add category filtering later)
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
      const data = task.activityData as FishingData;

      // Get leader character
      const leader = characters.find(c => c.id === task.leaderId) as any;

      // Get fishing spot
      const spot = fishingSpots.find(s => s.id === data.spotId);

      // Begin resolution (mark as in_progress)
      beginResolve(task.id);

      // Calculate and apply results with proper mechanics
      const results = calculateFishingResults(
        task,
        leader,
        fishSpecies as any[],
        fishingBait as any[],
        gatheringTables as any[],
        spot
      );
      resolve(task.id, results);
    },
    [characters, fishSpecies, fishingBait, fishingSpots, gatheringTables, beginResolve, resolve]
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
    <div className="fishing-activity" data-testid="fishing-activity">
      {/* Header */}
      <header className="activity-header flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Fish className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Fishing</h3>
        </div>
        {!isCreating && (
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

      {/* Creation Form */}
      {isCreating && (
        <FishingTaskForm
          characters={characters}
          spots={fishingSpots}
          species={fishSpecies}
          tools={fishingTools}
          bait={fishingBait}
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
                readonly
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
