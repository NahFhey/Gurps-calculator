import { useState } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_TERRAIN_ELEVATION, MAX_ELEVATION } from '../../../constants/map';

interface ElevationDialogProps {
  tileCount: number;
  onConfirm: (elevation: number | null) => void;
  onCancel: () => void;
}

export function ElevationDialog({ tileCount, onConfirm, onCancel }: ElevationDialogProps) {
  const [elevation, setElevation] = useState<number | null>(DEFAULT_TERRAIN_ELEVATION);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-lg border border-edge-strong bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-lg font-semibold text-fg-bright">Set Elevation</h2>
          <button type="button" aria-label="Close" onClick={onCancel} className="rounded p-1 hover:bg-surface-2">
            <X className="h-4 w-4 text-fg-muted" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-4">
          <div>
            <label htmlFor="tile-elevation" className="mb-1 block text-sm font-medium text-fg-secondary">
              Elevation level
            </label>
            <input
              id="tile-elevation"
              type="number"
              min={0}
              max={MAX_ELEVATION}
              step={1}
              value={elevation ?? ''}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                setElevation(Number.isFinite(value) ? value : null);
              }}
              className="w-full rounded border border-edge-strong bg-surface-0 px-3 py-2 text-sm text-fg-bright focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setElevation(null)}
            className="w-full rounded border border-edge-strong px-3 py-2 text-sm text-fg-secondary hover:bg-surface-2"
          >
            Clear override (use terrain elevation)
          </button>
          <p className="text-xs text-fg-muted">
            This change affects {tileCount} tile{tileCount === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-edge px-4 py-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-fg-secondary hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (elevation === null) onConfirm(null);
              else onConfirm(Math.max(0, Math.min(MAX_ELEVATION, Math.round(elevation))));
            }}
            className="rounded bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-500"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ElevationDialogProps };
