import { useMemo, useState } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import { getWeatherIcon, getRemainingWeatherSlots } from '../../utils/weatherSystem';
import { LocationManager } from '../location/LocationManager';
import type { Weather } from '../../types/location';
import { TEMPERATURE_LABELS, CLIMATE_LABELS } from '../../types/location';

/**
 * WeatherWidget - Displays current weather conditions and effects
 *
 * Phase 5: Location & Weather System
 *
 * Features:
 * - Displays current location and weather
 * - Shows weather effects on activities
 * - GM can click to manage locations and weather
 * - Weather auto-updates when time advances
 */

interface WeatherWidgetProps {
  compact?: boolean;
  showEffects?: boolean;
  showLocation?: boolean;
}

export function WeatherWidget({
  compact = false,
  showEffects = true,
  showLocation = true,
}: WeatherWidgetProps) {
  const { state, actions } = useCampaignStore();
  const [showManager, setShowManager] = useState(false);

  // Get current location and weather from state
  const currentLocation = state.locations.currentLocationId
    ? state.locations.locations[state.locations.currentLocationId]
    : null;

  const weather: Weather | null = currentLocation?.currentWeather?.weather ?? null;
  const activeWeather = currentLocation?.currentWeather ?? null;

  // Calculate remaining weather duration
  const remainingSlots = useMemo(() => {
    if (!activeWeather) return null;
    return getRemainingWeatherSlots(activeWeather, state.time, state.time.slotsPerDay);
  }, [activeWeather, state.time]);

  // Format effects for display
  const effectsDisplay = useMemo(() => {
    if (!weather) return 'No weather data';

    const effects: string[] = [];
    if (weather.effects.gathering !== 0) {
      effects.push(`Gathering ${weather.effects.gathering > 0 ? '+' : ''}${weather.effects.gathering}`);
    }
    if (weather.effects.hunting !== 0) {
      effects.push(`Hunting ${weather.effects.hunting > 0 ? '+' : ''}${weather.effects.hunting}`);
    }
    if (weather.effects.travel !== 0) {
      effects.push(`Travel ${weather.effects.travel > 0 ? '+' : ''}${weather.effects.travel}`);
    }
    if (weather.effects.crafting !== 0) {
      effects.push(`Crafting ${weather.effects.crafting > 0 ? '+' : ''}${weather.effects.crafting}`);
    }
    if (weather.effects.alchemy !== 0) {
      effects.push(`Alchemy ${weather.effects.alchemy > 0 ? '+' : ''}${weather.effects.alchemy}`);
    }
    if (weather.effects.cooking !== 0) {
      effects.push(`Cooking ${weather.effects.cooking > 0 ? '+' : ''}${weather.effects.cooking}`);
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
    if (remainingSlots >= state.time.slotsPerDay) {
      const days = Math.floor(remainingSlots / state.time.slotsPerDay);
      const slots = remainingSlots % state.time.slotsPerDay;
      if (slots === 0) return `${days} day${days > 1 ? 's' : ''} left`;
      return `${days}d ${slots}s left`;
    }
    return `${remainingSlots} slots left`;
  }, [remainingSlots, state.time.slotsPerDay]);

  // Handle roll new weather
  const handleRollWeather = () => {
    if (state.locations.currentLocationId) {
      actions.rollNewWeather(state.locations.currentLocationId);
    }
  };

  // No location available
  if (!currentLocation) {
    return (
      <div
        className="rounded border border-gray-600 bg-gray-700/50 px-4 py-2 cursor-pointer hover:bg-gray-700"
        onClick={() => setShowManager(true)}
        data-testid="weather-widget"
      >
        <div className="text-sm text-gray-400">No location set</div>
        <div className="text-xs text-gray-500">Click to manage locations</div>

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
          title={`${currentLocation.name}: ${weather?.description ?? 'Unknown'}\n${effectsDisplay}`}
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
        className="rounded border border-gray-600 bg-gray-700/50 px-4 py-2 cursor-pointer hover:bg-gray-700"
        onClick={() => setShowManager(true)}
        data-testid="weather-widget"
      >
        <div className="flex items-start gap-3">
          {/* Weather Icon */}
          <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-600/50 text-2xl">
            {weather ? getWeatherIcon(weather.type) : '🌡️'}
          </div>

          {/* Weather Info */}
          <div className="flex-1 min-w-0">
            {/* Location */}
            {showLocation && (
              <div className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                <span>{currentLocation.name}</span>
                <span className="text-gray-500">
                  ({CLIMATE_LABELS[currentLocation.climate]})
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

            {/* Effects */}
            {showEffects && (
              <div className="text-xs text-gray-400 mt-0.5">
                {effectsDisplay}
              </div>
            )}
          </div>

          {/* GM Controls */}
          {state.ui.gmModeEnabled && (
            <div className="flex flex-col gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRollWeather();
                }}
                className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded"
                title="Roll new weather"
              >
                🎲
              </button>
            </div>
          )}
        </div>
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

export default WeatherWidget;
