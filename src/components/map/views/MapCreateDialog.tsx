/**
 * MapCreateDialog — modal for creating a new map.
 */

import React, { useState } from 'react';
import type { MapScale, TerrainId } from '../../../types/map';
import { MAP_SCALES, createPresetTerrains } from '../../../constants/map';
import { X } from 'lucide-react';

interface MapCreateDialogProps {
  onConfirm: (params: {
    name: string;
    description?: string;
    scaleMilesPerTile: MapScale;
    startTerrainId: TerrainId;
  }) => void;
  onCancel: () => void;
}

const presetTerrains = createPresetTerrains();

export function MapCreateDialog({ onConfirm, onCancel }: MapCreateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scale, setScale] = useState<MapScale>(12);
  const [startTerrainId, setStartTerrainId] = useState<TerrainId>(presetTerrains[0].id);

  const canConfirm = name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;
    onConfirm({
      name: name.trim(),
      description: description.trim() || undefined,
      scaleMilesPerTile: scale,
      startTerrainId,
    });
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
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Map Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Thornwood Region"
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
