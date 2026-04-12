import { ChangeEvent } from 'react';
import QuickManeuverBar from './QuickManeuverBar';

interface Maneuver {
  id: string;
  label: string;
  disabled?: boolean;
  notes?: string;
  warning?: string;
  reason?: string;
}

interface ManeuverSelectorProps {
  maneuvers: Maneuver[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabledReason?: string;
}

export default function ManeuverSelector({
  maneuvers,
  selectedId,
  onSelect,
  disabledReason
}: ManeuverSelectorProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Maneuver</h3>
        {disabledReason && (
          <span className="text-xs text-red-400">{disabledReason}</span>
        )}
      </div>

      {/* Quick-action buttons for common maneuvers */}
      <QuickManeuverBar
        maneuvers={maneuvers}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      {/* Full dropdown for all maneuvers (including uncommon ones) */}
      <select
        value={selectedId || ''}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onSelect(e.target.value || null)}
        className="w-full px-3 py-2 bg-gray-700 rounded text-sm"
      >
        <option value="">All maneuvers...</option>
        {maneuvers.map((maneuver) => (
          <option
            key={maneuver.id}
            value={maneuver.id}
            disabled={maneuver.disabled}
          >
            {maneuver.label}{maneuver.disabled ? ' (Unavailable)' : ''}
          </option>
        ))}
      </select>
      {selectedId && (
        <div className="text-xs text-gray-400 space-y-1">
          {maneuvers
            .filter((maneuver) => maneuver.id === selectedId)
            .map((maneuver) => (
              <div key={maneuver.id}>
                {maneuver.notes && <div>{maneuver.notes}</div>}
                {maneuver.warning && (
                  <div className="text-yellow-400">{maneuver.warning}</div>
                )}
                {maneuver.reason && (
                  <div className="text-red-400">{maneuver.reason}</div>
                )}
              </div>
            ))}
        </div>
      )}
      {!selectedId && (
        <div className="text-xs text-gray-400">
          Pick a quick action above, or choose from the full list.
        </div>
      )}
    </div>
  );
}
