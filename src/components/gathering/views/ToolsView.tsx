import { useState } from 'react';
import { Plus, Save, X, Trash2, Edit2 } from 'lucide-react';
import {
  GATHERING_MODES,
  GATHERING_TOOL_TYPES,
  FISHING_METHODS
} from '../../../constants';
import type { ToolsViewProps, GatheringToolExtended, ToolBonus } from '../../../types/gathering';

interface YieldBonusEntry {
  typeId: string;
  dice: string;
}

/**
 * ToolsView - Manages gathering tools (fishing rods, nets, etc.)
 *
 * Allows creating, editing, and deleting gathering tools with their
 * bonuses, allowed modes, methods, and durability.
 */
export function ToolsView({ tools, foodTypes, materialTypes, saveTools, onDelete }: ToolsViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [newToolName, setNewToolName] = useState('');
  const [newToolType, setNewToolType] = useState('fishing_rod');
  const [newToolModes, setNewToolModes] = useState<string[]>(['Fishing']);
  const [newToolMethods, setNewToolMethods] = useState<string[]>([]);
  const [newToolSkillBonus, setNewToolSkillBonus] = useState('0');
  const [newToolYieldBonuses, setNewToolYieldBonuses] = useState<YieldBonusEntry[]>([]);
  const [newToolDurability, setNewToolDurability] = useState('');
  const [newToolNotes, setNewToolNotes] = useState('');

  function addTool() {
    if (!newToolName.trim()) {
      alert('Enter tool name');
      return;
    }

    const bonuses: ToolBonus[] = [];
    if (parseInt(newToolSkillBonus)) {
      bonuses.push({ type: 'skill_bonus', skill: 'Fishing', value: parseInt(newToolSkillBonus) });
    }

    newToolYieldBonuses.forEach(yb => {
      if (yb.typeId && yb.dice) {
        bonuses.push({ type: 'yield_bonus', typeId: yb.typeId, dice: parseInt(yb.dice) });
      }
    });

    const entryData: Omit<GatheringToolExtended, 'id'> = {
      name: newToolName.trim(),
      toolType: newToolType,
      allowedModes: newToolModes,
      allowedMethods: newToolMethods,
      bonuses,
      durability: newToolDurability ? parseInt(newToolDurability) : null,
      notes: newToolNotes
    };

    if (editingId) {
      saveTools(tools.map(t => t.id === editingId ? { ...t, ...entryData } : t));
    } else {
      saveTools([...tools, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetForm();
  }

  function editTool(t: GatheringToolExtended) {
    setEditingId(t.id);
    setNewToolName(t.name);
    setNewToolType(t.toolType || 'fishing_rod');
    setNewToolModes(t.allowedModes || ['Fishing']);
    setNewToolMethods(t.allowedMethods || []);
    setNewToolSkillBonus(String(t.bonuses?.find(b => b.type === 'skill_bonus')?.value || 0));

    const yieldBonuses = t.bonuses?.filter(b => b.type === 'yield_bonus').map(yb => ({
      typeId: yb.typeId || yb.categoryId || '',
      dice: String(yb.dice || 0)
    })) || [];
    setNewToolYieldBonuses(yieldBonuses);

    setNewToolDurability(t.durability ? String(t.durability) : '');
    setNewToolNotes(t.notes || '');
    setShowAdd(true);
  }

  function resetForm() {
    setEditingId(null);
    setNewToolName('');
    setNewToolType('fishing_rod');
    setNewToolModes(['Fishing']);
    setNewToolMethods([]);
    setNewToolSkillBonus('0');
    setNewToolYieldBonuses([]);
    setNewToolDurability('');
    setNewToolNotes('');
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-bold">Gathering Tools ({tools.length})</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
          <Plus size={16} className="inline" /> Add Tool
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name *</label>
              <input
                value={newToolName}
                onChange={(e) => setNewToolName(e.target.value)}
                placeholder="e.g., Quality Fishing Rod"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tool Type</label>
              <select
                value={newToolType}
                onChange={(e) => setNewToolType(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {Object.entries(GATHERING_TOOL_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label as string}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Allowed Modes</label>
            <div className="flex flex-wrap gap-2">
              {GATHERING_MODES.map(mode => (
                <label key={mode} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={newToolModes.includes(mode)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewToolModes([...newToolModes, mode]);
                      } else {
                        setNewToolModes(newToolModes.filter(m => m !== mode));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  {mode}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Allowed Methods (empty = all)</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(FISHING_METHODS).map(method => (
                <label key={method} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={newToolMethods.includes(method)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewToolMethods([...newToolMethods, method]);
                      } else {
                        setNewToolMethods(newToolMethods.filter(m => m !== method));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  {method}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Skill Bonus</label>
              <input
                type="number"
                value={newToolSkillBonus}
                onChange={(e) => setNewToolSkillBonus(e.target.value)}
                placeholder="e.g., +1"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Durability (optional)</label>
              <input
                type="number"
                value={newToolDurability}
                onChange={(e) => setNewToolDurability(e.target.value)}
                placeholder="Uses before breaking"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <input
              value={newToolNotes}
              onChange={(e) => setNewToolNotes(e.target.value)}
              placeholder="Special properties..."
              className="w-full bg-gray-600 px-3 py-2 rounded"
            />
          </div>

          {newToolModes.includes('Foraging') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-gray-400">Yield Bonuses (Foraging)</label>
                <button
                  type="button"
                  onClick={() => setNewToolYieldBonuses([...newToolYieldBonuses, { typeId: '', dice: '1' }])}
                  className="text-xs bg-blue-600 px-2 py-1 rounded"
                >
                  <Plus size={12} className="inline" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {newToolYieldBonuses.map((yb, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={yb.typeId}
                      onChange={(e) => {
                        const updated = [...newToolYieldBonuses];
                        updated[idx].typeId = e.target.value;
                        setNewToolYieldBonuses(updated);
                      }}
                      className="flex-1 bg-gray-600 px-2 py-1 rounded text-sm"
                    >
                      <option value="">Select type...</option>
                      <optgroup label="Food Types">
                        {foodTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Material Types">
                        {materialTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </optgroup>
                    </select>
                    <input
                      type="number"
                      value={yb.dice}
                      onChange={(e) => {
                        const updated = [...newToolYieldBonuses];
                        updated[idx].dice = e.target.value;
                        setNewToolYieldBonuses(updated);
                      }}
                      placeholder="Dice"
                      className="w-16 bg-gray-600 px-2 py-1 rounded text-sm text-center"
                    />
                    <span className="text-xs text-gray-400">d</span>
                    <button
                      type="button"
                      onClick={() => setNewToolYieldBonuses(newToolYieldBonuses.filter((_, i) => i !== idx))}
                      className="text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {newToolYieldBonuses.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No yield bonuses configured</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={addTool} className="flex-1 bg-green-600 px-4 py-2 rounded">
              <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
            </button>
            <button onClick={resetForm} className="bg-red-600 px-4 py-2 rounded">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tools.length === 0 ? (
          <p className="text-gray-500 italic">No tools defined. Add fishing rods, nets, etc.</p>
        ) : (
          tools.map(t => {
            const yieldBonuses = t.bonuses?.filter(b => b.type === 'yield_bonus') || [];
            return (
              <div key={t.id} className="bg-gray-700 p-3 rounded">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div>
                      <span className="font-medium">{t.name}</span>
                      <span className="text-sm text-gray-400 ml-2">({(GATHERING_TOOL_TYPES as Record<string, string>)[t.toolType] || t.toolType})</span>
                      {t.bonuses?.find(b => b.type === 'skill_bonus')?.value && (t.bonuses?.find(b => b.type === 'skill_bonus')?.value || 0) > 0 && (
                        <span className="text-green-400 ml-2">+{t.bonuses?.find(b => b.type === 'skill_bonus')?.value}</span>
                      )}
                    </div>
                    {yieldBonuses.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        Yield bonuses: {yieldBonuses.map(yb => `${yb.typeId || yb.categoryId}: +${yb.dice}d`).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editTool(t)} className="text-blue-400">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => onDelete('tool', t.id, t.name)} className="text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
