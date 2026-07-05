/**
 * LootDistribution Component (Phase 11c)
 *
 * Post-combat loot management:
 * - Add loot items (currency, materials, food, equipment, other)
 * - Distribute to party inventory or individual characters
 * - Summary of distributed loot
 */

import { useState, ChangeEvent } from 'react';
import { Plus, Package, Coins, Trash2, Check, Users, User } from 'lucide-react';
import { useCombatStore } from '../../hooks/useCombatStore';
import { useCampaignStore } from '../../state/campaignStore';
import type { LootItem, LootDistributionEntry } from '../../types/combatTracker';
import type { Character, AcquiredItem, InventoryOwner } from '../../types/campaign';

// ============================================================================
// HELPERS
// ============================================================================

let lootIdCounter = 0;
function generateLootId(): string {
  return `loot_${Date.now()}_${++lootIdCounter}`;
}

const LOOT_TYPES = [
  { value: 'currency', label: 'Currency', icon: Coins },
  { value: 'material', label: 'Material', icon: Package },
  { value: 'food', label: 'Food', icon: Package },
  { value: 'equipment', label: 'Equipment', icon: Package },
  { value: 'other', label: 'Other', icon: Package }
] as const;

// ============================================================================
// COMPONENTS
// ============================================================================

interface LootDistributionProps {
  /** Called when the user finishes the loot flow */
  onComplete: () => void;
}

