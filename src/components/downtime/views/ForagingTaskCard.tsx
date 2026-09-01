/**
 * Foraging Task Card
 *
 * Displays a single foraging task with its details and status.
 * Supports the revamped three-mode foraging system (General/Category/Specific).
 * Provides actions for resolving and cancelling pending tasks.
 * Includes a manual/auto resolution toggle matching fishing's pattern.
 */

import { useState } from 'react';
import { Leaf, Search, Target, Crosshair, Zap, Dices } from 'lucide-react';
import { ChainingAffordances, StatusBadge, getStatusBorderColor } from './shared';
import type { DowntimeTask, ForagingData } from '../../../types/downtime';
import type { Character } from '../../../types/campaign';
import type { ForageZoneProfile, ForageItem } from '../../../types/foraging';
import { FORAGE_CATEGORY_META } from '../../../constants/foraging';

// ============================================================================
// TYPES
// ============================================================================

export type ResolutionMode = 'auto' | 'manual';

interface ForagingTaskCardProps {
  /** The foraging task to display */
  task: DowntimeTask;
  /** Forage zone profiles for name lookup */
  zones: ForageZoneProfile[];
  /** Forage items for name lookup */
  forageItems: ForageItem[];
  /** Characters data for name lookup */
  characters: Character[];
  /** Called when the resolve button is clicked with selected mode */
  onResolve?: (mode: ResolutionMode) => void;
  /** Called when the cancel button is clicked */
  onCancel?: () => void;
  /** When true, hides action buttons (for completed tasks) */
  readonly?: boolean;
}

// ============================================================================
// MODE DISPLAY HELPERS
// ============================================================================

function getModeLabel(data: ForagingData, forageItems: ForageItem[]): { icon: React.ElementType; label: string } {
  const mode = data.mode ?? 'general';

  if (mode === 'specific' && data.targetItemId) {
    const item = forageItems.find((i) => i.id === data.targetItemId);
    const itemName = item?.name ?? data.targetItemId;
    return { icon: Crosshair, label: `Specific: ${itemName}` };
  }

  if (mode === 'category' && data.targetCategory) {
    const catMeta = FORAGE_CATEGORY_META[data.targetCategory as keyof typeof FORAGE_CATEGORY_META];
    const catLabel = catMeta?.label ?? data.targetCategory;
    return { icon: Target, label: `Category: ${catLabel}` };
  }

  return { icon: Search, label: 'General Forage' };
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

export function ForagingTaskCard({
  task,
  zones,
  forageItems,
  characters,
  onResolve,
  onCancel,
  readonly = false,
}: ForagingTaskCardProps) {
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>('manual');
  const data = task.activityData as ForagingData;

  // Mode display
  const { icon: ModeIcon, label: modeLabel } = getModeLabel(data, forageItems);

  // Lookup display names
  const zoneData = zones.find((z) => z.id === data.zoneId);
  const zoneName = zoneData?.name ?? data.zoneId ?? (data as any).biomeId ?? 'Unknown zone';

  const leaderData = characters.find((c) => c.id === task.leaderId);
  const leaderName = leaderData?.name ?? task.leaderId;

  const helperNames = task.helperIds
    .map((id) => characters.find((c) => c.id === id)?.name ?? id)
    .join(', ');

  // Skill display
  const skillLabel = data.skillUsed === 'herbLore' ? 'Herb Lore'
    : data.skillUsed === 'naturalist' ? 'Naturalist'
    : 'Survival';

  const isActionable = !readonly && (task.status === 'pending' || task.status === 'in_progress');

  const handleResolve = () => {
    onResolve?.(resolutionMode);
  };

  return (
    <div
      className={`foraging-task-card p-3 rounded-lg border-2 bg-surface-1/60 ${getStatusBorderColor(task.status)}`}
      data-testid="foraging-task-card"
      data-task-id={task.id}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-success-400" />
          <ModeIcon className="w-3.5 h-3.5 text-success-500" />
          <span className="font-medium text-fg-bright">{modeLabel}</span>
        </div>
        <StatusBadge status={task.status} />
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
          <span className="font-medium text-fg-primary">Zone:</span> {zoneName}
        </p>
        <p>
          <span className="font-medium text-fg-primary">Skill:</span> {skillLabel} ({data.leaderSkill ?? '?'})
        </p>
        <p>
          <span className="font-medium text-fg-primary">Modifier:</span>{' '}
          <span className={data.skillModifier >= 0 ? 'text-success-400' : 'text-danger-400'}>
            {data.skillModifier >= 0 ? '+' : ''}{data.skillModifier}
          </span>
        </p>
        {/* Context flags summary with modifier values */}
        {data.contextFlags && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.contextFlags.hasMapOrGuide && (
              <span className="text-xs px-1.5 py-0.5 bg-accent-900/50 text-accent-300 rounded">Map/Guide (+1)</span>
            )}
            {data.contextFlags.isUnfamiliarOrHostile && (
              <span className="text-xs px-1.5 py-0.5 bg-danger-900/50 text-danger-300 rounded">Unfamiliar (-2)</span>
            )}
            {data.contextFlags.isPeakSeason && (
              <span className="text-xs px-1.5 py-0.5 bg-success-900/50 text-success-300 rounded">Peak Season (+2)</span>
            )}
            {data.contextFlags.isOffSeason && (
              <span className="text-xs px-1.5 py-0.5 bg-warning-900/50 text-warning-300 rounded">Off Season (-2)</span>
            )}
            {data.contextFlags.hasProperTools && (
              <span className="text-xs px-1.5 py-0.5 bg-accent-900/50 text-accent-300 rounded">Proper Tools (+2)</span>
            )}
            {data.contextFlags.isDenseOrDangerousTerrain && (
              <span className="text-xs px-1.5 py-0.5 bg-danger-900/50 text-danger-300 rounded">Dense Terrain (-2)</span>
            )}
          </div>
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
          {task.results.experienceGained !== undefined && task.results.experienceGained > 0 && (
            <p className="text-accent-400 mt-1">+{task.results.experienceGained} XP</p>
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

      {/* Action Buttons (with resolution mode toggle) */}
      {isActionable && (
        <div className="mt-3 space-y-2">
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
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-success-600 text-white rounded hover:bg-success-700 transition-colors text-sm font-medium"
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
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 border border-danger-500/50 text-danger-400 rounded hover:bg-danger-900/30 transition-colors text-sm font-medium"
                data-testid="cancel-button"
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
