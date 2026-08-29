import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Bed, Plus } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useCampaignStore } from '../../../state/campaignStore';
import { generateTaskId, selectTasksForSlot, validateTaskCreation } from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import { isRestTask } from '../../../types/downtime';
import { estimateHealing } from '../../../utils/recovery';
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
      if (!pools || (pools.HP.current >= pools.HP.max && pools.FP.current >= pools.FP.max)) return [];
      return [{
        character,
        estimate: estimateHealing(pools.HP.max - pools.HP.current, pools.FP.max - pools.FP.current),
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
      const updatedPools = {
        ...leader.gcsData.pools,
        HP: {
          ...leader.gcsData.pools.HP,
          current: leader.gcsData.pools.HP.current + recovery.hpRestored,
        },
        FP: {
          ...leader.gcsData.pools.FP,
          current: leader.gcsData.pools.FP.current + recovery.fpRestored,
        },
      };

      campaignActions.updateCharacter(leader.id, {
        gcsData: {
          ...leader.gcsData,
          pools: updatedPools,
        },
      });
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
          <h3 className="text-lg font-semibold text-gray-100">Rest &amp; Recovery</h3>
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

      <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3" data-testid="party-recovery-status">
        <h4 className="mb-2 text-sm font-medium text-gray-200">Party recovery status</h4>
        {recoveryCharacters.length === 0 ? (
          <p className="text-xs text-gray-500">Everyone with a character sheet is at full HP and FP.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recoveryCharacters.map(({ character, estimate }) => {
              const pools = character.gcsData?.pools;
              if (!pools) return null;
              return (
                <div key={character.id} className="rounded bg-gray-900/60 px-3 py-2 text-xs text-gray-300">
                  <span className="mr-2 font-medium text-gray-100">{character.name}</span>
                  <span className="mr-2 text-red-300">HP {pools.HP.current}/{pools.HP.max}</span>
                  <span className="mr-2 text-blue-300">FP {pools.FP.current}/{pools.FP.max}</span>
                  <span className="text-gray-400">Full: HP {estimate.daysToFullHP}d, FP {estimate.daysToFullFP}d</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {validationError && (
        <div role="alert" data-testid="validation-error" className="mb-4 flex items-center gap-2 rounded border border-red-500 bg-red-900/30 px-3 py-2 text-sm text-red-300">
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
            <h4 className="mb-2 font-medium text-gray-200">Pending ({pendingTasks.length})</h4>
            {pendingTasks.length === 0 ? (
              <p className="text-sm italic text-gray-400">No pending rest tasks</p>
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
            <h4 className="mb-2 font-medium text-gray-200">Completed ({completedTasks.length})</h4>
            {completedTasks.length === 0 ? (
              <p className="text-sm italic text-gray-400">No completed rest tasks</p>
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
