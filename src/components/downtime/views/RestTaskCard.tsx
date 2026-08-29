import { Bed, Stethoscope } from 'lucide-react';
import { StatusBadge, getStatusBorderColor } from './shared';
import { getPhysicianLevel } from '../../../utils/recovery';
import type { Character } from '../../../types/campaign';
import type { DowntimeTask, RestData } from '../../../types/downtime';

export type RestTask = DowntimeTask & { activityData: RestData };

interface RestTaskCardProps {
  task: RestTask;
  leader?: Character;
  healer?: Character | null;
  onResolve?: () => void;
  onCancel?: () => void;
  readonly?: boolean;
}

const REST_LABELS: Record<RestData['restType'], string> = {
  sleep: 'Sleep',
  light_rest: 'Light rest',
  meditation: 'Meditation',
};

export function RestTaskCard({
  task,
  leader,
  healer,
  onResolve,
  onCancel,
  readonly = false,
}: RestTaskCardProps) {
  const data = task.activityData;
  const isPending = !readonly && task.status === 'pending';
  const physicianLevel = healer ? getPhysicianLevel(healer) : 0;

  return (
    <div
      className={`rounded-lg border-2 bg-gray-800/60 p-3 ${getStatusBorderColor(task.status)}`}
      data-testid="rest-task-card"
      data-task-id={task.id}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Bed className="h-4 w-4 text-indigo-400" />
          <span className="font-medium text-gray-100">{REST_LABELS[data.restType]}</span>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <div className="mb-3 space-y-1 text-sm text-gray-300">
        <p><span className="font-medium text-gray-200">Character:</span> {leader?.name ?? task.leaderId}</p>
        {healer && (
          <p className="flex flex-wrap items-center gap-1">
            <span className="font-medium text-gray-200">Healer:</span> {healer.name}
            {physicianLevel > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-teal-900/50 px-1.5 py-0.5 text-xs text-teal-300">
                <Stethoscope className="h-3 w-3" /> Physician-{physicianLevel}
              </span>
            )}
          </p>
        )}
        {data.recoveryBonus !== 0 && (
          <p><span className="font-medium text-gray-200">Recovery bonus:</span> {data.recoveryBonus > 0 ? '+' : ''}{data.recoveryBonus}</p>
        )}
      </div>

      {task.results && (
        <div className="rounded bg-indigo-900/30 p-2 text-sm text-indigo-200" data-testid="task-results">
          {task.results.message}
        </div>
      )}

      {isPending && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onResolve}
            data-testid="resolve-button"
            className="flex-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Resolve
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded border border-red-500/50 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
