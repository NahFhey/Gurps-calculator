import { useState } from 'react';
import { TASK_STATUS, FISHING_METHODS, FORAGING_RARITIES } from '../../../constants';
import { DiceRoller } from '../../DiceRoller';
import { validateWorkerAssignment } from '../../../utils/dayPlanner';
import { resolveTask } from '../../../utils/taskResolution';
import { determineDynamicEventType, parseDiceFormula } from '../../../utils/gathering';
import type {
  TaskDetailPanelProps,
  TaskAssignment,
  DiceRollState
} from '../../../types/dayplanner';

/**
 * TaskDetailPanel - Shows details and resolution UI for a selected task
 *
 * Handles task configuration (worker assignment, environment, tools),
 * mode-specific settings (fishing/foraging), and manual roll resolution.
 */
export function TaskDetailPanel({
  task,
  workers,
  environments,
  tools,
  species,
  categories,
  items,
  bait,
  tables,
  taskAssignments,
  currentDay,
  currentSlot,
  updateTask,
  completeTask
}: TaskDetailPanelProps) {
  const [validationError, setValidationError] = useState('');

  // Manual resolution roll state
  const [isResolving, setIsResolving] = useState(false);
  const [skillRoll, setSkillRoll] = useState<DiceRollState>({ dice: [], total: 0 });
  const [eventCheckRoll, setEventCheckRoll] = useState<DiceRollState>({ dice: [], total: 0 });
  const [eventTableRoll, setEventTableRoll] = useState<DiceRollState>({ dice: [], total: 0 });
  const [tableRoll, setTableRoll] = useState<DiceRollState>({ dice: [], total: 0 });

  if (!task) return null;

  /**
   * Updates a field on the task
   */
  function updateField(field: keyof TaskAssignment, value: unknown) {
    const updatedTask = { ...task, [field]: value } as TaskAssignment;

    // Recalculate assignedWorkerIds if workers changed
    if (field === 'leaderWorkerId' || field === 'helperWorkerIds') {
      updatedTask.assignedWorkerIds = [
        updatedTask.leaderWorkerId,
        ...(updatedTask.helperWorkerIds || [])
      ].filter((id): id is string => Boolean(id));
    }

    updateTask(updatedTask);
  }

  /**
   * Validates and sets the leader
   */
  function setLeader(workerId: string) {
    if (!workerId) {
      updateField('leaderWorkerId', null);
      setValidationError('');
      return;
    }

    const validation = validateWorkerAssignment(
      taskAssignments,
      currentDay,
      currentSlot,
      workerId,
      task!.id
    );

    if (!validation.valid) {
      setValidationError(validation.error || 'Validation failed');
      return;
    }

    setValidationError('');
    updateField('leaderWorkerId', workerId);
  }

  /**
   * Validates and toggles a helper
   */
  function toggleHelper(workerId: string) {
    const currentHelpers = task!.helperWorkerIds || [];
    const isCurrentlyHelper = currentHelpers.includes(workerId);

    if (isCurrentlyHelper) {
      // Remove helper
      updateField('helperWorkerIds', currentHelpers.filter(id => id !== workerId));
      setValidationError('');
      return;
    }

    // Add helper - validate first
    const validation = validateWorkerAssignment(
      taskAssignments,
      currentDay,
      currentSlot,
      workerId,
      task!.id
    );

    if (!validation.valid) {
      setValidationError(validation.error || 'Validation failed');
      return;
    }

    setValidationError('');
    updateField('helperWorkerIds', [...currentHelpers, workerId]);
  }

  /**
   * Toggles tool selection
   */
  function toggleTool(toolId: string) {
    const currentTools = task!.selectedToolIds || [];
    const isSelected = currentTools.includes(toolId);

    if (isSelected) {
      updateField('selectedToolIds', currentTools.filter(id => id !== toolId));
    } else {
      updateField('selectedToolIds', [...currentTools, toolId]);
    }
  }

  /**
   * Filters tools available for this mode
   */
  const availableTools = tools.filter(tool =>
    tool.allowedModes?.includes(task.mode)
  );

  /**
   * Gets available environments for this mode
   */
  const availableEnvironments = environments.filter(env =>
    env.supportedModes?.includes(task.mode)
  );

  /**
   * Checks if task is ready to be completed
   */
  const canComplete = task.leaderWorkerId && task.environmentId;

  /**
   * Resets resolution state
   */
  function resetResolutionState() {
    setIsResolving(false);
    setSkillRoll({ dice: [], total: 0 });
    setEventCheckRoll({ dice: [], total: 0 });
    setEventTableRoll({ dice: [], total: 0 });
    setTableRoll({ dice: [], total: 0 });
  }

  return (
    <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto">
      <div>
        <h3 className="text-lg font-bold">{task.mode} Task</h3>
        <div className="text-sm text-gray-400">Order: {task.orderIndex + 1}</div>
        <div className="text-xs text-gray-500 mt-1">
          Status: <span className={task.resolutionState === TASK_STATUS.Completed ? 'text-green-400' : 'text-yellow-400'}>
            {task.resolutionState}
          </span>
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="p-2 bg-red-900 border border-red-600 rounded text-sm">
          {validationError}
        </div>
      )}

      {/* Task is completed - show summary */}
      {task.resolutionState === TASK_STATUS.Completed ? (
        <TaskCompletedView
          task={task}
          species={species}
          items={items}
          updateTask={updateTask}
        />
      ) : (
        /* Task configuration */
        <TaskConfigurationView
          task={task}
          workers={workers}
          availableTools={availableTools}
          availableEnvironments={availableEnvironments}
          items={items}
          bait={bait}
          species={species}
          isResolving={isResolving}
          canComplete={!!canComplete}
          skillRoll={skillRoll}
          eventCheckRoll={eventCheckRoll}
          eventTableRoll={eventTableRoll}
          tableRoll={tableRoll}
          environments={environments}
          tools={tools}
          tables={tables}
          categories={categories}
          setLeader={setLeader}
          toggleHelper={toggleHelper}
          toggleTool={toggleTool}
          updateField={updateField}
          setIsResolving={setIsResolving}
          setSkillRoll={setSkillRoll}
          setEventCheckRoll={setEventCheckRoll}
          setEventTableRoll={setEventTableRoll}
          setTableRoll={setTableRoll}
          resetResolutionState={resetResolutionState}
          completeTask={completeTask}
        />
      )}
    </div>
  );
}

