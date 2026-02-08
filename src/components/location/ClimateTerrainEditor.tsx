/**
 * ClimateTerrainEditor - GM tool for managing custom climate and terrain types
 *
 * Displays preset types (read-only) alongside user-defined custom types.
 * Custom types can be added and removed by the GM.
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CLIMATE_LABELS, TERRAIN_LABELS } from '../../types/location';
import type { Location } from '../../types/location';

// ============================================================================
// TYPES
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
// COMPONENT
// ============================================================================

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
  const [newClimateLabel, setNewClimateLabel] = useState('');
  const [newTerrainLabel, setNewTerrainLabel] = useState('');

  // Check if a climate/terrain key is used by any location
  const isClimateInUse = (key: string) =>
    locations.some((loc) => loc.climate === key);
  const isTerrainInUse = (key: string) =>
    locations.some((loc) => loc.terrain === key);

  // All existing keys (preset + custom) for duplicate detection
  const allClimateKeys = new Set([
    ...Object.keys(CLIMATE_LABELS),
    ...customClimates.map((c) => c.key),
  ]);
  const allTerrainKeys = new Set([
    ...Object.keys(TERRAIN_LABELS),
    ...customTerrains.map((t) => t.key),
  ]);

  const handleAddClimate = () => {
    const label = newClimateLabel.trim();
    if (!label) return;
    const key = labelToKey(label);
    if (!key || allClimateKeys.has(key)) return;
    onAddClimate(key, label);
    setNewClimateLabel('');
  };

  const handleAddTerrain = () => {
    const label = newTerrainLabel.trim();
    if (!label) return;
    const key = labelToKey(label);
    if (!key || allTerrainKeys.has(key)) return;
    onAddTerrain(key, label);
    setNewTerrainLabel('');
  };

  const climateKeyFromLabel = labelToKey(newClimateLabel);
  const climateKeyConflict = allClimateKeys.has(climateKeyFromLabel) && climateKeyFromLabel !== '';
  const terrainKeyFromLabel = labelToKey(newTerrainLabel);
  const terrainKeyConflict = allTerrainKeys.has(terrainKeyFromLabel) && terrainKeyFromLabel !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Climates & Terrain</h3>
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-200 text-sm"
        >
          Back
        </button>
      </div>

      {/* ======== Climate Section ======== */}
      <div>
        <h4 className="text-sm font-semibold text-gray-200 mb-2 border-b border-gray-600 pb-1">
          Climate Types
        </h4>

        {/* Preset climates */}
        <div className="space-y-1 mb-3">
          <p className="text-xs text-gray-500 mb-1">Presets (built-in)</p>
          {Object.entries(CLIMATE_LABELS).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between px-3 py-1.5 bg-gray-700/50 rounded text-sm"
            >
              <span className="text-gray-300">{label}</span>
              <span className="text-xs text-gray-500 font-mono">{key}</span>
            </div>
          ))}
        </div>

        {/* Custom climates */}
        {customClimates.length > 0 && (
          <div className="space-y-1 mb-3">
            <p className="text-xs text-gray-500 mb-1">Custom</p>
            {customClimates.map((climate) => {
              const inUse = isClimateInUse(climate.key);
              return (
                <div
                  key={climate.key}
                  className="flex items-center justify-between px-3 py-1.5 bg-gray-700/50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-200">{climate.label}</span>
                    <span className="text-xs text-gray-500 font-mono">{climate.key}</span>
                    {inUse && (
                      <span className="text-xs text-blue-400">(in use)</span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveClimate(climate.key)}
                    disabled={inUse}
                    className={`p-1 rounded ${
                      inUse
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-red-400 hover:bg-red-600/20'
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
            className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500"
          />
          <button
            onClick={handleAddClimate}
            disabled={!newClimateLabel.trim() || climateKeyConflict}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
          >
            Add
          </button>
        </div>
        {climateKeyConflict && (
          <p className="text-xs text-red-400 mt-1">
            Key "{climateKeyFromLabel}" already exists
          </p>
        )}
      </div>

      {/* ======== Terrain Section ======== */}
      <div>
        <h4 className="text-sm font-semibold text-gray-200 mb-2 border-b border-gray-600 pb-1">
          Terrain Types
        </h4>

        {/* Preset terrains */}
        <div className="space-y-1 mb-3">
          <p className="text-xs text-gray-500 mb-1">Presets (built-in)</p>
          {Object.entries(TERRAIN_LABELS).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between px-3 py-1.5 bg-gray-700/50 rounded text-sm"
            >
              <span className="text-gray-300">{label}</span>
              <span className="text-xs text-gray-500 font-mono">{key}</span>
            </div>
          ))}
        </div>

        {/* Custom terrains */}
        {customTerrains.length > 0 && (
          <div className="space-y-1 mb-3">
            <p className="text-xs text-gray-500 mb-1">Custom</p>
            {customTerrains.map((terrain) => {
              const inUse = isTerrainInUse(terrain.key);
              return (
                <div
                  key={terrain.key}
                  className="flex items-center justify-between px-3 py-1.5 bg-gray-700/50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-200">{terrain.label}</span>
                    <span className="text-xs text-gray-500 font-mono">{terrain.key}</span>
                    {inUse && (
                      <span className="text-xs text-blue-400">(in use)</span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveTerrain(terrain.key)}
                    disabled={inUse}
                    className={`p-1 rounded ${
                      inUse
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-red-400 hover:bg-red-600/20'
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
            className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500"
          />
          <button
            onClick={handleAddTerrain}
            disabled={!newTerrainLabel.trim() || terrainKeyConflict}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
          >
            Add
          </button>
        </div>
        {terrainKeyConflict && (
          <p className="text-xs text-red-400 mt-1">
            Key "{terrainKeyFromLabel}" already exists
          </p>
        )}
      </div>
    </div>
  );
}
