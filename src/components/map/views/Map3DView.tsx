import { useEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { MapModel, TileId, VisionMode } from '../../../types/map';
import { getEffectiveElevation } from '../../../utils/lineOfSight';
import {
  MapScene,
  type MapSceneCallbacks,
  type TilePointerEvent,
} from '../three/MapScene';

interface Map3DViewProps {
  map: MapModel;
  isGmMode: boolean;
  visionMode: VisionMode;
  visibleTileIds?: Set<TileId>;
  selectedTileIds?: Set<TileId>;
  routeTileIds?: TileId[];
  reachableTileIds?: Set<TileId>;
  paintModeActive: boolean;
  placingParty: boolean;
  onTileClick?: (tileId: TileId, row: number, col: number) => void;
  onTileContextMenu?: (tileId: TileId, row: number, col: number, e: TilePointerEvent) => void;
  onTilePaintStart?: (tileId: TileId, row: number, col: number) => void;
  onTilePaintEnter?: (tileId: TileId, row: number, col: number) => void;
}

interface HoverInfo {
  tileId: TileId;
  row: number;
  col: number;
  clientX: number;
  clientY: number;
}

export function Map3DView(props: Map3DViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MapScene | null>(null);
  const propsRef = useRef(props);
  const [sceneReady, setSceneReady] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const callbacks: MapSceneCallbacks = {
      onTileClick: (tileId, row, col) => propsRef.current.onTileClick?.(tileId, row, col),
      onTileContextMenu: (tileId, row, col, event) => {
        propsRef.current.onTileContextMenu?.(tileId, row, col, event);
      },
      onTilePaintStart: (tileId, row, col) => {
        propsRef.current.onTilePaintStart?.(tileId, row, col);
      },
      onTilePaintEnter: (tileId, row, col) => {
        propsRef.current.onTilePaintEnter?.(tileId, row, col);
      },
      onHoverTile: setHover,
      onContextLost: () => setUnavailable(true),
      onContextRestored: () => setUnavailable(false),
    };
    const scene = new MapScene(canvas, callbacks);
    sceneRef.current = scene;
    setUnavailable(!scene.ok);
    setSceneReady((value) => value + 1);

    let observer: ResizeObserver | null = null;
    const resize = () => scene.resize();
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      observer.observe(container);
    } else {
      window.addEventListener('resize', resize);
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const fog = props.isGmMode
      ? 'gm'
      : props.visionMode === 'open' ? 'player-open' : 'player-los';
    sceneRef.current?.update({
      map: props.map,
      fog,
      visibleTileIds: fog === 'player-los' ? props.visibleTileIds ?? new Set<TileId>() : null,
      selectedTileIds: props.selectedTileIds ?? null,
      routeTileIds: props.routeTileIds ?? null,
      reachableTileIds: props.reachableTileIds ?? null,
      paintModeActive: props.paintModeActive,
      placingParty: props.placingParty,
    });
  }, [
    props.map,
    props.isGmMode,
    props.visionMode,
    props.visibleTileIds,
    props.selectedTileIds,
    props.routeTileIds,
    props.reachableTileIds,
    props.paintModeActive,
    props.placingParty,
    sceneReady,
  ]);

  const hoverTile = hover ? props.map.tilesById[hover.tileId] : null;
  const terrain = hoverTile?.terrainId ? props.map.terrainById[hoverTile.terrainId] : null;
  const markerCount = hoverTile?.markerIds.filter((markerId) => {
    const marker = props.map.markersById[markerId];
    return marker && (props.isGmMode || marker.visibility === 'player');
  }).length ?? 0;

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-[#0a0a0f]">
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />
      {unavailable && (
        <div role="alert" className="absolute inset-x-4 top-4 z-20 rounded border border-red-500/60 bg-red-950/90 px-4 py-3 text-sm text-red-200">
          3D map unavailable — WebGL could not start.
        </div>
      )}
      <button
        type="button"
        aria-label="Frame party"
        title="Frame party"
        onClick={() => sceneRef.current?.frameParty()}
        className="absolute right-3 top-3 z-10 rounded-md border border-gray-600 bg-gray-900/80 p-2 text-gray-200 shadow hover:bg-gray-700"
      >
        <Crosshair className="h-4 w-4" />
      </button>
      {hover && hoverTile && (
        <div
          className="pointer-events-none fixed z-40 max-w-56 rounded border border-gray-600 bg-gray-950/95 px-2 py-1.5 text-xs text-gray-200 shadow-xl"
          style={{ left: hover.clientX + 12, top: hover.clientY + 12 }}
        >
          <div className="font-medium">{terrain?.name ?? 'Unassigned'} ({hover.row}, {hover.col})</div>
          <div className="text-gray-400">Elev {getEffectiveElevation(props.map, hover.tileId)}</div>
          {props.map.partyTileId === hover.tileId && <div>Party here</div>}
          {markerCount > 0 && <div>{markerCount} marker(s)</div>}
          {hoverTile.linkIds.length > 0 && <div>Has links</div>}
        </div>
      )}
    </div>
  );
}

export type { Map3DViewProps };
