/**
 * MapGrid — renders the scrollable map grid with virtualized tiles.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { MapModel, TileId } from '../../../types/map';
import type { TokenData } from '../../../types/combatToken';
import { TILE_SIZE_PX } from '../../../constants/map';
import { MapTile } from './MapTile';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

/** Number of extra tiles rendered beyond the viewport */
const RENDER_BUFFER = 3;

/** Zoom level presets */
const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
const DEFAULT_ZOOM = 1.0;
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

interface MapGridProps {
  map: MapModel;
  isGmMode: boolean;
  selectedTileIds?: Set<TileId>;
  routeTileIds?: TileId[];
  reachableTileIds?: Set<TileId>;
  visibleTileIds?: Set<TileId>;
  onTileClick?: (tileId: TileId, row: number, col: number) => void;
  onTileContextMenu?: (tileId: TileId, row: number, col: number, e: React.MouseEvent) => void;
  onTileMouseDown?: (tileId: TileId, row: number, col: number, e: React.MouseEvent) => void;
  onTileMouseEnter?: (tileId: TileId, row: number, col: number, e: React.MouseEvent) => void;
  /** Combat token data keyed by tileId */
  tokens?: Map<string, TokenData[]>;
  /** Currently selected participant instanceId */
  selectedParticipantId?: string | null;
  /** Callback when a combat token is clicked */
  onTokenClick?: (instanceId: string) => void;
  /** Phase F: Tile IDs forming the LoS line overlay */
  losTileIds?: TileId[];
}

export function MapGrid({
  map,
  isGmMode,
  selectedTileIds,
  routeTileIds,
  reachableTileIds,
  visibleTileIds,
  onTileClick,
  onTileContextMenu,
  onTileMouseDown,
  onTileMouseEnter,
  tokens,
  selectedParticipantId,
  onTokenClick,
  losTileIds,
}: MapGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Effective tile size based on zoom
  const tileSizePx = Math.round(TILE_SIZE_PX * zoom);

  // Route tile set for quick lookup
  const routeSet = useMemo(
    () => new Set(routeTileIds ?? []),
    [routeTileIds]
  );

  // Phase F: LoS tile set for quick lookup
  const losSet = useMemo(
    () => new Set(losTileIds ?? []),
    [losTileIds]
  );

  // Zoom helpers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const nextIdx = ZOOM_LEVELS.findIndex((z) => z > prev);
      return nextIdx >= 0 ? ZOOM_LEVELS[nextIdx] : MAX_ZOOM;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const prevIdx = ZOOM_LEVELS.slice().reverse().findIndex((z) => z < prev);
      if (prevIdx >= 0) return ZOOM_LEVELS[ZOOM_LEVELS.length - 1 - prevIdx];
      return MIN_ZOOM;
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  // Ctrl+wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoom((prev) => {
          const nextIdx = ZOOM_LEVELS.findIndex((z) => z > prev);
          return nextIdx >= 0 ? ZOOM_LEVELS[nextIdx] : MAX_ZOOM;
        });
      } else {
        setZoom((prev) => {
          const prevIdx = ZOOM_LEVELS.slice().reverse().findIndex((z) => z < prev);
          if (prevIdx >= 0) return ZOOM_LEVELS[ZOOM_LEVELS.length - 1 - prevIdx];
          return MIN_ZOOM;
        });
      }
    }
  }, []);

  // Track container size
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
    if (node) {
      (containerRef as React.MutableRefObject<HTMLDivElement>).current = node;
      setContainerSize({ width: node.clientWidth, height: node.clientHeight });
      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      resizeObserverRef.current.observe(node);
    }
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollPos({ top: target.scrollTop, left: target.scrollLeft });
  }, []);

  // Calculate visible range using zoomed tile size
  const totalWidth = map.cols * tileSizePx;
  const totalHeight = map.rows * tileSizePx;

  const startRow = Math.max(0, Math.floor(scrollPos.top / tileSizePx) - RENDER_BUFFER);
  const endRow = Math.min(
    map.rows,
    Math.ceil((scrollPos.top + containerSize.height) / tileSizePx) + RENDER_BUFFER
  );
  const startCol = Math.max(0, Math.floor(scrollPos.left / tileSizePx) - RENDER_BUFFER);
  const endCol = Math.min(
    map.cols,
    Math.ceil((scrollPos.left + containerSize.width) / tileSizePx) + RENDER_BUFFER
  );

  // Build visible tile elements
  const tiles: React.ReactNode[] = [];
  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const tileId = map.grid[r]?.[c];
      if (!tileId) continue;

      const tile = map.tilesById[tileId];
      if (!tile) continue;

      const terrain = tile.terrainId ? map.terrainById[tile.terrainId] ?? null : null;
      const isRevealed = map.revealedTileIds.has(tileId);
      const isPartyHere = map.partyTileId === tileId;
      const markers = tile.markerIds
        .map((mId) => map.markersById[mId])
        .filter(Boolean);
      const hasLinks = tile.linkIds.length > 0;
      const tileTokens = tokens?.get(tileId);

      tiles.push(
        <div
          key={tileId}
          style={{
            position: 'absolute',
            top: r * tileSizePx,
            left: c * tileSizePx,
          }}
        >
          <MapTile
            terrain={terrain}
            isRevealed={isRevealed}
            isVisible={visibleTileIds?.has(tileId) ?? false}
            isPartyHere={isPartyHere}
            isGmMode={isGmMode}
            markers={markers}
            hasLinks={hasLinks}
            isSelected={selectedTileIds?.has(tileId)}
            isRouteHighlight={routeSet.has(tileId)}
            isReachable={reachableTileIds?.has(tileId)}
            isLoSHighlight={losSet.has(tileId)}
            row={r}
            col={c}
            tileSizePx={tileSizePx}
            tokens={tileTokens}
            selectedParticipantId={selectedParticipantId}
            onTokenClick={onTokenClick}
            onClick={() => onTileClick?.(tileId, r, c)}
            onContextMenu={(e) => onTileContextMenu?.(tileId, r, c, e)}
            onMouseDown={(e) => onTileMouseDown?.(tileId, r, c, e)}
            onMouseEnter={(e) => onTileMouseEnter?.(tileId, r, c, e)}
          />
        </div>
      );
    }
  }

  return (
    <div className="flex-1 relative">
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-30 flex flex-col items-center gap-1 bg-gray-800/90 rounded-lg p-1 border border-gray-700/50 shadow-lg">
        <button
          className="p-1.5 rounded hover:bg-gray-600/50 text-gray-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={handleZoomIn}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom in (Ctrl+Scroll Up)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          className="px-1.5 py-0.5 rounded hover:bg-gray-600/50 text-gray-400 text-[10px] font-mono transition-colors"
          onClick={handleZoomReset}
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className="p-1.5 rounded hover:bg-gray-600/50 text-gray-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={handleZoomOut}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom out (Ctrl+Scroll Down)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        {zoom !== DEFAULT_ZOOM && (
          <button
            className="p-1.5 rounded hover:bg-gray-600/50 text-gray-400 hover:text-white transition-colors"
            onClick={handleZoomReset}
            title="Reset to 100%"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Scrollable grid */}
      <div
        ref={containerCallbackRef}
        className="absolute inset-0 overflow-auto bg-gray-950"
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        <div
          className="relative"
          style={{
            width: totalWidth,
            height: totalHeight,
            minWidth: totalWidth,
            minHeight: totalHeight,
          }}
        >
          {tiles}
        </div>
      </div>
    </div>
  );
}
