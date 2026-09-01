import { useMemo, useState } from 'react';
import { useCampaignActions, useCampaignSelector } from '../../state/campaignStore';
import type { CampaignState } from '../../state/campaignReducer';
import { getWeatherIcon, getRemainingWeatherSlots, BASE_WEATHER_EFFECTS } from '../../utils/weatherSystem';
import { LocationManager } from '../location/LocationManager';
import type { Weather, WeatherEffects } from '../../types/location';
import { TEMPERATURE_LABELS, CLIMATE_LABELS } from '../../types/location';
import { getActiveAmbientWeather } from '../../utils/ambientWeather';

/**
 * WeatherWidget - Displays current weather conditions and effects
 *
 * Phase 5: Location & Weather System
 *
 * Features:
 * - Displays current location and weather
 * - Shows weather effects on activities
 * - GM can click to manage locations and weather
 * - GM can edit weather effect templates inline
 * - Weather auto-updates when time advances
 */

interface WeatherWidgetProps {
  compact?: boolean;
  showEffects?: boolean;
  showLocation?: boolean;
}

const selectMaps = (state: CampaignState) => state.maps;
const selectEntities = (state: CampaignState) => state.entities;
const selectLocations = (state: CampaignState) => state.locations;
const selectTime = (state: CampaignState) => state.time;
const selectGmModeEnabled = (state: CampaignState) => state.ui.gmModeEnabled;
const selectActiveTravelGroupId = (state: CampaignState) => state.ui.activeTravelGroupId;

