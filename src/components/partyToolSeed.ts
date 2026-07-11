import type {
  Character,
  ToolTemplate,
  ToolInstance,
  Facility,
  Inventory,
  CurrencyLog,
} from '../types/campaign';

export const createPartyToolState = () => {
  const toolTemplates: Record<string, ToolTemplate> = {
    'template-hammer': {
      templateId: 'template-hammer',
      name: 'Forge Hammer',
      activityCategories: {
        crafting: { skillBonus: 1, timeBonus: -1, qualityModifier: 1 },
        engineering: { skillBonus: 1, timeBonus: -1 },
      },
    },
    'template-needle': {
      templateId: 'template-needle',
      name: 'Artisan Needle',
      activityCategories: {
        crafting: { skillBonus: 1, yieldPercent: 5, qualityModifier: 2 },
      },
    },
    'template-alembic': {
      templateId: 'template-alembic',
      name: 'Alembic Kit',
      activityCategories: {
        alchemy: { skillBonus: 2, yieldPercent: 10, riskModifier: -1 },
      },
    },
    'template-field-kit': {
      templateId: 'template-field-kit',
      name: 'Field Kit',
      activityCategories: {
        survival: { skillBonus: 1, timeBonus: -1 },
        cooking: { skillBonus: 1, yieldFlat: 1 },
      },
    },
  };

  const toolInstances: Record<string, ToolInstance> = {
    'tool-hammer-a': {
      toolId: 'tool-hammer-a',
      templateId: 'template-hammer',
      conditionId: 'Good',
    },
    'tool-needle-a': {
      toolId: 'tool-needle-a',
      templateId: 'template-needle',
      conditionId: 'Good',
    },
    'tool-alembic-a': {
      toolId: 'tool-alembic-a',
      templateId: 'template-alembic',
      conditionId: 'Broken',
    },
    'tool-field-kit-a': {
      toolId: 'tool-field-kit-a',
      templateId: 'template-field-kit',
      conditionId: 'Good',
    },
  };

  return {
    characters: {
      'char-rina': {
        id: 'char-rina',
        name: 'Rina',
        isPlayer: true,
        work: {
          enabled: true,
          skills: { crafting: 13, designing: 11, alchemy: 10, survival: 9, cooking: 11, fishing: 10 },
        },
      },
      'char-soren': {
        id: 'char-soren',
        name: 'Soren',
        isPlayer: true,
        work: {
          enabled: true,
          skills: { crafting: 12, designing: 13, survival: 10, naturalist: 11, fishing: 12 },
        },
      },
      'char-mira': {
        id: 'char-mira',
        name: 'Mira',
        isPlayer: true,
        work: {
          enabled: true,
          skills: { alchemy: 12, cooking: 12, survival: 8, herbLore: 11 },
        },
      },
      'char-npc': {
        id: 'char-npc',
        name: 'Quartermaster',
        isPlayer: false,
        work: {
          enabled: true,
          skills: { crafting: 14, designing: 12 },
        },
      },
    } as Record<string, Character>,
    inventories: {
      'inv-party': {
        id: 'inv-party',
        ownerType: 'party' as const,
        ownerId: null,
        currency: { credits: 120, silver: 40 },
        items: [
          { id: 'item-rope', name: 'Coil of Rope', quantity: 2 },
          { id: 'item-herb', name: 'Healing Herb', quantity: 6 },
        ],
        tools: [],
        materials: [],
        food: [],
      },
      'inv-rina': {
        id: 'inv-rina',
        ownerType: 'character' as const,
        ownerId: 'char-rina',
        currency: { credits: 30 },
        items: [{ id: 'item-thread', name: 'Thread Spool', quantity: 3 }],
        tools: [toolInstances['tool-needle-a']],
        materials: [],
        food: [],
      },
      'inv-soren': {
        id: 'inv-soren',
        ownerType: 'character' as const,
        ownerId: 'char-soren',
        currency: { credits: 20 },
        items: [{ id: 'item-gear', name: 'Precision Gear', quantity: 1 }],
        tools: [toolInstances['tool-hammer-a']],
        materials: [],
        food: [],
      },
      'inv-mira': {
        id: 'inv-mira',
        ownerType: 'character' as const,
        ownerId: 'char-mira',
        currency: { credits: 15 },
        items: [{ id: 'item-flask', name: 'Crystal Flask', quantity: 2 }],
        tools: [toolInstances['tool-alembic-a'], toolInstances['tool-field-kit-a']],
        materials: [],
        food: [],
      },
    } as Record<string, Inventory>,
    toolTemplates,
    toolInstances,
    facilities: {
      'facility-workbench': {
        id: 'facility-workbench',
        name: 'Workbench Bay',
        facilityType: 'workshop' as const,
        rating: 1,
        conditionId: 'Good',
        activityCategories: {
          crafting: { skillBonus: 1, qualityModifier: 1 },
          engineering: { skillBonus: 1, timeBonus: -1 },
        },
      },
      'facility-lab': {
        id: 'facility-lab',
        name: 'Alchemy Corner',
        facilityType: 'lab' as const,
        rating: 2,
        conditionId: 'Broken',
        activityCategories: {
          alchemy: { skillBonus: 2, yieldPercent: 15, riskModifier: -2 },
        },
      },
    } as Record<string, Facility>,
    currencyLogs: [] as CurrencyLog[],
  };
};

export const PARTY_TOOL_SKILLS = ['crafting', 'alchemy', 'cooking', 'survival', 'engineering'] as const;
