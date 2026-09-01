/**
 * Fishing Task Card
 *
 * Displays a single fishing task with its details and status.
 * Provides actions for resolving and cancelling pending tasks.
 * Includes toggle for auto vs manual resolution mode.
 */

import React, { useState } from 'react';
import { Fish, Check, X, Clock, Loader, Ban, Target, Shuffle, Dices, Zap } from 'lucide-react';
import { FISHING_METHODS } from '../../../constants';
import type { DowntimeTask, FishingData, TaskStatus, FishingMethod } from '../../../types/downtime';
import type { Character, GatheringSpecies, GatheringEnvironment, GatheringBait } from '../../../types/campaign';
import { ChainingAffordances } from './shared';

// ============================================================================
// TYPES
// ============================================================================

export type ResolutionMode = 'auto' | 'manual';

interface FishingTaskCardProps {
  /** The fishing task to display */
  task: DowntimeTask;
  /** Fish species data for name lookup */
  species: GatheringSpecies[];
  /** Fishing spots data for name lookup */
  spots: GatheringEnvironment[];
  /** Characters data for name lookup */
  characters: Character[];
  /** Bait data for name lookup */
  bait?: GatheringBait[];
  /** Called when the resolve button is clicked with selected mode */
  onResolve?: (mode: ResolutionMode) => void;
  /** Called when the cancel button is clicked */
  onCancel?: () => void;
  /** When true, hides action buttons (for completed tasks) */
  readonly?: boolean;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatusBadgeProps {
  status: TaskStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<TaskStatus, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-300', icon: Clock, label: 'Pending' },
    in_progress: { bg: 'bg-accent-900/50', text: 'text-accent-300', icon: Loader, label: 'In Progress' },
    resolved: { bg: 'bg-success-900/50', text: 'text-success-300', icon: Check, label: 'Resolved' },
    cancelled: { bg: 'bg-surface-1', text: 'text-fg-muted', icon: Ban, label: 'Cancelled' },
  };

