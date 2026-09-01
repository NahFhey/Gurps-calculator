/**
 * MapCreateDialog — modal for creating a new map.
 */

import React, { useId, useState } from 'react';
import type { MapScale, TerrainId } from '../../../types/map';
import type { ClimateType } from '../../../types/location';
import { CLIMATE_LABELS } from '../../../types/location';
import { MAP_SCALES, createPresetTerrains } from '../../../constants/map';
import { Modal } from '../../ui/Modal';

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

  const nameInputId = useId();
  const descriptionInputId = useId();
  const scaleGroupId = useId();
  const terrainGroupId = useId();

  const canConfirm = name.trim().length > 0;

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
    <Modal isOpen onClose={onCancel} title="Create New Map" size="md" closeOnBackdrop={false} bodyClassName="p-0">
        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor={nameInputId} className="block text-sm font-medium text-fg-secondary mb-1">
              Map Name <span className="text-danger-400" aria-hidden="true">*</span>
            </label>
            <input
              id={nameInputId}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Thornwood Region"
              required
              aria-required="true"
              className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-sm text-fg-primary placeholder-fg-faint focus:outline-none focus:ring-2 focus:ring-accent-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor={descriptionInputId} className="block text-sm font-medium text-fg-secondary mb-1">
              Description
            </label>
            <input
              id={descriptionInputId}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-sm text-fg-primary placeholder-fg-faint focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          <div>
            <label htmlFor="map-climate" className="block text-sm font-medium text-fg-secondary mb-1">
              Climate
            </label>
            <select
              id="map-climate"
              value={climate}
              onChange={(event) => setClimate(event.target.value as ClimateType)}
              className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-sm text-fg-primary"
            >
              {Object.entries(climateLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Scale */}
          <div role="radiogroup" aria-labelledby={scaleGroupId}>
            <label id={scaleGroupId} className="block text-sm font-medium text-fg-secondary mb-2">
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
                      ? 'bg-accent-600 border-accent-500 text-white'
                      : 'bg-surface-2/50 border-edge-strong text-fg-secondary hover:bg-surface-3/50',
                  ].join(' ')}
                  onClick={() => setScale(s.value)}
                >
                  <div>{s.value} mi/tile</div>
                  <div className="text-fg-muted mt-0.5">{s.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Starting Terrain */}
          <div role="radiogroup" aria-labelledby={terrainGroupId}>
            <label id={terrainGroupId} className="block text-sm font-medium text-fg-secondary mb-2">
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
                      ? 'bg-surface-3 border-white/50 text-white'
                      : 'bg-surface-2/30 border-edge-strong text-fg-secondary hover:bg-surface-3/30',
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
              className="px-4 py-2 text-sm text-fg-secondary hover:text-fg-bright transition-colors"
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
                  ? 'bg-accent-600 hover:bg-accent-500 text-white'
                  : 'bg-surface-2 text-fg-faint cursor-not-allowed',
              ].join(' ')}
            >
              Create Map
            </button>
          </div>
        </form>
    </Modal>
  );
}
