import { describe, it, expect } from 'vitest';
import {
  resolveTask,
  resolveFishingTask,
  resolveForagingTask
} from '../taskResolution';

const makeEnv = (overrides = {}) => ({
  skillMod: 0,
  defaultsByMode: {
    Fishing: {
      randomCatchTableId: 'tbl-catch',
      rareEventTableId: 'tbl-rare',
      mildEventTableId: 'tbl-mild'
    },
    Foraging: {
      randomCatchTableId: 'tbl-find',
      rareEventTableId: 'tbl-rare',
      mildEventTableId: 'tbl-mild'
    }
  },
  ...overrides
});

const catchTable = {
  id: 'tbl-catch',
  name: 'Catch Table',
  rollMethod: '2d6',
  entries: [
    { rollValue: 2, resultType: 'nothing', text: 'Nothing' },
    { rollValue: 7, resultType: 'species', speciesId: 'sp-1', text: 'Trout' },
    { rollValue: 12, resultType: 'species', speciesId: 'sp-1', text: 'Big' }
  ]
};

const findTable = {
  id: 'tbl-find',
  name: 'Find Table',
  rollMethod: '2d6',
  entries: [
    { rollValue: 2, resultType: 'nothing', text: 'Nothing' },
    { rollValue: 7, resultType: 'item', itemId: 'item-1', text: 'Berry' }
  ]
};

const rareTable = {
  id: 'tbl-rare',
  name: 'Rare',
  rollMethod: '2d6',
  entries: [{ rollValue: 7, resultType: 'event', text: 'Rare thing happened' }]
};

const mildTable = {
  id: 'tbl-mild',
  name: 'Mild',
  rollMethod: '2d6',
  entries: [{ rollValue: 7, resultType: 'event', text: 'Mild thing happened' }]
};

const species = [
  {
    id: 'sp-1',
    name: 'Trout',
    foodType: 'fish'
  }
];

const items = [
  {
    id: 'item-1',
    name: 'Wild Berry',
    typeId: 'berry',
    inventoryKind: 'food',
    yieldFormula: '1'
  },
  {
    id: 'item-2',
    name: 'Linen Plant',
    typeId: 'fiber',
    inventoryKind: 'material',
    yieldFormula: '1'
  }
];

const leader = { id: 'pc-1', skills: { fishing: 14, survival: 13 } };

