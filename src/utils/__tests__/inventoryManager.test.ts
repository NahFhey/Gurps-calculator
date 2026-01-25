import { describe, expect, it } from 'vitest';
import { InventoryManager } from '../inventoryManager';
import type { GlobalState, ToolInstance } from '../../types/partyTool';

describe('InventoryManager', () => {
  it('transfers a tool while preserving ID and condition', () => {
    const tool: ToolInstance = {
      toolId: 'tool-1',
      templateId: 'template-1',
      conditionId: 'condition-1',
      notes: 'Test tool',
    };

    const state: GlobalState = {
      characters: {},
      inventories: {
        character: {
          id: 'character',
          ownerType: 'character',
          ownerId: 'char-1',
          currency: {},
          items: [],
          tools: [tool],
          materials: [],
          food: [],
        },
        party: {
          id: 'party',
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

    const manager = new InventoryManager(state);

    manager.transferItem('character', 'party', tool.toolId);

    expect(state.inventories.character.tools).toHaveLength(0);
    expect(state.inventories.party.tools).toHaveLength(1);
    expect(state.inventories.party.tools[0].toolId).toBe('tool-1');
    expect(state.inventories.party.tools[0].conditionId).toBe('condition-1');
  });
});