export function WeatherWidget({
  compact = false,
  showEffects = true,
  showLocation = true,
}: WeatherWidgetProps) {
  const actions = useCampaignActions();
  const maps = useCampaignSelector(selectMaps);
  const entities = useCampaignSelector(selectEntities);
  const locations = useCampaignSelector(selectLocations);
  const time = useCampaignSelector(selectTime);
  const gmModeEnabled = useCampaignSelector(selectGmModeEnabled);
  const activeTravelGroupId = useCampaignSelector(selectActiveTravelGroupId);
  const [showManager, setShowManager] = useState(false);
  const [editingEffects, setEditingEffects] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const ambient = useMemo(
    () => getActiveAmbientWeather({ maps, entities, ui: { activeTravelGroupId } }),
    [maps, entities, activeTravelGroupId]
  );
  const activeMap = ambient.mapId ? maps.mapsById[ambient.mapId] : null;
  const weather: Weather | null = ambient.weather;
  const activeWeather = activeMap?.currentWeather ?? null;
  const allClimateLabels = useMemo(() => {
    const labels: Record<string, string> = { ...CLIMATE_LABELS };
    for (const custom of locations.customClimates ?? []) labels[custom.key] = custom.label;
    return labels;
  }, [locations.customClimates]);

  // Calculate remaining weather duration
  const remainingSlots = useMemo(() => {
    if (!activeWeather) return null;
    return getRemainingWeatherSlots(activeWeather, time, time.slotsPerDay);
  }, [activeWeather, time]);

  // Format effects summary (compact one-line)
  const effectsSummary = useMemo(() => {
    if (!weather) return 'No weather data';

    const effects: string[] = [];
    if (weather.effects.gathering !== 0) {
      effects.push(`Gather ${weather.effects.gathering > 0 ? '+' : ''}${weather.effects.gathering}`);
    }
    if (weather.effects.hunting !== 0) {
      effects.push(`Hunt ${weather.effects.hunting > 0 ? '+' : ''}${weather.effects.hunting}`);
    }
    if (weather.effects.travel !== 0) {
      effects.push(`Travel ${weather.effects.travel > 0 ? '+' : ''}${weather.effects.travel}`);
    }
    if (weather.effects.crafting !== 0) {
      effects.push(`Craft ${weather.effects.crafting > 0 ? '+' : ''}${weather.effects.crafting}`);
    }
    if (weather.effects.combat !== 0) {
      effects.push(`Combat ${weather.effects.combat > 0 ? '+' : ''}${weather.effects.combat}`);
    }
    if (weather.effects.visibility !== 0) {
      effects.push(`Vision ${weather.effects.visibility > 0 ? '+' : ''}${weather.effects.visibility}`);
    }

    return effects.length > 0 ? effects.join(', ') : 'No modifiers';
  }, [weather]);

  // Format duration for display
  const durationDisplay = useMemo(() => {
    if (remainingSlots === null) return 'Indefinite';
    if (remainingSlots === 0) return 'Changing soon';
    if (remainingSlots === 1) return '1 slot left';
    if (remainingSlots >= time.slotsPerDay) {
      const days = Math.floor(remainingSlots / time.slotsPerDay);
      const slots = remainingSlots % time.slotsPerDay;
      if (slots === 0) return `${days} day${days > 1 ? 's' : ''} left`;
      return `${days}d ${slots}s left`;
    }
    return `${remainingSlots} slots left`;
  }, [remainingSlots, time.slotsPerDay]);

  // Handle roll new weather
  const handleRollWeather = () => {
    if (ambient.mapId) {
      actions.rollNewWeather(ambient.mapId);
    }
  };

  // No map available
  if (!activeMap) {
    return (
      <div
        className="rounded border border-gray-600 bg-gray-700/50 px-4 py-2 cursor-pointer hover:bg-gray-700"
        onClick={() => setShowManager(true)}
        data-testid="weather-widget"
      >
        <div className="text-sm text-gray-400">No map set</div>
        <div className="text-xs text-gray-500">Select or place the active group on a map</div>

        {showManager && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
            <div onClick={(e) => e.stopPropagation()}>
              <LocationManager onClose={() => setShowManager(false)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Compact view
  if (compact) {
    return (
      <>
        <div
          className="flex items-center gap-2 rounded border border-gray-600 bg-gray-700/50 px-3 py-1.5 cursor-pointer hover:bg-gray-700"
          title={`${activeMap.name}: ${weather?.description ?? 'Unknown'}\n${effectsSummary}`}
          onClick={() => setShowManager(true)}
          data-testid="weather-widget-compact"
        >
          <span className="text-lg">{weather ? getWeatherIcon(weather.type) : '🌡️'}</span>
          <span className="text-sm text-gray-200">
            {weather ? TEMPERATURE_LABELS[weather.temperature] : 'Unknown'}
          </span>
        </div>

        {showManager && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowManager(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <LocationManager onClose={() => setShowManager(false)} />
            </div>
          </div>
        )}
      </>
    );
  }

  // Full view
  return (
    <>
      <div
        className="rounded border border-gray-600 bg-gray-700/50 px-4 py-2"
        data-testid="weather-widget"
      >
        {/* Main clickable row — opens location manager */}
        <div
          className="flex items-start gap-3 cursor-pointer hover:bg-gray-700/50 rounded -mx-1 px-1 py-0.5"
          onClick={() => setShowManager(true)}
        >
          {/* Weather Icon */}
          <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-600/50 text-2xl flex-shrink-0">
            {weather ? getWeatherIcon(weather.type) : '🌡️'}
          </div>

          {/* Weather Info */}
          <div className="flex-1 min-w-0">
            {/* Location */}
            {showLocation && (
              <div className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                <span>{activeMap.name}</span>
                <span className="text-gray-500">
                  ({allClimateLabels[activeMap.climate] ?? activeMap.climate})
                </span>
              </div>
            )}

            {/* Weather Description */}
            <div className="text-sm font-medium text-gray-100">
              {weather?.description ?? 'Unknown weather'}
            </div>

            {/* Duration */}
            <div className="text-xs text-gray-500 mt-0.5">
              {durationDisplay}
            </div>

            {/* Effects summary (collapsed) */}
            {showEffects && !expanded && (
              <div className="text-xs text-gray-400 mt-0.5">
                {effectsSummary}
              </div>
            )}
          </div>
        </div>

        {/* GM Controls — outside the clickable area */}
        {gmModeEnabled && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-600/50">
            <button
              onClick={handleRollWeather}
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded"
              title="Roll new weather"
            >
              🎲 Reroll
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className={`px-2 py-1 text-xs rounded ${
                expanded
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
              }`}
              title="Show weather effects details"
            >
              {expanded ? 'Hide Effects' : 'Show Effects'}
            </button>
            {weather && (
              <button
                onClick={() => {
                  if (!expanded) setExpanded(true);
                  setEditingEffects(!editingEffects);
                }}
                className={`px-2 py-1 text-xs rounded ${
                  editingEffects
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                }`}
                title="Edit weather effect values for this weather type"
              >
                {editingEffects ? 'Done Editing' : 'Edit Effects'}
              </button>
            )}
          </div>
        )}

        {/* Expanded effects display */}
        {expanded && weather && (
          <div className="mt-2 pt-2 border-t border-gray-600/50">
            <WeatherEffectsDisplay
              weather={weather}
              editing={editingEffects}
              currentOverrides={locations.weatherEffectOverrides ?? {}}
              onSave={(overrides) => actions.setWeatherEffectOverrides(overrides)}
            />
          </div>
        )}
      </div>

      {/* Location Manager Modal */}
      {showManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowManager(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <LocationManager onClose={() => setShowManager(false)} />
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// WEATHER EFFECTS DISPLAY / EDITOR
// ============================================================================

const EFFECT_KEYS: { key: keyof WeatherEffects; label: string }[] = [
  { key: 'gathering', label: 'Gathering' },
  { key: 'hunting', label: 'Hunting' },
  { key: 'travel', label: 'Travel' },
  { key: 'crafting', label: 'Crafting' },
  { key: 'alchemy', label: 'Alchemy' },
  { key: 'cooking', label: 'Cooking' },
  { key: 'combat', label: 'Combat' },
  { key: 'visibility', label: 'Vision' },
  { key: 'hearing', label: 'Hearing' },
  { key: 'fireRisk', label: 'Fire Risk' },
  { key: 'trackingMod', label: 'Tracking' },
];

/** Base weather effects for reference — sourced from the canonical BASE_WEATHER_EFFECTS */

function WeatherEffectsDisplay({
  weather,
  editing,
  currentOverrides,
  onSave,
}: {
  weather: Weather;
  editing: boolean;
  currentOverrides: Record<string, Partial<WeatherEffects>>;
  onSave: (overrides: Record<string, Partial<WeatherEffects>>) => void;
}) {
  const baseDefaults = BASE_WEATHER_EFFECTS[weather.type] ?? {};
  const typeOverrides = currentOverrides[weather.type] ?? {};

  const getBaseValue = (key: string): number => {
    return (baseDefaults[key as keyof WeatherEffects] as number) ?? 0;
  };

  const getOverrideValue = (key: string): number | undefined => {
    return typeOverrides[key as keyof WeatherEffects] as number | undefined;
  };

  const isOverridden = (key: string): boolean => {
    return getOverrideValue(key) !== undefined;
  };

  const getEffectiveValue = (key: string): number => {
    const override = getOverrideValue(key);
    if (override !== undefined) return override;
    return getBaseValue(key);
  };

  // Get the actual live value from the weather (after intensity scaling)
  const getLiveValue = (key: string): number => {
    return (weather.effects[key as keyof WeatherEffects] as number) ?? 0;
  };

  const handleChange = (key: string, value: number) => {
    const defaultVal = getBaseValue(key);
    const next = { ...currentOverrides };

    if (value === defaultVal) {
      // Remove override if matches default
      if (next[weather.type]) {
        const { [key]: _, ...rest } = next[weather.type] as Record<string, unknown>;
        if (Object.keys(rest).length === 0) {
          delete next[weather.type];
        } else {
          next[weather.type] = rest as Partial<WeatherEffects>;
        }
      }
    } else {
      next[weather.type] = { ...next[weather.type], [key]: value };
    }
    onSave(next);
  };

  const handleResetAll = () => {
    const next = { ...currentOverrides };
    delete next[weather.type];
    onSave(next);
  };

  const hasOverrides = Object.keys(typeOverrides).length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-300">
          Weather Effects: {weather.type}
          {weather.intensity && weather.intensity !== 'moderate' && (
            <span className="text-gray-500 ml-1">({weather.intensity})</span>
          )}
        </span>
        {editing && hasOverrides && (
          <button
            onClick={handleResetAll}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Reset all
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1">
        {EFFECT_KEYS.map(({ key, label }) => {
          const liveVal = getLiveValue(key);
          const baseVal = getEffectiveValue(key);
          const overridden = isOverridden(key);

          // In view mode, skip effects that are zero (unless overridden)
          if (!editing && liveVal === 0 && !overridden) return null;

          return (
            <div key={key} className="flex items-center justify-between gap-1">
              <span className="text-xs text-gray-400 truncate" title={label}>
                {label}
              </span>
              {editing ? (
                <input
                  type="number"
                  value={baseVal}
                  onChange={(e) => handleChange(key, parseInt(e.target.value) || 0)}
                  className={`w-12 px-1 py-0.5 text-center text-xs rounded border ${
                    overridden
                      ? 'bg-amber-900/30 border-amber-600 text-amber-200'
                      : 'bg-gray-700 border-gray-600 text-gray-100'
                  }`}
                />
              ) : (
                <span className={`text-xs font-mono ${
                  liveVal > 0 ? 'text-green-400' : liveVal < 0 ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {liveVal > 0 ? '+' : ''}{liveVal}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Show all-zero message in view mode */}
      {!editing && EFFECT_KEYS.every(({ key }) => getLiveValue(key) === 0) && (
        <p className="text-xs text-gray-500 italic">No active weather modifiers</p>
      )}

      {editing && (
        <p className="text-xs text-gray-500 mt-2">
          Edit base values for &ldquo;{weather.type}&rdquo;. Changes apply to all future rolls (before intensity scaling).
          {hasOverrides && <span className="text-amber-400 ml-1">Amber = overridden</span>}
        </p>
      )}
    </div>
  );
}

export default WeatherWidget;