describe('resolveFishingTask', () => {
  it('warns and returns empty delta when no catch table is configured', () => {
    const result = resolveFishingTask({
      task: { mode: 'Fishing', method: 'Line' },
      leader,
      environment: { skillMod: 0, defaultsByMode: { Fishing: {} } },
      tools: [],
      species,
      tables: [],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 7 }
    });

    expect(result.warnings).toContain('No catch table configured for this environment');
    expect(result.inventoryDelta).toEqual([]);
    expect(result.payload.method).toBe('Line');
    expect(result.payload.effectiveSkill).toBe(14);
  });

  it('produces a food inventory delta on a successful species catch', () => {
    const result = resolveFishingTask({
      task: { mode: 'Fishing', method: 'Line' },
      leader,
      environment: makeEnv(),
      tools: [],
      species,
      tables: [catchTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 7 }
    });

    expect(result.inventoryDelta).toHaveLength(1);
    expect(result.inventoryDelta[0]).toMatchObject({
      type: 'food',
      speciesName: 'Trout',
      foodType: 'fish',
      units: 1
    });
    expect(result.payload.eventType).toBe('none');
    expect(result.payload.eventResult).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('records a "Caught nothing" note when the table entry is nothing', () => {
    const result = resolveFishingTask({
      task: { mode: 'Fishing', method: 'Line' },
      leader,
      environment: makeEnv(),
      tools: [],
      species,
      tables: [catchTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 2 }
    });

    expect(result.inventoryDelta).toEqual([]);
    expect(result.notes).toContain('Caught nothing');
  });

  it('applies tool skill bonuses to effective fishing skill', () => {
    const tools = [
      { id: 'tool-1', bonuses: [{ type: 'skill_bonus', value: 3 }] }
    ];
    const result = resolveFishingTask({
      task: { mode: 'Fishing', method: 'Line' },
      leader,
      environment: makeEnv(),
      tools,
      species,
      tables: [catchTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 7 }
    });

    expect(result.payload.effectiveSkill).toBe(17);
  });

  it('triggers a rare event and surfaces it as a warning', () => {
    const result = resolveFishingTask({
      task: { mode: 'Fishing', method: 'Line' },
      leader,
      environment: makeEnv(),
      tools: [],
      species,
      tables: [catchTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 5, tableRoll: 7, eventTableRoll: 7 }
    });

    expect(result.payload.eventType).toBe('rare');
    expect(result.payload.eventResult).toBeTruthy();
    expect(result.warnings).toContain('Rare thing happened');
  });

  it('triggers a mild event without crashing when the mild table is missing', () => {
    const result = resolveFishingTask({
      task: { mode: 'Fishing', method: 'Line' },
      leader,
      environment: makeEnv(),
      tools: [],
      species,
      tables: [catchTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 8, tableRoll: 7 }
    });

    expect(result.payload.eventType).toBe('mild');
    expect(result.payload.eventResult).toBeNull();
    expect(result.notes).toContain('no table configured');
  });

  it('defaults method to "Line" when not provided', () => {
    const result = resolveFishingTask({
      task: { mode: 'Fishing' },
      leader,
      environment: makeEnv(),
      tools: [],
      species,
      tables: [catchTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 2 }
    });

    expect(result.payload.method).toBe('Line');
  });
});

describe('resolveForagingTask', () => {
  it('warns when no find table is configured', () => {
    const result = resolveForagingTask({
      task: { mode: 'Foraging', intent: { skill: 'Survival' } },
      leader,
      environment: { skillMod: 0, defaultsByMode: { Foraging: {} } },
      tools: [],
      items,
      tables: [],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 7 }
    });

    expect(result.warnings).toContain('No find table configured for this environment');
    expect(result.inventoryDelta).toEqual([]);
    expect(result.payload.skill).toBe('Survival');
  });

  it('produces a food inventory delta when finding a food item', () => {
    const result = resolveForagingTask({
      task: { mode: 'Foraging', intent: { skill: 'Survival' } },
      leader,
      environment: makeEnv(),
      tools: [],
      items,
      tables: [findTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 7 }
    });

    expect(result.inventoryDelta).toHaveLength(1);
    expect(result.inventoryDelta[0]).toMatchObject({
      type: 'food',
      speciesName: 'Wild Berry',
      foodType: 'berry'
    });
    expect(result.inventoryDelta[0].units).toBeGreaterThanOrEqual(1);
  });

  it('produces a material inventory delta when finding a material item', () => {
    const findTableMat = {
      ...findTable,
      entries: [
        { rollValue: 2, resultType: 'nothing', text: 'Nothing' },
        { rollValue: 7, resultType: 'item', itemId: 'item-2', text: 'Plant' }
      ]
    };
    const result = resolveForagingTask({
      task: { mode: 'Foraging', intent: { skill: 'Survival' } },
      leader,
      environment: makeEnv(),
      tools: [],
      items,
      tables: [findTableMat, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 7 }
    });

    expect(result.inventoryDelta).toHaveLength(1);
    expect(result.inventoryDelta[0]).toMatchObject({
      type: 'material',
      name: 'Linen Plant',
      materialType: 'fiber'
    });
  });

  it('records a "Found nothing" note when the find table entry is nothing', () => {
    const result = resolveForagingTask({
      task: { mode: 'Foraging', intent: { skill: 'Survival' } },
      leader,
      environment: makeEnv(),
      tools: [],
      items,
      tables: [findTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 2 }
    });

    expect(result.inventoryDelta).toEqual([]);
    expect(result.notes).toContain('Found nothing');
  });

  it('defaults skill to Survival when intent.skill is not provided', () => {
    const result = resolveForagingTask({
      task: { mode: 'Foraging' },
      leader,
      environment: makeEnv(),
      tools: [],
      items,
      tables: [findTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 2 }
    });

    expect(result.payload.skill).toBe('Survival');
  });

  it('triggers a mild event and surfaces text as a warning', () => {
    const result = resolveForagingTask({
      task: { mode: 'Foraging', intent: { skill: 'Survival' } },
      leader,
      environment: makeEnv(),
      tools: [],
      items,
      tables: [findTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 8, tableRoll: 2, eventTableRoll: 7 }
    });

    expect(result.payload.eventType).toBe('mild');
    expect(result.warnings).toContain('Mild thing happened');
  });
});

describe('resolveTask dispatcher', () => {
  it('routes Fishing mode to the fishing resolver', () => {
    const result = resolveTask({
      task: { mode: 'Fishing', method: 'Line' },
      leader,
      environment: makeEnv(),
      tools: [],
      species,
      tables: [catchTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 7 }
    });

    expect(result.payload.method).toBe('Line');
    expect(result.inventoryDelta[0].speciesName).toBe('Trout');
  });

  it('routes Foraging mode to the foraging resolver', () => {
    const result = resolveTask({
      task: { mode: 'Foraging', intent: { skill: 'Survival' } },
      leader,
      environment: makeEnv(),
      tools: [],
      items,
      tables: [findTable, rareTable, mildTable],
      manualRolls: { skillRoll: 10, eventCheckRoll: 12, tableRoll: 7 }
    });

    expect(result.payload.skill).toBe('Survival');
  });

  it('returns an unsupported-mode warning for unknown modes', () => {
    const result = resolveTask({ task: { mode: 'Hunting' } });

    expect(result.payload).toBeNull();
    expect(result.inventoryDelta).toEqual([]);
    expect(result.warnings).toEqual(['Mode Hunting is not yet implemented']);
    expect(result.notes).toContain('Unsupported mode: Hunting');
  });
});
