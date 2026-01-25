import { describe, expect, it } from 'vitest';
import { BASIC_TOOL_TEMPLATE_ID, initializeSystem, validatePlayerWorkers } from '../systemInitialization';
import type { GlobalState } from '../../types/partyTool';

describe('SystemInitialization', () => {
  it('adds the basic +0 tool template when missing', () => {
    const state: GlobalState = {
      characters: {},
      inventories: {},
      toolTemplates: {},
      toolInstances: {},
      facilities: {},
      currencyLogs: [],
    };

    const result = initializeSystem(state);

    expect(result.state.toolTemplates[BASIC_TOOL_TEMPLATE_ID]).toBeDefined();
  });

  it('validates only player characters can be workers', () => {
    const characters = {
      player: { id: 'player', isPlayer: true, work: { enabled: true, skills: {} } },
      npc: { id: 'npc', isPlayer: false, work: { enabled: true, skills: {} } },
    };

    const errors = validatePlayerWorkers(characters, ['player', 'npc']);

    expect(errors).toContain('Worker is not a player: npc');
  });
});
