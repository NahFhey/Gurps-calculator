import React from 'react';
import { useCampaignStore } from '../state/campaignStore';

/**
 * ChangelogTab Component - Displays version history and release notes
 *
 * Renders an expandable/collapsible list of application versions with
 * categorized change items. The most recent version is expanded by default.
 *
 * @returns {JSX.Element} The changelog interface
 */
export function ChangelogTab() {
  const { state } = useCampaignStore();
  const entries = state.logs.entries;
  const gmModeEnabled = state.ui.gmModeEnabled;

  const visibleEntries = entries.filter((entry) => {
    if (entry.visibility === 'gmOnly' && !gmModeEnabled) {
      return false;
    }
    return true;
  });

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Changelog</h2>
      {visibleEntries.length === 0 ? (
        <div className="text-sm text-gray-400">No log entries yet.</div>
      ) : (
        <div className="space-y-4">
          {visibleEntries.map((entry) => {
            const payload = entry.payload || {};
            const isMixed = entry.visibility === 'mixed';
            const message =
              !gmModeEnabled && isMixed
                ? payload.maskedMessage || 'Details hidden in player mode.'
                : payload.message || payload.title || entry.type;
            return (
              <div key={entry.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="uppercase tracking-wide">{entry.type}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div className="mt-2 text-sm text-gray-200" data-testid={`log-entry-${entry.id}`}>
                  {message}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
