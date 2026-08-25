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

export function PartyStashView({
  inventories,
  characters,
  toolTemplates,
  transferState,
  onTransferStateChange,
  onConfirmTransfer,
  onGiveItem,
}: PartyStashViewProps) {
  const partyInventories = inventories.filter((inventory) => inventory.ownerType === 'party');
  const sortedCharacters = Object.values(characters).sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
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
                      <span>
                        {item.name} <span className="text-slate-400">x{item.quantity}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <select
                          aria-label={`Give ${item.name} to character`}
                          value=""
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
