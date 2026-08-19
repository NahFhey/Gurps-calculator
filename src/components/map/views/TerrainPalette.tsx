/**
 * TerrainPalette — sidebar showing terrain swatches for GM editing.
 */

import type { TerrainModel, TerrainId } from '../../../types/map';
import type { MapInteractionMode } from '../MapPanel';
import { MAX_ELEVATION } from '../../../constants/map';
import { Paintbrush, MousePointer, Hand, Plus } from 'lucide-react';

interface TerrainPaletteProps {
  terrains: TerrainModel[];
  selectedTerrainId: TerrainId | null;
  interactionMode: MapInteractionMode;
  /** Elevation painted alongside terrain; null = terrain default (don't touch overrides). */
  paintElevation?: number | null;
  onSetPaintElevation?: (elevation: number | null) => void;
  onSelectTerrain: (terrainId: TerrainId) => void;
  onSetMode: (mode: MapInteractionMode) => void;
  onAddTerrain?: () => void;
}

export function TerrainPalette({
  terrains,
  selectedTerrainId,
  interactionMode,
  paintElevation = null,
  onSetPaintElevation,
  onSelectTerrain,
  onSetMode,
  onAddTerrain,
}: TerrainPaletteProps) {
  return (
    <div className="w-36 bg-gray-800/80 border-r border-gray-700/50 flex flex-col overflow-y-auto">
      {/* Mode buttons */}
      <div className="px-2 py-2 border-b border-gray-700/50">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Mode</div>
        <div className="flex gap-1">
          <button
            className={[
              'flex-1 p-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors',
              interactionMode === 'view'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50',
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
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50',
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
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50',
            ].join(' ')}
            onClick={() => onSetMode('select')}
            title="Select mode"
          >
            <MousePointer className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Paint elevation (paint mode only) */}
      {interactionMode === 'paint' && onSetPaintElevation && (
        <div className="px-2 py-2 border-b border-gray-700/50">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Elevation</div>
          <div className="flex gap-1">
            <button
              className={[
                'flex-1 px-1.5 py-1 rounded text-xs transition-colors',
                paintElevation === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50',
              ].join(' ')}
              onClick={() => onSetPaintElevation(null)}
              title="Paint with the terrain's default elevation (leaves overrides alone)"
            >
              Auto
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
              className="w-14 px-1.5 py-1 rounded bg-gray-900 border border-gray-600 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Paint every touched tile at this elevation"
            />
          </div>
        </div>
      )}

      {/* Terrain list */}
      <div className="px-2 py-2 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Terrain</div>
        <div className="space-y-1">
          {terrains.map((t) => (
            <button
              key={t.id}
              className={[
                'w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors',
                selectedTerrainId === t.id
                  ? 'bg-gray-600 ring-1 ring-white/30 text-white'
                  : 'bg-gray-700/30 text-gray-300 hover:bg-gray-600/30',
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
        <div className="px-2 py-2 border-t border-gray-700/50">
          <button
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium bg-blue-600/80 hover:bg-blue-500/80 text-white transition-colors"
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
