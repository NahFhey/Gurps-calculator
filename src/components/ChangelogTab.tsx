import { useMemo, useState } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import type { LogEntry } from '../state/campaignReducer';

const ACTIVITY_FAMILIES = [
  'location',
  'alchemy',
  'cooking',
  'crafting',
  'gathering',
  'inventory',
  'combat',
  'rest',
  'trading',
  'study',
  'social',
  'travel',
  'character',
] as const;

type VisibleLogEntry = {
  entry: LogEntry;
  message: string;
  searchableMessage: string;
};

function getPayloadString(entry: LogEntry, key: 'message' | 'maskedMessage' | 'title'): string | undefined {
  const value = entry.payload?.[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * ChangelogTab Component - Displays version history and release notes
 *
 * Renders an expandable/collapsible list of application versions with
 * categorized change items. The most recent version is expanded by default.
 */
export function ChangelogTab() {
  const { state } = useCampaignStore();
  const entries = state.logs.entries;
  const gmModeEnabled = state.ui.gmModeEnabled;
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('all');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [characterId, setCharacterId] = useState('');

  const characters = useMemo(
    () => Object.values(state.entities.characters).sort((left, right) => left.name.localeCompare(right.name)),
    [state.entities.characters]
  );

  const visibleEntries = useMemo<VisibleLogEntry[]>(() => entries.flatMap((entry) => {
    if (entry.visibility === 'gmOnly' && !gmModeEnabled) {
      return [];
    }

    const isMasked = !gmModeEnabled && entry.visibility === 'mixed';
    const payloadMessage = getPayloadString(entry, 'message');
    const maskedMessage = getPayloadString(entry, 'maskedMessage');
    const title = getPayloadString(entry, 'title');
    const searchableMessage = isMasked ? (maskedMessage ?? '') : (payloadMessage ?? '');
    const message = isMasked
      ? maskedMessage ?? 'Details hidden in player mode.'
      : payloadMessage ?? title ?? entry.type;

    return [{ entry, message, searchableMessage }];
  }), [entries, gmModeEnabled]);

  const searchedEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? visibleEntries.filter(({ searchableMessage }) => searchableMessage.toLowerCase().includes(query))
      : visibleEntries;
  }, [search, visibleEntries]);

  const familyEntries = useMemo(() => family === 'all'
    ? searchedEntries
    : searchedEntries.filter(({ entry }) => entry.type.split('.')[0] === family),
  [family, searchedEntries]);

  const dayEntries = useMemo(() => {
    if (fromDay === '' && toDay === '') return familyEntries;

    const minimum = fromDay === '' ? undefined : Number(fromDay);
    const maximum = toDay === '' ? undefined : Number(toDay);
    return familyEntries.filter(({ entry }) => {
      if (entry.day === undefined) return false;
      if (minimum !== undefined && entry.day < minimum) return false;
      if (maximum !== undefined && entry.day > maximum) return false;
      return true;
    });
  }, [familyEntries, fromDay, toDay]);

  const filteredEntries = useMemo(() => {
    if (!characterId) return dayEntries;
    const character = state.entities.characters[characterId];
    if (!character) return [];
    const characterName = character.name.toLowerCase();

    return dayEntries.filter(({ entry }) => {
      const ids = entry.meta?.characterIds;
      if (ids?.length) return ids.includes(characterId);
      return entry.meta?.characterNames?.some(name => name.toLowerCase() === characterName) ?? false;
    });
  }, [characterId, dayEntries, state.entities.characters]);


  return (
    <div className="bg-surface-1 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Changelog</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm text-fg-secondary lg:col-span-2">
          <span className="mb-1 block">Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search log messages"
            className="w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright placeholder:text-fg-muted"
          />
        </label>
        <label className="text-sm text-fg-secondary">
          <span className="mb-1 block">Category</span>
          <select
            value={family}
            onChange={(event) => setFamily(event.target.value)}
            className="w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
          >
            <option value="all">All</option>
            {ACTIVITY_FAMILIES.map((activityFamily) => (
              <option key={activityFamily} value={activityFamily}>
                {activityFamily.charAt(0).toUpperCase() + activityFamily.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-fg-secondary">
          <span className="mb-1 block">From day</span>
          <input
            type="number"
            value={fromDay}
            onChange={(event) => setFromDay(event.target.value)}
            className="w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
          />
        </label>
        <label className="text-sm text-fg-secondary">
          <span className="mb-1 block">To day</span>
          <input
            type="number"
            value={toDay}
            onChange={(event) => setToDay(event.target.value)}
            className="w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
          />
        </label>
        <label className="text-sm text-fg-secondary sm:col-span-2 lg:col-span-2">
          <span className="mb-1 block">Character</span>
          <select
            value={characterId}
            onChange={(event) => setCharacterId(event.target.value)}
            className="w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
          >
            <option value="">All characters</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </label>
      </div>
      {filteredEntries.length === 0 ? (
        <div className="text-sm text-fg-muted">No log entries yet.</div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map(({ entry, message }) => (
              <div key={entry.id} className="bg-surface-2 rounded-lg p-4">
                <div className="flex items-center justify-between text-xs text-fg-muted">
                  <span className="uppercase tracking-wide">{entry.type}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div className="mt-2 text-sm text-fg-primary" data-testid={`log-entry-${entry.id}`}>
                  {message}
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
