import { useMemo } from 'react';

/**
 * WeatherWidget - Displays current weather conditions and effects
 *
 * Part of Phase 2: Layout Restructure
 *
 * PLACEHOLDER: This is a placeholder component that displays mock weather data.
 * It will be enhanced in Phase 5 when the Location & Weather System is implemented.
 *
 * Future enhancements (Phase 5):
 * - Weather tied to Locations (different climates per location)
 * - Weather generation based on location weather tables
 * - Weather duration and expiration
 * - GM controls to roll/set weather
 * - Travel between locations
 */

interface WeatherEffects {
  gathering: number;
  hunting: number;
  travel: number;
  crafting: number;
  visibility: number;
}

interface PlaceholderWeather {
  type: string;
  description: string;
  temperature: string;
  icon: string;
  effects: WeatherEffects;
}

// Placeholder weather data - will be replaced by actual weather state in Phase 5
const PLACEHOLDER_WEATHER: PlaceholderWeather = {
  type: 'clear',
  description: 'Clear skies',
  temperature: 'Mild',
  icon: '\u2600', // Sun emoji alternative: could use actual emoji or icon library
  effects: {
    gathering: 1,
    hunting: 0,
    travel: 0,
    crafting: 0,
    visibility: 0,
  },
};

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
  // In Phase 5, this will come from state.locations.current.weather
  // For now, use placeholder data
  const weather = PLACEHOLDER_WEATHER;

  // Format effects for display
  const effectsDisplay = useMemo(() => {
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
    if (weather.effects.visibility !== 0) {
      effects.push(`Vision ${weather.effects.visibility > 0 ? '+' : ''}${weather.effects.visibility}`);
    }
    return effects.length > 0 ? effects.join(', ') : 'No modifiers';
  }, [weather.effects]);

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 rounded border border-gray-600 bg-gray-700/50 px-3 py-1.5"
        title={`${weather.description}, ${weather.temperature}\n${effectsDisplay}`}
        data-testid="weather-widget-compact"
      >
        <span className="text-lg">{weather.icon}</span>
        <span className="text-sm text-gray-200">{weather.temperature}</span>
      </div>
    );
  }

  return (
    <div
      className="rounded border border-gray-600 bg-gray-700/50 px-4 py-2"
      data-testid="weather-widget"
    >
      <div className="flex items-start gap-3">
        {/* Weather Icon */}
        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-600/50 text-2xl">
          {weather.icon}
        </div>

        {/* Weather Info */}
        <div className="flex-1 min-w-0">
          {/* Location - placeholder for Phase 5 */}
          {showLocation && (
            <div className="text-xs text-gray-400 mb-0.5">
              Current Location
            </div>
          )}

          {/* Weather Description */}
          <div className="text-sm font-medium text-gray-100">
            {weather.description}, {weather.temperature}
          </div>

          {/* Effects */}
          {showEffects && (
            <div className="text-xs text-gray-400 mt-0.5">
              {effectsDisplay}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WeatherWidget;
