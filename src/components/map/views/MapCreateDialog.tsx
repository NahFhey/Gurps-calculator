/**
 * MapCreateDialog — modal for creating a new map.
 * Supports both Overland and Tactical map creation modes.
 */

import React, { useState } from 'react';
import type { MapScale, TerrainId } from '../../../types/map';
import { MAP_SCALES, createPresetTerrains, createTacticalTerrainPresets } from '../../../constants/map';
import { X } from 'lucide-react';

type MapMode = 'overland' | 'tactical';

interface MapCreateDialogProps {
  onConfirm: (params: {
    name: string;
    description?: string;
    scaleMilesPerTile: MapScale;
    startTerrainId: TerrainId;
  }) => void;
  onConfirmTactical?: (params: {
    name: string;
    description?: string;
    rows: number;
    cols: number;
    startTerrainId?: string;
  }) => void;
  onCancel: () => void;
}

const presetTerrains = createPresetTerrains();
const tacticalTerrains = createTacticalTerrainPresets();

const TACTICAL_SIZES = [
  { label: 'Small', rows: 15, cols: 15, description: '15×15' },
  { label: 'Medium', rows: 20, cols: 20, description: '20×20' },
  { label: 'Large', rows: 30, cols: 30, description: '30×30' },
] as const;

export function MapCreateDialog({ onConfirm, onConfirmTactical, onCancel }: MapCreateDialogProps) {
  const [mode, setMode] = useState<MapMode>(onConfirmTactical ? 'tactical' : 'overland');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Overland state
  const [scale, setScale] = useState<MapScale>(12);
  const [startTerrainId, setStartTerrainId] = useState<TerrainId>(presetTerrains[0].id);

  // Tactical state
  const [tacticalSize, setTacticalSize] = useState<number>(1); // index into TACTICAL_SIZES
  const [tacticalTerrainId, setTacticalTerrainId] = useState<string>('tactical-open');

  const canConfirm = name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;

    if (mode === 'tactical' && onConfirmTactical) {
      const size = TACTICAL_SIZES[tacticalSize];
      onConfirmTactical({
        name: name.trim(),
        description: description.trim() || undefined,
        rows: size.rows,
        cols: size.cols,
        startTerrainId: tacticalTerrainId,
      });
    } else {
      onConfirm({
        name: name.trim(),
        description: description.trim() || undefined,
        scaleMilesPerTile: scale,
        startTerrainId,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-gray-800 border border-gray-600 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Create New Map</h2>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {/* Mode toggle — only show if tactical is available */}
          {onConfirmTactical && (
            <div className="flex rounded-lg overflow-hidden border border-gray-600">
              <button
                type="button"
                className={[
                  'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                  mode === 'overland'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700/50 text-gray-400 hover:text-gray-200',
                ].join(' ')}
                onClick={() => setMode('overland')}
              >
                Overland
              </button>
              <button
                type="button"
                className={[
                  'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                  mode === 'tactical'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700/50 text-gray-400 hover:text-gray-200',
                ].join(' ')}
                onClick={() => setMode('tactical')}
              >
                Tactical (1 yd/tile)
              </button>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Map Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === 'tactical' ? 'e.g., Dungeon Room 1' : 'e.g., Thornwood Region'}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {mode === 'overland' ? (
            <>
              {/* Scale */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Scale
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {MAP_SCALES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={[
                        'px-3 py-2 rounded text-xs font-medium border transition-colors',
                        scale === s.value
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-600/50',
                      ].join(' ')}
                      onClick={() => setScale(s.value)}
                    >
                      <div>{s.value} mi/tile</div>
                      <div className="text-gray-400 mt-0.5">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Starting Terrain */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Starting Terrain
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {presetTerrains.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={[
                        'flex items-center gap-2 px-2 py-1.5 rounded text-xs border transition-colors',
                        startTerrainId === t.id
                          ? 'bg-gray-600 border-white/50 text-white'
                          : 'bg-gray-700/30 border-gray-600 text-gray-300 hover:bg-gray-600/30',
                      ].join(' ')}
                      onClick={() => setStartTerrainId(t.id)}
                    >
                      <div
                        className="w-3 h-3 rounded-sm border border-white/20"
                        style={{ backgroundColor: t.color }}
                      />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Grid Size */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grid Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TACTICAL_SIZES.map((s, i) => (
                    <button
                      key={s.label}
                      type="button"
                      className={[
                        'px-3 py-2 rounded text-xs font-medium border transition-colors',
                        tacticalSize === i
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-600/50',
                      ].join(' ')}
                      onClick={() => setTacticalSize(i)}
                    >
                      <div>{s.label}</div>
                      <div className="text-gray-400 mt-0.5">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Starting Terrain (Tactical) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Terrain
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {tacticalTerrains.slice(0, 6).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={[
                        'flex items-center gap-2 px-2 py-1.5 rounded text-xs border transition-colors',
                        tacticalTerrainId === t.id
                          ? 'bg-gray-600 border-white/50 text-white'
                          : 'bg-gray-700/30 border-gray-600 text-gray-300 hover:bg-gray-600/30',
                      ].join(' ')}
                      onClick={() => setTacticalTerrainId(t.id)}
                    >
                      <div
                        className="w-3 h-3 rounded-sm border border-white/20"
                        style={{ backgroundColor: t.color }}
                      />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className={[
                'px-4 py-2 text-sm font-medium rounded transition-colors',
                canConfirm
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed',
              ].join(' ')}
            >
              Create Map
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
