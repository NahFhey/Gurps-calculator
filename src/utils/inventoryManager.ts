import type { CurrencyLog, GlobalState, Id, Inventory, ToolInstance } from '../types/partyTool';
import type { ReservationEngine } from './reservationEngine';

type InventoryLookup = Record<Id, Inventory>;

const FALLBACK_CURRENCY_KEY = 'unknown';

const createLogId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const ensureInventory = (inventories: InventoryLookup, inventoryId: Id): Inventory => {
  const inventory = inventories[inventoryId];
  if (!inventory) {
    throw new Error(`Inventory not found: ${inventoryId}`);
  }
  return inventory;
};

const findToolIndex = (tools: ToolInstance[], toolId: Id) => tools.findIndex(tool => tool.toolId === toolId);

export class InventoryManager {
  private state: GlobalState;
  private reservationEngine?: ReservationEngine;

  constructor(state: GlobalState, reservationEngine?: ReservationEngine) {
    this.state = state;
    this.reservationEngine = reservationEngine;
  }

  getState(): GlobalState {
    return this.state;
  }

  transferItem(sourceInvId: Id, targetInvId: Id, itemInstanceId: Id) {
    const source = ensureInventory(this.state.inventories, sourceInvId);
    const target = ensureInventory(this.state.inventories, targetInvId);

    const itemIndex = source.items.findIndex(item => item.id === itemInstanceId);
    if (itemIndex >= 0) {
      const [item] = source.items.splice(itemIndex, 1);
      target.items.push(item);
      this.logTransfer({
        sourceInventoryId: sourceInvId,
        targetInventoryId: targetInvId,
        itemInstanceId: item.id,
        timestamp: Date.now(),
      });
      return;
    }

    const toolIndex = findToolIndex(source.tools, itemInstanceId);
    if (toolIndex >= 0) {
      const [tool] = source.tools.splice(toolIndex, 1);
      target.tools.push(tool);
      this.reservationEngine?.invalidateReservationsForTool(tool.toolId);
      this.logTransfer({
        sourceInventoryId: sourceInvId,
        targetInventoryId: targetInvId,
        toolId: tool.toolId,
        timestamp: Date.now(),
      });
      return;
    }

    throw new Error(`Item or tool not found: ${itemInstanceId}`);
  }

  transferCurrency(sourceInvId: Id, targetInvId: Id, currencyKey: string, amount: number) {
    if (amount <= 0) {
      throw new Error('Transfer amount must be greater than zero');
    }

    const source = ensureInventory(this.state.inventories, sourceInvId);
    const target = ensureInventory(this.state.inventories, targetInvId);

    const available = source.currency[currencyKey] ?? 0;
    if (available < amount) {
      throw new Error(`Insufficient currency: ${currencyKey}`);
    }

    source.currency[currencyKey] = available - amount;
    target.currency[currencyKey] = (target.currency[currencyKey] ?? 0) + amount;

    this.logTransfer({
      sourceInventoryId: sourceInvId,
      targetInventoryId: targetInvId,
      currencyKey: currencyKey || FALLBACK_CURRENCY_KEY,
      amount,
      timestamp: Date.now(),
    });
  }

  private logTransfer(entry: Omit<CurrencyLog, 'id'>) {
    const logEntry: CurrencyLog = {
      id: createLogId(),
      ...entry,
    };

    this.state.currencyLogs.push(logEntry);
  }
}
