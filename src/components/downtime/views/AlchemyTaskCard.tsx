/**
 * Alchemy Task Card
 *
 * Displays a single alchemy work session task with its details and status.
 * Provides actions for resolving and cancelling pending tasks.
 */

import { FlaskConical, Check, X, Clock, Loader, Ban } from 'lucide-react';
import type { DowntimeTask, AlchemyData, TaskStatus } from '../../../types/downtime';
import type { Character, AlchemyBatch, AlchemyFormula } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface AlchemyTaskCardProps {
  /** The alchemy task to display */
  task: DowntimeTask;
  /** Alchemy batches for batch name lookup */
  batches: AlchemyBatch[];
  /** Alchemy formulas for formula name lookup */
  formulas: AlchemyFormula[];
  /** Characters data for name lookup */
  characters: Character[];
  /** Called when the resolve button is clicked */
  onResolve?: () => void;
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
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'Pending' },
    in_progress: { bg: 'bg-accent-100', text: 'text-accent-800', icon: Loader, label: 'In Progress' },
    resolved: { bg: 'bg-success-100', text: 'text-success-800', icon: Check, label: 'Resolved' },
    cancelled: { bg: 'bg-surface-2', text: 'text-fg-secondary', icon: Ban, label: 'Cancelled' },
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

// ============================================================================
// COMPONENT
// ============================================================================

export function AlchemyTaskCard({
  task,
  batches,
  formulas: _formulas,
  characters,
  onResolve,
  onCancel,
  readonly = false,
}: AlchemyTaskCardProps) {
  const data = task.activityData as AlchemyData;

  // Lookup batch details
  const batch = batches.find((b) => b.id === data.formulaId);
  const batchName = batch?.formulaName ?? 'Unknown Batch';
  const batchProgress = batch ? `${batch.PP ?? 0}/${batch.WR ?? '?'} PP` : 'N/A';
  const batchCP = batch?.CP ?? 0;

  // Lookup leader name
  const leaderData = characters.find((c) => c.id === task.leaderId);
  const leaderName = leaderData?.name ?? task.leaderId;

  // Lookup helper names
  const helperNames = task.helperIds
    .map((id) => characters.find((c) => c.id === id)?.name ?? id)
    .join(', ');

  // Get aspect modifiers for display
  const skillMod = data.aspectModifiers?.skill ?? 0;
  const labMod = data.aspectModifiers?.lab ?? 0;
  const helperMod = data.aspectModifiers?.helpers ?? 0;

  // Determine card border color based on status
  const statusBorders: Record<TaskStatus, string> = {
    pending: 'border-yellow-300',
    in_progress: 'border-accent-300',
    resolved: 'border-success-300',
    cancelled: 'border-edge-bright',
  };

  const isActionable = !readonly && (task.status === 'pending' || task.status === 'in_progress');

  return (
    <div
      className={`alchemy-task-card p-3 rounded-lg border-2 bg-surface-1 ${statusBorders[task.status]}`}
      data-testid="alchemy-task-card"
      data-task-id={task.id}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-purple-600" />
          <span className="font-medium">Alchemy: {batchName}</span>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {/* Task Details */}
      <div className="task-details text-sm text-fg-secondary space-y-1 mb-3">
        <p>
          <span className="font-medium">Alchemist:</span> {leaderName}
        </p>
        {task.helperIds.length > 0 && (
          <p>
            <span className="font-medium">Assistants:</span> {helperNames}
          </p>
        )}
        <p>
          <span className="font-medium">Progress:</span> {batchProgress}
          {batchCP > 0 && (
            <span className="ml-2 text-orange-600">CP: {batchCP}</span>
          )}
        </p>
        <p>
          <span className="font-medium">Modifier:</span>{' '}
          <span className={skillMod >= 0 ? 'text-success-600' : 'text-danger-600'}>
            {skillMod >= 0 ? '+' : ''}{skillMod}
          </span>
          <span className="text-xs text-fg-faint ml-1">
            (Lab +{labMod}, Helpers +{helperMod})
          </span>
        </p>
      </div>

      {/* Results (for resolved tasks) */}
      {task.results && (
        <div
          className={`task-results p-2 rounded text-sm ${
            task.results.success ? 'bg-success-50 text-success-800' : 'bg-surface-2 text-fg-primary'
          }`}
          data-testid="task-results"
        >
          <p className="font-medium mb-1">{task.results.message}</p>
          {task.results.inventoryChanges && task.results.inventoryChanges.length > 0 && (
            <ul className="list-disc list-inside">
              {task.results.inventoryChanges.map((change, i) => (
                <li key={i}>
                  <span className={change.quantity > 0 ? 'text-success-600' : 'text-danger-600'}>
                    {change.quantity > 0 ? '+' : ''}{change.quantity}
                  </span>{' '}
                  {change.itemName}
                </li>
              ))}
            </ul>
          )}
          {task.results.experienceGained !== undefined && task.results.experienceGained > 0 && (
            <p className="text-accent-600 mt-1">+{task.results.experienceGained} XP</p>
          )}
        </div>
      )}

      {/* Cancelled Message */}
      {task.status === 'cancelled' && (
        <div className="task-cancelled p-2 rounded bg-surface-2 text-fg-secondary text-sm italic">
          Work session was cancelled
        </div>
      )}

      {/* Action Buttons */}
      {isActionable && (
        <div className="task-actions mt-3 flex gap-2">
          <button
            type="button"
            onClick={onResolve}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
            disabled={task.status === 'in_progress'}
            data-testid="resolve-button"
          >
            <Check className="w-3 h-3" />
            {task.status === 'in_progress' ? 'Working...' : 'Complete Work Block'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 border border-danger-300 text-danger-600 text-sm rounded hover:bg-danger-50 transition-colors"
            disabled={task.status === 'in_progress'}
            data-testid="cancel-button"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
