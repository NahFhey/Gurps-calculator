import { useState } from 'react';
import { DEFAULT_TERRAIN_ELEVATION, MAX_ELEVATION } from '../../../constants/map';
import { Modal } from '../../ui/Modal';

interface ElevationDialogProps {
  tileCount: number;
  onConfirm: (elevation: number | null) => void;
  onCancel: () => void;
}

export function ElevationDialog({ tileCount, onConfirm, onCancel }: ElevationDialogProps) {
  const [elevation, setElevation] = useState<number | null>(DEFAULT_TERRAIN_ELEVATION);

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Set Elevation"
      size="sm"
      bodyClassName="space-y-4 px-4 py-4"
      footer={(
        <>
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
        </>
      )}
    >
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
    </Modal>
  );
}

export type { ElevationDialogProps };
