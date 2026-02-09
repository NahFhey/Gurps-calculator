import { AlertCircle } from 'lucide-react';
import type { AdvancementCheck } from '../../../state/downtime/downtimeSelectors';

interface TimeAdvancementBlockerProps {
  advancementCheck: AdvancementCheck;
  onJumpToTasks: () => void;
}

/**
 * Displays a warning when time advancement is blocked by unresolved tasks.
 * Provides a button to navigate to the blocking tasks.
 */
export function TimeAdvancementBlocker({
  advancementCheck,
  onJumpToTasks,
}: TimeAdvancementBlockerProps) {
  // Don't render anything if advancement is allowed
  if (advancementCheck.canAdvance) {
    return null;
  }

  const taskCount = advancementCheck.blockingTaskIds.length;
  const taskLabel = taskCount === 1 ? 'task' : 'tasks';

  return (
    <div
      className="flex items-center gap-2 bg-yellow-100 border border-yellow-300 rounded p-2 text-yellow-800"
      role="alert"
      data-testid="time-advancement-blocker"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm flex-grow">
        {advancementCheck.reason ?? `${taskCount} ${taskLabel} blocking advancement`}
      </span>
      <button
        type="button"
        onClick={onJumpToTasks}
        className="text-sm underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded px-1"
      >
        View {taskLabel}
      </button>
    </div>
  );
}
