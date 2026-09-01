/**
 * MapContextMenu — right-click context menu for map tiles.
 */

import { useEffect, useRef } from 'react';
import type { MarkerModel, TileId, TerrainId, TerrainModel } from '../../../types/map';
import { Eye, Pencil, Paintbrush, MapPin, LinkIcon, Mountain } from 'lucide-react';

export interface ContextMenuState {
  tileId: TileId;
  row: number;
  col: number;
  x: number;
  y: number;
}

interface MapContextMenuProps {
  state: ContextMenuState;
  selectedTileIds: Set<TileId>;
  selectedTerrainId: TerrainId | null;
  terrains: Record<TerrainId, TerrainModel>;
  onStampSelection: () => void;
  onAddMarker: (tileId: TileId) => void;
  onAddLink: (tileId: TileId) => void;
  onSetElevation: (tileIds: TileId[]) => void;
  isGmMode?: boolean;
  marker?: MarkerModel;
  hasVisibleLocation?: boolean;
  onViewLocation?: (tileId: TileId) => void;
  onEditMarker?: (marker: MarkerModel) => void;
  onClose: () => void;
}

export function MapContextMenu({
  state: menuState,
  selectedTileIds,
  selectedTerrainId,
  terrains,
  onStampSelection,
  onAddMarker,
  onAddLink,
  onSetElevation,
  isGmMode = true,
  marker,
  hasVisibleLocation,
  onViewLocation,
  onEditMarker,
  onClose,
}: MapContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const terrainName = selectedTerrainId ? terrains[selectedTerrainId]?.name : null;
  const hasSelection = selectedTileIds.size > 0;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface-1 border border-edge-strong rounded-lg shadow-xl py-1 min-w-48"
      style={{ top: menuState.y, left: menuState.x }}
    >
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-fg-faint">
        Tile ({menuState.row}, {menuState.col})
      </div>

      {hasVisibleLocation && onViewLocation && (
        <button
          className="w-full px-3 py-1.5 text-sm text-left text-fg-primary hover:bg-surface-2/50 flex items-center gap-2"
          onClick={() => { onViewLocation(menuState.tileId); onClose(); }}
        >
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          View location
        </button>
      )}

      {/* Stamp terrain to selection */}
      {isGmMode && hasSelection && selectedTerrainId && (
        <button
          className="w-full px-3 py-1.5 text-sm text-left text-fg-primary hover:bg-surface-2/50 flex items-center gap-2"
          onClick={onStampSelection}
        >
          <Paintbrush className="w-3.5 h-3.5 text-fg-muted" />
          Apply {terrainName} to {selectedTileIds.size} tile(s)
        </button>
      )}

      {isGmMode && <div className="border-t border-edge my-1" />}

      {/* Set elevation */}
      {isGmMode && <button
        className="w-full px-3 py-1.5 text-sm text-left text-fg-primary hover:bg-surface-2/50 flex items-center gap-2"
        onClick={() => {
          const targets = selectedTileIds.size > 0 && selectedTileIds.has(menuState.tileId)
            ? Array.from(selectedTileIds)
            : [menuState.tileId];
          onSetElevation(targets);
          onClose();
        }}
      >
        <Mountain className="w-3.5 h-3.5 text-fg-muted" />
        Set Elevation…
      </button>}

      {/* Add marker */}
      {isGmMode && <button
        className="w-full px-3 py-1.5 text-sm text-left text-fg-primary hover:bg-surface-2/50 flex items-center gap-2"
        onClick={() => {
          onAddMarker(menuState.tileId);
          onClose();
        }}
      >
        <MapPin className="w-3.5 h-3.5 text-fg-muted" />
        Add Marker
      </button>}

      {isGmMode && marker && onEditMarker && (
        <button
          className="w-full px-3 py-1.5 text-sm text-left text-fg-primary hover:bg-surface-2/50 flex items-center gap-2"
          onClick={() => { onEditMarker(marker); onClose(); }}
        >
          <Pencil className="w-3.5 h-3.5 text-fg-muted" />
          Edit marker
        </button>
      )}

      {/* Add link */}
      {isGmMode && <button
        className="w-full px-3 py-1.5 text-sm text-left text-fg-primary hover:bg-surface-2/50 flex items-center gap-2"
        onClick={() => {
          onAddLink(menuState.tileId);
          onClose();
        }}
      >
        <LinkIcon className="w-3.5 h-3.5 text-fg-muted" />
        Add Link
      </button>}
    </div>
  );
}