function LootItemRow({
  item,
  partyCharacters,
  distribution,
  onUpdateDistribution,
  onRemove
}: {
  item: LootItem;
  partyCharacters: Character[];
  distribution: LootDistributionEntry | undefined;
  onUpdateDistribution: (lootItemId: string, targetId: string, quantity: number) => void;
  onRemove: (id: string) => void;
}) {
  const targetId = distribution?.targetId || 'party';
  const TypeIcon = LOOT_TYPES.find(t => t.value === item.type)?.icon || Package;

  return (
    <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
      <TypeIcon size={18} className="text-gray-400 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{item.name}</div>
        <div className="text-xs text-gray-400">
          {item.type}{item.materialType ? ` (${item.materialType})` : ''} × {item.quantity}
          {item.value != null && ` — ${item.value} cp`}
        </div>
        {item.notes && (
          <div className="text-xs text-gray-500 mt-0.5">{item.notes}</div>
        )}
      </div>

      {/* Target selector */}
      <select
        value={targetId}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          onUpdateDistribution(item.id, e.target.value, item.quantity)
        }
        className="px-2 py-1 bg-gray-700 rounded text-sm w-36"
      >
        <option value="party">Party Pool</option>
        {partyCharacters.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <button
        onClick={() => onRemove(item.id)}
        className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
        title="Remove loot item"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export default function LootDistribution({ onComplete }: LootDistributionProps) {
  const { partyCharacters } = useCombatStore();
  const { state, actions: campaignActions } = useCampaignStore();
  const materialTypes = state.entities.materialTypes ?? [];

  const [lootItems, setLootItems] = useState<LootItem[]>([]);
  const [distributions, setDistributions] = useState<Record<string, LootDistributionEntry>>({});

  // New item form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<LootItem['type']>('currency');
  const [newMaterialType, setNewMaterialType] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newValue, setNewValue] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [distributed, setDistributed] = useState(false);

  const handleAddItem = () => {
    if (!newName.trim()) return;

    const item: LootItem = {
      id: generateLootId(),
      name: newName.trim(),
      type: newType,
      quantity: newQuantity,
      value: newValue ? parseInt(newValue) : undefined,
      notes: newNotes.trim() || undefined,
      // Only meaningful for materials; empty string means "untyped loot material"
      materialType: newType === 'material' && newMaterialType ? newMaterialType : undefined
    };

    setLootItems(prev => [...prev, item]);
    // Default distribution: party pool
    setDistributions(prev => ({
      ...prev,
      [item.id]: { lootItemId: item.id, targetId: 'party', quantity: newQuantity }
    }));

    // Reset form
    setNewName('');
    setNewQuantity(1);
    setNewValue('');
    setNewNotes('');
    setNewMaterialType('');
  };

  const handleUpdateDistribution = (lootItemId: string, targetId: string, quantity: number) => {
    setDistributions(prev => ({
      ...prev,
      [lootItemId]: { lootItemId, targetId, quantity }
    }));
  };

  const handleRemoveItem = (id: string) => {
    setLootItems(prev => prev.filter(i => i.id !== id));
    setDistributions(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleDistribute = () => {
    // Inventory bus (Phase 12a.5): commit each loot item to its assigned owner.
    // Assignments are final at this point, so we acquire directly with the
    // recipient as owner (equivalent to acquire-to-party + retag-to-recipient).
    for (const item of lootItems) {
      const dist = distributions[item.id];
      const owner: InventoryOwner = dist?.targetId && dist.targetId !== 'party'
        ? dist.targetId
        : 'party';

      let acquired: AcquiredItem;
      switch (item.type) {
        case 'currency':
          acquired = {
            kind: 'currency',
            currencyKey: item.name.trim().toLowerCase(),
            amount: item.quantity
          };
          break;
        case 'material':
          acquired = {
            kind: 'material',
            id: item.id,
            name: item.name,
            // Reference a real MaterialType when one was picked; otherwise
            // fall back to the untyped 'loot' bucket (followup #9).
            type: item.materialType ?? 'loot',
            quantity: item.quantity,
            notes: item.notes
          };
          break;
        case 'food':
          acquired = {
            kind: 'food',
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            notes: item.notes
          };
          break;
        case 'equipment':
        case 'other':
        default:
          acquired = {
            kind: item.type === 'equipment' ? 'equipment' : 'other',
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            value: item.value,
            notes: item.notes
          };
          break;
      }

      campaignActions.acquireItem(acquired, owner, 'loot');
    }

    setDistributed(true);
  };

  // Summary stats
  const totalValue = lootItems.reduce((sum, i) => sum + (i.value ?? 0) * i.quantity, 0);
  const partyItems = lootItems.filter(i => distributions[i.id]?.targetId === 'party');
  const characterItems = lootItems.filter(i => distributions[i.id]?.targetId !== 'party');

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Package size={24} className="text-yellow-400" />
          Loot Distribution
        </h2>
        {lootItems.length > 0 && totalValue > 0 && (
          <div className="text-sm text-gray-400">Total value: {totalValue} cp</div>
        )}
      </div>

      {/* Add new loot item */}
      {!distributed && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Add Loot</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
              placeholder="Item name"
              className="px-3 py-2 bg-gray-700 rounded text-sm"
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
            />
            <select
              value={newType}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewType(e.target.value as LootItem['type'])}
              className="px-3 py-2 bg-gray-700 rounded text-sm"
            >
              {LOOT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={newQuantity}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewQuantity(parseInt(e.target.value) || 1)}
              min={1}
              placeholder="Qty"
              className="px-3 py-2 bg-gray-700 rounded text-sm"
            />
            <input
              type="number"
              value={newValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewValue(e.target.value)}
              placeholder="Value (cp)"
              className="px-3 py-2 bg-gray-700 rounded text-sm"
            />
          </div>
          {newType === 'material' && (
            <select
              value={newMaterialType}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewMaterialType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded text-sm"
              title="Material type (optional)"
            >
              <option value="">Untyped loot material</option>
              {materialTypes.map(mt => (
                <option key={mt.name} value={mt.name}>{mt.name}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={newNotes}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 bg-gray-700 rounded text-sm"
          />
          <button
            onClick={handleAddItem}
            disabled={!newName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>
      )}

      {/* Loot list */}
      {lootItems.length > 0 && (
        <div className="space-y-2">
          {lootItems.map(item => (
            <LootItemRow
              key={item.id}
              item={item}
              partyCharacters={partyCharacters as Character[]}
              distribution={distributions[item.id]}
              onUpdateDistribution={handleUpdateDistribution}
              onRemove={handleRemoveItem}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {lootItems.length === 0 && !distributed && (
        <div className="text-center text-gray-400 py-8 bg-gray-800 rounded-lg">
          No loot items added yet. Add items above or skip to finish.
        </div>
      )}

      {/* Distribution summary */}
      {distributed && (
        <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-300 font-semibold">
            <Check size={18} />
            Loot Distributed
          </div>
          {partyItems.length > 0 && (
            <div className="text-sm">
              <span className="flex items-center gap-1 text-gray-300">
                <Users size={14} /> Party Pool:
              </span>
              <div className="ml-5 text-gray-400">
                {partyItems.map(i => `${i.name} × ${i.quantity}`).join(', ')}
              </div>
            </div>
          )}
          {characterItems.length > 0 && characterItems.map(item => {
            const dist = distributions[item.id];
            const char = (partyCharacters as Character[]).find(c => c.id === dist?.targetId);
            return (
              <div key={item.id} className="text-sm">
                <span className="flex items-center gap-1 text-gray-300">
                  <User size={14} /> {char?.name || 'Unknown'}:
                </span>
                <div className="ml-5 text-gray-400">
                  {item.name} × {item.quantity}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-4 border-t border-gray-700">
        {!distributed && lootItems.length > 0 && (
          <button
            onClick={handleDistribute}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
          >
            <Check size={18} />
            Distribute
          </button>
        )}
        <button
          onClick={onComplete}
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
        >
          {distributed || lootItems.length === 0 ? 'Finish' : 'Skip Loot'}
        </button>
      </div>
    </div>
  );
}
