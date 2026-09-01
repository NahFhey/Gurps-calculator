import { Trash2 } from 'lucide-react';
import type { ProjectsViewProps } from '../../../types/views';

/**
 * ProjectsView - Read-only view of crafting projects
 *
 * Displays in-progress and completed crafting projects.
 * Allows deletion with material refund for incomplete projects.
 */
export function ProjectsView({ crafts, onDelete }: ProjectsViewProps) {
  const inProgress = crafts.filter(c => !c.completed);
  const completed = crafts.filter(c => c.completed);

  function handleDelete(project: typeof crafts[0]) {
    const projectName = project.name || `${project.currentQuality} ${project.template}`;
    onDelete('project', projectName, { id: project.id });
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Project Manager</h2>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-yellow-400">
          In-Progress Projects ({inProgress.length})
        </h3>
        <div className="space-y-2">
          {inProgress.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-4 bg-yellow-900 bg-opacity-30 border border-yellow-600 p-3 rounded"
            >
              <div className="flex-1">
                <div className="font-semibold capitalize">
                  {c.name || `${c.currentQuality} ${c.template}`}
                </div>
                <div className="text-sm text-fg-muted">
                  Phase: {c.phase} | Started: {c.startDate || 'unknown'}
                </div>
              </div>
              <button
                onClick={() => handleDelete(c)}
                className="text-danger-400"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          {inProgress.length === 0 && (
            <div className="text-fg-faint italic">No in-progress projects</div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 text-success-400">
          Completed Projects ({completed.length})
        </h3>
        <div className="space-y-2">
          {completed.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-4 bg-surface-2 p-3 rounded"
            >
              <div className="flex-1">
                <div className="font-semibold capitalize">
                  {c.name || `${c.currentQuality} ${c.template}`}
                </div>
                <div className="text-sm text-fg-muted">
                  Completed: {c.completedDate || 'unknown'}
                </div>
              </div>
              <button
                onClick={() => handleDelete(c)}
                className="text-danger-400"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          {completed.length === 0 && (
            <div className="text-fg-faint italic">No completed projects</div>
          )}
        </div>
      </div>
    </div>
  );
}
