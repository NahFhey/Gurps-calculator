/**
 * TerrainPalette — sidebar showing terrain swatches for GM editing.
 */

import type { TerrainModel, TerrainId, StructureLayer, StructureLayerId } from '../../../types/map';
import type { MapInteractionMode } from '../MapPanel';
import { MAX_ELEVATION } from '../../../constants/map';
import { MAX_BRUSH_SIZE, type BrushShape } from '../../../utils/mapUtils';
import { Paintbrush, MousePointer, Hand, Plus, Eye, EyeOff, Trash2, Eraser, Circle, Square, Minus } from 'lucide-react';

interface TerrainPaletteProps {
  terrains: TerrainModel[];
  selectedTerrainId: TerrainId | null;
  interactionMode: MapInteractionMode;
  /** Elevation painted alongside terrain; null = terrain default (don't touch overrides). */
  paintElevation?: number | null;
  onSetPaintElevation?: (elevation: number | null) => void;
  /** Brush radius in tiles (1 = single tile). Ctrl+scroll over the map also adjusts it. */
  brushSize?: number;
  brushShape?: BrushShape;
  onSetBrushSize?: (size: number) => void;
  onSetBrushShape?: (shape: BrushShape) => void;
  onSelectTerrain: (terrainId: TerrainId) => void;
  onSetMode: (mode: MapInteractionMode) => void;
  onAddTerrain?: () => void;
  /** Structure layers on the active map (absent = feature hidden). */
  structureLayers?: StructureLayer[];
  /** Layer painting targets; null = the ground grid. */
  activeStructureLayerId?: StructureLayerId | null;
  /** When true (and a structure layer is active), painting erases cells. */
  structureEraseMode?: boolean;
  onSelectStructureLayer?: (layerId: StructureLayerId | null) => void;
  onAddStructureLayer?: () => void;
  onUpdateStructureLayer?: (layerId: StructureLayerId, changes: Partial<Omit<StructureLayer, 'id' | 'cells'>>) => void;
  onRemoveStructureLayer?: (layerId: StructureLayerId) => void;
  onSetStructureEraseMode?: (erase: boolean) => void;
}

