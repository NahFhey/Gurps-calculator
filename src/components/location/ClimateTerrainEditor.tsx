/**
 * ClimateEditor & TerrainEditor - GM tools for managing custom climate and terrain types
 *
 * Split into separate components so each can be viewed on its own tab
 * without requiring full-screen mode.
 *
 * Displays preset types (read-only) alongside user-defined custom types.
 * Custom types can be added and removed by the GM.
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CLIMATE_LABELS, TERRAIN_LABELS } from '../../types/location';
import type { Location } from '../../types/location';

// ============================================================================
// HELPERS
// ============================================================================

/** Convert a display label to a safe key (lowercase, no spaces, alphanumeric + underscore) */
function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// ============================================================================
// CLIMATE EDITOR
// ============================================================================

interface ClimateEditorProps {
  customClimates: Array<{ key: string; label: string }>;
  locations: Location[];
  onAddClimate: (key: string, label: string) => void;
  onRemoveClimate: (key: string) => void;
}

export function ClimateEditor({
  customClimates,
  locations,
  onAddClimate,
  onRemoveClimate,
}: ClimateEditorProps) {
  const [newClimateLabel, setNewClimateLabel] = useState('');

  const isClimateInUse = (key: string) =>
    locations.some((loc) => loc.climate === key);

  const allClimateKeys = new Set([
    ...Object.keys(CLIMATE_LABELS),
    ...customClimates.map((c) => c.key),
  ]);

  const handleAddClimate = () => {
    const label = newClimateLabel.trim();
    if (!label) return;
    const key = labelToKey(label);
    if (!key || allClimateKeys.has(key)) return;
    onAddClimate(key, label);
    setNewClimateLabel('');
  };

  const climateKeyFromLabel = labelToKey(newClimateLabel);
  const climateKeyConflict = allClimateKeys.has(climateKeyFromLabel) && climateKeyFromLabel !== '';

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-fg-bright">Climate Types</h3>

      {/* Preset climates */}
      <div className="space-y-1">
        <p className="text-xs text-fg-faint mb-1">Presets (built-in)</p>
        {Object.entries(CLIMATE_LABELS).map(([key, label]) => (
          <div
            key={key}
            className="flex items-center justify-between px-3 py-1.5 bg-surface-2/50 rounded text-sm"
          >
            <span className="text-fg-secondary">{label}</span>
            <span className="text-xs text-fg-faint font-mono">{key}</span>
          </div>
        ))}
      </div>

      {/* Custom climates */}
      {customClimates.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-fg-faint mb-1">Custom</p>
          {customClimates.map((climate) => {
            const inUse = isClimateInUse(climate.key);
            return (
              <div
                key={climate.key}
                className="flex items-center justify-between px-3 py-1.5 bg-surface-2/50 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-fg-primary">{climate.label}</span>
                  <span className="text-xs text-fg-faint font-mono">{climate.key}</span>
                  {inUse && (
                    <span className="text-xs text-accent-400">(in use)</span>
                  )}
                </div>
                <button
                  onClick={() => onRemoveClimate(climate.key)}
                  disabled={inUse}
                  className={`p-1 rounded ${
                    inUse
                      ? 'text-fg-disabled cursor-not-allowed'
                      : 'text-danger-400 hover:bg-danger-600/20'
                  }`}
                  title={inUse ? 'Cannot delete: used by a location' : 'Delete custom climate'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new climate */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newClimateLabel}
          onChange={(e) => setNewClimateLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddClimate()}
          placeholder="New climate name..."
          className="flex-1 px-3 py-1.5 bg-surface-2 border border-edge-strong rounded text-sm text-fg-bright placeholder-fg-faint"
        />
        <button
          onClick={handleAddClimate}
          disabled={!newClimateLabel.trim() || climateKeyConflict}
          className="px-3 py-1.5 text-sm bg-accent-600 hover:bg-accent-700 disabled:bg-surface-3 disabled:cursor-not-allowed text-white rounded"
        >
          Add
        </button>
      </div>
      {climateKeyConflict && (
        <p className="text-xs text-danger-400 mt-1">
          Key &quot;{climateKeyFromLabel}&quot; already exists
        </p>
      )}
    </div>
  );
}

// ============================================================================
// TERRAIN EDITOR
// ============================================================================

interface TerrainEditorProps {
  customTerrains: Array<{ key: string; label: string }>;
  locations: Location[];
  onAddTerrain: (key: string, label: string) => void;
  onRemoveTerrain: (key: string) => void;
}

export function TerrainEditor({
  customTerrains,
  locations,
  onAddTerrain,
  onRemoveTerrain,
}: TerrainEditorProps) {
  const [newTerrainLabel, setNewTerrainLabel] = useState('');

  const isTerrainInUse = (key: string) =>
    locations.some((loc) => loc.terrain === key);

  const allTerrainKeys = new Set([
    ...Object.keys(TERRAIN_LABELS),
    ...customTerrains.map((t) => t.key),
  ]);

  const handleAddTerrain = () => {
    const label = newTerrainLabel.trim();
    if (!label) return;
    const key = labelToKey(label);
    if (!key || allTerrainKeys.has(key)) return;
    onAddTerrain(key, label);
    setNewTerrainLabel('');
  };

  const terrainKeyFromLabel = labelToKey(newTerrainLabel);
  const terrainKeyConflict = allTerrainKeys.has(terrainKeyFromLabel) && terrainKeyFromLabel !== '';

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-fg-bright">Terrain Types</h3>

      {/* Preset terrains */}
      <div className="space-y-1">
        <p className="text-xs text-fg-faint mb-1">Presets (built-in)</p>
        {Object.entries(TERRAIN_LABELS).map(([key, label]) => (
          <div
            key={key}
            className="flex items-center justify-between px-3 py-1.5 bg-surface-2/50 rounded text-sm"
          >
            <span className="text-fg-secondary">{label}</span>
            <span className="text-xs text-fg-faint font-mono">{key}</span>
          </div>
        ))}
      </div>

      {/* Custom terrains */}
      {customTerrains.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-fg-faint mb-1">Custom</p>
          {customTerrains.map((terrain) => {
            const inUse = isTerrainInUse(terrain.key);
            return (
              <div
                key={terrain.key}
                className="flex items-center justify-between px-3 py-1.5 bg-surface-2/50 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-fg-primary">{terrain.label}</span>
                  <span className="text-xs text-fg-faint font-mono">{terrain.key}</span>
                  {inUse && (
                    <span className="text-xs text-accent-400">(in use)</span>
                  )}
                </div>
                <button
                  onClick={() => onRemoveTerrain(terrain.key)}
                  disabled={inUse}
                  className={`p-1 rounded ${
                    inUse
                      ? 'text-fg-disabled cursor-not-allowed'
                      : 'text-danger-400 hover:bg-danger-600/20'
                  }`}
                  title={inUse ? 'Cannot delete: used by a location' : 'Delete custom terrain'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new terrain */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newTerrainLabel}
          onChange={(e) => setNewTerrainLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTerrain()}
          placeholder="New terrain name..."
          className="flex-1 px-3 py-1.5 bg-surface-2 border border-edge-strong rounded text-sm text-fg-bright placeholder-fg-faint"
        />
        <button
          onClick={handleAddTerrain}
          disabled={!newTerrainLabel.trim() || terrainKeyConflict}
          className="px-3 py-1.5 text-sm bg-accent-600 hover:bg-accent-700 disabled:bg-surface-3 disabled:cursor-not-allowed text-white rounded"
        >
          Add
        </button>
      </div>
      {terrainKeyConflict && (
        <p className="text-xs text-danger-400 mt-1">
          Key &quot;{terrainKeyFromLabel}&quot; already exists
        </p>
      )}
    </div>
  );
}

// ============================================================================
// LEGACY COMBINED EXPORT (kept for backward compatibility)
// ============================================================================

interface ClimateTerrainEditorProps {
  customClimates: Array<{ key: string; label: string }>;
  customTerrains: Array<{ key: string; label: string }>;
  locations: Location[];
  onAddClimate: (key: string, label: string) => void;
  onRemoveClimate: (key: string) => void;
  onAddTerrain: (key: string, label: string) => void;
  onRemoveTerrain: (key: string) => void;
  onBack: () => void;
}

export function ClimateTerrainEditor({
  customClimates,
  customTerrains,
  locations,
  onAddClimate,
  onRemoveClimate,
  onAddTerrain,
  onRemoveTerrain,
  onBack,
}: ClimateTerrainEditorProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-fg-bright">Climates & Terrain</h3>
        <button
          onClick={onBack}
          className="text-fg-muted hover:text-fg-primary text-sm"
        >
          Back
        </button>
      </div>
      <ClimateEditor
        customClimates={customClimates}
        locations={locations}
        onAddClimate={onAddClimate}
        onRemoveClimate={onRemoveClimate}
      />
      <TerrainEditor
        customTerrains={customTerrains}
        locations={locations}
        onAddTerrain={onAddTerrain}
        onRemoveTerrain={onRemoveTerrain}
      />
    </div>
  );
}