  const { bg, text, icon: Icon, label } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
      data-testid="status-badge"
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// Method badge component
function MethodBadge({ method }: { method: FishingMethod }) {
  const config: Record<FishingMethod, { bg: string; text: string; label: string }> = {
    Line: { bg: 'bg-accent-900/50', text: 'text-accent-300', label: 'Line' },
    Net: { bg: 'bg-success-900/50', text: 'text-success-300', label: 'Net' },
    Spear: { bg: 'bg-orange-900/50', text: 'text-orange-300', label: 'Spear' },
  };

  const { bg, text, label } = config[method] ?? config.Line;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

// Resolution mode toggle component
interface ResolutionModeToggleProps {
  mode: ResolutionMode;
  onChange: (mode: ResolutionMode) => void;
}

function ResolutionModeToggle({ mode, onChange }: ResolutionModeToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-surface-0/50 rounded p-0.5">
      <button
        type="button"
        onClick={() => onChange('auto')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          mode === 'auto'
            ? 'bg-purple-600 text-white'
            : 'text-fg-muted hover:text-fg-primary'
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
          mode === 'manual'
            ? 'bg-purple-600 text-white'
            : 'text-fg-muted hover:text-fg-primary'
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

export function FishingTaskCard({
  task,
  species,
  spots,
  characters,
  bait = [],
  onResolve,
  onCancel,
  readonly = false,
}: FishingTaskCardProps) {
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>('manual');

  const data = task.activityData as FishingData;
  const method = data.method || 'Line';
  const methodConfig = FISHING_METHODS[method];
  const isRandomCatch = data.isRandomCatch ?? true;

  // Lookup display names
  const speciesData = species.find((s) => s.id === data.speciesId);
  const speciesName = speciesData?.name ?? 'Unknown';
  const isLargeFish = speciesData?.tags?.includes('LargeFish') ?? false;

  const spotData = spots.find((s) => s.id === data.spotId);
  const spotName = spotData?.name ?? data.spotId;

  const leaderData = characters.find((c) => c.id === task.leaderId);
  const leaderName = leaderData?.name ?? task.leaderId;

  const helperNames = task.helperIds
    .map((id) => characters.find((c) => c.id === id)?.name ?? id)
    .join(', ');

  // Lookup bait name
  const baitData = data.baitId ? bait.find((b) => b.id === data.baitId) : null;
  const baitName = baitData?.name ?? null;

  // Determine card border color based on status
  const statusBorders: Record<TaskStatus, string> = {
    pending: 'border-yellow-600/50',
    in_progress: 'border-accent-600/50',
    resolved: 'border-success-600/50',
    cancelled: 'border-edge-strong/50',
  };

  const isActionable = !readonly && (task.status === 'pending' || task.status === 'in_progress');

  // Build the title based on targeting mode
  // methodConfig.label already includes "Fishing" (e.g., "Net Fishing")
  const title = isRandomCatch
    ? `${methodConfig?.label ?? method} - Random Catch`
    : `${methodConfig?.label ?? method} - Target: ${speciesName}`;

  const handleResolve = () => {
    onResolve?.(resolutionMode);
  };

  return (
    <div
      className={`fishing-task-card p-3 rounded-lg border-2 bg-surface-1/60 ${statusBorders[task.status]}`}
      data-testid="fishing-task-card"
      data-task-id={task.id}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <Fish className="w-4 h-4 text-accent-400" />
          <span className="font-medium text-fg-bright">{title}</span>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {/* Method & Targeting Info */}
      <div className="flex flex-wrap gap-2 mb-3">
        <MethodBadge method={method} />
        {isRandomCatch ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface-2 text-fg-secondary">
            <Shuffle className="w-3 h-3" />
            Random
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-900/50 text-purple-300">
            <Target className="w-3 h-3" />
            Targeted
          </span>
        )}
        {isLargeFish && !isRandomCatch && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-900/50 text-orange-300">
            Large Fish
          </span>
        )}
      </div>

      {/* Task Details */}
      <div className="task-details text-sm text-fg-secondary space-y-1 mb-3">
        <p>
          <span className="font-medium text-fg-primary">Leader:</span> {leaderName}
        </p>
        {task.helperIds.length > 0 && (
          <p>
            <span className="font-medium text-fg-primary">Helpers:</span> {helperNames}
          </p>
        )}
        <p>
          <span className="font-medium text-fg-primary">Spot:</span> {spotName}
        </p>
        {baitName && (
          <p>
            <span className="font-medium text-fg-primary">Bait:</span> {baitName}
          </p>
        )}
        <p>
          <span className="font-medium text-fg-primary">Modifier:</span>{' '}
          <span className={data.skillModifier >= 0 ? 'text-success-400' : 'text-danger-400'}>
            {data.skillModifier >= 0 ? '+' : ''}{data.skillModifier}
          </span>
        </p>
        {(data.retryAttempt ?? 0) > 0 && (
          <p className="text-yellow-400">
            <span className="font-medium">Retry:</span> Attempt #{(data.retryAttempt ?? 0) + 1} (-{data.retryAttempt} penalty)
          </p>
        )}
      </div>

      {/* Results (for resolved tasks) */}
      {task.results && (
        <div
          className={`task-results p-2 rounded text-sm ${
            task.results.success ? 'bg-success-900/30 text-success-200' : 'bg-surface-0/50 text-fg-secondary'
          }`}
          data-testid="task-results"
        >
          <p className="font-medium mb-1">{task.results.message}</p>
          {task.results.inventoryChanges && task.results.inventoryChanges.length > 0 && (
            <ul className="list-disc list-inside">
              {task.results.inventoryChanges.map((change, i) => (
                <li key={i}>
                  <span className={change.quantity > 0 ? 'text-success-400' : 'text-danger-400'}>
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

      {/* Cancelled Message */}
      {task.status === 'cancelled' && (
        <div className="task-cancelled p-2 rounded bg-surface-0/50 text-fg-muted text-sm italic">
          Task was cancelled
        </div>
      )}

      {/* Action Buttons */}
      {isActionable && (
        <div className="task-actions mt-3 space-y-2">
          {/* Resolution Mode Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-muted">Resolution Mode:</span>
            <ResolutionModeToggle mode={resolutionMode} onChange={setResolutionMode} />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResolve}
              className="flex items-center gap-1 px-3 py-1.5 bg-success-600 text-white text-sm rounded hover:bg-success-700 transition-colors"
              disabled={task.status === 'in_progress'}
              data-testid="resolve-button"
            >
              {resolutionMode === 'manual' ? (
                <>
                  <Dices className="w-3 h-3" />
                  Resolve (Manual)
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  Resolve (Auto)
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1 px-3 py-1.5 border border-danger-500/50 text-danger-400 text-sm rounded hover:bg-danger-900/30 transition-colors"
              disabled={task.status === 'in_progress'}
              data-testid="cancel-button"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
