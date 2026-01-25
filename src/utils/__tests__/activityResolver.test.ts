import { describe, expect, it } from 'vitest';
import { preResolutionCheck, resolveActivity } from '../activityResolver';
import type { ActivityConfig } from '../activityResolver';

const buildConfig = (): ActivityConfig => ({
  sessionId: 'session-1',
  skillKey: 'crafting',
  primaryWorker: { id: 'worker-1', skills: { crafting: 12 } },
  helpers: [{ id: 'worker-2', skills: { crafting: 11 } }],
  toolsUsed: [
    {
      toolId: 'tool-1',
      name: 'Hammer',
      assignedWorkerId: 'worker-1',
      conditionId: 'Good',
      modifiers: { skillBonus: 1 },
    },
  ],
  facility: null,
  inventories: {
    inv1: {
      id: 'inv1',
      ownerType: 'party',
      ownerId: null,
      currency: {},
      items: [{ id: 'iron', quantity: 2 }],
      tools: [],
      materials: [],
      food: [],
    },
  },
  consumables: [{ inventoryId: 'inv1', itemId: 'iron', quantity: 1 }],
  reservedToolSessions: {},
});

describe('ActivityResolver', () => {
  it('flags missing skills and missing consumables', () => {
    const config = buildConfig();
    config.primaryWorker.skills = {};
    config.consumables = [{ inventoryId: 'inv1', itemId: 'iron', quantity: 5 }];

    const result = preResolutionCheck(config);

    expect(result.errors).toContain('Worker lacks skill: worker-1');
    expect(result.errors).toContain('Consumables missing: iron');
  });

  it('blocks resolution when validation fails without GM override', () => {
    const config = buildConfig();
    config.primaryWorker.skills = {};

    const result = resolveActivity(config, false);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.logEntry.outcome).toBe('blocked');
  });

  it('allows GM override and records it in the log', () => {
    const config = buildConfig();
    config.primaryWorker.skills = {};

    const result = resolveActivity(config, true);

    expect(result.logEntry.gmOverrideUsed).toBe(true);
    expect(result.logEntry.outcome).toBe('resolved-with-override');
  });

  it('deducts consumables with whole numbers only', () => {
    const config = buildConfig();

    const result = resolveActivity(config, false);

    expect(result.logEntry.outcome).toBe('resolved');
    expect(config.inventories.inv1.items[0].quantity).toBe(1);
  });
});
