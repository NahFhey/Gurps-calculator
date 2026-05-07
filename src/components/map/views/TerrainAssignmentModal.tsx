/**
 * TerrainAssignmentModal — mandatory modal for post-travel null terrain assignment.
 *
 * After GM override travel through null-terrain tiles, this modal
 * forces the GM to assign terrain before continuing.
 */

import { useEffect, useId, useState } from 'react';
import type { TileId, TerrainId, MapModel } from '../../../types/map';
import { findTileGridPos } from '../../../utils/mapUtils';
import { AlertTriangle, Paintbrush, CheckCircle } from 'lucide-react';

interface TerrainAssignmentModalProps {
  map: MapModel;
  pendingTileIds: TileId[];
  onFillAll: (terrainId: TerrainId) => void;
  onDismiss: () => void;
}

export function TerrainAssignmentModal({
  map,
  pendingTileIds,
  onFillAll,
  onDismiss,
}: TerrainAssignmentModalProps) {
  const [selectedTerrainId, setSelectedTerrainId] = useState<TerrainId>(
    map.lastPlacedTerrainId
  );
  const titleId = useId();
  const descriptionId = useId();
  const terrains = Object.values(map.terrainById);

  // Check if all pending tiles now have terrain (they may have been painted manually)
  const remainingNull = pendingTileIds.filter((tid) => {
    const tile = map.tilesById[tid];
    return tile && tile.terrainId === null;
  });

  const allResolved = remainingNull.length === 0;

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && allResolved) onDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [allResolved, onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-lg shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
          <AlertTriangle className="w-4 h-4 text-yellow-400" aria-hidden="true" />
          <h2 id={titleId} className="text-sm font-semibold text-gray-100">
            Assign Terrain
          </h2>
        </div>

        <div className="px-4 py-3 space-y-3">
          {allResolved ? (
            <div id={descriptionId} className="flex items-center gap-2 text-green-300 text-sm">
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              All tiles have been assigned terrain.
            </div>
          ) : (
            <>
              <p id={descriptionId} className="text-xs text-gray-400">
                {remainingNull.length} tile(s) traversed during travel have no terrain
                assigned. Assign terrain before continuing.
              </p>

              {/* Tile list */}
              <div className="max-h-28 overflow-y-auto space-y-0.5">
                {remainingNull.map((tileId) => {
                  const pos = findTileGridPos(map, tileId);
                  return (
                    <div
                      key={tileId}
                      className="text-[10px] text-gray-400 px-2 py-0.5 bg-gray-900/50 rounded"
                    >
                      Tile ({pos?.row}, {pos?.col})
                    </div>
                  );
                })}
              </div>

              {/* Terrain selector */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Fill all with:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {terrains.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-label={`Select terrain ${t.name}`}
                      aria-pressed={selectedTerrainId === t.id}
                      className={[
                        'flex items-center gap-1.5 px-2 py-1 rounded text-[10px] border transition-colors',
                        selectedTerrainId === t.id
                          ? 'bg-gray-600 border-white/30 text-white'
                          : 'bg-gray-700/30 border-gray-600 text-gray-300 hover:bg-gray-600/30',
                      ].join(' ')}
                      onClick={() => setSelectedTerrainId(t.id)}
                    >
                      <div
                        aria-hidden="true"
                        className="w-3 h-3 rounded-sm border border-white/20 flex-shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            {allResolved ? (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Done"
                className="px-3 py-1.5 text-xs font-medium rounded bg-green-700 hover:bg-green-600 text-white transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onFillAll(selectedTerrainId)}
                aria-label={`Fill all ${remainingNull.length} tiles with selected terrain`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <Paintbrush className="w-3 h-3" aria-hidden="true" />
                Fill All ({remainingNull.length} tiles)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
