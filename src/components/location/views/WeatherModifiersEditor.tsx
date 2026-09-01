import { useState } from 'react';
import { WEATHER_LABELS } from '../../../types/location';
import type { WeatherEffects, WeatherType } from '../../../types/location';
import { BASE_WEATHER_EFFECTS } from '../../../utils/weatherSystem';

const WEATHER_EFFECT_KEYS: { key: keyof WeatherEffects; label: string }[] = [
  { key: 'gathering', label: 'Gather' },
  { key: 'hunting', label: 'Hunt' },
  { key: 'travel', label: 'Travel' },
  { key: 'crafting', label: 'Craft' },
  { key: 'alchemy', label: 'Alch' },
  { key: 'cooking', label: 'Cook' },
  { key: 'combat', label: 'Combat' },
  { key: 'visibility', label: 'Vision' },
  { key: 'hearing', label: 'Hear' },
  { key: 'fireRisk', label: 'Fire' },
  { key: 'trackingMod', label: 'Track' },
];

const ALL_WEATHER_TYPES: WeatherType[] = [
  'clear', 'partlyCloudy', 'overcast',
  'lightRain', 'rain', 'heavyRain', 'thunderstorm',
  'fog', 'mist',
  'snow', 'blizzard', 'hail',
  'sandstorm', 'wind', 'heatwave', 'coldSnap',
];

export interface WeatherModifiersEditorProps {
  overrides: Record<string, Partial<WeatherEffects>>;
  onSave: (overrides: Record<string, Partial<WeatherEffects>>) => void;
}

export function WeatherModifiersEditor({
  overrides,
  onSave,
}: WeatherModifiersEditorProps) {
  const [local, setLocal] = useState<Record<string, Partial<WeatherEffects>>>({ ...overrides });

  const getDefaultValue = (weatherType: string, key: keyof WeatherEffects): number => {
    const defaults = BASE_WEATHER_EFFECTS[weatherType as WeatherType];
    return (defaults?.[key] as number) ?? 0;
  };

  const getValue = (weatherType: string, key: keyof WeatherEffects): number => {
    if (local[weatherType] && local[weatherType][key] !== undefined) {
      return local[weatherType][key] as number;
    }
    return getDefaultValue(weatherType, key);
  };

  const isOverridden = (weatherType: string, key: keyof WeatherEffects): boolean =>
    local[weatherType]?.[key] !== undefined;

  const handleChange = (weatherType: string, key: keyof WeatherEffects, value: number) => {
    const defaultVal = getDefaultValue(weatherType, key);
    const next = { ...local };
    if (value === defaultVal) {
      if (next[weatherType]) {
        const { [key]: _, ...rest } = next[weatherType];
        if (Object.keys(rest).length === 0) delete next[weatherType];
        else next[weatherType] = rest;
      }
    } else {
      next[weatherType] = { ...next[weatherType], [key]: value };
    }
    setLocal(next);
    onSave(next);
  };

  const handleReset = (weatherType: string) => {
    const next = { ...local };
    delete next[weatherType];
    setLocal(next);
    onSave(next);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-fg-bright">Weather Modifiers</h3>
      <p className="text-xs text-fg-muted">
        Base effect modifiers per weather type (before intensity scaling).
        Edited values are highlighted. These apply when weather is rolled.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-fg-muted text-xs">
              <th className="text-left py-1 px-2 sticky left-0 bg-surface-1 z-10">Weather</th>
              {WEATHER_EFFECT_KEYS.map(({ key, label }) => (
                <th key={key} className="text-center py-1 px-1 whitespace-nowrap">{label}</th>
              ))}
              <th className="text-center py-1 px-1"></th>
            </tr>
          </thead>
          <tbody>
            {ALL_WEATHER_TYPES.map((weatherType) => (
              <tr key={weatherType} className="border-t border-edge">
                <td className="py-1 px-2 text-fg-primary sticky left-0 bg-surface-1 z-10 whitespace-nowrap">
                  {WEATHER_LABELS[weatherType]}
                </td>
                {WEATHER_EFFECT_KEYS.map(({ key }) => (
                  <td key={key} className="py-1 px-0.5 text-center">
                    <input
                      type="number"
                      value={getValue(weatherType, key)}
                      onChange={(e) => handleChange(weatherType, key, parseInt(e.target.value) || 0)}
                      className={`w-12 px-0.5 py-0.5 text-center text-xs rounded border ${
                        isOverridden(weatherType, key)
                          ? 'bg-warning-900/30 border-warning-600 text-warning-200'
                          : 'bg-surface-2 border-edge-strong text-fg-bright'
                      }`}
                    />
                  </td>
                ))}
                <td className="py-1 px-1 text-center">
                  {local[weatherType] && (
                    <button
                      onClick={() => handleReset(weatherType)}
                      className="text-xs text-fg-faint hover:text-fg-secondary"
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
