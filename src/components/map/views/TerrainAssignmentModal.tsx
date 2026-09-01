/**
 * TerrainAssignmentModal — mandatory modal for post-travel null terrain assignment.
 *
 * After GM override travel through null-terrain tiles, this modal
 * forces the GM to assign terrain before continuing.
 */

import { useId, useState } from 'react';
import type { TileId, TerrainId, MapModel } from '../../../types/map';
import { findTileGridPos } from '../../../utils/mapUtils';
import { AlertTriangle, Paintbrush, CheckCircle } from 'lucide-react';
import { Modal } from '../../ui/Modal';

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
  const descriptionId = useId();
  const terrains = Object.values(map.terrainById);

  // Check if all pending tiles now have terrain (they may have been painted manually)
  const remainingNull = pendingTileIds.filter((tid) => {
    const tile = map.tilesById[tid];
    return tile && tile.terrainId === null;
  });

  const allResolved = remainingNull.length === 0;

  return (
    <Modal
      isOpen
      onClose={onDismiss}
      title={(
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" aria-hidden="true" />
          Assign Terrain
        </span>
      )}
      ariaDescribedby={descriptionId}
      size="sm"
      hideCloseButton
      closeOnBackdrop={false}
      closeOnEscape={allResolved}
      bodyClassName="space-y-3 px-4 py-3"
    >
          {allResolved ? (
            <div id={descriptionId} className="flex items-center gap-2 text-success-300 text-sm">
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              All tiles have been assigned terrain.
            </div>
          ) : (
            <>
              <p id={descriptionId} className="text-xs text-fg-muted">
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
                      className="text-[10px] text-fg-muted px-2 py-0.5 bg-surface-0/50 rounded"
                    >
                      Tile ({pos?.row}, {pos?.col})
                    </div>
                  );
                })}
              </div>

              {/* Terrain selector */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
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
                          ? 'bg-surface-3 border-white/30 text-white'
                          : 'bg-surface-2/30 border-edge-strong text-fg-secondary hover:bg-surface-3/30',
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
                className="px-3 py-1.5 text-xs font-medium rounded bg-success-700 hover:bg-success-600 text-white transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onFillAll(selectedTerrainId)}
                aria-label={`Fill all ${remainingNull.length} tiles with selected terrain`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-accent-600 hover:bg-accent-500 text-white transition-colors"
              >
                <Paintbrush className="w-3 h-3" aria-hidden="true" />
                Fill All ({remainingNull.length} tiles)
              </button>
            )}
          </div>
    </Modal>
  );
}
