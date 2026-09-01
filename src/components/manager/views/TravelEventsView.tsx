import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import { createPresetTerrains, PRESET_TERRAIN_IDS } from '../../../constants/map';
import { WEATHER_LABELS } from '../../../types/location';
import type { WeatherType } from '../../../types/location';
import type {
  TravelEventEntry,
  TravelEventKind,
  TravelEventTable,
  TravelEventTableSet,
} from '../../../types/travelEvents';

const KINDS: TravelEventKind[] = ['nothing', 'flavor', 'hazard', 'encounter'];
const WEATHER_TYPES = Object.keys(WEATHER_LABELS) as WeatherType[];

function newEntry(): TravelEventEntry {
  return {
    id: crypto.randomUUID(),
    kind: 'flavor',
    weight: 1,
    name: 'New event',
    description: '',
  };
}

export function TravelEventsView() {
  const { state, actions } = useCampaignStore();
  const [tab, setTab] = useState<'tables' | 'sets'>('tables');
  const tables = useMemo(
    () => Object.values(state.entities.travelEventTables ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [state.entities.travelEventTables]
  );
  const sets = useMemo(
    () => Object.values(state.entities.travelEventTableSets ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [state.entities.travelEventTableSets]
  );
  const [tableId, setTableId] = useState<string | null>(null);
  const [setId, setSetId] = useState<string | null>(null);
  const [tableDraft, setTableDraft] = useState<TravelEventTable | null>(null);
  const [setDraft, setSetDraft] = useState<TravelEventTableSet | null>(null);

  useEffect(() => {
    const selected = tables.find((table) => table.id === tableId) ?? null;
    setTableDraft(selected ? structuredClone(selected) : null);
  }, [tableId, tables]);
  useEffect(() => {
    const selected = sets.find((set) => set.id === setId) ?? null;
    setSetDraft(selected ? structuredClone(selected) : null);
  }, [setId, sets]);

  const terrainNames = useMemo(
    () => Object.fromEntries(createPresetTerrains().map((terrain) => [terrain.id, terrain.name])),
    []
  );
  const updateEntry = (index: number, changes: Partial<TravelEventEntry>) => {
    setTableDraft((current) => current ? {
      ...current,
      entries: current.entries.map((entry, entryIndex) => entryIndex === index
        ? { ...entry, ...changes }
        : entry),
    } : current);
  };

  const addTable = () => {
    const table: TravelEventTable = {
      id: crypto.randomUUID(),
      name: 'New travel event table',
      description: '',
      entries: [newEntry()],
    };
    actions.partyUpsertTravelEventTable(table);
    setTableId(table.id);
  };
  const addSet = () => {
    const set: TravelEventTableSet = {
      id: crypto.randomUUID(),
      name: 'New travel event set',
      byTerrain: {},
      fallbackTableId: null,
    };
    actions.partyUpsertTravelEventTableSet(set);
    setSetId(set.id);
  };

  return (
    <section className="space-y-5" data-testid="travel-events-view">
      <div>
        <h2 className="text-xl font-semibold text-fg-bright">Travel Events</h2>
        <p className="text-sm text-fg-muted">Author weighted road events and map terrain to tables.</p>
      </div>
      <div className="flex gap-2 border-b border-edge">
        {(['tables', 'sets'] as const).map((value) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={`px-3 py-2 text-sm capitalize ${tab === value ? 'border-b-2 border-rose-500 text-rose-300' : 'text-fg-muted'}`}>
            {value}
          </button>
        ))}
      </div>

      {tab === 'tables' && (
        <div className="grid gap-5 xl:grid-cols-[18rem_1fr]">
          <div className="space-y-2">
            <button type="button" onClick={addTable} className="flex items-center gap-1 rounded bg-rose-700 px-3 py-1.5 text-sm text-white"><Plus className="h-4 w-4" /> Add table</button>
            {tables.map((table) => (
              <button key={table.id} type="button" onClick={() => setTableId(table.id)} className={`flex w-full items-center gap-2 rounded border p-2 text-left text-sm ${tableId === table.id ? 'border-rose-500 bg-rose-950/30' : 'border-edge bg-surface-1'}`}>
                <span className="flex-1">{table.name}<span className="block text-xs text-fg-faint">{table.entries.length} entries</span></span>
                {table.builtin && <span className="rounded bg-accent-500/15 px-1.5 py-0.5 text-[10px] text-accent-300">Built-in</span>}
              </button>
            ))}
          </div>
          {tableDraft ? (
            <div className="space-y-3 rounded border border-edge bg-surface-1/60 p-4" data-testid="travel-event-table-editor">
              <div className="grid gap-2 sm:grid-cols-2">
                <input aria-label="Travel event table name" value={tableDraft.name} onChange={(event) => setTableDraft({ ...tableDraft, name: event.target.value })} className="rounded bg-surface-0 px-2 py-1.5" />
                <input aria-label="Travel event table description" value={tableDraft.description ?? ''} onChange={(event) => setTableDraft({ ...tableDraft, description: event.target.value })} className="rounded bg-surface-0 px-2 py-1.5" />
              </div>
              {tableDraft.entries.map((eventEntry, index) => (
                <article key={eventEntry.id} className="space-y-2 rounded border border-edge p-3" data-testid={`travel-event-entry-${eventEntry.id}`}>
                  <div className="grid gap-2 lg:grid-cols-[8rem_6rem_1fr_2fr_auto]">
                    <select aria-label={`Event ${index + 1} kind`} value={eventEntry.kind} onChange={(event) => updateEntry(index, { kind: event.target.value as TravelEventKind })} className="rounded bg-surface-0 px-2 py-1">
                      {KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                    </select>
                    <input aria-label={`Event ${index + 1} weight`} type="number" value={eventEntry.weight} onChange={(event) => updateEntry(index, { weight: event.target.valueAsNumber || 0 })} className="rounded bg-surface-0 px-2 py-1" />
                    <input aria-label={`Event ${index + 1} name`} value={eventEntry.name} onChange={(event) => updateEntry(index, { name: event.target.value })} className="rounded bg-surface-0 px-2 py-1" />
                    <input aria-label={`Event ${index + 1} description`} value={eventEntry.description} onChange={(event) => updateEntry(index, { description: event.target.value })} className="rounded bg-surface-0 px-2 py-1" />
                    <button type="button" aria-label={`Remove event ${index + 1}`} onClick={() => setTableDraft({ ...tableDraft, entries: tableDraft.entries.filter((entry) => entry.id !== eventEntry.id) })} className="text-danger-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {eventEntry.kind === 'hazard' && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input aria-label={`Event ${index + 1} lost miles`} type="number" min={0} placeholder="Lost miles" value={eventEntry.hazard?.lostMiles ?? ''} onChange={(event) => updateEntry(index, { hazard: { ...eventEntry.hazard, lostMiles: event.target.value === '' ? undefined : Math.max(0, event.target.valueAsNumber || 0) } })} className="rounded bg-surface-0 px-2 py-1" />
                      <input aria-label={`Event ${index + 1} FP formula`} placeholder="FP formula" value={eventEntry.hazard?.fpLossFormula ?? ''} onChange={(event) => updateEntry(index, { hazard: { ...eventEntry.hazard, fpLossFormula: event.target.value || undefined } })} className="rounded bg-surface-0 px-2 py-1" />
                      <input aria-label={`Event ${index + 1} HP formula`} placeholder="HP formula" value={eventEntry.hazard?.hpLossFormula ?? ''} onChange={(event) => updateEntry(index, { hazard: { ...eventEntry.hazard, hpLossFormula: event.target.value || undefined } })} className="rounded bg-surface-0 px-2 py-1" />
                    </div>
                  )}
                  {eventEntry.kind === 'encounter' && (
                    <select aria-label={`Event ${index + 1} encounter template`} value={eventEntry.encounterTemplateId ?? ''} onChange={(event) => updateEntry(index, { encounterTemplateId: event.target.value || null })} className="w-full rounded bg-surface-0 px-2 py-1">
                      <option value="">— none —</option>
                      {Object.values(state.entities.encounterTemplates).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                    </select>
                  )}
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <label className="text-xs text-fg-muted">Weather gates
                      <select multiple aria-label={`Event ${index + 1} weather gates`} value={eventEntry.conditions?.weatherTypes ?? []} onChange={(event) => {
                        const selected = Array.from(event.target.selectedOptions, (option) => option.value as WeatherType);
                        updateEntry(index, { conditions: { ...eventEntry.conditions, weatherTypes: selected.length > 0 ? selected : undefined } });
                      }} className="mt-1 h-20 w-full rounded bg-surface-0 px-2 py-1">
                        {WEATHER_TYPES.map((weather) => <option key={weather} value={weather}>{WEATHER_LABELS[weather]}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={eventEntry.conditions?.nightOnly ?? false} onChange={(event) => updateEntry(index, { conditions: { ...eventEntry.conditions, nightOnly: event.target.checked || undefined } })} /> Night-only</label>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={eventEntry.conditions?.forcedMarchOnly ?? false} onChange={(event) => updateEntry(index, { conditions: { ...eventEntry.conditions, forcedMarchOnly: event.target.checked || undefined } })} /> Forced-march-only</label>
                  </div>
                </article>
              ))}
              <div className="flex gap-2">
                <button type="button" onClick={() => setTableDraft({ ...tableDraft, entries: [...tableDraft.entries, newEntry()] })} className="rounded bg-surface-2 px-3 py-1.5 text-sm"><Plus className="mr-1 inline h-4 w-4" />Entry</button>
                <button type="button" onClick={() => actions.partyUpsertTravelEventTable(tableDraft)} className="rounded bg-success-700 px-3 py-1.5 text-sm"><Save className="mr-1 inline h-4 w-4" />Save</button>
                <button type="button" onClick={() => { actions.partyRemoveTravelEventTable(tableDraft.id); setTableId(null); }} className="rounded bg-danger-800 px-3 py-1.5 text-sm">Delete table</button>
              </div>
            </div>
          ) : <div className="text-sm text-fg-faint">Choose a table to edit.</div>}
        </div>
      )}

      {tab === 'sets' && (
        <div className="grid gap-5 xl:grid-cols-[18rem_1fr]">
          <div className="space-y-2">
            <button type="button" onClick={addSet} className="flex items-center gap-1 rounded bg-fuchsia-700 px-3 py-1.5 text-sm text-white"><Plus className="h-4 w-4" /> Add set</button>
            {sets.map((set) => <button key={set.id} type="button" onClick={() => setSetId(set.id)} className={`flex w-full items-center gap-2 rounded border p-2 text-left text-sm ${setId === set.id ? 'border-fuchsia-500 bg-fuchsia-950/30' : 'border-edge bg-surface-1'}`}><span className="flex-1">{set.name}</span>{set.builtin && <span className="rounded bg-accent-500/15 px-1.5 py-0.5 text-[10px] text-accent-300">Built-in</span>}</button>)}
          </div>
          {setDraft ? (
            <div className="space-y-3 rounded border border-edge bg-surface-1/60 p-4" data-testid="travel-event-set-editor">
              <input aria-label="Travel event set name" value={setDraft.name} onChange={(event) => setSetDraft({ ...setDraft, name: event.target.value })} className="w-full rounded bg-surface-0 px-2 py-1.5" />
              <div className="grid gap-2 sm:grid-cols-2">
                {PRESET_TERRAIN_IDS.map((terrainId) => <label key={terrainId} className="grid grid-cols-[8rem_1fr] items-center gap-2 text-sm"><span>{terrainNames[terrainId] ?? terrainId}</span><select aria-label={`${terrainNames[terrainId]} travel event table`} value={setDraft.byTerrain[terrainId] ?? ''} onChange={(event) => setSetDraft({ ...setDraft, byTerrain: { ...setDraft.byTerrain, [terrainId]: event.target.value || undefined } })} className="rounded bg-surface-0 px-2 py-1"><option value="">— none —</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select></label>)}
              </div>
              <label className="block text-sm">Fallback table<select aria-label="Fallback travel event table" value={setDraft.fallbackTableId ?? ''} onChange={(event) => setSetDraft({ ...setDraft, fallbackTableId: event.target.value || null })} className="ml-2 rounded bg-surface-0 px-2 py-1"><option value="">— none —</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select></label>
              <div className="flex gap-2"><button type="button" onClick={() => actions.partyUpsertTravelEventTableSet(setDraft)} className="rounded bg-success-700 px-3 py-1.5 text-sm"><Save className="mr-1 inline h-4 w-4" />Save</button><button type="button" onClick={() => { actions.partyRemoveTravelEventTableSet(setDraft.id); setSetId(null); }} className="rounded bg-danger-800 px-3 py-1.5 text-sm">Delete set</button></div>
            </div>
          ) : <div className="text-sm text-fg-faint">Choose a set to edit.</div>}
        </div>
      )}
    </section>
  );
}
