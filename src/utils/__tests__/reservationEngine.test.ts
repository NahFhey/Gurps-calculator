import { describe, expect, it } from 'vitest';
import { InventoryManager } from '../inventoryManager';
import { ReservationEngine } from '../reservationEngine';
import type { GlobalState, ToolInstance } from '../../types/partyTool';

describe('ReservationEngine', () => {
  it('prevents double reservation and invalidates on transfer', () => {
    const tool: ToolInstance = {
      toolId: 'tool-1',
      templateId: 'template-1',
      conditionId: 'Good',
    };

    const state: GlobalState = {
      characters: {},
      inventories: {
        source: {
          id: 'source',
          ownerType: 'character',
          ownerId: 'char-1',
          currency: {},
          items: [],
          tools: [tool],
          materials: [],
          food: [],
        },
        target: {
          id: 'target',
          ownerType: 'party',
          ownerId: null,
          currency: {},
          items: [],
          tools: [],
          materials: [],
          food: [],
        },
      },
      toolTemplates: {},
      toolInstances: { [tool.toolId]: tool },
      facilities: {},
      currencyLogs: [],
    };

    const reservationEngine = new ReservationEngine(state);
    reservationEngine.reserveTool('session-a', tool.toolId);

    expect(() => reservationEngine.reserveTool('session-b', tool.toolId)).toThrow(
      'Tool already reserved by session: session-a'
    );

    const manager = new InventoryManager(state, reservationEngine);
    manager.transferItem('source', 'target', tool.toolId);

    expect(reservationEngine.activeReservations).toEqual({});
  });
});