export function TerrainPalette({
  terrains,
  selectedTerrainId,
  interactionMode,
  paintElevation = null,
  onSetPaintElevation,
  brushSize = 1,
  brushShape = 'circle',
  onSetBrushSize,
  onSetBrushShape,
  onSelectTerrain,
  onSetMode,
  onAddTerrain,
  structureLayers,
  activeStructureLayerId = null,
  structureEraseMode = false,
  onSelectStructureLayer,
  onAddStructureLayer,
  onUpdateStructureLayer,
  onRemoveStructureLayer,
  onSetStructureEraseMode,
}: TerrainPaletteProps) {
  const activeLayer = structureLayers?.find((l) => l.id === activeStructureLayerId) ?? null;
  return (
    <div className="w-36 bg-surface-1/80 border-r border-edge/50 flex flex-col overflow-y-auto">
      {/* Mode buttons */}
      <div className="px-2 py-2 border-b border-edge/50">
        <div className="text-[10px] uppercase tracking-wider text-fg-faint mb-1.5">Mode</div>
        <div className="flex gap-1">
          <button
            className={[
              'flex-1 p-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors',
              interactionMode === 'view'
                ? 'bg-accent-600 text-white'
                : 'bg-surface-2/50 text-fg-muted hover:bg-surface-3/50',
            ].join(' ')}
            onClick={() => onSetMode('view')}
            title="View mode"
          >
            <Hand className="w-3 h-3" />
          </button>
          <button
            className={[
              'flex-1 p-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors',
              interactionMode === 'paint'
                ? 'bg-accent-600 text-white'
                : 'bg-surface-2/50 text-fg-muted hover:bg-surface-3/50',
            ].join(' ')}
            onClick={() => onSetMode('paint')}
            title="Paint mode"
          >
            <Paintbrush className="w-3 h-3" />
          </button>
          <button
            className={[
              'flex-1 p-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors',
              interactionMode === 'select'
                ? 'bg-accent-600 text-white'
                : 'bg-surface-2/50 text-fg-muted hover:bg-surface-3/50',
            ].join(' ')}
            onClick={() => onSetMode('select')}
            title="Select mode"
          >
            <MousePointer className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Structure layers */}
      {onSelectStructureLayer && (
        <div className="px-2 py-2 border-b border-edge/50">
          <div className="text-[10px] uppercase tracking-wider text-fg-faint mb-1.5">Layer</div>
          <div className="space-y-1">
            <button
              className={[
                'w-full px-2 py-1 rounded text-xs text-left transition-colors',
                activeStructureLayerId === null
                  ? 'bg-surface-3 ring-1 ring-white/30 text-white'
                  : 'bg-surface-2/30 text-fg-secondary hover:bg-surface-3/30',
              ].join(' ')}
              onClick={() => onSelectStructureLayer(null)}
            >
              Ground
            </button>
            {(structureLayers ?? []).map((layer) => (
              <div key={layer.id} className="flex items-center gap-1">
                <button
                  className={[
                    'flex-1 min-w-0 px-2 py-1 rounded text-xs text-left truncate transition-colors',
                    activeStructureLayerId === layer.id
                      ? 'bg-surface-3 ring-1 ring-white/30 text-white'
                      : 'bg-surface-2/30 text-fg-secondary hover:bg-surface-3/30',
                  ].join(' ')}
                  onClick={() => onSelectStructureLayer(layer.id)}
                  title={`Paint on ${layer.name} (base ${layer.baseElevation})`}
                >
                  {layer.name}
                </button>
                <button
                  className="p-1 rounded text-fg-muted hover:bg-surface-3/50"
                  onClick={() => onUpdateStructureLayer?.(layer.id, { visible: !layer.visible })}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                >
                  {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
          {onAddStructureLayer && (
            <button
              className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs bg-surface-2/50 hover:bg-surface-3/50 text-fg-secondary transition-colors"
              onClick={onAddStructureLayer}
            >
              <Plus className="w-3 h-3" />
              Add Layer
            </button>
          )}

          {/* Active layer settings */}
          {activeLayer && (
            <div className="mt-2 space-y-1.5">
              <input
                type="text"
                value={activeLayer.name}
                onChange={(e) => onUpdateStructureLayer?.(activeLayer.id, { name: e.target.value })}
                className="w-full px-1.5 py-1 rounded bg-surface-0 border border-edge-strong text-xs text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent-500"
                title="Layer name"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={MAX_ELEVATION}
                  step={1}
                  value={activeLayer.baseElevation}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    if (Number.isFinite(value)) {
                      onUpdateStructureLayer?.(activeLayer.id, { baseElevation: value });
                    }
                  }}
                  className="w-12 px-1.5 py-1 rounded bg-surface-0 border border-edge-strong text-xs text-fg-primary"
                  title="Base elevation (levels above ground)"
                />
                <input
                  type="number"
                  min={1}
                  max={MAX_ELEVATION}
                  step={1}
                  value={activeLayer.heightLevels}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    if (Number.isFinite(value)) {
                      onUpdateStructureLayer?.(activeLayer.id, { heightLevels: value });
                    }
                  }}
                  className="w-12 px-1.5 py-1 rounded bg-surface-0 border border-edge-strong text-xs text-fg-primary"
                  title="Thickness (levels)"
                />
                <button
                  className={[
                    'p-1 rounded transition-colors',
                    structureEraseMode
                      ? 'bg-danger-700 text-white'
                      : 'text-fg-muted hover:bg-surface-3/50',
                  ].join(' ')}
                  onClick={() => onSetStructureEraseMode?.(!structureEraseMode)}
                  title="Erase cells from this layer while painting"
                  aria-label="Toggle erase mode"
                >
                  <Eraser className="w-3 h-3" />
                </button>
                <button
                  className="p-1 rounded text-danger-400 hover:bg-surface-3/50"
                  onClick={() => onRemoveStructureLayer?.(activeLayer.id)}
                  title="Delete layer"
                  aria-label="Delete layer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Brush (paint mode only) */}
      {interactionMode === 'paint' && onSetBrushSize && (
        <div className="px-2 py-2 border-b border-edge/50">
          <div className="text-[10px] uppercase tracking-wider text-fg-faint mb-1.5">
            Brush <span className="normal-case text-fg-disabled">(Ctrl+scroll)</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1 rounded bg-surface-2/50 text-fg-secondary hover:bg-surface-3/50 disabled:opacity-40"
              onClick={() => onSetBrushSize(Math.max(1, brushSize - 1))}
              disabled={brushSize <= 1}
              title="Smaller brush"
              aria-label="Smaller brush"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="flex-1 text-center text-xs text-fg-primary" data-testid="brush-size">{brushSize}</span>
            <button
              className="p-1 rounded bg-surface-2/50 text-fg-secondary hover:bg-surface-3/50 disabled:opacity-40"
              onClick={() => onSetBrushSize(Math.min(MAX_BRUSH_SIZE, brushSize + 1))}
              disabled={brushSize >= MAX_BRUSH_SIZE}
              title="Larger brush"
              aria-label="Larger brush"
            >
              <Plus className="w-3 h-3" />
            </button>
            {onSetBrushShape && (
              <>
                <button
                  className={[
                    'p-1 rounded transition-colors',
                    brushShape === 'circle' ? 'bg-accent-600 text-white' : 'bg-surface-2/50 text-fg-muted hover:bg-surface-3/50',
                  ].join(' ')}
                  onClick={() => onSetBrushShape('circle')}
                  title="Round brush"
                  aria-label="Round brush"
                >
                  <Circle className="w-3 h-3" />
                </button>
                <button
                  className={[
                    'p-1 rounded transition-colors',
                    brushShape === 'square' ? 'bg-accent-600 text-white' : 'bg-surface-2/50 text-fg-muted hover:bg-surface-3/50',
                  ].join(' ')}
                  onClick={() => onSetBrushShape('square')}
                  title="Square brush"
                  aria-label="Square brush"
                >
                  <Square className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Paint elevation (paint mode only; ground layer only — structure layers carry their own base) */}
      {interactionMode === 'paint' && onSetPaintElevation && activeStructureLayerId === null && (
        <div className="px-2 py-2 border-b border-edge/50">
          <div className="text-[10px] uppercase tracking-wider text-fg-faint mb-1.5">
            Elevation <span className="normal-case text-fg-disabled">(Shift+scroll)</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className={[
                'px-1.5 py-1 rounded text-xs transition-colors',
                paintElevation === null
                  ? 'bg-accent-600 text-white'
                  : 'bg-surface-2/50 text-fg-muted hover:bg-surface-3/50',
              ].join(' ')}
              onClick={() => onSetPaintElevation(null)}
              title="Paint with the terrain's default elevation (leaves overrides alone)"
            >
              Auto
            </button>
            <button
              className="p-1 rounded bg-surface-2/50 text-fg-secondary hover:bg-surface-3/50 disabled:opacity-40"
              onClick={() => onSetPaintElevation(Math.max(0, (paintElevation ?? 0) - 1))}
              disabled={paintElevation !== null && paintElevation <= 0}
              title="Lower paint elevation"
              aria-label="Lower paint elevation"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              min={0}
              max={MAX_ELEVATION}
              step={1}
              value={paintElevation ?? ''}
              placeholder="—"
              onChange={(e) => {
                const value = e.target.valueAsNumber;
                onSetPaintElevation(Number.isFinite(value)
                  ? Math.max(0, Math.min(MAX_ELEVATION, Math.round(value)))
                  : null);
              }}
              // Scrolling over a focused number input silently changes its value
              // in some browsers — blur so map zoom/elevation scrolling can't
              // edit this field by accident.
              onWheel={(e) => e.currentTarget.blur()}
              className="w-10 px-1 py-1 rounded bg-surface-0 border border-edge-strong text-center text-xs text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent-500"
              title="Paint every touched tile at this elevation"
            />
            <button
              className="p-1 rounded bg-surface-2/50 text-fg-secondary hover:bg-surface-3/50 disabled:opacity-40"
              onClick={() => onSetPaintElevation(Math.min(MAX_ELEVATION, (paintElevation ?? 0) + 1))}
              disabled={paintElevation !== null && paintElevation >= MAX_ELEVATION}
              title="Raise paint elevation"
              aria-label="Raise paint elevation"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Terrain list */}
      <div className="px-2 py-2 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-fg-faint mb-1.5">Terrain</div>
        <div className="space-y-1">
          {terrains.map((t) => (
            <button
              key={t.id}
              className={[
                'w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors',
                selectedTerrainId === t.id
                  ? 'bg-surface-3 ring-1 ring-white/30 text-white'
                  : 'bg-surface-2/30 text-fg-secondary hover:bg-surface-3/30',
              ].join(' ')}
              onClick={() => onSelectTerrain(t.id)}
            >
              <div
                className="w-4 h-4 rounded-sm border border-white/20 flex-shrink-0"
                style={{ backgroundColor: t.color }}
              />
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Add Terrain button */}
      {onAddTerrain && (
        <div className="px-2 py-2 border-t border-edge/50">
          <button
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium bg-accent-600/80 hover:bg-accent-500/80 text-white transition-colors"
            onClick={onAddTerrain}
          >
            <Plus className="w-3 h-3" />
            Add Terrain
          </button>
        </div>
      )}
    </div>
  );
}
