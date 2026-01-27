import type { CampaignDayViewProps } from '../../../types/gathering';

/**
 * CampaignDayView - Campaign day tracker for gathering system
 *
 * Tracks the current campaign day which is used to manage daily events
 * in the gathering system. Each gathering group can only trigger one
 * daily event per day.
 */
export function CampaignDayView({ currentDay, saveCurrentDay }: CampaignDayViewProps) {
  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Campaign Day Tracker</h3>
      <div className="bg-gray-700 p-4 rounded space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Current Campaign Day</label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={currentDay}
              onChange={(e) => saveCurrentDay(parseInt(e.target.value) || 1)}
              min="1"
              className="w-32 bg-gray-600 px-3 py-2 rounded text-2xl font-bold text-center"
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveCurrentDay(Math.max(1, currentDay - 1))}
                className="bg-gray-600 px-4 py-2 rounded"
              >
                - Day
              </button>
              <button
                onClick={() => saveCurrentDay(currentDay + 1)}
                className="bg-blue-600 px-4 py-2 rounded"
              >
                + Day
              </button>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          The campaign day is used to track daily events in gathering.
          Each gathering group can only trigger one daily event per day.
        </p>
      </div>
    </div>
  );
}
