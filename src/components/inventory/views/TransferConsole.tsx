import { ArrowRight } from 'lucide-react';
import type { Character, Inventory } from '../../../types/campaign';
import { getInventoryLabel } from '../labels';
import type { TransferState } from '../types';

export interface TransferConsoleProps {
  inventories: Inventory[];
  characters: Record<string, Character>;
  transferState: TransferState | null;
  onTransferStateChange: (state: TransferState | null) => void;
  onConfirmTransfer: () => void;
}

export function TransferConsole({
  inventories,
  characters,
  transferState,
  onTransferStateChange,
  onConfirmTransfer,
}: TransferConsoleProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 h-fit">
      <h3 className="text-lg font-semibold text-white">Transfer Console</h3>
      {!transferState && (
        <p className="mt-3 text-sm text-slate-400">
          Select an item, tool, material, food, or currency to initiate a transfer between inventories.
        </p>
      )}
      {transferState && (
        <div className="mt-4 space-y-4 text-sm text-slate-200">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
            <p className="text-xs uppercase text-slate-400">Source</p>
            <p>{getInventoryLabel(
              inventories.find(inv => inv.id === transferState.sourceInventoryId),
              characters
            )}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
            <p className="text-xs uppercase text-slate-400">Transferring</p>
            <p className="flex items-center gap-2">
              {transferState.type === 'item' && 'Item'}
              {transferState.type === 'tool' && 'Tool'}
              {transferState.type === 'currency' && `Currency: ${transferState.currencyKey}`}
              {transferState.type === 'material' && 'Material'}
              {transferState.type === 'food' && 'Food'}
              <ArrowRight size={14} className="text-slate-400" />
            </p>
          </div>
          <label className="flex flex-col gap-2">
            Target Inventory
            <select
              value={transferState.targetInventoryId}
              onChange={(event) =>
                onTransferStateChange({
                  ...transferState,
                  targetInventoryId: event.target.value,
                })
              }
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            >
              <option value="">Select destination</option>
              {inventories
                .filter((inv) => inv.id !== transferState.sourceInventoryId)
                .map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {getInventoryLabel(inv, characters)}
                  </option>
                ))}
            </select>
          </label>
          {transferState.type === 'currency' && (
            <label className="flex flex-col gap-2">
              Amount
              <input
                type="number"
                value={transferState.amount || ''}
                onChange={(event) =>
                  onTransferStateChange({ ...transferState, amount: event.target.value })
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
          )}
          {(transferState.type === 'material' || transferState.type === 'food') && (
            <label className="flex flex-col gap-2">
              Quantity
              <input
                type="number"
                min="1"
                value={transferState.quantity || ''}
                onChange={(event) =>
                  onTransferStateChange({ ...transferState, quantity: event.target.value })
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
          )}
          <div className="flex gap-2">
            <button
              onClick={onConfirmTransfer}
              className="flex-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Confirm Transfer
            </button>
            <button
              onClick={() => onTransferStateChange(null)}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
