import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Bed, Plus } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useCampaignStore } from '../../../state/campaignStore';
import { generateTaskId, selectTasksForSlot, validateTaskCreation } from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import { isRestTask } from '../../../types/downtime';
import { estimateHealing } from '../../../utils/recovery';
import { compactCharacterStatus } from '../../../utils/injuryPersistence';
import { getLocationByKey } from '../../../utils/hitLocations';
import { restLog } from '../../../utils/activityLogger';
import { RestTaskForm } from './RestTaskForm';
import { RestTaskCard } from './RestTaskCard';
import { RestResolutionPanel } from './RestResolutionPanel';
import type { RestRecoveryResult } from '../../../utils/recovery';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { RestData, TaskResults } from '../../../types/downtime';
import type { RestTask } from './RestTaskCard';

interface RestActivityProps {
  currentDayKey: number;
  currentSlot: number;
}

export function RestActivity({ currentDayKey, currentSlot }: RestActivityProps) {
  const {
    state,
    characters,
    createDowntimeTask,
    createDowntimeTasksBatch,
    beginResolve,
    resolve,
    cancel,
  } = useDowntimeContext();
  const { actions: campaignActions } = useCampaignStore();
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resolvingTask, setResolvingTask] = useState<RestTask | null>(null);

  const restTasks = useMemo(
    () => selectTasksForSlot(state, currentDayKey, currentSlot).filter(isRestTask),
    [state, currentDayKey, currentSlot]
  );
  const pendingTasks = restTasks.filter((task) => task.status === 'pending' || task.status === 'in_progress');
  const completedTasks = restTasks.filter((task) => task.status === 'resolved' || task.status === 'cancelled');

  const recoveryCharacters = useMemo(
    () => characters.flatMap((character) => {
      const pools = character.gcsData?.pools;
      const hasPersistentStatus = character.status?.dead === true
        || (character.status?.conditions?.length ?? 0) > 0
        || (character.status?.crippled?.length ?? 0) > 0;
      if ((!pools || (pools.HP.current >= pools.HP.max && pools.FP.current >= pools.FP.max))
        && !hasPersistentStatus) return [];
      return [{
        character,
        estimate: pools
          ? estimateHealing(pools.HP.max - pools.HP.current, pools.FP.max - pools.FP.current)
          : null,
      }];
    }),
    [characters]
  );

  const logCreatedTask = useCallback((payload: CreateTaskPayload) => {
    const leader = characters.find((character) => character.id === payload.leaderId);
    if (payload.activityData.type !== 'rest') return;
    campaignActions.addLogEntry(restLog.taskCreated(
      leader?.name ?? payload.leaderId,
      payload.activityData.restType.replace('_', ' '),
      { characterIds: [payload.leaderId], taskId: payload.id }
    ));
  }, [campaignActions, characters]);

  const handleCreate = useCallback((data: {
    leaderId: string;
    helperIds: string[];
    activityData: RestData;
  }) => {
    const payload: CreateTaskPayload = {
      id: generateTaskId(),
      activityType: 'rest',
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
      logCreatedTask(payload);
      setIsCreating(false);
      setValidationError(null);
    } catch (error) {
      setValidationError(error instanceof DowntimeValidationError ? error.message : 'Failed to create task');
    }
  }, [createDowntimeTask, currentDayKey, currentSlot, logCreatedTask, state]);

  const handleCreateBatch = useCallback((payloads: CreateTaskPayload[]) => {
    const identified = payloads.map((payload) => ({ ...payload, id: payload.id ?? generateTaskId() }));
    const results = createDowntimeTasksBatch(identified);
    if (results.every((result) => result.valid)) {
      identified.forEach(logCreatedTask);
      setValidationError(null);
    }
    return results;
  }, [createDowntimeTasksBatch, logCreatedTask]);

  const handleFinalize = useCallback((results: TaskResults, recovery: RestRecoveryResult | null) => {
    if (!resolvingTask) return;
    const leader = characters.find((character) => character.id === resolvingTask.leaderId);

    if (leader?.gcsData && recovery) {
      const resultingHP = leader.gcsData.pools.HP.current + recovery.hpRestored;
      const updatedPools = {
        ...leader.gcsData.pools,
        HP: {
          ...leader.gcsData.pools.HP,
          current: resultingHP,
        },
        FP: {
          ...leader.gcsData.pools.FP,
          current: leader.gcsData.pools.FP.current + recovery.fpRestored,
        },
      };

      const changes: Parameters<typeof campaignActions.updateCharacter>[1] = {
        gcsData: {
          ...leader.gcsData,
          pools: updatedPools,
        },
      };

      if (resultingHP > 0 && leader.status?.conditions?.some(
        condition => condition.conditionId === 'unconscious'
      )) {
        changes.status = compactCharacterStatus({
          ...leader.status,
          conditions: leader.status.conditions.filter(
            condition => condition.conditionId !== 'unconscious'
          ),
        });
      }

      campaignActions.updateCharacter(leader.id, changes);
    }

    beginResolve(resolvingTask.id);
    resolve(resolvingTask.id, results);
    campaignActions.addLogEntry(restLog.recoveryResolved(
      leader?.name ?? resolvingTask.leaderId,
      recovery?.hpRestored ?? 0,
      recovery?.fpRestored ?? 0,
      {
        characterIds: [resolvingTask.leaderId],
        taskId: resolvingTask.id,
        quantity: recovery?.hpRestored ?? 0,
      }
    ));
    setResolvingTask(null);
  }, [beginResolve, campaignActions, characters, resolve, resolvingTask]);

  const resolvingLeader = resolvingTask
    ? characters.find((character) => character.id === resolvingTask.leaderId)
    : undefined;
  const resolvingHealer = resolvingTask?.activityData.healerId
    ? characters.find((character) => character.id === resolvingTask.activityData.healerId) ?? null
    : null;

  return (
    <div data-testid="rest-activity">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bed className="h-5 w-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-fg-bright">Rest &amp; Recovery</h3>
        </div>
        {!isCreating && !resolvingTask && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            data-testid="new-rest-task-button"
            className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New Rest Task
          </button>
        )}
      </header>

      <div className="mb-4 rounded-lg border border-edge bg-surface-1/50 p-3" data-testid="party-recovery-status">
        <h4 className="mb-2 text-sm font-medium text-fg-primary">Party recovery status</h4>
        {recoveryCharacters.length === 0 ? (
          <p className="text-xs text-fg-faint">Everyone with a character sheet is at full HP and FP.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recoveryCharacters.map(({ character, estimate }) => {
              const pools = character.gcsData?.pools;
              const conditionLabels = character.status?.conditions?.map(condition => condition.label) ?? [];
              const crippledLabels = character.status?.crippled?.map(locationKey => (
                getLocationByKey(character.hitLocationProfileId ?? 'humanoid', locationKey)?.label ?? locationKey
              )) ?? [];
              return (
                <div key={character.id} className="rounded bg-surface-0/60 px-3 py-2 text-xs text-fg-secondary">
                  <span className="mr-2 font-medium text-fg-bright">{character.name}</span>
                  {pools && estimate && (
                    <>
                      <span className="mr-2 text-danger-300">HP {pools.HP.current}/{pools.HP.max}</span>
                      <span className="mr-2 text-accent-300">FP {pools.FP.current}/{pools.FP.max}</span>
                      <span className="mr-2 text-fg-muted">Full: HP {estimate.daysToFullHP}d, FP {estimate.daysToFullFP}d</span>
                    </>
                  )}
                  {character.status?.dead && <span className="mr-2 text-danger-400">Dead</span>}
                  {conditionLabels.length > 0 && (
                    <span className="mr-2 text-purple-300">{conditionLabels.join(', ')}</span>
                  )}
                  {crippledLabels.length > 0 && (
                    <span className="text-orange-300">Crippled: {crippledLabels.join(', ')}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {validationError && (
        <div role="alert" data-testid="validation-error" className="mb-4 flex items-center gap-2 rounded border border-danger-500 bg-danger-900/30 px-3 py-2 text-sm text-danger-300">
          <AlertCircle className="h-4 w-4" /> {validationError}
        </div>
      )}

      {resolvingTask && resolvingLeader && (
        <div className="mb-4">
          <RestResolutionPanel
            task={resolvingTask}
            leader={resolvingLeader}
            healer={resolvingHealer}
            onFinalize={handleFinalize}
            onCancel={() => setResolvingTask(null)}
          />
        </div>
      )}

      {isCreating && !resolvingTask && (
        <RestTaskForm
          characters={characters}
          state={state}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
          onSubmit={handleCreate}
          onSubmitBatch={handleCreateBatch}
          onCancel={() => {
            setIsCreating(false);
            setValidationError(null);
          }}
        />
      )}

      {!resolvingTask && (
        <>
          <section className="mb-6" data-testid="pending-tasks-section">
            <h4 className="mb-2 font-medium text-fg-primary">Pending ({pendingTasks.length})</h4>
            {pendingTasks.length === 0 ? (
              <p className="text-sm italic text-fg-muted">No pending rest tasks</p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <RestTaskCard
                    key={task.id}
                    task={task}
                    leader={characters.find((character) => character.id === task.leaderId)}
                    healer={task.activityData.healerId ? characters.find((character) => character.id === task.activityData.healerId) ?? null : null}
                    onResolve={() => setResolvingTask(task)}
                    onCancel={() => cancel(task.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section data-testid="completed-tasks-section">
            <h4 className="mb-2 font-medium text-fg-primary">Completed ({completedTasks.length})</h4>
            {completedTasks.length === 0 ? (
              <p className="text-sm italic text-fg-muted">No completed rest tasks</p>
            ) : (
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <RestTaskCard
                    key={task.id}
                    task={task}
                    leader={characters.find((character) => character.id === task.leaderId)}
                    healer={task.activityData.healerId ? characters.find((character) => character.id === task.activityData.healerId) ?? null : null}
                    readonly
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
