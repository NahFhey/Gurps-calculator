/**
 * MapContextMenu — right-click context menu for map tiles.
 */

import { useEffect, useRef } from 'react';
import type { TileId, TerrainId, TerrainModel } from '../../../types/map';
import { Paintbrush, MapPin, LinkIcon, Mountain } from 'lucide-react';

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
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-48"
      style={{ top: menuState.y, left: menuState.x }}
    >
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500">
        Tile ({menuState.row}, {menuState.col})
      </div>

      {/* Stamp terrain to selection */}
      {hasSelection && selectedTerrainId && (
        <button
          className="w-full px-3 py-1.5 text-sm text-left text-gray-200 hover:bg-gray-700/50 flex items-center gap-2"
          onClick={onStampSelection}
        >
          <Paintbrush className="w-3.5 h-3.5 text-gray-400" />
          Apply {terrainName} to {selectedTileIds.size} tile(s)
        </button>
      )}

      {/* Separator */}
      <div className="border-t border-gray-700 my-1" />

      {/* Set elevation */}
      <button
        className="w-full px-3 py-1.5 text-sm text-left text-gray-200 hover:bg-gray-700/50 flex items-center gap-2"
        onClick={() => {
          const targets = selectedTileIds.size > 0 && selectedTileIds.has(menuState.tileId)
            ? Array.from(selectedTileIds)
            : [menuState.tileId];
          onSetElevation(targets);
          onClose();
        }}
      >
        <Mountain className="w-3.5 h-3.5 text-gray-400" />
        Set Elevation…
      </button>

      {/* Add marker */}
      <button
        className="w-full px-3 py-1.5 text-sm text-left text-gray-200 hover:bg-gray-700/50 flex items-center gap-2"
        onClick={() => {
          onAddMarker(menuState.tileId);
          onClose();
        }}
      >
        <MapPin className="w-3.5 h-3.5 text-gray-400" />
        Add Marker
      </button>

      {/* Add link */}
      <button
        className="w-full px-3 py-1.5 text-sm text-left text-gray-200 hover:bg-gray-700/50 flex items-center gap-2"
        onClick={() => {
          onAddLink(menuState.tileId);
          onClose();
        }}
      >
        <LinkIcon className="w-3.5 h-3.5 text-gray-400" />
        Add Link
      </button>
    </div>
  );
}
