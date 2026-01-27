import { Plus, Trash2, CheckCircle, Circle } from 'lucide-react';
import { TASK_STATUS, TASK_MODES } from '../../../constants';
import type { TaskListPanelProps } from '../../../types/dayplanner';

/**
 * TaskListPanel - Displays and manages tasks for the current slot
 *
 * Shows the list of tasks, allows adding new tasks, and selecting
 * tasks to view their details.
 */
export function TaskListPanel({
  tasks,
  selectedTaskId,
  showAddTask,
  newTaskMode,
  onSelectTask,
  onToggleAddTask,
  onSetNewTaskMode,
  onAddTask,
  onDeleteTask
}: TaskListPanelProps) {
  return (
    <div className="col-span-5 bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">
          Tasks ({tasks.length})
        </h3>
        <button
          onClick={onToggleAddTask}
          className="px-3 py-1 bg-green-600 rounded text-sm flex items-center gap-1"
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {showAddTask && (
        <div className="mb-4 p-3 bg-gray-700 rounded space-y-2">
          <label className="block text-sm text-gray-400">Mode</label>
          <select
            value={newTaskMode}
            onChange={(e) => onSetNewTaskMode(e.target.value as typeof newTaskMode)}
            className="w-full bg-gray-600 px-3 py-2 rounded"
          >
            {TASK_MODES.map(mode => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={onAddTask}
              className="flex-1 bg-green-600 px-3 py-2 rounded text-sm"
            >
              Create
            </button>
            <button
              onClick={onToggleAddTask}
              className="bg-gray-600 px-3 py-2 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-gray-500 italic text-sm">
            No tasks planned for this slot
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className={`p-3 rounded cursor-pointer border-2 ${
                selectedTaskId === task.id
                  ? 'bg-blue-900 border-blue-600'
                  : 'bg-gray-700 border-transparent hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {task.resolutionState === TASK_STATUS.Completed ? (
                    <CheckCircle size={16} className="text-green-400" />
                  ) : (
                    <Circle size={16} className="text-gray-400" />
                  )}
                  <span className="font-medium">{task.mode}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {task.assignedWorkerIds.length > 0
                  ? `${task.assignedWorkerIds.length} worker(s)`
                  : 'No workers assigned'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {task.resolutionState}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