/**
 * TaskCompletedView - Shows results after task completion
 */
interface TaskCompletedViewProps {
  task: TaskAssignment;
  species: TaskDetailPanelProps['species'];
  items: TaskDetailPanelProps['items'];
  updateTask: (task: TaskAssignment) => void;
}

function TaskCompletedView({ task, species, items, updateTask }: TaskCompletedViewProps) {
  return (
    <div className="space-y-3">
      <div className="p-3 bg-green-900 border border-green-600 rounded">
        <div className="font-medium text-green-200">Task Completed</div>
        <div className="text-sm text-green-300 mt-1">
          Results added to pending day ledger
        </div>
      </div>

      {/* Show found item for foraging tasks */}
      {task.mode === 'Foraging' && task.payload?.findResult?.type === 'item' && (
        <ForagingResultRoller task={task} items={items} updateTask={updateTask} />
      )}

      {/* Show caught species for fishing tasks */}
      {task.mode === 'Fishing' && task.payload?.tableEntry?.resultType === 'species' && (
        <FishingResultRoller task={task} species={species} updateTask={updateTask} />
      )}

      {task.notes && (
        <div className="p-3 bg-gray-700 rounded">
          <div className="text-xs text-gray-400 mb-1">Notes:</div>
          <div className="text-sm">{task.notes}</div>
        </div>
      )}

      {task.warnings && task.warnings.length > 0 && (
        <div className="p-3 bg-yellow-900 border border-yellow-600 rounded">
          <div className="text-xs text-yellow-300 mb-1">Warnings:</div>
          {task.warnings.map((warning, idx) => (
            <div key={idx} className="text-sm text-yellow-200">• {warning}</div>
          ))}
        </div>
      )}

      {task.inventoryDelta && task.inventoryDelta.length > 0 && (
        <div className="p-3 bg-gray-700 rounded">
          <div className="text-xs text-gray-400 mb-1">Inventory Pending:</div>
          {task.inventoryDelta.map((delta, idx) => (
            <div key={idx} className="text-sm">
              {delta.speciesName || delta.name}: {delta.units} units
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ForagingResultRoller - Shows yield roller for foraged items
 */
interface ForagingResultRollerProps {
  task: TaskAssignment;
  items: TaskDetailPanelProps['items'];
  updateTask: (task: TaskAssignment) => void;
}

function ForagingResultRoller({ task, items: _items, updateTask }: ForagingResultRollerProps) {
  const foundItem = task.payload?.findResult?.item;
  if (!foundItem) return null;

  // Parse yield formula to get dice info
  const formula = foundItem.yieldFormula || '1d';
  const parsed = parseDiceFormula(formula);
  const diceCount = parsed.count || 1;
  const diceSides = parsed.sides || 6;
  const modValue = parsed.modifier || 0;

  // Get current yield from inventory delta
  const currentDelta = task.inventoryDelta?.find(d =>
    (d.speciesName || d.name) === foundItem.name
  );
  const currentYield = currentDelta?.units || 0;
  const currentDice = currentDelta?.dice || [];

  return (
    <div className="p-3 bg-purple-900 border border-purple-600 rounded">
      <div className="font-medium text-purple-200 mb-2">Found Item</div>
      <div className="text-sm text-purple-100 mb-1">{foundItem.name}</div>
      <div className="text-xs text-purple-300 mb-3">
        Yield Formula: {formula}
      </div>

      <DiceRoller
        label="Roll for Yield"
        diceCount={diceCount}
        diceSides={diceSides}
        modifier={modValue}
        dice={currentDice}
        total={currentYield}
        onRoll={(dice, total) => {
          // Update inventory delta with new yield and dice
          const updatedDelta = (task.inventoryDelta || []).map(d => {
            if ((d.speciesName || d.name) === foundItem.name) {
              return { ...d, units: total, dice };
            }
            return d;
          });
          updateTask({
            ...task,
            inventoryDelta: updatedDelta
          });
        }}
        onTotalChange={(total) => {
          // Update inventory delta with manual yield
          const updatedDelta = (task.inventoryDelta || []).map(d => {
            if ((d.speciesName || d.name) === foundItem.name) {
              return { ...d, units: total, dice: [] };
            }
            return d;
          });
          updateTask({
            ...task,
            inventoryDelta: updatedDelta
          });
        }}
      />
    </div>
  );
}

/**
 * FishingResultRoller - Shows yield rollers for caught fish
 */
interface FishingResultRollerProps {
  task: TaskAssignment;
  species: TaskDetailPanelProps['species'];
  updateTask: (task: TaskAssignment) => void;
}

function FishingResultRoller({ task, species, updateTask }: FishingResultRollerProps) {
  const speciesId = task.payload?.tableEntry?.speciesId;
  const caughtSpecies = species.find(s => s.id === speciesId);
  if (!caughtSpecies) return null;

  // Parse meat yield formula
  const meatFormula = caughtSpecies.yieldMeatFormula || '1d';
  const meatParsed = parseDiceFormula(meatFormula);
  const meatDiceCount = meatParsed.count || 1;
  const meatDiceSides = meatParsed.sides || 6;
  const meatModValue = meatParsed.modifier || 0;

  // Get current meat yield from inventory delta
  const meatDelta = task.inventoryDelta?.find(d =>
    d.type === 'food' && d.speciesName === caughtSpecies.name
  );
  const currentMeatYield = meatDelta?.units || 0;
  const currentMeatDice = meatDelta?.dice || [];

  // Parse secondary yield formula if exists
  const hasSecondary = caughtSpecies.yieldSecondaryFormula && caughtSpecies.secondaryMaterialType;
  let secondaryDiceCount = 1, secondaryDiceSides = 6, secondaryModValue = 0;
  let currentSecondaryYield = 0, currentSecondaryDice: number[] = [];
  let secondaryName = '';

  if (hasSecondary) {
    const secondaryFormula = caughtSpecies.yieldSecondaryFormula || '1d';
    const secondaryParsed = parseDiceFormula(secondaryFormula);
    secondaryDiceCount = secondaryParsed.count || 1;
    secondaryDiceSides = secondaryParsed.sides || 6;
    secondaryModValue = secondaryParsed.modifier || 0;

    secondaryName = caughtSpecies.secondaryNameOverride || `${caughtSpecies.name} ${caughtSpecies.secondaryMaterialType}`;
    const secondaryDelta = task.inventoryDelta?.find(d =>
      d.type === 'material' && d.name === secondaryName
    );
    currentSecondaryYield = secondaryDelta?.units || 0;
    currentSecondaryDice = secondaryDelta?.dice || [];
  }

  return (
    <div className="p-3 bg-blue-900 border border-blue-600 rounded space-y-3">
      <div>
        <div className="font-medium text-blue-200 mb-2">Caught Species</div>
        <div className="text-sm text-blue-100 mb-1">{caughtSpecies.name}</div>
      </div>

      {/* Meat Yield Roller */}
      <div>
        <div className="text-xs text-blue-300 mb-2">
          Meat Yield Formula: {meatFormula}
        </div>
        <DiceRoller
          label="Roll for Meat Yield"
          diceCount={meatDiceCount}
          diceSides={meatDiceSides}
          modifier={meatModValue}
          dice={currentMeatDice}
          total={currentMeatYield}
          onRoll={(dice, total) => {
            // Update meat yield in inventory delta with dice
            const updatedDelta = (task.inventoryDelta || []).map(d => {
              if (d.type === 'food' && d.speciesName === caughtSpecies.name) {
                return { ...d, units: total, dice };
              }
              return d;
            });
            updateTask({
              ...task,
              inventoryDelta: updatedDelta
            });
          }}
          onTotalChange={(total) => {
            const updatedDelta = (task.inventoryDelta || []).map(d => {
              if (d.type === 'food' && d.speciesName === caughtSpecies.name) {
                return { ...d, units: total, dice: [] };
              }
              return d;
            });
            updateTask({
              ...task,
              inventoryDelta: updatedDelta
            });
          }}
        />
      </div>

      {/* Secondary Material Yield Roller */}
      {hasSecondary && (
        <div>
          <div className="text-xs text-blue-300 mb-2">
            {secondaryName} Formula: {caughtSpecies.yieldSecondaryFormula}
          </div>
          <DiceRoller
            label={`Roll for ${caughtSpecies.secondaryMaterialType}`}
            diceCount={secondaryDiceCount}
            diceSides={secondaryDiceSides}
            modifier={secondaryModValue}
            dice={currentSecondaryDice}
            total={currentSecondaryYield}
            onRoll={(dice, total) => {
              // Update secondary yield in inventory delta with dice
              const updatedDelta = (task.inventoryDelta || []).map(d => {
                if (d.type === 'material' && d.name === secondaryName) {
                  return { ...d, units: total, dice };
                }
                return d;
              });
              updateTask({
                ...task,
                inventoryDelta: updatedDelta
              });
            }}
            onTotalChange={(total) => {
              const updatedDelta = (task.inventoryDelta || []).map(d => {
                if (d.type === 'material' && d.name === secondaryName) {
                  return { ...d, units: total, dice: [] };
                }
                return d;
              });
              updateTask({
                ...task,
                inventoryDelta: updatedDelta
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * TaskConfigurationView - Shows task setup and resolution UI
 */
interface TaskConfigurationViewProps {
  task: TaskAssignment;
  workers: TaskDetailPanelProps['workers'];
  availableTools: TaskDetailPanelProps['tools'];
  availableEnvironments: TaskDetailPanelProps['environments'];
  items: TaskDetailPanelProps['items'];
  bait: TaskDetailPanelProps['bait'];
  species: TaskDetailPanelProps['species'];
  environments: TaskDetailPanelProps['environments'];
  tools: TaskDetailPanelProps['tools'];
  tables: TaskDetailPanelProps['tables'];
  categories: TaskDetailPanelProps['categories'];
  isResolving: boolean;
  canComplete: boolean;
  skillRoll: DiceRollState;
  eventCheckRoll: DiceRollState;
  eventTableRoll: DiceRollState;
  tableRoll: DiceRollState;
  setLeader: (workerId: string) => void;
  toggleHelper: (workerId: string) => void;
  toggleTool: (toolId: string) => void;
  updateField: (field: keyof TaskAssignment, value: unknown) => void;
  setIsResolving: (resolving: boolean) => void;
  setSkillRoll: (roll: DiceRollState) => void;
  setEventCheckRoll: (roll: DiceRollState) => void;
  setEventTableRoll: (roll: DiceRollState) => void;
  setTableRoll: (roll: DiceRollState) => void;
  resetResolutionState: () => void;
  completeTask: (task: TaskAssignment) => void;
}

function TaskConfigurationView({
  task,
  workers,
  availableTools,
  availableEnvironments,
  items,
  bait,
  species,
  environments,
  tools,
  tables,
  categories,
  isResolving,
  canComplete,
  skillRoll,
  eventCheckRoll,
  eventTableRoll,
  tableRoll,
  setLeader,
  toggleHelper,
  toggleTool,
  updateField,
  setIsResolving,
  setSkillRoll,
  setEventCheckRoll,
  setEventTableRoll,
  setTableRoll,
  resetResolutionState,
  completeTask
}: TaskConfigurationViewProps) {
  return (
    <div className="space-y-4">
      {/* Worker Assignment */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Leader *</label>
        <select
          value={task.leaderWorkerId || ''}
          onChange={(e) => setLeader(e.target.value)}
          className="w-full bg-gray-700 px-3 py-2 rounded"
        >
          <option value="">-- Select Leader --</option>
          {workers.map(worker => (
            <option key={worker.id} value={worker.id}>
              {worker.name}
            </option>
          ))}
        </select>
      </div>

      {/* Helpers */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Helpers (optional)</label>
        <div className="space-y-1">
          {workers
            .filter(w => w.id !== task.leaderWorkerId)
            .map(worker => (
              <label key={worker.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600">
                <input
                  type="checkbox"
                  checked={(task.helperWorkerIds || []).includes(worker.id)}
                  onChange={() => toggleHelper(worker.id)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{worker.name}</span>
              </label>
            ))}
        </div>
      </div>

      {/* Environment */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Environment *</label>
        <select
          value={task.environmentId || ''}
          onChange={(e) => updateField('environmentId', e.target.value)}
          className="w-full bg-gray-700 px-3 py-2 rounded"
        >
          <option value="">-- Select Environment --</option>
          {availableEnvironments.map(env => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tools */}
      {availableTools.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Tools (optional)</label>
          <div className="space-y-1">
            {availableTools.map(tool => (
              <label key={tool.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600">
                <input
                  type="checkbox"
                  checked={(task.selectedToolIds || []).includes(tool.id)}
                  onChange={() => toggleTool(tool.id)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{tool.name}</span>
                {tool.bonuses && tool.bonuses.length > 0 && (
                  <span className="text-xs text-green-400 ml-auto">
                    +{tool.bonuses.find(b => b.type === 'skill_bonus')?.value || 0}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Mode-specific configuration */}
      {task.mode === 'Fishing' && (
        <FishingConfigSection task={task} bait={bait} species={species} updateField={updateField} />
      )}

      {task.mode === 'Foraging' && (
        <ForagingConfigSection task={task} items={items} updateField={updateField} />
      )}

      {/* Resolution UI */}
      {task.resolutionState !== TASK_STATUS.Completed && !isResolving && (
        <div className="space-y-2">
          {!canComplete && (
            <div className="text-xs text-yellow-400">
              Assign a leader and select an environment to complete this task
            </div>
          )}
          <button
            onClick={() => setIsResolving(true)}
            disabled={!canComplete}
            className={`w-full px-4 py-2 rounded ${
              canComplete
                ? 'bg-purple-600 hover:bg-purple-500'
                : 'bg-gray-600 opacity-50 cursor-not-allowed'
            }`}
          >
            Begin Resolution
          </button>
        </div>
      )}

      {/* Manual Roll UI */}
      {isResolving && task.resolutionState !== TASK_STATUS.Completed && (
        <ManualResolutionUI
          task={task}
          workers={workers}
          environments={environments}
          tools={tools}
          tables={tables}
          species={species}
          categories={categories}
          items={items}
          skillRoll={skillRoll}
          eventCheckRoll={eventCheckRoll}
          eventTableRoll={eventTableRoll}
          tableRoll={tableRoll}
          setSkillRoll={setSkillRoll}
          setEventCheckRoll={setEventCheckRoll}
          setEventTableRoll={setEventTableRoll}
          setTableRoll={setTableRoll}
          resetResolutionState={resetResolutionState}
          completeTask={completeTask}
        />
      )}
    </div>
  );
}

/**
 * FishingConfigSection - Fishing-specific task configuration
 */
interface FishingConfigSectionProps {
  task: TaskAssignment;
  bait: TaskDetailPanelProps['bait'];
  species: TaskDetailPanelProps['species'];
  updateField: (field: keyof TaskAssignment, value: unknown) => void;
}

function FishingConfigSection({ task, bait, species, updateField }: FishingConfigSectionProps) {
  return (
    <div className="p-3 bg-gray-700 rounded border border-gray-600 space-y-3">
      <div className="text-sm font-medium text-gray-300">Fishing Configuration</div>

      {/* Method Selection */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Method</label>
        <select
          value={task.method || 'Line'}
          onChange={(e) => updateField('method', e.target.value)}
          className="w-full bg-gray-600 px-3 py-2 rounded"
        >
          {Object.keys(FISHING_METHODS).map(method => (
            <option key={method} value={method}>{method}</option>
          ))}
        </select>
      </div>

      {/* Bait Selection (only for Line fishing) */}
      {task.method === 'Line' && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Bait (optional)</label>
          <select
            value={task.baitId || ''}
            onChange={(e) => updateField('baitId', e.target.value)}
            className="w-full bg-gray-600 px-3 py-2 rounded"
          >
            <option value="">No bait</option>
            {bait.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.quantity} remaining)</option>
            ))}
          </select>
        </div>
      )}

      {/* Target Species */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Target Species (optional)</label>
        <select
          value={task.targetSpeciesId || ''}
          onChange={(e) => updateField('targetSpeciesId', e.target.value)}
          className="w-full bg-gray-600 px-3 py-2 rounded"
        >
          <option value="">Any species</option>
          {species.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * ForagingConfigSection - Foraging-specific task configuration
 */
interface ForagingConfigSectionProps {
  task: TaskAssignment;
  items: TaskDetailPanelProps['items'];
  updateField: (field: keyof TaskAssignment, value: unknown) => void;
}

function ForagingConfigSection({ task, items, updateField }: ForagingConfigSectionProps) {
  return (
    <div className="p-3 bg-gray-700 rounded border border-gray-600 space-y-3">
      <div className="text-sm font-medium text-gray-300">Foraging Configuration</div>

      {/* Skill Selection */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Skill</label>
        <select
          value={task.intent?.skill || 'Survival'}
          onChange={(e) => updateField('intent', { ...task.intent, skill: e.target.value })}
          className="w-full bg-gray-600 px-3 py-2 rounded"
        >
          <option value="Survival">Survival</option>
          <option value="Naturalist">Naturalist</option>
          <option value="Herb Lore">Herb Lore</option>
        </select>
      </div>

      {/* Target Selection */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Target (optional)</label>
        <select
          value={task.intent?.targetItemId || ''}
          onChange={(e) => {
            const value = e.target.value;
            if (!value) {
              updateField('intent', { ...task.intent, targetItemId: null });
            } else {
              updateField('intent', { ...task.intent, targetItemId: value });
            }
          }}
          className="w-full bg-gray-600 px-3 py-2 rounded"
        >
          <option value="">Random foraging</option>
          {items.map(i => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      {/* Context Modifiers */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400">Context Modifiers</div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.intent?.isUnfamiliar || false}
            onChange={(e) => updateField('intent', { ...task.intent, isUnfamiliar: e.target.checked })}
            className="w-4 h-4"
          />
          Unfamiliar terrain (-4)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.intent?.hasMapGuide || false}
            onChange={(e) => updateField('intent', { ...task.intent, hasMapGuide: e.target.checked })}
            className="w-4 h-4"
          />
          Has map/guide (+2)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.intent?.isPeakSeason || false}
            onChange={(e) => updateField('intent', { ...task.intent, isPeakSeason: e.target.checked })}
            className="w-4 h-4"
          />
          Peak season (+1)
        </label>
      </div>

      {/* Target Rarity Display (only if targeting) */}
      {task.intent?.targetItemId && items && FORAGING_RARITIES && (() => {
        const targetItem = items.find(i => i.id === task.intent?.targetItemId);
        if (!targetItem) return null;
        const rarity = targetItem.rarity || 'Common';
        const rarityData = FORAGING_RARITIES[rarity as keyof typeof FORAGING_RARITIES] || FORAGING_RARITIES.Common || { label: rarity, penalty: 0 };
        return (
          <div className="p-2 bg-gray-600 rounded">
            <div className="text-xs text-gray-400 mb-1">Target Rarity</div>
            <div className="text-sm text-gray-200">{rarityData.label} ({rarityData.penalty})</div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * ManualResolutionUI - Dice rolling interface for task resolution
 */
interface ManualResolutionUIProps {
  task: TaskAssignment;
  workers: TaskDetailPanelProps['workers'];
  environments: TaskDetailPanelProps['environments'];
  tools: TaskDetailPanelProps['tools'];
  tables: TaskDetailPanelProps['tables'];
  species: TaskDetailPanelProps['species'];
  categories: TaskDetailPanelProps['categories'];
  items: TaskDetailPanelProps['items'];
  skillRoll: DiceRollState;
  eventCheckRoll: DiceRollState;
  eventTableRoll: DiceRollState;
  tableRoll: DiceRollState;
  setSkillRoll: (roll: DiceRollState) => void;
  setEventCheckRoll: (roll: DiceRollState) => void;
  setEventTableRoll: (roll: DiceRollState) => void;
  setTableRoll: (roll: DiceRollState) => void;
  resetResolutionState: () => void;
  completeTask: (task: TaskAssignment) => void;
}

function ManualResolutionUI({
  task,
  workers,
  environments,
  tools,
  tables,
  species,
  categories,
  items,
  skillRoll,
  eventCheckRoll,
  eventTableRoll,
  tableRoll,
  setSkillRoll,
  setEventCheckRoll,
  setEventTableRoll,
  setTableRoll,
  resetResolutionState,
  completeTask
}: ManualResolutionUIProps) {
  // Get leader and environment for skill calculation
  const leader = workers.find(w => w.id === task.leaderWorkerId);
  const env = environments.find(e => e.id === task.environmentId);
  const selectedTools = tools.filter(t => (task.selectedToolIds || []).includes(t.id));

  if (!leader || !env) {
    return (
      <div className="text-red-400">Error: Missing leader or environment</div>
    );
  }

  // Calculate effective skill based on mode
  let effectiveSkill = 10;
  let skillLabel = 'Skill';
  if (task.mode === 'Fishing') {
    const baseFishingSkill = leader.skills?.fishing || 10;
    const toolBonus = selectedTools.reduce((sum, tool) => {
      const skillBonus = tool.bonuses?.find(b => b.type === 'skill_bonus');
      return sum + (skillBonus?.value || 0);
    }, 0);
    effectiveSkill = baseFishingSkill + toolBonus + (env.skillMod || 0);
    skillLabel = 'Fishing Skill';
  } else if (task.mode === 'Foraging') {
    const baseForagingSkill = leader.skills?.survival || 10;
    const toolBonus = selectedTools.reduce((sum, tool) => {
      const skillBonus = tool.bonuses?.find(b => b.type === 'skill_bonus');
      return sum + (skillBonus?.value || 0);
    }, 0);
    effectiveSkill = baseForagingSkill + toolBonus + (env.skillMod || 0);
    skillLabel = 'Foraging Skill';
  }

  // Check if event was triggered based on separate event check roll
  const eventType = eventCheckRoll.total > 0 ? determineDynamicEventType(eventCheckRoll.total) : 'none';
  const showEventTableRoll = eventType !== 'none';

  // Get table info
  const modeDefaults = env.defaultsByMode?.[task.mode] || { randomCatchTableId: null, mildEventTableId: null, rareEventTableId: null };
  const findTable = tables.find(t => t.id === modeDefaults.randomCatchTableId);
  const tableName = findTable?.name || 'Table';
  const tableRollMethod = findTable?.rollMethod || '2d6';
  const tableDiceCount = tableRollMethod === '1d6' ? 1 : tableRollMethod === '3d6' ? 3 : 2;

  // Check if event table exists
  const eventTableId = eventType === 'rare' ? modeDefaults.rareEventTableId : modeDefaults.mildEventTableId;
  const eventTable = tables.find(t => t.id === eventTableId);
  const eventTableName = eventTable?.name || `${eventType === 'rare' ? 'Rare' : 'Mild'} Event`;

  // Can finalize when all required rolls are done
  const canFinalize = skillRoll.total > 0 && eventCheckRoll.total > 0 && tableRoll.total > 0 && (!showEventTableRoll || eventTableRoll.total > 0);

  return (
    <div className="space-y-3 bg-gray-800 p-4 rounded border-2 border-purple-500">
      <div className="text-lg font-bold text-purple-300">Manual Resolution</div>

      {/* 1. Skill Roll */}
      <DiceRoller
        label={skillLabel}
        diceCount={3}
        diceSides={6}
        dice={skillRoll.dice}
        total={skillRoll.total}
        targetNumber={effectiveSkill}
        onRoll={(dice, total) => setSkillRoll({ dice, total })}
        onTotalChange={(total) => setSkillRoll({ ...skillRoll, total })}
      />

      {/* 2. Event Check Roll */}
      <DiceRoller
        label="Event Check"
        diceCount={3}
        diceSides={6}
        dice={eventCheckRoll.dice}
        total={eventCheckRoll.total}
        onRoll={(dice, total) => setEventCheckRoll({ dice, total })}
        onTotalChange={(total) => setEventCheckRoll({ ...eventCheckRoll, total })}
      />

      {/* 3. Event Table Roll (if event triggered) */}
      {showEventTableRoll && (
        <div className="border-l-4 border-yellow-500 pl-3">
          <div className="text-xs text-yellow-300 mb-1">
            {eventType === 'rare' ? 'Rare' : 'Mild'} Event Triggered!
          </div>
          <DiceRoller
            label={eventTableName}
            diceCount={2}
            diceSides={6}
            dice={eventTableRoll.dice}
            total={eventTableRoll.total}
            onRoll={(dice, total) => setEventTableRoll({ dice, total })}
            onTotalChange={(total) => setEventTableRoll({ ...eventTableRoll, total })}
          />
        </div>
      )}

      {/* 4. Catch/Find Table Roll */}
      {skillRoll.total > 0 && (
        <DiceRoller
          label={tableName}
          diceCount={tableDiceCount}
          diceSides={6}
          dice={tableRoll.dice}
          total={tableRoll.total}
          onRoll={(dice, total) => setTableRoll({ dice, total })}
          onTotalChange={(total) => setTableRoll({ ...tableRoll, total })}
        />
      )}

      {/* Finalize Button */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={resetResolutionState}
          className="flex-1 px-4 py-2 rounded bg-gray-600 hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            // Resolve task with manual roll values
            const resolution = resolveTask({
              task,
              leader,
              environment: env,
              tools: selectedTools,
              species,
              categories,
              items,
              tables,
              manualRolls: {
                skillRoll: skillRoll.total,
                eventCheckRoll: eventCheckRoll.total,
                eventTableRoll: showEventTableRoll ? eventTableRoll.total : null,
                tableRoll: tableRoll.total
              }
            });

            // Mark task as completed
            const completedTask: TaskAssignment = {
              ...task,
              resolutionState: 'Completed',
              payload: resolution.payload,
              inventoryDelta: resolution.inventoryDelta,
              notes: resolution.notes,
              warnings: resolution.warnings
            };
            completeTask(completedTask);

            // Reset state
            resetResolutionState();
          }}
          disabled={!canFinalize}
          className={`flex-1 px-4 py-2 rounded ${
            canFinalize
              ? 'bg-green-600 hover:bg-green-500'
              : 'bg-gray-600 opacity-50 cursor-not-allowed'
          }`}
        >
          Finalize Task
        </button>
      </div>
    </div>
  );
}
