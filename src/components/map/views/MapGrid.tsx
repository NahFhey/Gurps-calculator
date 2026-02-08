/**
 * MapGrid — renders the scrollable map grid with virtualized tiles.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { MapModel, TileId } from '../../../types/map';
import { TILE_SIZE_PX } from '../../../constants/map';
import { MapTile } from './MapTile';

/** Number of extra tiles rendered beyond the viewport */
const RENDER_BUFFER = 3;

interface MapGridProps {
  map: MapModel;
  isGmMode: boolean;
  selectedTileIds?: Set<TileId>;
  routeTileIds?: TileId[];
  reachableTileIds?: Set<TileId>;
  onTileClick?: (tileId: TileId, row: number, col: number) => void;
  onTileContextMenu?: (tileId: TileId, row: number, col: number, e: React.MouseEvent) => void;
  onTileMouseDown?: (tileId: TileId, row: number, col: number, e: React.MouseEvent) => void;
  onTileMouseEnter?: (tileId: TileId, row: number, col: number, e: React.MouseEvent) => void;
}

export function MapGrid({
  map,
  isGmMode,
  selectedTileIds,
  routeTileIds,
  reachableTileIds,
  onTileClick,
  onTileContextMenu,
  onTileMouseDown,
  onTileMouseEnter,
}: MapGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Route tile set for quick lookup
  const routeSet = useMemo(
    () => new Set(routeTileIds ?? []),
    [routeTileIds]
  );

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

  // Calculate visible range
  const totalWidth = map.cols * TILE_SIZE_PX;
  const totalHeight = map.rows * TILE_SIZE_PX;

  const startRow = Math.max(0, Math.floor(scrollPos.top / TILE_SIZE_PX) - RENDER_BUFFER);
  const endRow = Math.min(
    map.rows,
    Math.ceil((scrollPos.top + containerSize.height) / TILE_SIZE_PX) + RENDER_BUFFER
  );
  const startCol = Math.max(0, Math.floor(scrollPos.left / TILE_SIZE_PX) - RENDER_BUFFER);
  const endCol = Math.min(
    map.cols,
    Math.ceil((scrollPos.left + containerSize.width) / TILE_SIZE_PX) + RENDER_BUFFER
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

      tiles.push(
        <div
          key={tileId}
          style={{
            position: 'absolute',
            top: r * TILE_SIZE_PX,
            left: c * TILE_SIZE_PX,
          }}
        >
          <MapTile
            terrain={terrain}
            isRevealed={isRevealed}
            isPartyHere={isPartyHere}
            isGmMode={isGmMode}
            markers={markers}
            hasLinks={hasLinks}
            isSelected={selectedTileIds?.has(tileId)}
            isRouteHighlight={routeSet.has(tileId)}
            isReachable={reachableTileIds?.has(tileId)}
            row={r}
            col={c}
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
    <div
      ref={containerCallbackRef}
      className="flex-1 overflow-auto bg-gray-950"
      onScroll={handleScroll}
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
  );
}
