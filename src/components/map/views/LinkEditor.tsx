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

  // For v1, link to center tile of target map (or party tile if set)
  const toTileId = targetMap
    ? targetMap.partyTileId ?? targetMap.grid[Math.floor(targetMap.rows / 2)]?.[Math.floor(targetMap.cols / 2)]
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
      <div className="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-lg shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100">Create Link</h2>
          <button onClick={onCancel} className="p-1 rounded hover:bg-gray-700">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
          {/* Target map */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Target Map <span className="text-red-400">*</span>
            </label>
            {targetMaps.length === 0 ? (
              <div className="px-2.5 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-500">
                No other maps available. Create another map first.
              </div>
            ) : (
              <select
                value={toMapId}
                onChange={(e) => setToMapId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-xs font-medium text-gray-400 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g., "Enter Port City"'
              className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className={[
                'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                canConfirm
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed',
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
