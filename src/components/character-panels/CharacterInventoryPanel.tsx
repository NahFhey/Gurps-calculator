import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Package } from 'lucide-react';
import { useCampaignStore } from '../../state/campaignStore';
import type { Character, Inventory, ItemInstance, ToolTemplate } from '../../types/campaign';

interface CharacterInventoryPanelProps {
  character: Character;
}

export function CharacterInventoryPanel({ character }: CharacterInventoryPanelProps) {
  const { state, actions } = useCampaignStore();
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newCurrencyKey, setNewCurrencyKey] = useState('');
  const [newCurrencyAmount, setNewCurrencyAmount] = useState(0);

  const toolTemplates = state.entities.toolTemplates as Record<string, ToolTemplate>;

  // Find the character's inventory
  const characterInventory = useMemo(() => {
    return Object.values(state.entities.inventories).find(
      (inv) => inv.ownerType === 'character' && inv.ownerId === character.id
    ) as Inventory | undefined;
  }, [state.entities.inventories, character.id]);

  const handleBack = () => {
    actions.setCharacterPanelView('sheet');
  };

  // Create inventory if it doesn't exist
  const handleCreateInventory = useCallback(() => {
    const newInventory: Inventory = {
      id: `inv-${character.id}`,
      ownerType: 'character',
      ownerId: character.id,
      currency: {},
      items: [],
      tools: [],
      materials: [],
      food: [],
    };
    actions.addInventory(newInventory);
  }, [actions, character.id]);

  // Add item
  const handleAddItem = useCallback(() => {
    if (!characterInventory || !newItemName.trim()) return;

    const newItem: ItemInstance = {
      id: `item-${Date.now()}`,
      name: newItemName.trim(),
      quantity: newItemQuantity,
    };

    actions.updateInventory(characterInventory.id, {
      items: [...characterInventory.items, newItem],
    });

    setNewItemName('');
    setNewItemQuantity(1);
  }, [actions, characterInventory, newItemName, newItemQuantity]);

  // Remove item
  const handleRemoveItem = useCallback((itemId: string) => {
    if (!characterInventory) return;

    actions.updateInventory(characterInventory.id, {
      items: characterInventory.items.filter((item) => item.id !== itemId),
    });
  }, [actions, characterInventory]);

  // Add currency
  const handleAddCurrency = useCallback(() => {
    if (!characterInventory || !newCurrencyKey.trim() || newCurrencyAmount <= 0) return;

    const existingAmount = characterInventory.currency[newCurrencyKey] || 0;
    actions.updateInventory(characterInventory.id, {
      currency: {
        ...characterInventory.currency,
        [newCurrencyKey.trim()]: existingAmount + newCurrencyAmount,
      },
    });

    setNewCurrencyKey('');
    setNewCurrencyAmount(0);
  }, [actions, characterInventory, newCurrencyKey, newCurrencyAmount]);

  // Update currency amount
  const handleUpdateCurrency = useCallback((key: string, amount: number) => {
    if (!characterInventory) return;

    if (amount <= 0) {
      // Remove currency if 0 or negative
      const rest = { ...characterInventory.currency };
      delete rest[key];
      actions.updateInventory(characterInventory.id, {
        currency: rest,
      });
    } else {
      actions.updateInventory(characterInventory.id, {
        currency: {
          ...characterInventory.currency,
          [key]: amount,
        },
      });
    }
  }, [actions, characterInventory]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
            title="Back to character sheet"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Package size={20} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-gray-100">
              {character.name}'s Inventory
            </h2>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!characterInventory ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">
              {character.name} doesn't have a personal inventory yet.
            </p>
            <button
              onClick={handleCreateInventory}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium"
            >
              Create Inventory
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Items Section */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Items</h3>

              {/* Add Item Form */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Item name"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                />
                <input
                  type="number"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 text-center"
                />
                <button
                  onClick={handleAddItem}
                  disabled={!newItemName.trim()}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Items List */}
              {characterInventory.items.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No items</p>
              ) : (
                <ul className="space-y-1">
                  {characterInventory.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-gray-700/50"
                    >
                      <span className="text-gray-200">
                        {item.name}
                        <span className="text-gray-400 ml-2">x{item.quantity}</span>
                      </span>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 hover:bg-gray-600 rounded text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tools Section */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Tools</h3>
              {characterInventory.tools.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No tools</p>
              ) : (
                <ul className="space-y-1">
                  {characterInventory.tools.map((tool) => {
                    const template = toolTemplates[tool.templateId];
                    return (
                      <li
                        key={tool.toolId}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-gray-700/50"
                      >
                        <span className="text-gray-200">
                          {template?.name ?? 'Unknown Tool'}
                          <span className="text-gray-400 ml-2">({tool.conditionId})</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Currency Section */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Currency</h3>

              {/* Add Currency Form */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newCurrencyKey}
                  onChange={(e) => setNewCurrencyKey(e.target.value)}
                  placeholder="Currency type (e.g., Gold)"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100"
                />
                <input
                  type="number"
                  value={newCurrencyAmount}
                  onChange={(e) => setNewCurrencyAmount(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 text-center"
                />
                <button
                  onClick={handleAddCurrency}
                  disabled={!newCurrencyKey.trim() || newCurrencyAmount <= 0}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Currency List */}
              {Object.keys(characterInventory.currency).length === 0 ? (
                <p className="text-gray-500 text-sm italic">No currency</p>
              ) : (
                <ul className="space-y-1">
                  {Object.entries(characterInventory.currency).map(([key, amount]) => (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-gray-700/50"
                    >
                      <span className="text-gray-200">{key}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => handleUpdateCurrency(key, parseInt(e.target.value) || 0)}
                          min={0}
                          className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 text-right"
                        />
                        <button
                          onClick={() => handleUpdateCurrency(key, 0)}
                          className="p-1 hover:bg-gray-600 rounded text-red-400"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
