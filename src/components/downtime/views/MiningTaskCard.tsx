/**
 * Mining Task Card
 *
 * Displays a single mining task with its details and status.
 * Supports Surface Prospecting and Deep Mining methods.
 * Provides actions for resolving and cancelling pending tasks.
 */

import { useState } from 'react';
import { HardHat, Mountain, Shovel, Zap, Dices } from 'lucide-react';
import { ChainingAffordances, StatusBadge, getStatusBorderColor } from './shared';
import type { DowntimeTask, MiningData, MiningSite } from '../../../types/downtime';
import type { Character } from '../../../types/campaign';
import { MINING_SKILL_LABELS, MINERALS_BY_ID } from '../../../constants/mining';

// ============================================================================
// TYPES
// ============================================================================

export type ResolutionMode = 'auto' | 'manual';

interface MiningTaskCardProps {
  task: DowntimeTask;
  characters: Character[];
  miningSites: MiningSite[];
  onResolve?: (mode: ResolutionMode) => void;
  onCancel?: () => void;
  readonly?: boolean;
}

// ============================================================================
// RESOLUTION MODE TOGGLE
// ============================================================================

interface ResolutionModeToggleProps {
  mode: ResolutionMode;
  onChange: (mode: ResolutionMode) => void;
}

function ResolutionModeToggle({ mode, onChange }: ResolutionModeToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-900/50 rounded p-0.5">
      <button
        type="button"
        onClick={() => onChange('auto')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          mode === 'auto' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'
        }`}
        title="Auto-roll all dice"
      >
        <Zap className="w-3 h-3" />
        Auto
      </button>
      <button
        type="button"
        onClick={() => onChange('manual')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          mode === 'manual' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'
        }`}
        title="Roll dice manually"
      >
        <Dices className="w-3 h-3" />
        Manual
      </button>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MiningTaskCard({
  task,
  characters,
  miningSites,
  onResolve,
  onCancel,
  readonly = false,
}: MiningTaskCardProps) {
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>('manual');
  const data = task.activityData as MiningData;

  const MethodIcon = data.method === 'Surface Prospecting' ? Shovel : Mountain;

  const leaderData = characters.find((c) => c.id === task.leaderId);
  const leaderName = leaderData?.name ?? task.leaderId;

  const helperNames = task.helperIds
    .map((id) => characters.find((c) => c.id === id)?.name ?? id)
    .join(', ');

  const site = data.siteId ? miningSites.find((s) => s.id === data.siteId) : undefined;
  const targetMineral = data.targetResourceId ? MINERALS_BY_ID[data.targetResourceId] : undefined;

  const isActionable = !readonly && (task.status === 'pending' || task.status === 'in_progress');

  const handleResolve = () => {
    onResolve?.(resolutionMode);
  };

  return (
    <div
      className={`mining-task-card p-3 rounded-lg border-2 bg-gray-800/60 ${getStatusBorderColor(task.status)}`}
      data-testid="mining-task-card"
      data-task-id={task.id}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <HardHat className="w-4 h-4 text-amber-400" />
          <MethodIcon className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-medium text-gray-100">{data.method}</span>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {/* Task Details */}
      <div className="task-details text-sm text-gray-300 space-y-1 mb-3">
        <p>
          <span className="font-medium text-gray-200">Leader:</span> {leaderName}
        </p>
        {task.helperIds.length > 0 && (
          <p>
            <span className="font-medium text-gray-200">Helpers:</span> {helperNames}
          </p>
        )}
        {site && (
          <p>
            <span className="font-medium text-gray-200">Site:</span> {site.name} ({site.depositSize}, {site.remainingUnits}/{site.totalUnits} units)
          </p>
        )}
        {targetMineral && (
          <p>
            <span className="font-medium text-gray-200">Target:</span> {targetMineral.name}
          </p>
        )}
        <p>
          <span className="font-medium text-gray-200">Locate:</span> {MINING_SKILL_LABELS[data.locateSkill]} ({data.leaderLocateSkill})
        </p>
        <p>
          <span className="font-medium text-gray-200">Extract:</span> {MINING_SKILL_LABELS[data.extractionSkill]} ({data.leaderExtractionSkill})
        </p>
        <p>
          <span className="font-medium text-gray-200">Modifier:</span>{' '}
          <span className={data.skillModifier >= 0 ? 'text-green-400' : 'text-red-400'}>
            {data.skillModifier >= 0 ? '+' : ''}{data.skillModifier}
          </span>
        </p>
        {/* Context flags summary */}
        {data.contextFlags && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.contextFlags.hasDetailedMaps && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">Maps (+1)</span>
            )}
            {data.contextFlags.knownRichDeposit && (
              <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-300 rounded">Rich Deposit (+2)</span>
            )}
            {data.contextFlags.randomUnexplored && (
              <span className="text-xs px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded">Unexplored (-2)</span>
            )}
            {data.contextFlags.hasSupervisor && (
              <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-300 rounded">Supervisor (+5)</span>
            )}
            {data.contextFlags.hasProperTools && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">Proper Tools (+2)</span>
            )}
            {data.contextFlags.isImprovisedTools && (
              <span className="text-xs px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded">Improvised (-2)</span>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {task.results && (
        <div
          className={`task-results p-2 rounded text-sm ${
            task.results.success ? 'bg-amber-900/30 text-amber-200' : 'bg-gray-900/50 text-gray-300'
          }`}
          data-testid="task-results"
        >
          <p className="font-medium mb-1">{task.results.message}</p>
          {task.results.inventoryChanges && task.results.inventoryChanges.length > 0 && (
            <ul className="list-disc list-inside">
              {task.results.inventoryChanges.map((change, i) => (
                <li key={i}>
                  <span className={change.quantity > 0 ? 'text-green-400' : 'text-red-400'}>
                    {change.quantity > 0 ? '+' : ''}{change.quantity}
                  </span>{' '}
                  {change.itemName}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {task.results && <ChainingAffordances results={task.results} />}

      {/* Cancelled */}
      {task.status === 'cancelled' && (
        <div className="task-cancelled p-2 rounded bg-gray-900/50 text-gray-400 text-sm italic">
          Task was cancelled
        </div>
      )}

      {/* Action Buttons */}
      {isActionable && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Resolution Mode:</span>
            <ResolutionModeToggle mode={resolutionMode} onChange={setResolutionMode} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResolve}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-sm font-medium"
              disabled={task.status === 'in_progress'}
            >
              {resolutionMode === 'manual' ? (
                <><Dices className="w-3 h-3" /> Resolve (Manual)</>
              ) : (
                <><Zap className="w-3 h-3" /> Resolve (Auto)</>
              )}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 border border-red-500/50 text-red-400 rounded hover:bg-red-900/30 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
