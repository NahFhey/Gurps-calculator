/**
 * Mining Activity View
 *
 * Main view for the mining downtime activity.
 * Displays pending and completed mining tasks and allows
 * creation, resolution, and cancellation of tasks.
 *
 * Supports two methods:
 * - Surface Prospecting: locate + harvest in 1 slot, discovers new sites
 * - Deep Mining: extract from mapped sites, 1 slot per extraction
 *
 * Mining sites are stored locally and persisted via task results.
 * Extracted materials are added to inventory.
 */

import { useState, useCallback, useMemo } from 'react';
import { HardHat, Plus, AlertCircle } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useCampaignStore } from '../../../state/campaignStore';
import { MiningTaskForm } from './MiningTaskForm';
import { MiningTaskCard, type ResolutionMode } from './MiningTaskCard';
import { MiningResolutionPanel } from './MiningResolutionPanel';
import {
  selectTasksByActivityType,
  validateTaskCreation,
} from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import {
  MINERALS_BY_ID,
  MINERALS_BY_RARITY,
  DEPOSIT_CAPACITY,
  EXTRACTION_YIELD_MULTIPLIERS,
  SPECIFIC_RESOURCE_PENALTIES,
  determineLocateOutcome,
  checkEventTrigger,
  selectEvent,
  getTeamBonus,
  LOCATE_MODIFIERS,
  EXTRACTION_MODIFIERS,
  type ExtractionOutcome,
} from '../../../constants/mining';
import {
  isCriticalSuccess,
  isCriticalFailure,
  parseDiceFormula,
} from '../../../utils/gathering';
import { selectCharacterFatigueStatus, getFatiguePenalty } from '../../../state/downtime/downtimeSelectors';
import type { DowntimeTask, MiningData, MiningSite, TaskResults } from '../../../types/downtime';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { Material } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface MiningActivityProps {
  currentDayKey: number;
  currentSlot: number;
}

// ============================================================================
// AUTO-RESOLUTION HELPERS
// ============================================================================

function rollDie(sides: number = 6): number {
  return Math.floor(Math.random() * sides) + 1;
}

function roll3d6Total(): number {
  return rollDie() + rollDie() + rollDie();
}

function roll2d6Total(): number {
  return rollDie() + rollDie();
}

function rollFormulaTotal(formula: string): number {
  const parsed = parseDiceFormula(formula);
  if (!parsed) return 1;
  let total = 0;
  for (let i = 0; i < parsed.count; i++) {
    total += rollDie(parsed.sides || 6);
  }
  return Math.max(1, total + (parsed.modifier || 0));
}

