/**
 * Task Results Display
 *
 * Displays the results of a resolved task including success/failure message,
 * inventory changes, and experience gained.
 * Used across all task card components for consistent results display.
 */

import type { TaskResults } from '../../../../types/downtime';

// ============================================================================
// TYPES
// ============================================================================

interface TaskResultsDisplayProps {
  /** The task results to display */
  results: TaskResults;
  /** Optional additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TaskResultsDisplay({ results, className = '' }: TaskResultsDisplayProps) {
  const backgroundClass = results.success
    ? 'bg-green-50 text-green-800'
    : 'bg-gray-50 text-gray-700';

  return (
    <div
      className={`task-results p-2 rounded text-sm ${backgroundClass} ${className}`}
      data-testid="task-results"
    >
      {/* Result Message */}
      <p className="font-medium mb-1">{results.message}</p>

      {/* Inventory Changes */}
      {results.inventoryChanges && results.inventoryChanges.length > 0 && (
        <ul className="list-disc list-inside">
          {results.inventoryChanges.map((change, index) => (
            <li key={index}>
              <span className={change.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                {change.quantity > 0 ? '+' : ''}
                {change.quantity}
              </span>{' '}
              {change.itemName}
            </li>
          ))}
        </ul>
      )}

      {/* Experience Gained */}
      {results.experienceGained !== undefined && results.experienceGained > 0 && (
        <p className="text-blue-600 mt-1">+{results.experienceGained} XP</p>
      )}
    </div>
  );
}

// ============================================================================
// CANCELLED MESSAGE COMPONENT
// ============================================================================

interface CancelledMessageProps {
  /** Optional custom message text */
  message?: string;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Displays a message for cancelled tasks.
 */
export function CancelledMessage({
  message = 'Task was cancelled',
  className = '',
}: CancelledMessageProps) {
  return (
    <div
      className={`task-cancelled p-2 rounded bg-gray-50 text-gray-600 text-sm italic ${className}`}
      data-testid="cancelled-message"
    >
      {message}
    </div>
  );
}
