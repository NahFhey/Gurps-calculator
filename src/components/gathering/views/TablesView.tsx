import { useState } from 'react';
import { Plus, Save, X, Trash2, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import { GATHERING_TABLE_TYPES } from '../../../constants';
import type {
  TablesViewProps,
  GatheringTableExtended,
  TableEntry
} from '../../../types/gathering';

type RollMethod = '1d6' | '2d6' | '3d6';

interface RollMethodRange {
  min: number;
  max: number;
  count: number;
}

function getRollMethodRange(rollMethod: string): RollMethodRange {
  switch (rollMethod) {
    case '1d6': return { min: 1, max: 6, count: 6 };
    case '2d6': return { min: 2, max: 12, count: 11 };
    case '3d6': return { min: 3, max: 18, count: 16 };
    default: return { min: 2, max: 12, count: 11 };
  }
}

/**
 * TablesView - Manages gathering tables (catch tables, event tables)
 *
 * Allows creating, editing, and deleting gathering tables with their
 * roll method, entries, and result types (species, item, event, etc.).
 */
export function TablesView({ tables, species, items, saveTables, onDelete }: TablesViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [newTableName, setNewTableName] = useState('');
  const [newTableType, setNewTableType] = useState('FishingRandomCatch');
  const [newTableRollMethod, setNewTableRollMethod] = useState<RollMethod>('2d6');
  const [newTableEntries, setNewTableEntries] = useState<TableEntry[]>([]);

  function addTable() {
    if (!newTableName.trim()) {
      alert('Enter table name');
      return;
    }

    const range = getRollMethodRange(newTableRollMethod);
    if (newTableEntries.length !== range.count) {
      alert(`Table must have exactly ${range.count} entries for ${newTableRollMethod} (${range.min}-${range.max}). Currently has ${newTableEntries.length}.`);
      return;
    }

    const entryData: Omit<GatheringTableExtended, 'id'> = {
      name: newTableName.trim(),
      tableType: newTableType,
      rollMethod: newTableRollMethod,
      entries: newTableEntries
    };

    if (editingId) {
      saveTables(tables.map(t => t.id === editingId ? { ...t, ...entryData } : t));
    } else {
      saveTables([...tables, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetForm();
  }

  function editTable(t: GatheringTableExtended) {
    setEditingId(t.id);
    setNewTableName(t.name);
    setNewTableType(t.tableType || 'FishingRandomCatch');
    setNewTableRollMethod((t.rollMethod || '2d6') as RollMethod);
    setNewTableEntries(t.entries || []);
    setShowAdd(true);
  }

  function resetForm() {
    setEditingId(null);
    setNewTableName('');
    setNewTableType('FishingRandomCatch');
    setNewTableRollMethod('2d6');
    setNewTableEntries([]);
    setShowAdd(false);
  }

  function initializeTableEntries(rollMethod: string) {
    const range = getRollMethodRange(rollMethod);
    const entries: TableEntry[] = [];
    for (let i = range.min; i <= range.max; i++) {
      entries.push({
        id: crypto.randomUUID(),
        rollValue: i,
        resultType: 'nothing',
        speciesId: null,
        text: ''
      });
    }
    setNewTableEntries(entries);
  }

  function addTableEntry() {
    setNewTableEntries([
      ...newTableEntries,
      { id: crypto.randomUUID(), rollValue: newTableEntries.length + 2, resultType: 'nothing', speciesId: null, text: '' }
    ]);
  }

  function getSpeciesName(speciesId: string | null): string | null {
    if (!speciesId) return null;
    return species.find(s => s.id === speciesId)?.name || null;
  }

  function getItemName(itemId: string | null | undefined): string | null {
    if (!itemId) return null;
    return items.find(i => i.id === itemId)?.name || null;
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-bold">Gathering Tables ({tables.length})</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
          <Plus size={16} className="inline" /> Add Table
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name *</label>
              <input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="e.g., Coastal Waters Catch Table"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Table Type</label>
              <select
                value={newTableType}
                onChange={(e) => setNewTableType(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {GATHERING_TABLE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-400">Roll Method</label>
              <button
                onClick={() => initializeTableEntries(newTableRollMethod)}
                className="text-xs text-blue-400 hover:text-blue-300"
                type="button"
              >
                Initialize Entries
              </button>
            </div>
            <select
              value={newTableRollMethod}
              onChange={(e) => {
                const value = e.target.value as RollMethod;
                setNewTableRollMethod(value);
                if (newTableEntries.length === 0) {
                  initializeTableEntries(value);
                }
              }}
              className="w-full bg-gray-600 px-3 py-2 rounded"
            >
              <option value="2d6">2d6 (2-12, 11 entries)</option>
              <option value="1d6">1d6 (1-6, 6 entries)</option>
              <option value="3d6">3d6 (3-18, 16 entries)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Required entries: {getRollMethodRange(newTableRollMethod).count} | Current: {newTableEntries.length}
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs text-gray-400">Table Entries</label>
              <button onClick={addTableEntry} className="text-sm text-blue-400">+ Add Entry</button>
            </div>
            {newTableEntries.map((entry, idx) => (
              <div key={entry.id} className="flex gap-2 mb-2 items-center">
                <input
                  type="number"
                  value={entry.rollValue}
                  onChange={(e) => {
                    const updated = [...newTableEntries];
                    updated[idx].rollValue = parseInt(e.target.value);
                    setNewTableEntries(updated);
                  }}
                  className="w-16 bg-gray-600 px-2 py-1 rounded"
                  placeholder="Roll"
                />
                <select
                  value={entry.resultType}
                  onChange={(e) => {
                    const updated = [...newTableEntries];
                    updated[idx].resultType = e.target.value as TableEntry['resultType'];
                    setNewTableEntries(updated);
                  }}
                  className="w-24 bg-gray-600 px-2 py-1 rounded"
                >
                  <option value="species">Species</option>
                  <option value="item">Item</option>
                  <option value="nothing">Nothing</option>
                  <option value="event">Event</option>
                  <option value="special">Special</option>
                </select>
                {entry.resultType === 'species' && (
                  <select
                    value={entry.speciesId || ''}
                    onChange={(e) => {
                      const updated = [...newTableEntries];
                      updated[idx].speciesId = e.target.value;
                      setNewTableEntries(updated);
                    }}
                    className="flex-1 bg-gray-600 px-2 py-1 rounded"
                  >
                    <option value="">-- Select Species --</option>
                    {species.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
                {entry.resultType === 'item' && (
                  <select
                    value={entry.itemId || ''}
                    onChange={(e) => {
                      const updated = [...newTableEntries];
                      updated[idx].itemId = e.target.value;
                      setNewTableEntries(updated);
                    }}
                    className="flex-1 bg-gray-600 px-2 py-1 rounded"
                  >
                    <option value="">-- Select Item --</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                )}
                {(entry.resultType === 'event' || entry.resultType === 'special') && (
                  <input
                    value={entry.text || ''}
                    onChange={(e) => {
                      const updated = [...newTableEntries];
                      updated[idx].text = e.target.value;
                      setNewTableEntries(updated);
                    }}
                    placeholder="Event text..."
                    className="flex-1 bg-gray-600 px-2 py-1 rounded"
                  />
                )}
                <button
                  onClick={() => setNewTableEntries(newTableEntries.filter((_, i) => i !== idx))}
                  className="text-red-400"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={addTable} className="flex-1 bg-green-600 px-4 py-2 rounded">
              <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
            </button>
            <button onClick={resetForm} className="bg-red-600 px-4 py-2 rounded">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tables.length === 0 ? (
          <p className="text-gray-500 italic">No tables defined. Create catch and event tables.</p>
        ) : (
          tables.map(t => (
            <div key={t.id} className="bg-gray-700 rounded">
              <div
                className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
                onClick={() => setExpanded(prev => ({ ...prev, [`table-${t.id}`]: !prev[`table-${t.id}`] }))}
              >
                <span>{expanded[`table-${t.id}`] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                <span className="flex-1 font-medium">{t.name}</span>
                <span className="text-sm text-gray-400">{t.tableType}</span>
                <span className="text-xs bg-gray-600 px-2 py-1 rounded">{t.entries?.length || 0} entries</span>
              </div>
              {expanded[`table-${t.id}`] && (
                <div className="px-3 pb-3 border-t border-gray-600 pt-2">
                  <div className="text-sm text-gray-400 mb-2">Roll: {t.rollMethod}</div>
                  {t.entries?.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {t.entries.map(entry => {
                        const speciesName = getSpeciesName(entry.speciesId);
                        const itemName = getItemName(entry.itemId);
                        return (
                          <div key={entry.id} className="text-sm flex gap-2">
                            <span className="text-gray-400 w-8">{entry.rollValue}:</span>
                            <span>
                              {entry.resultType === 'species' && speciesName}
                              {entry.resultType === 'item' && itemName}
                              {entry.resultType === 'nothing' && 'Nothing'}
                              {(entry.resultType === 'event' || entry.resultType === 'special') && entry.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-4 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); editTable(t); }}
                      className="text-blue-400 text-sm"
                    >
                      <Edit2 size={14} className="inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => onDelete('table', t.id, t.name)}
                      className="text-red-400 text-sm"
                    >
                      <Trash2 size={14} className="inline mr-1" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
