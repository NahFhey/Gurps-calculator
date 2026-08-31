import { useMemo } from 'react';
import { useCampaignStore } from '../../../state/campaignStore';
import { DEFAULT_CALENDAR, type CalendarConfig, type SeasonDef } from '../../../utils/timeSystem';

const cloneDefaults = (): CalendarConfig => ({
  seasons: DEFAULT_CALENDAR.seasons.map((season) => ({ ...season })),
  startSeasonIndex: DEFAULT_CALENDAR.startSeasonIndex,
});

export function CalendarView() {
  const { state, actions } = useCampaignStore();
  // Phase 14 intentionally exposes four configurable rows; variable-length calendars are deferred.
  const calendar = useMemo<CalendarConfig>(() => {
    const saved = state.time.calendar;
    if (!saved) return cloneDefaults();
    return {
      seasons: DEFAULT_CALENDAR.seasons.map((fallback, index) => ({
        ...fallback,
        ...saved.seasons[index],
      })),
      startSeasonIndex: Math.max(0, Math.min(3, saved.startSeasonIndex)),
    };
  }, [state.time.calendar]);

  const updateSeason = (index: number, changes: Partial<SeasonDef>) => {
    actions.setCalendarConfig({
      ...calendar,
      seasons: calendar.seasons.map((season, seasonIndex) =>
        seasonIndex === index ? { ...season, ...changes } : season
      ),
    });
  };

  return (
    <section data-testid="calendar-view" className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">Calendar & Seasons</h2>
        <p className="text-sm text-gray-400">Season timing shifts ambient temperature bands and precipitation weights.</p>
      </div>

      <div className="overflow-x-auto rounded border border-gray-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-900/60 text-xs uppercase text-gray-500">
            <tr><th className="p-2">Name</th><th>Days</th><th>Temperature shift</th><th>Precipitation ×</th></tr>
          </thead>
          <tbody>
            {calendar.seasons.map((season, index) => (
              <tr key={index} className="border-t border-gray-700 bg-gray-800/60">
                <td className="p-2"><input aria-label={`Season ${index + 1} name`} value={season.name} onChange={(event) => updateSeason(index, { name: event.target.value })} className="w-36 rounded bg-gray-900 px-2 py-1" /></td>
                <td><input aria-label={`${season.name} days`} type="number" min={1} value={season.days} onChange={(event) => updateSeason(index, { days: Math.max(1, event.target.valueAsNumber || 1) })} className="w-20 rounded bg-gray-900 px-2 py-1" /></td>
                <td><input aria-label={`${season.name} temperature shift`} type="number" min={-3} max={3} value={season.temperatureShift} onChange={(event) => updateSeason(index, { temperatureShift: Math.max(-3, Math.min(3, event.target.valueAsNumber || 0)) })} className="w-20 rounded bg-gray-900 px-2 py-1" /></td>
                <td><input aria-label={`${season.name} precipitation multiplier`} type="number" min={0.1} max={3} step={0.05} value={season.precipitationMultiplier} onChange={(event) => updateSeason(index, { precipitationMultiplier: Math.max(0.1, Math.min(3, event.target.valueAsNumber || 0.1)) })} className="w-24 rounded bg-gray-900 px-2 py-1" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-300">
          <span className="mb-1 block text-xs text-gray-500">Starting season</span>
          <select aria-label="Starting season" value={calendar.startSeasonIndex} onChange={(event) => actions.setCalendarConfig({ ...calendar, startSeasonIndex: Number(event.target.value) })} className="rounded bg-gray-900 px-3 py-2">
            {calendar.seasons.map((season, index) => <option key={index} value={index}>{season.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => actions.setCalendarConfig(cloneDefaults())} className="rounded bg-gray-700 px-3 py-2 text-sm text-gray-100 hover:bg-gray-600">Reset to defaults</button>
      </div>
    </section>
  );
}
