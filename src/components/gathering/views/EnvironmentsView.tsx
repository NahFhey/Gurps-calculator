import { useState } from 'react';
import { Plus, Save, X, Trash2, Edit2 } from 'lucide-react';
import { GATHERING_MODES } from '../../../constants';
import type { EnvironmentsViewProps, GatheringEnvironmentExtended, ModeDefaults } from '../../../types/gathering';

/**
 * EnvironmentsView - Manages gathering environments/locations
 *
 * Allows creating, editing, and deleting environments that link
 * to catch tables, event tables, and specify skill modifiers.
 */
export function EnvironmentsView({ environments, tables, saveEnvironments, onDelete }: EnvironmentsViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvModes, setNewEnvModes] = useState<string[]>(['Fishing']);
  const [newEnvCatchTableId, setNewEnvCatchTableId] = useState('');
  const [newEnvMildTableId, setNewEnvMildTableId] = useState('');
  const [newEnvRareTableId, setNewEnvRareTableId] = useState('');
  const [newEnvForagingFindTableId, setNewEnvForagingFindTableId] = useState('');
  const [newEnvForagingMildTableId, setNewEnvForagingMildTableId] = useState('');
  const [newEnvForagingRareTableId, setNewEnvForagingRareTableId] = useState('');
  const [newEnvSkillMod, setNewEnvSkillMod] = useState('0');

  function addEnvironment() {
    if (!newEnvName.trim()) {
      alert('Enter environment name');
      return;
    }

    const defaultsByMode: { Fishing?: ModeDefaults; Foraging?: ModeDefaults } = {};

    if (newEnvModes.includes('Fishing')) {
      defaultsByMode.Fishing = {
        randomCatchTableId: newEnvCatchTableId || null,
        mildEventTableId: newEnvMildTableId || null,
        rareEventTableId: newEnvRareTableId || null
      };
    }

    if (newEnvModes.includes('Foraging')) {
      defaultsByMode.Foraging = {
        randomCatchTableId: newEnvForagingFindTableId || null,
        mildEventTableId: newEnvForagingMildTableId || null,
        rareEventTableId: newEnvForagingRareTableId || null
      };
    }

    const hasTables = Object.values(defaultsByMode).some(mode =>
      mode.randomCatchTableId || mode.mildEventTableId || mode.rareEventTableId
    );

    if (!hasTables) {
      alert('Environment must have at least one table selected');
      return;
    }

    const entryData: Omit<GatheringEnvironmentExtended, 'id'> = {
      name: newEnvName.trim(),
      supportedModes: newEnvModes,
      defaultsByMode,
      skillMod: parseInt(newEnvSkillMod) || 0
    };

    if (editingId) {
      saveEnvironments(environments.map(e => e.id === editingId ? { ...e, ...entryData } : e));
    } else {
      saveEnvironments([...environments, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetForm();
  }

  function editEnvironment(e: GatheringEnvironmentExtended) {
    setEditingId(e.id);
    setNewEnvName(e.name);
    setNewEnvModes(e.supportedModes || ['Fishing']);

    const fishingDefaults = e.defaultsByMode?.Fishing || {};
    setNewEnvCatchTableId(fishingDefaults.randomCatchTableId || '');
    setNewEnvMildTableId(fishingDefaults.mildEventTableId || '');
    setNewEnvRareTableId(fishingDefaults.rareEventTableId || '');

    const foragingDefaults = e.defaultsByMode?.Foraging || {};
    setNewEnvForagingFindTableId(foragingDefaults.randomCatchTableId || '');
    setNewEnvForagingMildTableId(foragingDefaults.mildEventTableId || '');
    setNewEnvForagingRareTableId(foragingDefaults.rareEventTableId || '');

    setNewEnvSkillMod(String(e.skillMod || 0));
    setShowAdd(true);
  }

  function resetForm() {
    setEditingId(null);
    setNewEnvName('');
    setNewEnvModes(['Fishing']);
    setNewEnvCatchTableId('');
    setNewEnvMildTableId('');
    setNewEnvRareTableId('');
    setNewEnvForagingFindTableId('');
    setNewEnvForagingMildTableId('');
    setNewEnvForagingRareTableId('');
    setNewEnvSkillMod('0');
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-bold">Environments ({environments.length})</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
          <Plus size={16} className="inline" /> Add Environment
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name *</label>
            <input
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              placeholder="e.g., Tuto Coastal Waters"
              className="w-full bg-gray-600 px-3 py-2 rounded"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Supported Modes</label>
            <div className="flex flex-wrap gap-2">
              {GATHERING_MODES.map(mode => (
                <label key={mode} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={newEnvModes.includes(mode)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewEnvModes([...newEnvModes, mode]);
                      } else {
                        setNewEnvModes(newEnvModes.filter(m => m !== mode));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  {mode}
                </label>
              ))}
            </div>
          </div>

          {newEnvModes.includes('Fishing') && (
            <>
              <div className="text-sm font-medium text-gray-300 mt-4 mb-2">Fishing Tables</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Catch Table</label>
                  <select
                    value={newEnvCatchTableId}
                    onChange={(e) => setNewEnvCatchTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables.filter(t => t.tableType.includes('RandomCatch')).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Mild Event Table</label>
                  <select
                    value={newEnvMildTableId}
                    onChange={(e) => setNewEnvMildTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables.filter(t => t.tableType.includes('EventMild')).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rare Event Table</label>
                  <select
                    value={newEnvRareTableId}
                    onChange={(e) => setNewEnvRareTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables.filter(t => t.tableType.includes('EventRare')).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {newEnvModes.includes('Foraging') && (
            <>
              <div className="text-sm font-medium text-gray-300 mt-4 mb-2">Foraging Tables</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Find Table</label>
                  <select
                    value={newEnvForagingFindTableId}
                    onChange={(e) => setNewEnvForagingFindTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables.filter(t => t.tableType.includes('ForagingRandomFind')).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Mild Event Table</label>
                  <select
                    value={newEnvForagingMildTableId}
                    onChange={(e) => setNewEnvForagingMildTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables.filter(t => t.tableType.includes('ForagingEventMild')).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rare Event Table</label>
                  <select
                    value={newEnvForagingRareTableId}
                    onChange={(e) => setNewEnvForagingRareTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables.filter(t => t.tableType.includes('ForagingEventRare')).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="w-1/3">
            <label className="block text-xs text-gray-400 mb-1">Skill Modifier</label>
            <input
              type="number"
              value={newEnvSkillMod}
              onChange={(e) => setNewEnvSkillMod(e.target.value)}
              placeholder="e.g., -1"
              className="w-full bg-gray-600 px-3 py-2 rounded"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={addEnvironment} className="flex-1 bg-green-600 px-4 py-2 rounded">
              <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
            </button>
            <button onClick={resetForm} className="bg-red-600 px-4 py-2 rounded">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {environments.length === 0 ? (
          <p className="text-gray-500 italic">No environments defined. Create fishing locations.</p>
        ) : (
          environments.map(e => (
            <div key={e.id} className="bg-gray-700 p-3 rounded">
              <div className="flex justify-between items-center">
                <span className="font-medium">{e.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => editEnvironment(e)} className="text-blue-400">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => onDelete('environment', e.id, e.name)} className="text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Modes: {e.supportedModes?.join(', ') || 'All'}
                {e.skillMod !== 0 && <span className="ml-2">Skill: {e.skillMod >= 0 ? '+' : ''}{e.skillMod}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
