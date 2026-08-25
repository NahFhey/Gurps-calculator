import { useState } from 'react';
import type { LocationModifiers } from '../../../types/location';
import { DEFAULT_TERRAIN_MODIFIERS } from '../../../utils/weatherSystem';

const MODIFIER_KEYS: (keyof LocationModifiers)[] = ['gathering', 'hunting', 'foraging', 'travel'];

export interface TerrainModifiersEditorProps {
  overrides: Record<string, Partial<LocationModifiers>>;
  allTerrainLabels: Record<string, string>;
  onSave: (overrides: Record<string, Partial<LocationModifiers>>) => void;
}

export function TerrainModifiersEditor({
  overrides,
  allTerrainLabels,
  onSave,
}: TerrainModifiersEditorProps) {
  const [local, setLocal] = useState<Record<string, Partial<LocationModifiers>>>({ ...overrides });
  const terrainKeys = Object.keys(allTerrainLabels);

  const getValue = (terrain: string, key: keyof LocationModifiers): number => {
    if (local[terrain] && local[terrain][key] !== undefined) {
      return local[terrain][key]!;
    }
    const defaults = DEFAULT_TERRAIN_MODIFIERS[terrain];
    return defaults?.[key] ?? 0;
  };

  const isOverridden = (terrain: string, key: keyof LocationModifiers): boolean =>
    local[terrain]?.[key] !== undefined;

  const handleChange = (terrain: string, key: keyof LocationModifiers, value: number) => {
    const defaults = DEFAULT_TERRAIN_MODIFIERS[terrain];
    const defaultVal = defaults?.[key] ?? 0;
    const next = { ...local };
    if (value === defaultVal) {
      if (next[terrain]) {
        const { [key]: _, ...rest } = next[terrain];
        if (Object.keys(rest).length === 0) delete next[terrain];
        else next[terrain] = rest;
      }
    } else {
      next[terrain] = { ...next[terrain], [key]: value };
    }
    setLocal(next);
    onSave(next);
  };

  const handleReset = (terrain: string) => {
    const next = { ...local };
    delete next[terrain];
    setLocal(next);
    onSave(next);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-100">Terrain Modifiers</h3>
      <p className="text-xs text-gray-400">
        Default activity modifiers per terrain type. These auto-apply when the party enters a terrain.
        Edited values are highlighted.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs">
              <th className="text-left py-1 px-2">Terrain</th>
              {MODIFIER_KEYS.map((key) => (
                <th key={key} className="text-center py-1 px-2 capitalize">{key}</th>
              ))}
              <th className="text-center py-1 px-1"></th>
            </tr>
          </thead>
          <tbody>
            {terrainKeys.map((terrain) => (
              <tr key={terrain} className="border-t border-gray-700">
                <td className="py-1 px-2 text-gray-200">{allTerrainLabels[terrain]}</td>
                {MODIFIER_KEYS.map((key) => (
                  <td key={key} className="py-1 px-1 text-center">
                    <input
                      type="number"
                      value={getValue(terrain, key)}
                      onChange={(e) => handleChange(terrain, key, parseInt(e.target.value) || 0)}
                      className={`w-14 px-1 py-0.5 text-center text-sm rounded border ${
                        isOverridden(terrain, key)
                          ? 'bg-amber-900/30 border-amber-600 text-amber-200'
                          : 'bg-gray-700 border-gray-600 text-gray-100'
                      }`}
                    />
                  </td>
                ))}
                <td className="py-1 px-1 text-center">
                  {local[terrain] && (
                    <button
                      onClick={() => handleReset(terrain)}
                      className="text-xs text-gray-500 hover:text-gray-300"
                      title="Reset to defaults"
                    >
                      Reset
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