function selectMineralByRarity(rarity: string, targetResourceId?: string) {
  if (targetResourceId && MINERALS_BY_ID[targetResourceId]) {
    return MINERALS_BY_ID[targetResourceId];
  }
  const pool = MINERALS_BY_RARITY[rarity as keyof typeof MINERALS_BY_RARITY] ?? MINERALS_BY_RARITY.common;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Auto-resolve a mining task. Returns results, optionally a new site,
 * and optionally an updated existing site (with depleted units).
 */
function autoResolveMiningTask(
  task: DowntimeTask,
  ctx: ReturnType<typeof useDowntimeContext>,
  campaignActions: { addMaterial: (m: Material) => void },
  miningSites: MiningSite[],
): { results: TaskResults; newSite?: MiningSite; updatedSite?: MiningSite } {
  const data = task.activityData as MiningData;
  const isSurface = data.method === 'Surface Prospecting';
  const leader = ctx.characters.find((c) => c.id === task.leaderId);
  const leaderName = leader?.name ?? 'Worker';

  // Calculate effective locate skill
  let locateSkill = data.leaderLocateSkill ?? 10;
  const flags = data.contextFlags;
  if (flags?.hasDetailedMaps) locateSkill += LOCATE_MODIFIERS.detailedMaps;
  if (flags?.knownRichDeposit) locateSkill += LOCATE_MODIFIERS.knownRichDeposit;
  if (flags?.randomUnexplored) locateSkill += LOCATE_MODIFIERS.randomUnexplored;
  if (flags?.hasSupervisor) locateSkill += LOCATE_MODIFIERS.supervisor15Plus;
  const fatigueStatus = selectCharacterFatigueStatus(ctx.state, task.leaderId, task.dayKey, task.slot);
  locateSkill += getFatiguePenalty(fatigueStatus);
  locateSkill += getTeamBonus(task.helperIds.length);
  for (const toolId of data.toolIds ?? []) {
    const tool = ctx.tools.find((t) => t.id === toolId);
    if (tool) locateSkill += tool.skillBonus ?? 0;
  }
  if (data.targetResourceId) {
    const mineral = MINERALS_BY_ID[data.targetResourceId];
    if (mineral) locateSkill += SPECIFIC_RESOURCE_PENALTIES[mineral.rarity];
  }

  // Calculate effective extraction skill
  let extractSkill = data.leaderExtractionSkill ?? 10;
  if (flags?.hasProperTools) extractSkill += EXTRACTION_MODIFIERS.properTools;
  if (flags?.isImprovisedTools) extractSkill += EXTRACTION_MODIFIERS.improvisedTools;
  if (flags?.hasSupervisor) extractSkill += EXTRACTION_MODIFIERS.supervisor15Plus;
  if (data.extractionSkill === 'prospecting' && !flags?.hasProperTools) {
    extractSkill += EXTRACTION_MODIFIERS.prospectingExtractionPenalty;
  }
  extractSkill += getFatiguePenalty(fatigueStatus);
  extractSkill += getTeamBonus(task.helperIds.length);
  for (const toolId of data.toolIds ?? []) {
    const tool = ctx.tools.find((t) => t.id === toolId);
    if (tool) extractSkill += tool.skillBonus ?? 0;
  }

  const inventoryChanges: { itemId: string; quantity: number; itemName: string }[] = [];
  let message = '';
  let success = false;
  let newSite: MiningSite | undefined;
  let updatedSite: MiningSite | undefined;

  if (isSurface) {
    // Locate roll
    const locateRoll = roll3d6Total();
    const locateSucceeded = locateRoll <= locateSkill && !isCriticalFailure(locateRoll, locateSkill);
    const locateCrit = isCriticalSuccess(locateRoll, locateSkill);
    const locateCritFail = isCriticalFailure(locateRoll, locateSkill);
    const locateMargin = locateSkill - locateRoll;

    if (!locateSucceeded) {
      message = `${leaderName} searched for a mining site (rolled ${locateRoll} vs ${locateSkill}) but found nothing.`;
      if (locateCritFail) message += ' Critical failure — false lead or immediate hazard!';
      return { results: { success: false, message, inventoryChanges: [], experienceGained: 0 } };
    }

    const locateOutcome = determineLocateOutcome(locateMargin, locateCrit);
    const mineral = selectMineralByRarity(locateOutcome.rarity, data.targetResourceId);
    const depositCapFormula = DEPOSIT_CAPACITY[mineral.category][locateOutcome.depositSize];
    const depositCap = rollFormulaTotal(depositCapFormula);

    const siteId = `mine-site-${Date.now()}`;
    newSite = {
      id: siteId,
      name: `${mineral.name} Deposit`,
      zoneId: data.zoneId,
      materials: [mineral.id],
      depositSize: locateOutcome.depositSize,
      totalUnits: depositCap,
      remainingUnits: depositCap,
      mapped: true,
      depleted: false,
      quality: 'normal',
      discoveredAt: Date.now(),
    };

    message = `${leaderName} discovered a ${locateOutcome.depositSize} ${mineral.name} deposit (${depositCap} units, rolled ${locateRoll} vs ${locateSkill}, MoS ${locateMargin}).`;

    // Extraction
    const extRoll = roll3d6Total();
    const extSucceeded = extRoll <= extractSkill && !isCriticalFailure(extRoll, extractSkill);
    const extCrit = isCriticalSuccess(extRoll, extractSkill);
    const extCritFail = isCriticalFailure(extRoll, extractSkill);

    let outcome: ExtractionOutcome = 'failure';
    if (extCrit) outcome = 'criticalSuccess';
    else if (extCritFail) outcome = 'criticalFailure';
    else if (extSucceeded) outcome = 'success';

    if (outcome !== 'criticalFailure') {
      let baseYield = rollFormulaTotal(mineral.yieldFormula);
      if (extractSkill >= 15) baseYield += rollDie();
      const multiplier = EXTRACTION_YIELD_MULTIPLIERS[outcome];
      const finalYield = Math.max(0, Math.floor(baseYield * multiplier));

      if (finalYield > 0 && newSite) {
        newSite.remainingUnits = Math.max(0, newSite.remainingUnits - finalYield);
        if (newSite.remainingUnits <= 0) newSite.depleted = true;

        inventoryChanges.push({ itemId: mineral.id, quantity: finalYield, itemName: mineral.name });
        campaignActions.addMaterial({
          id: `mine-${mineral.id}-${Date.now()}`,
          name: mineral.name,
          type: mineral.typeId,
          quantity: finalYield,
          source: `Mining at ${newSite.name}`,
        } as Material);

        message += ` Extracted ${finalYield} units (${outcome}).`;
        success = true;
      }
    } else {
      message += ' Extraction failed critically — no yield!';
    }

    // Events (surface: only on crits)
    if (extCrit || extCritFail) {
      const eventCheck = roll3d6Total();
      const eventSev = checkEventTrigger(eventCheck);
      if (eventSev !== 'none') {
        const evt = selectEvent(eventSev, roll2d6Total());
        message += ` Event: ${evt.name} — ${evt.description}`;
      }
    }
  } else {
    // Deep Mining
    const site = data.siteId ? miningSites.find((s) => s.id === data.siteId) : undefined;
    if (!site) {
      return { results: { success: false, message: `${leaderName} has no valid mining site selected.`, inventoryChanges: [], experienceGained: 0 } };
    }

    const mineral = MINERALS_BY_ID[site.materials[0]] ?? MINERALS_BY_RARITY.common[0];

    const extRoll = roll3d6Total();
    const extSucceeded = extRoll <= extractSkill && !isCriticalFailure(extRoll, extractSkill);
    const extCrit = isCriticalSuccess(extRoll, extractSkill);
    const extCritFail = isCriticalFailure(extRoll, extractSkill);

    let outcome: ExtractionOutcome = 'failure';
    if (extCrit) outcome = 'criticalSuccess';
    else if (extCritFail) outcome = 'criticalFailure';
    else if (extSucceeded) outcome = 'success';

    if (outcome !== 'criticalFailure') {
      let baseYield = rollFormulaTotal(mineral.yieldFormula);
      if (extractSkill >= 15) baseYield += rollDie();
      const multiplier = EXTRACTION_YIELD_MULTIPLIERS[outcome];
      const finalYield = Math.max(0, Math.floor(baseYield * multiplier));

      if (finalYield > 0) {
        // Deplete the site
        const newRemaining = Math.max(0, site.remainingUnits - finalYield);
        updatedSite = {
          ...site,
          remainingUnits: newRemaining,
          depleted: newRemaining <= 0,
        };

        inventoryChanges.push({ itemId: mineral.id, quantity: finalYield, itemName: mineral.name });
        campaignActions.addMaterial({
          id: `mine-${mineral.id}-${Date.now()}`,
          name: mineral.name,
          type: mineral.typeId,
          quantity: finalYield,
          source: `Mining at ${site.name}`,
        } as Material);

        message = `${leaderName} extracted ${finalYield} units of ${mineral.name} from ${site.name} (rolled ${extRoll} vs ${extractSkill}, ${outcome}). ${newRemaining} units remaining.`;
        if (newRemaining <= 0) message += ' Deposit is now depleted!';
        success = true;
      } else {
        message = `${leaderName} mined at ${site.name} but extracted nothing useful.`;
      }
    } else {
      message = `${leaderName} had a critical failure while mining ${site.name}! No yield and possible hazard!`;
    }

    // Events
    const shouldEvent = data.dangerMode === 'full' || !extSucceeded || extCrit || extCritFail;
    if (shouldEvent) {
      const eventCheck = roll3d6Total();
      const eventSev = checkEventTrigger(eventCheck);
      if (eventSev !== 'none') {
        const evt = selectEvent(eventSev, roll2d6Total());
        message += ` Event: ${evt.name} — ${evt.description}`;
      }
    }
  }

  return {
    results: { success, message, inventoryChanges: inventoryChanges.length > 0 ? inventoryChanges : [], experienceGained: 0 },
    newSite,
    updatedSite,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MiningActivity({ currentDayKey, currentSlot }: MiningActivityProps) {
  const ctx = useDowntimeContext();
  const { actions: campaignActions } = useCampaignStore();
  const {
    state,
    characters,
    tools,
    createDowntimeTask,
    beginResolve,
    resolve,
    cancel,
  } = ctx;

  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resolvingTask, setResolvingTask] = useState<DowntimeTask | null>(null);
  const [miningSites, setMiningSites] = useState<MiningSite[]>([]);

  // Get mining tasks for current slot
  const miningTasks = useMemo(() => {
    return selectTasksByActivityType(state, 'mining').filter(
      (t) => t.dayKey === currentDayKey && t.slot === currentSlot
    );
  }, [state, currentDayKey, currentSlot]);

  const pendingTasks = useMemo(
    () => miningTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [miningTasks]
  );

  const completedTasks = useMemo(
    () => miningTasks.filter((t) => t.status === 'resolved' || t.status === 'cancelled'),
    [miningTasks]
  );

  // Handle task creation
  const handleCreate = useCallback(
    (data: { leaderId: string; helperIds: string[]; activityData: MiningData }) => {
      const payload: CreateTaskPayload = {
        activityType: 'mining',
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
        setResolvingTask(task);
      } else {
        beginResolve(task.id);
        const { results, newSite, updatedSite } = autoResolveMiningTask(task, ctx, campaignActions, miningSites);
        if (newSite) {
          setMiningSites((prev) => [...prev, newSite]);
        }
        if (updatedSite) {
          setMiningSites((prev) => prev.map((s) => s.id === updatedSite.id ? updatedSite : s));
        }
        resolve(task.id, results);
      }
    },
    [ctx, campaignActions, miningSites, beginResolve, resolve]
  );

  // Handle manual resolution finalize
  const handleManualFinalize = useCallback(
    (results: TaskResults, newSite?: MiningSite, updatedSite?: MiningSite) => {
      if (resolvingTask) {
        beginResolve(resolvingTask.id);
        if (newSite) {
          setMiningSites((prev) => [...prev, newSite]);
        }
        if (updatedSite) {
          setMiningSites((prev) => prev.map((s) => s.id === updatedSite.id ? updatedSite : s));
        }
        resolve(resolvingTask.id, results);
        setResolvingTask(null);
      }
    },
    [resolvingTask, beginResolve, resolve]
  );

  const handleManualCancel = useCallback(() => {
    setResolvingTask(null);
  }, []);

  const handleCancel = useCallback(
    (taskId: string) => { cancel(taskId); },
    [cancel]
  );

  const handleFormCancel = useCallback(() => {
    setIsCreating(false);
    setValidationError(null);
  }, []);

  const resolvingLeader = resolvingTask
    ? characters.find((c) => c.id === resolvingTask.leaderId)
    : undefined;

  return (
    <div className="mining-activity" data-testid="mining-activity">
      {/* Header */}
      <header className="activity-header flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <HardHat className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-gray-100">Mining</h3>
        </div>
        {!isCreating && !resolvingTask && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-sm"
            data-testid="new-mining-task-button"
          >
            <Plus className="w-4 h-4" />
            New Mining Task
          </button>
        )}
      </header>

      {/* Mapped Sites Summary */}
      {miningSites.length > 0 && !resolvingTask && (
        <div className="mb-4 bg-gray-900/50 border border-gray-700 rounded p-3">
          <h4 className="text-sm font-medium text-gray-200 mb-2">Mapped Sites ({miningSites.length})</h4>
          <div className="space-y-1">
            {miningSites.map((site) => (
              <div key={site.id} className="flex items-center justify-between text-xs text-gray-300">
                <span>
                  {site.name} — {site.depositSize}
                </span>
                <span className={site.depleted ? 'text-red-400' : 'text-green-400'}>
                  {site.depleted ? 'Depleted' : `${site.remainingUnits}/${site.totalUnits} units`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <MiningResolutionPanel
            task={resolvingTask}
            leader={resolvingLeader}
            miningSites={miningSites}
            onFinalize={handleManualFinalize}
            onCancel={handleManualCancel}
          />
        </div>
      )}

      {/* Creation Form */}
      {isCreating && !resolvingTask && (
        <MiningTaskForm
          characters={characters}
          tools={tools}
          miningSites={miningSites}
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
            <p className="text-gray-400 text-sm italic">No pending mining tasks</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <MiningTaskCard
                  key={task.id}
                  task={task}
                  characters={characters}
                  miningSites={miningSites}
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
            <p className="text-gray-400 text-sm italic">No completed mining tasks</p>
          ) : (
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <MiningTaskCard
                  key={task.id}
                  task={task}
                  characters={characters}
                  miningSites={miningSites}
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
