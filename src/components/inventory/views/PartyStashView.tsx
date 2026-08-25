import { useMemo, useState } from 'react';
import type { Character, Inventory, ToolTemplate } from '../../../types/campaign';
import { getInventoryLabel } from '../labels';
import type { TransferState } from '../types';
import { TransferConsole } from './TransferConsole';

export interface PartyStashViewProps {
  inventories: Inventory[];
  characters: Record<string, Character>;
  toolTemplates: Record<string, ToolTemplate>;
  transferState: TransferState | null;
  onTransferStateChange: (state: TransferState | null) => void;
  onConfirmTransfer: () => void;
  onGiveItem: (inventoryId: string, itemId: string, characterId: string) => void;
}

interface SelectedItemRef {
  inventoryId: string;
  itemId: string;
}

export function PartyStashView({
  inventories,
  characters,
  toolTemplates,
  transferState,
  onTransferStateChange,
  onConfirmTransfer,
  onGiveItem,
}: PartyStashViewProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedItemRef[]>([]);
  const [bulkCharacterChoice, setBulkCharacterChoice] = useState<string | null>(null);
  const partyInventories = inventories.filter((inventory) => inventory.ownerType === 'party');
  const sortedCharacters = Object.values(characters).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const selectedInventoryItems = useMemo(
    () => selectedItems.flatMap((selection) => {
      const inventory = partyInventories.find(candidate => candidate.id === selection.inventoryId);
      const item = inventory?.items.find(candidate => candidate.id === selection.itemId);
      return item ? [{ inventoryId: selection.inventoryId, item }] : [];
    }),
    [partyInventories, selectedItems]
  );
  const bulkCrafterId = useMemo(() => {
    if (selectedInventoryItems.length !== selectedItems.length || selectedInventoryItems.length === 0) {
      return '';
    }
    const firstCrafterId = selectedInventoryItems[0].item.crafterId;
    if (
      !firstCrafterId ||
      !characters[firstCrafterId] ||
      !selectedInventoryItems.every(({ item }) =>
        item.source === 'crafting' && item.crafterId === firstCrafterId
      )
    ) {
      return '';
    }
    return firstCrafterId;
  }, [characters, selectedInventoryItems, selectedItems.length]);
  const bulkCharacterId = bulkCharacterChoice ?? bulkCrafterId;

  function setItemSelected(inventoryId: string, itemId: string, checked: boolean) {
    setSelectedItems(current => {
      if (checked) {
        return current.some(item => item.inventoryId === inventoryId && item.itemId === itemId)
          ? current
          : [...current, { inventoryId, itemId }];
      }
      return current.filter(item => item.inventoryId !== inventoryId || item.itemId !== itemId);
    });
    setBulkCharacterChoice(null);
  }

  function clearSelection() {
    setSelectedItems([]);
    setBulkCharacterChoice(null);
  }

  function giveSelectedItems() {
    if (!bulkCharacterId) return;
    selectedInventoryItems.forEach(({ inventoryId, item }) => {
      onGiveItem(inventoryId, item.id, bulkCharacterId);
    });
    clearSelection();
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {selectedItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
            <span>{selectedItems.length} selected — Give to</span>
            <select
              aria-label="Give selected items to character"
              value={bulkCharacterId}
              onChange={(event) => setBulkCharacterChoice(event.target.value)}
              className="max-w-40 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
            >
              <option value="">Give to…</option>
              {sortedCharacters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={giveSelectedItems}
              disabled={!bulkCharacterId}
              className="rounded-full bg-indigo-500 px-3 py-1 text-xs text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Give
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600"
            >
              Clear
            </button>
          </div>
        )}
        {partyInventories.map((inventory) => (
          <div
            key={inventory.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {getInventoryLabel(inventory, characters)}
              </h3>
              <span className="text-xs text-slate-400">{inventory.id}</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-300">Items</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-200">
                  {inventory.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.name}`}
                          checked={selectedItems.some(selection =>
                            selection.inventoryId === inventory.id && selection.itemId === item.id
                          )}
                          onChange={(event) =>
                            setItemSelected(inventory.id, item.id, event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500"
                        />
                        <span>
                          {item.name} <span className="text-slate-400">x{item.quantity}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <select
                          aria-label={`Give ${item.name} to character`}
                          value={
                            item.source === 'crafting' && item.crafterId && characters[item.crafterId]
                              ? item.crafterId
                              : ''
                          }
                          onChange={(event) => {
                            if (event.target.value) {
                              onGiveItem(inventory.id, item.id, event.target.value);
                            }
                          }}
                          className="max-w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                        >
                          <option value="">Give to…</option>
                          {sortedCharacters.map((character) => (
                            <option key={character.id} value={character.id}>
                              {character.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            onTransferStateChange({
                              type: 'item',
                              itemId: item.id,
                              sourceInventoryId: inventory.id,
                              targetInventoryId: '',
                            })
                          }
                          className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
                        >
                          Transfer
                        </button>
                      </span>
                    </li>
                  ))}
                  {inventory.items.length === 0 && (
                    <li className="text-xs text-slate-500">No items.</li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-300">Tools</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-200">
                  {inventory.tools.map((tool) => {
                    const template = toolTemplates[tool.templateId];
                    return (
                      <li
                        key={tool.toolId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                      >
                        <span>
                          {template?.name ?? 'Unknown Tool'}
                          <span className="text-slate-400"> ({tool.conditionId})</span>
                        </span>
                        <button
                          onClick={() =>
                            onTransferStateChange({
                              type: 'tool',
                              toolId: tool.toolId,
                              sourceInventoryId: inventory.id,
                              targetInventoryId: '',
                            })
                          }
                          className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
                        >
                          Transfer
                        </button>
                      </li>
                    );
                  })}
                  {inventory.tools.length === 0 && (
                    <li className="text-xs text-slate-500">No tools.</li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-300">Currency</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-200">
                  {Object.entries(inventory.currency).map(([currencyKey, amount]) => (
                    <li
                      key={currencyKey}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                    >
                      <span>
                        {currencyKey}: <span className="text-slate-400">{amount}</span>
                      </span>
                      <button
                        onClick={() =>
                          onTransferStateChange({
                            type: 'currency',
                            currencyKey,
                            amount: '',
                            sourceInventoryId: inventory.id,
                            targetInventoryId: '',
                          })
                        }
                        className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
                      >
                        Transfer
                      </button>
                    </li>
                  ))}
                  {Object.keys(inventory.currency).length === 0 && (
                    <li className="text-xs text-slate-500">No currency.</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-300">Materials</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-200">
                  {inventory.materials.map((material) => (
                    <li key={material.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <span>{material.name} <span className="text-slate-400">× {material.quantity}</span></span>
                      <button
                        onClick={() => onTransferStateChange({
                          type: 'material', entryId: material.id, quantity: '',
                          sourceInventoryId: inventory.id, targetInventoryId: '',
                        })}
                        className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
                      >Transfer</button>
                    </li>
                  ))}
                  {inventory.materials.length === 0 && <li className="text-xs text-slate-500">No materials.</li>}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-300">Food</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-200">
                  {inventory.food.map((food) => (
                    <li key={food.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <span>{food.name} <span className="text-slate-400">× {food.quantity}</span></span>
                      <button
                        onClick={() => onTransferStateChange({
                          type: 'food', entryId: food.id, quantity: '',
                          sourceInventoryId: inventory.id, targetInventoryId: '',
                        })}
                        className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
                      >Transfer</button>
                    </li>
                  ))}
                  {inventory.food.length === 0 && <li className="text-xs text-slate-500">No food.</li>}
                </ul>
              </div>
            </div>
          </div>
        ))}
        {partyInventories.length === 0 && (
          <div className="text-center text-slate-400 py-8">
            No party stash found.
          </div>
        )}
      </div>

      <TransferConsole
        inventories={inventories}
        characters={characters}
        transferState={transferState}
        onTransferStateChange={onTransferStateChange}
        onConfirmTransfer={onConfirmTransfer}
      />
    </section>
  );
}
