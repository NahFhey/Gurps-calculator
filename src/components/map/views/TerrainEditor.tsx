/**
 * TerrainEditor — modal for creating/editing a custom terrain type.
 * Allows GM to set name, color, per-mode travel modifiers, and weather/location terrain mapping.
 */

import React, { useState } from 'react';
import type { TerrainModel, TravelMode } from '../../../types/map';
import { X } from 'lucide-react';
import { DEFAULT_TERRAIN_ELEVATION, MAX_ELEVATION } from '../../../constants/map';

/** Preset location terrain types for weather system integration */
const LOCATION_TERRAIN_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '(None)' },
  { value: 'forest', label: 'Forest' },
  { value: 'plains', label: 'Plains' },
  { value: 'mountains', label: 'Mountains' },
  { value: 'desert', label: 'Desert' },
  { value: 'swamp', label: 'Swamp' },
  { value: 'coastal', label: 'Coastal' },
  { value: 'urban', label: 'Urban' },
  { value: 'underground', label: 'Underground' },
  { value: 'river', label: 'River' },
];

/** Preset color options for quick selection */
const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
  '#f43f5e', '#78716c', '#a3a23a', '#166534', '#92400e',
  '#6b7280', '#d4a574', '#7e22ce', '#0ea5e9', '#fbbf24',
];

const TRAVEL_MODES: { id: TravelMode; label: string }[] = [
  { id: 'foot', label: 'Foot' },
  { id: 'boat', label: 'Boat' },
  { id: 'airship', label: 'Airship' },
];

interface TerrainEditorProps {
  /** If provided, editing an existing terrain. Otherwise creating a new one. */
  existing?: TerrainModel;
  onConfirm: (terrain: TerrainModel) => void;
  onCancel: () => void;
}

export function TerrainEditor({ existing, onConfirm, onCancel }: TerrainEditorProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? '#22c55e');
  const [locationTerrain, setLocationTerrain] = useState(existing?.locationTerrain ?? '');
  const [elevation, setElevation] = useState(existing?.elevation ?? DEFAULT_TERRAIN_ELEVATION);

  const [footPassable, setFootPassable] = useState(existing?.perMode.foot.passable ?? true);
  const [footSpeed, setFootSpeed] = useState(existing?.perMode.foot.speedModifier ?? 1.0);
  const [boatPassable, setBoatPassable] = useState(existing?.perMode.boat.passable ?? false);
  const [boatSpeed, setBoatSpeed] = useState(existing?.perMode.boat.speedModifier ?? 1.0);
  const [airshipPassable, setAirshipPassable] = useState(existing?.perMode.airship.passable ?? true);
  const [airshipSpeed, setAirshipSpeed] = useState(existing?.perMode.airship.speedModifier ?? 1.0);

  const canConfirm = name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;

    const id = existing?.id ?? `terrain-custom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    const terrain: TerrainModel = {
      id,
      name: name.trim(),
      color,
      elevation: Math.max(0, Math.min(MAX_ELEVATION, Math.round(elevation))),
      perMode: {
        foot: { passable: footPassable, speedModifier: footSpeed },
        boat: { passable: boatPassable, speedModifier: boatSpeed },
        airship: { passable: airshipPassable, speedModifier: airshipSpeed },
      },
      ...(locationTerrain ? { locationTerrain } : {}),
    };

    onConfirm(terrain);
  };

  const modeStates = [
    { mode: TRAVEL_MODES[0], passable: footPassable, setPassable: setFootPassable, speed: footSpeed, setSpeed: setFootSpeed },
    { mode: TRAVEL_MODES[1], passable: boatPassable, setPassable: setBoatPassable, speed: boatSpeed, setSpeed: setBoatSpeed },
    { mode: TRAVEL_MODES[2], passable: airshipPassable, setPassable: setAirshipPassable, speed: airshipSpeed, setSpeed: setAirshipSpeed },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg bg-surface-1 border border-edge-strong rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h2 className="text-lg font-semibold text-fg-bright">
            {existing ? 'Edit Terrain' : 'Add Custom Terrain'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-surface-2 transition-colors"
          >
            <X className="w-4 h-4 text-fg-muted" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1">
              Terrain Name <span className="text-danger-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tundra, Lava Fields"
              className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-sm text-fg-primary placeholder-fg-faint focus:outline-none focus:ring-2 focus:ring-accent-500"
              autoFocus
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">
              Tile Color
            </label>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded border border-white/20 flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 bg-transparent border-0 cursor-pointer"
              />
              <div className="flex flex-wrap gap-1">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={[
                      'w-5 h-5 rounded-sm border transition-all',
                      color === c ? 'border-white ring-1 ring-white/50 scale-110' : 'border-white/10 hover:border-white/30',
                    ].join(' ')}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Elevation */}
          <div>
            <label htmlFor="terrain-elevation" className="block text-sm font-medium text-fg-secondary mb-1">
              Elevation
            </label>
            <input
              id="terrain-elevation"
              type="number"
              value={elevation}
              min={0}
              max={MAX_ELEVATION}
              step={1}
              onChange={(event) => setElevation(event.target.valueAsNumber || 0)}
              className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* Travel Mode Modifiers */}
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-2">
              Travel Mode Properties
            </label>
            <div className="space-y-2">
              {modeStates.map(({ mode, passable, setPassable, speed, setSpeed }) => (
                <div
                  key={mode.id}
                  className="flex items-center gap-3 px-3 py-2 bg-surface-0/50 rounded border border-edge/50"
                >
                  <span className="text-xs text-fg-secondary w-14 flex-shrink-0">{mode.label}</span>

                  <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={passable}
                      onChange={(e) => setPassable(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-surface-2 border-edge-strong text-accent-500 focus:ring-accent-500 focus:ring-offset-0"
                    />
                    <span className="text-[11px] text-fg-muted">Passable</span>
                  </label>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] text-fg-faint">Speed</span>
                    <input
                      type="number"
                      value={speed}
                      onChange={(e) => setSpeed(Math.max(0.1, Math.min(5.0, parseFloat(e.target.value) || 0.1)))}
                      step={0.1}
                      min={0.1}
                      max={5.0}
                      disabled={!passable}
                      className="w-16 px-2 py-1 bg-surface-1 border border-edge-strong rounded text-xs text-fg-primary text-center focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:opacity-30"
                    />
                    <span className="text-[11px] text-fg-faint">x</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-fg-faint mt-1">
              Speed modifier: 1.0 = normal, &gt;1 = faster, &lt;1 = slower. Impassable terrain blocks that travel mode.
            </p>
          </div>

          {/* Location / Weather Terrain Mapping */}
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1">
              Weather / Location Terrain Type
            </label>
            <select
              value={locationTerrain}
              onChange={(e) => setLocationTerrain(e.target.value)}
              className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              {LOCATION_TERRAIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-fg-faint mt-1">
              Maps this terrain to the weather system for activity modifiers (gathering, hunting, foraging, travel).
              Choose the closest match — e.g., "Tundra" might map to "Mountains" or leave as (None).
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-fg-secondary hover:text-fg-bright transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className={[
                'px-4 py-2 text-sm font-medium rounded transition-colors',
                canConfirm
                  ? 'bg-accent-600 hover:bg-accent-500 text-white'
                  : 'bg-surface-2 text-fg-faint cursor-not-allowed',
              ].join(' ')}
            >
              {existing ? 'Save Changes' : 'Add Terrain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
