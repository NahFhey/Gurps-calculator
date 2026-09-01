/**
 * LinkEditor — modal for creating links (portals) between maps.
 */

import { useState } from 'react';
import type { MapId, TileId, LinkModel, MapModel } from '../../../types/map';
import { MAP_SCALES } from '../../../constants/map';
import { X } from 'lucide-react';

interface LinkEditorProps {
  fromMapId: MapId;
  fromTileId: TileId;
  maps: Record<MapId, MapModel>;
  onConfirm: (link: LinkModel) => void;
  onCancel: () => void;
}

export function LinkEditor({
  fromMapId,
  fromTileId,
  maps,
  onConfirm,
  onCancel,
}: LinkEditorProps) {
  const [toMapId, setToMapId] = useState<MapId>('');
  const [label, setLabel] = useState('');

  // Available target maps (exclude current map)
  const targetMaps = Object.values(maps).filter((m) => m.id !== fromMapId);

  // Selected target map
  const targetMap = toMapId ? maps[toMapId] : null;

  // Links default to the stable tile id currently at the target map's center.
  const toTileId = targetMap
    ? targetMap.grid[Math.floor(targetMap.rows / 2)]?.[Math.floor(targetMap.cols / 2)]
    : null;

  const canConfirm = toMapId && toTileId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm || !toTileId) return;

    const link: LinkModel = {
      id: crypto.randomUUID(),
      fromMapId,
      fromTileId,
      toMapId,
      toTileId,
      label: label.trim() || undefined,
    };
    onConfirm(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm bg-surface-1 border border-edge-strong rounded-lg shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h2 className="text-sm font-semibold text-fg-bright">Create Link</h2>
          <button onClick={onCancel} className="p-1 rounded hover:bg-surface-2">
            <X className="w-4 h-4 text-fg-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
          {/* Target map */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">
              Target Map <span className="text-danger-400">*</span>
            </label>
            {targetMaps.length === 0 ? (
              <div className="px-2.5 py-1.5 bg-surface-0 border border-edge-strong rounded text-sm text-fg-faint">
                No other maps available. Create another map first.
              </div>
            ) : (
              <select
                value={toMapId}
                onChange={(e) => setToMapId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-surface-0 border border-edge-strong rounded text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                <option value="">Select a map...</option>
                {targetMaps.map((m) => {
                  const scale = MAP_SCALES.find((s) => s.value === m.scaleMilesPerTile);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} ({scale?.label ?? `${m.scaleMilesPerTile} mi/tile`})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g., "Enter Port City"'
              className="w-full px-2.5 py-1.5 bg-surface-0 border border-edge-strong rounded text-sm text-fg-primary placeholder-fg-faint focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-fg-secondary hover:text-fg-bright"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className={[
                'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                canConfirm
                  ? 'bg-accent-600 hover:bg-accent-500 text-white'
                  : 'bg-surface-2 text-fg-faint cursor-not-allowed',
              ].join(' ')}
            >
              Create Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
