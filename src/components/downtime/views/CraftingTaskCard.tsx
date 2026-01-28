/**
 * Crafting Task Card
 *
 * Displays a single crafting task with its details and status.
 * Provides actions for resolving and cancelling pending tasks.
 *
 * SLOT-BOUNDED: Tasks complete within a single slot.
 * Resolution consumes materials and produces item (on success only).
 */

import { Hammer, Check, X, Clock, Loader, Ban } from 'lucide-react';
import type { DowntimeTask, CraftingData, TaskStatus } from '../../../types/downtime';
import type { Character, Recipe, Material } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface CraftingTaskCardProps {
  /** The crafting task to display */
  task: DowntimeTask;
  /** Recipes for recipe name lookup */
  recipes: Recipe[];
  /** Materials for material name lookup */
  materials: Material[];
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
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Loader, label: 'In Progress' },
    resolved: { bg: 'bg-green-100', text: 'text-green-800', icon: Check, label: 'Resolved' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Ban, label: 'Cancelled' },
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
// CONSTANTS
// ============================================================================

const QUALITY_LABELS: Record<string, string> = {
  basic: 'Basic',
  standard: 'Standard',
  fine: 'Fine',
  masterwork: 'Masterwork',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function CraftingTaskCard({
  task,
  recipes,
  materials: _materials,
  characters,
  onResolve,
  onCancel,
  readonly = false,
}: CraftingTaskCardProps) {
  const data = task.activityData as CraftingData;

  // Lookup recipe details
  const recipe = recipes.find((r) => r.id === data.recipeId);
  const recipeName = recipe?.name ?? 'Unknown Recipe';

  // Lookup leader name
  const leaderData = characters.find((c) => c.id === task.leaderId);
  const leaderName = leaderData?.name ?? task.leaderId;

  // Lookup helper names
  const helperNames = task.helperIds
    .map((id) => characters.find((c) => c.id === id)?.name ?? id)
    .join(', ');

  // Get quality label
  const qualityLabel = QUALITY_LABELS[data.qualityTarget] ?? data.qualityTarget;

  // Get skill modifier for display
  const skillMod = data.skillModifier ?? 0;

  // Determine card border color based on status
  const statusBorders: Record<TaskStatus, string> = {
    pending: 'border-yellow-300',
    in_progress: 'border-blue-300',
    resolved: 'border-green-300',
    cancelled: 'border-gray-300',
  };

  const isActionable = !readonly && (task.status === 'pending' || task.status === 'in_progress');

  return (
    <div
      className={`crafting-task-card p-3 rounded-lg border-2 bg-white ${statusBorders[task.status]}`}
      data-testid="crafting-task-card"
      data-task-id={task.id}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <Hammer className="w-4 h-4 text-orange-600" />
          <span className="font-medium">Crafting: {recipeName}</span>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {/* Task Details */}
      <div className="task-details text-sm text-gray-600 space-y-1 mb-3">
        <p>
          <span className="font-medium">Crafter:</span> {leaderName}
        </p>
        {task.helperIds.length > 0 && (
          <p>
            <span className="font-medium">Assistants:</span> {helperNames}
          </p>
        )}
        <p>
          <span className="font-medium">Quality:</span>{' '}
          <span className="text-orange-600">{qualityLabel}</span>
        </p>
        <p>
          <span className="font-medium">Modifier:</span>{' '}
          <span className={skillMod >= 0 ? 'text-green-600' : 'text-red-600'}>
            {skillMod >= 0 ? '+' : ''}{skillMod}
          </span>
        </p>
      </div>

      {/* Slot-Bounded Indicator for Pending Tasks */}
      {task.status === 'pending' && (
        <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 mb-3">
          Single-roll resolution: Materials consumed on attempt
        </div>
      )}

      {/* Results (for resolved tasks) */}
      {task.results && (
        <div
          className={`task-results p-2 rounded text-sm ${
            task.results.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
          data-testid="task-results"
        >
          <p className="font-medium mb-1">{task.results.message}</p>
          {task.results.inventoryChanges && task.results.inventoryChanges.length > 0 && (
            <ul className="list-disc list-inside">
              {task.results.inventoryChanges.map((change, i) => (
                <li key={i}>
                  <span className={change.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                    {change.quantity > 0 ? '+' : ''}{change.quantity}
                  </span>{' '}
                  {change.itemName}
                </li>
              ))}
            </ul>
          )}
          {task.results.experienceGained !== undefined && task.results.experienceGained > 0 && (
            <p className="text-blue-600 mt-1">+{task.results.experienceGained} XP</p>
          )}
        </div>
      )}

      {/* Cancelled Message */}
      {task.status === 'cancelled' && (
        <div className="task-cancelled p-2 rounded bg-gray-50 text-gray-600 text-sm italic">
          Crafting task was cancelled (no materials consumed)
        </div>
      )}

      {/* Action Buttons */}
      {isActionable && (
        <div className="task-actions mt-3 flex gap-2">
          <button
            type="button"
            onClick={onResolve}
            className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
            disabled={task.status === 'in_progress'}
            data-testid="resolve-button"
          >
            <Check className="w-3 h-3" />
            {task.status === 'in_progress' ? 'Crafting...' : 'Complete Crafting'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50 transition-colors"
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
