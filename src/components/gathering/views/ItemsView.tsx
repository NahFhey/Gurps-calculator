import { useState } from 'react';
import { Plus, Save, X, Trash2, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import { FORAGING_RARITIES } from '../../../constants';
import type { ItemsViewProps, GatheringItemExtended } from '../../../types/gathering';

/**
 * ItemsView - Manages forageable items
 *
 * Allows creating, editing, and deleting forageable items with their
 * yields, rarity, and inventory type (food or material).
 */
export function ItemsView({ items, foodTypes, materialTypes, saveItems, onDelete }: ItemsViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemInventoryKind, setNewItemInventoryKind] = useState<'food' | 'material'>('food');
  const [newItemTypeId, setNewItemTypeId] = useState('');
  const [newItemYieldFormula, setNewItemYieldFormula] = useState('3d');
  const [newItemRarity, setNewItemRarity] = useState('Common');
  const [newItemDescription, setNewItemDescription] = useState('');

  function addItem() {
    if (!newItemName.trim()) {
      alert('Enter item name');
      return;
    }

    const entryData: Omit<GatheringItemExtended, 'id'> = {
      name: newItemName.trim(),
      inventoryKind: newItemInventoryKind,
      typeId: newItemTypeId.trim() || newItemName.trim().toLowerCase().replace(/\s+/g, '_'),
      yieldFormula: newItemYieldFormula || '3d',
      rarity: newItemRarity,
      description: newItemDescription.trim()
    };

    if (editingId) {
      saveItems(items.map(i => i.id === editingId ? { ...i, ...entryData } : i));
    } else {
      saveItems([...items, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetForm();
  }

  function editItem(i: GatheringItemExtended) {
    setEditingId(i.id);
    setNewItemName(i.name);
    setNewItemInventoryKind(i.inventoryKind || 'food');
    setNewItemTypeId(i.typeId || '');
    setNewItemYieldFormula(i.yieldFormula || '3d');
    setNewItemRarity(i.rarity || 'Common');
    setNewItemDescription(i.description || '');
    setShowAdd(true);
  }

  function resetForm() {
    setEditingId(null);
    setNewItemName('');
    setNewItemInventoryKind('food');
    setNewItemTypeId('');
    setNewItemYieldFormula('3d');
    setNewItemRarity('Common');
    setNewItemDescription('');
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-bold">Forageable Items ({items.length})</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
          <Plus size={16} className="inline" /> Add Item
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name *</label>
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Tamrya Berries"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Yield Formula</label>
              <input
                value={newItemYieldFormula}
                onChange={(e) => setNewItemYieldFormula(e.target.value)}
                placeholder="e.g., 3d+1"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Inventory Type</label>
              <select
                value={newItemInventoryKind}
                onChange={(e) => setNewItemInventoryKind(e.target.value as 'food' | 'material')}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                <option value="food">Food</option>
                <option value="material">Material</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type ID</label>
              {newItemInventoryKind === 'food' ? (
                <select
                  value={newItemTypeId}
                  onChange={(e) => setNewItemTypeId(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="">Auto-generate from name</option>
                  {foodTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={newItemTypeId}
                  onChange={(e) => setNewItemTypeId(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="">Auto-generate from name</option>
                  {materialTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rarity</label>
              <select
                value={newItemRarity}
                onChange={(e) => setNewItemRarity(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              >
                {Object.entries(FORAGING_RARITIES).map(([key, data]) => (
                  <option key={key} value={key}>{(data as { label: string; penalty: number }).label} ({(data as { label: string; penalty: number }).penalty})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <input
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                placeholder="Brief description..."
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={addItem} className="flex-1 bg-green-600 px-4 py-2 rounded">
              <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
            </button>
            <button onClick={resetForm} className="bg-red-600 px-4 py-2 rounded">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-gray-500 italic">No items defined. Add specific forageable items!</p>
        ) : (
          items.map(i => {
            const rarityData = FORAGING_RARITIES[i.rarity as keyof typeof FORAGING_RARITIES];
            return (
              <div key={i.id} className="bg-gray-700 rounded">
                <div
                  className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
                  onClick={() => setExpanded(prev => ({ ...prev, [`item-${i.id}`]: !prev[`item-${i.id}`] }))}
                >
                  <span>{expanded[`item-${i.id}`] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                  <span className="flex-1 font-medium">{i.name}</span>
                  <span className="text-sm text-gray-400">{i.yieldFormula}</span>
                  <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                    {i.inventoryKind || 'food'}
                  </span>
                  <span className="text-xs bg-purple-600 px-2 py-1 rounded">
                    {rarityData?.label || i.rarity}
                  </span>
                </div>
                {expanded[`item-${i.id}`] && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-600 pt-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-400">Type ID:</span> {i.typeId || 'N/A'}</div>
                      <div><span className="text-gray-400">Yield:</span> {i.yieldFormula}</div>
                      <div><span className="text-gray-400">Inventory:</span> {i.inventoryKind || 'food'}</div>
                      <div><span className="text-gray-400">Rarity:</span> {rarityData?.label || i.rarity} ({rarityData?.penalty || 0})</div>
                    </div>
                    {i.description && (
                      <div className="text-sm text-gray-400">{i.description}</div>
                    )}
                    <div className="flex gap-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); editItem(i); }}
                        className="text-blue-400 text-sm"
                      >
                        <Edit2 size={14} className="inline mr-1" /> Edit
                      </button>
                      <button
                        onClick={() => onDelete('item', i.id, i.name)}
                        className="text-red-400 text-sm"
                      >
                        <Trash2 size={14} className="inline mr-1" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
