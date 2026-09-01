import { useState } from 'react';
import { Plus, Save, X, Trash2, Edit2 } from 'lucide-react';
import { BAIT_TAGS } from '../../../constants';
import type { BaitViewProps, GatheringBaitExtended } from '../../../types/gathering';

/**
 * BaitView - Manages fishing bait
 *
 * Allows creating, editing, and deleting bait items that attract
 * specific species and provide roll bonuses.
 */
export function BaitView({ bait, species, saveBait, onDelete }: BaitViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [newBaitName, setNewBaitName] = useState('');
  const [newBaitTags, setNewBaitTags] = useState<string[]>([]);
  const [newBaitAttracts, setNewBaitAttracts] = useState<string[]>([]);
  const [newBaitQuantity, setNewBaitQuantity] = useState('10');
  const [newBaitRollBonus, setNewBaitRollBonus] = useState('1');

  function addBait() {
    if (!newBaitName.trim()) {
      alert('Enter bait name');
      return;
    }

    if (newBaitAttracts.length === 0) {
      alert('Bait must attract at least one species');
      return;
    }

    const entryData: Omit<GatheringBaitExtended, 'id'> = {
      name: newBaitName.trim(),
      consumableType: 'bait',
      baitTags: newBaitTags,
      attractsSpeciesIds: newBaitAttracts,
      quantity: parseInt(newBaitQuantity) || 10,
      rollBonus: parseInt(newBaitRollBonus) || 1
    };

    if (editingId) {
      saveBait(bait.map(b => b.id === editingId ? { ...b, ...entryData } : b));
    } else {
      saveBait([...bait, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetForm();
  }

  function editBaitItem(b: GatheringBaitExtended) {
    setEditingId(b.id);
    setNewBaitName(b.name);
    setNewBaitTags(b.baitTags || []);
    setNewBaitAttracts(b.attractsSpeciesIds || []);
    setNewBaitQuantity(String(b.quantity || 10));
    setNewBaitRollBonus(String(b.rollBonus || 1));
    setShowAdd(true);
  }

  function resetForm() {
    setEditingId(null);
    setNewBaitName('');
    setNewBaitTags([]);
    setNewBaitAttracts([]);
    setNewBaitQuantity('10');
    setNewBaitRollBonus('1');
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-bold">Bait ({bait.length})</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-success-600 px-3 py-1 rounded text-sm">
          <Plus size={16} className="inline" /> Add Bait
        </button>
      </div>

      {showAdd && (
        <div className="bg-surface-2 p-4 rounded mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1">Name *</label>
              <input
                value={newBaitName}
                onChange={(e) => setNewBaitName(e.target.value)}
                placeholder="e.g., Glowing Worms"
                className="w-full bg-surface-3 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">Quantity</label>
              <input
                type="number"
                value={newBaitQuantity}
                onChange={(e) => setNewBaitQuantity(e.target.value)}
                className="w-full bg-surface-3 px-3 py-2 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-fg-muted mb-1">Bait Tags</label>
            <div className="flex flex-wrap gap-2">
              {BAIT_TAGS.map(tag => (
                <label key={tag} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={newBaitTags.includes(tag)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewBaitTags([...newBaitTags, tag]);
                      } else {
                        setNewBaitTags(newBaitTags.filter(t => t !== tag));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  {tag}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-fg-muted mb-1">Attracts Species (required) *</label>
            <select
              multiple
              value={newBaitAttracts}
              onChange={(e) => setNewBaitAttracts(Array.from(e.target.selectedOptions, opt => opt.value))}
              className="w-full bg-surface-3 px-3 py-2 rounded h-24"
            >
              {species.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-xs text-fg-faint mt-1">Hold Ctrl/Cmd to select multiple. Bait must attract at least one species.</p>
          </div>

          <div className="w-1/3">
            <label className="block text-xs text-fg-muted mb-1">Roll Bonus (when used on random catch)</label>
            <input
              type="number"
              value={newBaitRollBonus}
              onChange={(e) => setNewBaitRollBonus(e.target.value)}
              min="0"
              max="10"
              className="w-full bg-surface-3 px-3 py-2 rounded"
            />
            <p className="text-xs text-fg-faint mt-1">Added to catch table roll when line fishing</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={addBait} className="flex-1 bg-success-600 px-4 py-2 rounded">
              <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
            </button>
            <button onClick={resetForm} className="bg-danger-600 px-4 py-2 rounded">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {bait.length === 0 ? (
          <p className="text-fg-faint italic">No bait defined. Add some for fishing bonuses.</p>
        ) : (
          bait.map(b => (
            <div key={b.id} className="bg-surface-2 p-3 rounded flex justify-between items-center">
              <div>
                <span className="font-medium">{b.name}</span>
                <span className="text-sm text-fg-muted ml-2">({b.quantity || 0} available)</span>
                {b.rollBonus > 0 && (
                  <span className="text-success-400 ml-2">+{b.rollBonus} to catch roll</span>
                )}
                {b.baitTags?.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {b.baitTags.map(tag => (
                      <span key={tag} className="text-xs bg-surface-3 px-2 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={b.quantity || 0}
                  onChange={(e) => {
                    saveBait(bait.map(x => x.id === b.id ? { ...x, quantity: parseInt(e.target.value) || 0 } : x));
                  }}
                  className="w-20 bg-surface-3 px-2 py-1 rounded"
                />
                <button onClick={() => editBaitItem(b)} className="text-accent-400">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => onDelete('bait', b.id, b.name)} className="text-danger-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
