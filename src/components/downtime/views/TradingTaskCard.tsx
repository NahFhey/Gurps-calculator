import { Coins } from 'lucide-react';
import { getMerchantSkill } from '../../../utils/trading';
import { StatusBadge, getStatusBorderColor } from './shared';
import type { Character } from '../../../types/campaign';
import type { DowntimeTask, TradingData } from '../../../types/downtime';

export type TradingTask = DowntimeTask & { activityData: TradingData };

interface TradingTaskCardProps {
  task: TradingTask;
  leader?: Character;
  onResolve?: () => void;
  onCancel?: () => void;
  readonly?: boolean;
}

export function TradingTaskCard({ task, leader, onResolve, onCancel, readonly = false }: TradingTaskCardProps) {
  const merchant = leader ? getMerchantSkill(leader) : null;
  const isPending = !readonly && task.status === 'pending';
  return (
    <div
      className={`rounded-lg border-2 bg-gray-800/60 p-3 ${getStatusBorderColor(task.status)}`}
      data-testid="trading-task-card"
      data-task-id={task.id}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-400" />
          <span className="font-medium text-gray-100">{task.activityData.merchantName}</span>
        </div>
        <StatusBadge status={task.status} />
      </div>
      <div className="mb-3 space-y-1 text-sm text-gray-300">
        <p>
          <span className="font-medium text-gray-200">Leader:</span> {leader?.name ?? task.leaderId}
          {merchant && (
            <span className="ml-2 rounded bg-amber-900/40 px-1.5 py-0.5 text-xs text-amber-300">
              {merchant.isDefault ? `Merchant default ${merchant.level}` : `Merchant-${merchant.level}`}
            </span>
          )}
        </p>
        <p><span className="font-medium text-gray-200">Opposing skill:</span> {task.activityData.opposingSkill}</p>
      </div>
      {task.results && (
        <div className="rounded bg-amber-900/20 p-2 text-sm text-amber-100" data-testid="task-results">
          {task.results.message}
        </div>
      )}
      {isPending && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onResolve} data-testid="resolve-button" className="flex-1 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
            Resolve
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded border border-red-500/50 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30">Cancel</button>
          )}
        </div>
      )}
    </div>
  );
}
