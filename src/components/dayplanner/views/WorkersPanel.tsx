import { Users } from 'lucide-react';
import type { WorkersPanelProps } from '../../../types/dayplanner';

/**
 * WorkersPanel - Displays available and assigned workers
 *
 * Shows workers grouped by their assignment status for the current slot.
 */
export function WorkersPanel({
  workers,
  availableWorkers,
  assignedWorkerIds
}: WorkersPanelProps) {
  return (
    <div className="col-span-3 bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Users size={18} /> Workers
      </h3>

      <div className="space-y-2">
        <div className="text-sm text-gray-400 mb-2">
          Available ({availableWorkers.length}/{workers.length})
        </div>
        {availableWorkers.map(worker => (
          <div
            key={worker.id}
            className="p-2 bg-gray-700 rounded text-sm"
          >
            {worker.name}
          </div>
        ))}

        {assignedWorkerIds.length > 0 && (
          <>
            <div className="text-sm text-gray-400 mt-4 mb-2">
              Assigned ({assignedWorkerIds.length})
            </div>
            {assignedWorkerIds.map(workerId => {
              const worker = workers.find(w => w.id === workerId);
              return (
                <div
                  key={workerId}
                  className="p-2 bg-green-900 rounded text-sm"
                >
                  {worker?.name || 'Unknown'}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
