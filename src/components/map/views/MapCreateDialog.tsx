/**
 * MapCreateDialog — modal for creating a new map.
 */

import React, { useEffect, useId, useState } from 'react';
import type { MapScale, TerrainId } from '../../../types/map';
import type { ClimateType } from '../../../types/location';
import { CLIMATE_LABELS } from '../../../types/location';
import { MAP_SCALES, createPresetTerrains } from '../../../constants/map';
import { X } from 'lucide-react';

interface MapCreateDialogProps {
  onConfirm: (params: {
    name: string;
    description?: string;
    scaleMilesPerTile: MapScale;
    startTerrainId: TerrainId;
    climate: ClimateType;
  }) => void;
  climateLabels?: Record<string, string>;
  onCancel: () => void;
}

const presetTerrains = createPresetTerrains();

export function MapCreateDialog({ onConfirm, onCancel, climateLabels = CLIMATE_LABELS }: MapCreateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scale, setScale] = useState<MapScale>(12);
  const [startTerrainId, setStartTerrainId] = useState<TerrainId>(presetTerrains[0].id);
  const [climate, setClimate] = useState<ClimateType>('temperate');

  const titleId = useId();
  const nameInputId = useId();
  const descriptionInputId = useId();
  const scaleGroupId = useId();
  const terrainGroupId = useId();

  const canConfirm = name.trim().length > 0;

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;
    onConfirm({
      name: name.trim(),
      description: description.trim() || undefined,
      scaleMilesPerTile: scale,
      startTerrainId,
      climate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md bg-gray-800 border border-gray-600 rounded-lg shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 id={titleId} className="text-lg font-semibold text-gray-100">Create New Map</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1 rounded hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor={nameInputId} className="block text-sm font-medium text-gray-300 mb-1">
              Map Name <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <input
              id={nameInputId}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Thornwood Region"
              required
              aria-required="true"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor={descriptionInputId} className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <input
              id={descriptionInputId}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="map-climate" className="block text-sm font-medium text-gray-300 mb-1">
              Climate
            </label>
            <select
              id="map-climate"
              value={climate}
              onChange={(event) => setClimate(event.target.value as ClimateType)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200"
            >
              {Object.entries(climateLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Scale */}
          <div role="radiogroup" aria-labelledby={scaleGroupId}>
            <label id={scaleGroupId} className="block text-sm font-medium text-gray-300 mb-2">
              Scale
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MAP_SCALES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={scale === s.value}
                  aria-label={`${s.value} miles per tile — ${s.description}`}
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
          <div role="radiogroup" aria-labelledby={terrainGroupId}>
            <label id={terrainGroupId} className="block text-sm font-medium text-gray-300 mb-2">
              Starting Terrain
            </label>
            <div className="grid grid-cols-3 gap-2">
              {presetTerrains.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={startTerrainId === t.id}
                  aria-label={`Starting terrain: ${t.name}`}
                  className={[
                    'flex items-center gap-2 px-2 py-1.5 rounded text-xs border transition-colors',
                    startTerrainId === t.id
                      ? 'bg-gray-600 border-white/50 text-white'
                      : 'bg-gray-700/30 border-gray-600 text-gray-300 hover:bg-gray-600/30',
                  ].join(' ')}
                  onClick={() => setStartTerrainId(t.id)}
                >
                  <div
                    aria-hidden="true"
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
              aria-label="Cancel and close dialog"
              className="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              aria-label="Create Map"
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
