/**
 * @fileoverview Test Sample Data
 *
 * This module provides persistent test samples for development and QA testing.
 * Data is loaded when the campaign state is empty (first-time setup).
 *
 * Includes:
 * - Raw materials (100 of each type)
 * - Food supplies (single and multi-type)
 * - Gathering system (species, items, tools, tables, environments, bait)
 * - Alchemy reagents (various aspects, roles, hazards)
 * - Equipment templates (weapons, armor, ranged, explosives)
 * - Cooking skills
 */

import type { Material, Food, CustomTemplates } from '../types/campaign';
import type { CookingSkill, AlchemyReagent } from '../types/views';
import type {
  GatheringSpeciesExtended,
  GatheringToolExtended,
  GatheringTableExtended,
  GatheringEnvironmentExtended,
  GatheringBaitExtended,
  GatheringItemExtended,
} from '../types/gathering';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = (): string => crypto.randomUUID();

// ============================================================================
// RAW MATERIALS
// ============================================================================

/**
 * Creates sample raw materials - 1 of each material type with quantity 100
 */
export function generateSampleMaterials(): Record<string, Material> {
  const materials: Record<string, Material> = {};

  const materialTypes = [
    { name: 'wood', source: 'Forest' },
    { name: 'metal', source: 'Mine' },
    { name: 'leather', source: 'Tannery' },
    { name: 'cloth', source: 'Weaver' },
    { name: 'stone', source: 'Quarry' },
  ];

  materialTypes.forEach((mat) => {
    const id = generateId();
    materials[id] = {
      id,
      name: `${mat.name.charAt(0).toUpperCase() + mat.name.slice(1)} Stock`,
      type: mat.name,
      quantity: 100,
      source: mat.source,
      notes: `Test sample ${mat.name} material`,
    };
  });

  return materials;
}

// ============================================================================
// FOOD SUPPLIES
// ============================================================================

/**
 * Creates sample food supplies:
 * - 1 of each food type with quantity 100
 * - 1 food with 2 types
 * - 1 food with 3 types
 * - 1 food with 4 types
 */
export function generateSampleFoods(): Record<string, Food> {
  const foods: Record<string, Food> = {};

  // Single-type foods (one for each food type)
  const singleTypeFoods = [
    { name: 'Salmon Fillet', types: ['fish'], source: 'River fishing' },
    { name: 'Roasted Chicken', types: ['poultry'], source: 'Farm' },
    { name: 'Beef Steak', types: ['meat'], source: 'Butcher' },
    { name: 'Apple Basket', types: ['fruit'], source: 'Orchard' },
    { name: 'Carrot Bundle', types: ['vegetable'], source: 'Garden' },
  ];

  singleTypeFoods.forEach((food) => {
    const id = generateId();
    foods[id] = {
      id,
      name: food.name,
      types: food.types,
      quantity: 100,
      source: food.source,
      notes: 'Test sample food',
    };
  });

  // Multi-type foods
  const multiTypeFoods = [
    {
      name: 'Fish and Vegetable Stew',
      types: ['fish', 'vegetable'],
      notes: '2-type food sample',
    },
    {
      name: 'Chicken Fruit Salad',
      types: ['poultry', 'fruit', 'vegetable'],
      notes: '3-type food sample',
    },
    {
      name: 'Surf and Turf Platter',
      types: ['fish', 'meat', 'vegetable', 'fruit'],
      notes: '4-type food sample',
    },
  ];

  multiTypeFoods.forEach((food) => {
    const id = generateId();
    foods[id] = {
      id,
      name: food.name,
      types: food.types,
      quantity: 100,
      source: 'Kitchen',
      notes: food.notes,
    };
  });

  return foods;
}

// ============================================================================
// GATHERING SPECIES
// ============================================================================

/**
 * Creates sample gathering species (fish, shellfish, crustaceans)
 */
export function generateSampleSpecies(): Record<string, GatheringSpeciesExtended> {
  const species: Record<string, GatheringSpeciesExtended> = {};

  const speciesData: Omit<GatheringSpeciesExtended, 'id'>[] = [
    {
      name: 'River Trout',
      type: 'fish',
      tags: ['freshwater', 'common'],
      foodType: 'fish',
      yieldMeatFormula: '2d+2',
      secondaryMaterialType: null,
      yieldSecondaryFormula: null,
      secondaryNameOverride: null,
      st: 4,
      specialRules: [],
    },
    {
      name: 'Ocean Salmon',
      type: 'fish',
      tags: ['saltwater', 'migratory'],
      foodType: 'fish',
      yieldMeatFormula: '3d+1',
      secondaryMaterialType: null,
      yieldSecondaryFormula: null,
      secondaryNameOverride: null,
      st: 6,
      specialRules: ['Strong swimmer - requires ST check to land'],
    },
    {
      name: 'Giant Catfish',
      type: 'fish',
      tags: ['freshwater', 'bottom-feeder', 'rare'],
      foodType: 'fish',
      yieldMeatFormula: '4d',
      secondaryMaterialType: 'leather',
      yieldSecondaryFormula: '1d',
      secondaryNameOverride: 'Catfish Skin',
      st: 10,
      specialRules: ['Dangerous barbs - HT roll or 1d-2 damage'],
    },
    {
      name: 'Oyster',
      type: 'shellfish',
      tags: ['saltwater', 'coastal', 'common'],
      foodType: 'fish',
      yieldMeatFormula: '1d',
      secondaryMaterialType: null,
      yieldSecondaryFormula: null,
      secondaryNameOverride: null,
      st: null,
      specialRules: ['May contain pearl (1 in 20 chance)'],
    },
    {
      name: 'Giant Clam',
      type: 'shellfish',
      tags: ['saltwater', 'deep', 'rare'],
      foodType: 'fish',
      yieldMeatFormula: '2d+1',
      secondaryMaterialType: 'stone',
      yieldSecondaryFormula: '1d-1',
      secondaryNameOverride: 'Pearl Shell Fragment',
      st: null,
      specialRules: ['Valuable shell material'],
    },
    {
      name: 'River Crayfish',
      type: 'crustacean',
      tags: ['freshwater', 'common'],
      foodType: 'fish',
      yieldMeatFormula: '1d+1',
      secondaryMaterialType: null,
      yieldSecondaryFormula: null,
      secondaryNameOverride: null,
      st: 2,
      specialRules: [],
    },
    {
      name: 'King Crab',
      type: 'crustacean',
      tags: ['saltwater', 'cold-water', 'uncommon'],
      foodType: 'fish',
      yieldMeatFormula: '3d',
      secondaryMaterialType: null,
      yieldSecondaryFormula: null,
      secondaryNameOverride: null,
      st: 5,
      specialRules: ['Powerful claws - DX check to avoid 1d-3 damage'],
    },
  ];

  speciesData.forEach((sp) => {
    const id = generateId();
    species[id] = { id, ...sp };
  });

  return species;
}

// ============================================================================
// GATHERING ITEMS (Forageable)
// ============================================================================

/**
 * Creates sample gathering items (forageable items)
 */
export function generateSampleGatheringItems(): Record<string, GatheringItemExtended> {
  const items: Record<string, GatheringItemExtended> = {};

  const itemData: Omit<GatheringItemExtended, 'id'>[] = [
    {
      name: 'Wild Berries',
      inventoryKind: 'food',
      typeId: 'fruit',
      yieldFormula: '2d+1',
      rarity: 'Common',
      description: 'Sweet and nutritious forest berries',
    },
    {
      name: 'Edible Mushrooms',
      inventoryKind: 'food',
      typeId: 'vegetable',
      yieldFormula: '1d+2',
      rarity: 'Common',
      description: 'Safe-to-eat woodland mushrooms',
    },
    {
      name: 'Wild Herbs',
      inventoryKind: 'food',
      typeId: 'vegetable',
      yieldFormula: '1d',
      rarity: 'Uncommon',
      description: 'Fragrant herbs for cooking',
    },
    {
      name: 'Medicinal Roots',
      inventoryKind: 'material',
      typeId: 'wood',
      yieldFormula: '1d-1',
      rarity: 'Uncommon',
      description: 'Roots with healing properties',
    },
    {
      name: 'Rare Truffle',
      inventoryKind: 'food',
      typeId: 'vegetable',
      yieldFormula: '1d-2',
      rarity: 'Rare',
      description: 'Prized culinary fungus',
    },
    {
      name: 'Spider Silk',
      inventoryKind: 'material',
      typeId: 'cloth',
      yieldFormula: '1d',
      rarity: 'Uncommon',
      description: 'Strong natural fiber from spider webs',
    },
    {
      name: 'Flint Nodule',
      inventoryKind: 'material',
      typeId: 'stone',
      yieldFormula: '1d+1',
      rarity: 'Common',
      description: 'Sharp stone useful for tools',
    },
    {
      name: 'Glowing Moss',
      inventoryKind: 'material',
      typeId: 'wood',
      yieldFormula: '1d-1',
      rarity: 'Rare',
      description: 'Bioluminescent moss found in caves',
    },
  ];

  itemData.forEach((item) => {
    const id = generateId();
    items[id] = { id, ...item };
  });

  return items;
}

// ============================================================================
// GATHERING TOOLS
// ============================================================================

/**
 * Creates sample gathering tools
 */
export function generateSampleTools(): Record<string, GatheringToolExtended> {
  const tools: Record<string, GatheringToolExtended> = {};

  const toolData: Omit<GatheringToolExtended, 'id'>[] = [
    {
      name: 'Basic Fishing Rod',
      toolType: 'fishing_rod',
      allowedModes: ['Fishing'],
      allowedMethods: ['Rod'],
      bonuses: [{ type: 'skill_bonus', skill: 'Fishing', value: 0 }],
      durability: 20,
      notes: 'Standard wooden fishing rod',
    },
    {
      name: 'Fine Fishing Rod',
      toolType: 'fishing_rod',
      allowedModes: ['Fishing'],
      allowedMethods: ['Rod'],
      bonuses: [
        { type: 'skill_bonus', skill: 'Fishing', value: 1 },
        { type: 'yield_bonus', dice: 1 },
      ],
      durability: 30,
      notes: 'High-quality bamboo rod with better flex',
    },
    {
      name: 'Hand Line',
      toolType: 'handline',
      allowedModes: ['Fishing'],
      allowedMethods: ['Handline'],
      bonuses: [],
      durability: 50,
      notes: 'Simple but durable fishing line',
    },
    {
      name: 'Cast Net',
      toolType: 'net',
      allowedModes: ['Fishing'],
      allowedMethods: ['Net'],
      bonuses: [{ type: 'yield_bonus', dice: 2 }],
      durability: 15,
      notes: 'Catches multiple fish at once',
    },
    {
      name: 'Fishing Spear',
      toolType: 'spear',
      allowedModes: ['Fishing'],
      allowedMethods: ['Spear'],
      bonuses: [{ type: 'skill_bonus', skill: 'Spear', value: 0 }],
      durability: 40,
      notes: 'Three-pronged fishing spear',
    },
    {
      name: 'Foraging Basket',
      toolType: 'general',
      allowedModes: ['Foraging'],
      allowedMethods: [],
      bonuses: [{ type: 'yield_bonus', dice: 1 }],
      durability: 100,
      notes: 'Woven basket for collecting foraged items',
    },
    {
      name: 'Herbalist Kit',
      toolType: 'general',
      allowedModes: ['Foraging'],
      allowedMethods: [],
      bonuses: [
        { type: 'skill_bonus', skill: 'HerbLore', value: 2 },
        { type: 'yield_bonus', typeId: 'medicinal_herb', dice: 1 },
      ],
      durability: 50,
      notes: 'Tools for identifying and harvesting medicinal plants',
    },
    {
      name: 'Diving Gear',
      toolType: 'general',
      allowedModes: ['Fishing'],
      allowedMethods: ['Spear', 'Net'],
      bonuses: [{ type: 'skill_bonus', skill: 'Swimming', value: 2 }],
      durability: 25,
      notes: 'Allows deeper water fishing',
    },
  ];

  toolData.forEach((tool) => {
    const id = generateId();
    tools[id] = { id, ...tool };
  });

  return tools;
}

// ============================================================================
// GATHERING TABLES
// ============================================================================

/**
 * Creates sample gathering tables
 */
export function generateSampleTables(
  speciesIds: string[],
  itemIds: string[]
): Record<string, GatheringTableExtended> {
  const tables: Record<string, GatheringTableExtended> = {};

  // Fishing catch table
  const fishingTableId = generateId();
  tables[fishingTableId] = {
    id: fishingTableId,
    name: 'River Fishing Catch Table',
    tableType: 'FishingRandomCatch',
    rollMethod: '2d6',
    entries: [
      { id: generateId(), rollValue: 2, resultType: 'nothing', speciesId: null, text: 'Line snaps - lost bait' },
      { id: generateId(), rollValue: 3, resultType: 'species', speciesId: speciesIds[0] || null, text: '' },
      { id: generateId(), rollValue: 4, resultType: 'species', speciesId: speciesIds[0] || null, text: '' },
      { id: generateId(), rollValue: 5, resultType: 'species', speciesId: speciesIds[5] || null, text: '' },
      { id: generateId(), rollValue: 6, resultType: 'species', speciesId: speciesIds[0] || null, text: '' },
      { id: generateId(), rollValue: 7, resultType: 'species', speciesId: speciesIds[0] || null, text: '' },
      { id: generateId(), rollValue: 8, resultType: 'species', speciesId: speciesIds[0] || null, text: '' },
      { id: generateId(), rollValue: 9, resultType: 'species', speciesId: speciesIds[5] || null, text: '' },
      { id: generateId(), rollValue: 10, resultType: 'species', speciesId: speciesIds[1] || null, text: '' },
      { id: generateId(), rollValue: 11, resultType: 'species', speciesId: speciesIds[2] || null, text: '' },
      { id: generateId(), rollValue: 12, resultType: 'special', speciesId: null, text: 'Unusual catch - GM discretion' },
    ],
  };

  // Ocean fishing table
  const oceanTableId = generateId();
  tables[oceanTableId] = {
    id: oceanTableId,
    name: 'Ocean Fishing Catch Table',
    tableType: 'FishingRandomCatch',
    rollMethod: '2d6',
    entries: [
      { id: generateId(), rollValue: 2, resultType: 'nothing', speciesId: null, text: 'Strong current - lose tackle' },
      { id: generateId(), rollValue: 3, resultType: 'species', speciesId: speciesIds[3] || null, text: '' },
      { id: generateId(), rollValue: 4, resultType: 'species', speciesId: speciesIds[1] || null, text: '' },
      { id: generateId(), rollValue: 5, resultType: 'species', speciesId: speciesIds[1] || null, text: '' },
      { id: generateId(), rollValue: 6, resultType: 'species', speciesId: speciesIds[6] || null, text: '' },
      { id: generateId(), rollValue: 7, resultType: 'species', speciesId: speciesIds[1] || null, text: '' },
      { id: generateId(), rollValue: 8, resultType: 'species', speciesId: speciesIds[3] || null, text: '' },
      { id: generateId(), rollValue: 9, resultType: 'species', speciesId: speciesIds[4] || null, text: '' },
      { id: generateId(), rollValue: 10, resultType: 'species', speciesId: speciesIds[6] || null, text: '' },
      { id: generateId(), rollValue: 11, resultType: 'species', speciesId: speciesIds[4] || null, text: '' },
      { id: generateId(), rollValue: 12, resultType: 'special', speciesId: null, text: 'Legendary fish sighting!' },
    ],
  };

  // Foraging find table
  const foragingTableId = generateId();
  tables[foragingTableId] = {
    id: foragingTableId,
    name: 'Forest Foraging Table',
    tableType: 'ForagingRandomFind',
    rollMethod: '2d6',
    entries: [
      { id: generateId(), rollValue: 2, resultType: 'nothing', speciesId: null, itemId: null, text: 'Nothing found' },
      { id: generateId(), rollValue: 3, resultType: 'item', speciesId: null, itemId: itemIds[3] || null, text: '' },
      { id: generateId(), rollValue: 4, resultType: 'item', speciesId: null, itemId: itemIds[1] || null, text: '' },
      { id: generateId(), rollValue: 5, resultType: 'item', speciesId: null, itemId: itemIds[0] || null, text: '' },
      { id: generateId(), rollValue: 6, resultType: 'item', speciesId: null, itemId: itemIds[0] || null, text: '' },
      { id: generateId(), rollValue: 7, resultType: 'item', speciesId: null, itemId: itemIds[2] || null, text: '' },
      { id: generateId(), rollValue: 8, resultType: 'item', speciesId: null, itemId: itemIds[1] || null, text: '' },
      { id: generateId(), rollValue: 9, resultType: 'item', speciesId: null, itemId: itemIds[6] || null, text: '' },
      { id: generateId(), rollValue: 10, resultType: 'item', speciesId: null, itemId: itemIds[4] || null, text: '' },
      { id: generateId(), rollValue: 11, resultType: 'item', speciesId: null, itemId: itemIds[5] || null, text: '' },
      { id: generateId(), rollValue: 12, resultType: 'special', speciesId: null, itemId: null, text: 'Rare discovery!' },
    ],
  };

  // Fishing event table (mild)
  const mildEventTableId = generateId();
  tables[mildEventTableId] = {
    id: mildEventTableId,
    name: 'Fishing Mild Events',
    tableType: 'FishingEventMild',
    rollMethod: '2d6',
    entries: [
      { id: generateId(), rollValue: 2, resultType: 'event', speciesId: null, text: 'Perfect conditions - +2 to next roll' },
      { id: generateId(), rollValue: 3, resultType: 'event', speciesId: null, text: 'Schools of fish spotted - +1 yield' },
      { id: generateId(), rollValue: 4, resultType: 'event', speciesId: null, text: 'Calm waters - relaxing fishing' },
      { id: generateId(), rollValue: 5, resultType: 'event', speciesId: null, text: 'Bird activity indicates fish' },
      { id: generateId(), rollValue: 6, resultType: 'event', speciesId: null, text: 'Clear water - can see fish' },
      { id: generateId(), rollValue: 7, resultType: 'event', speciesId: null, text: 'Normal conditions' },
      { id: generateId(), rollValue: 8, resultType: 'event', speciesId: null, text: 'Slight breeze - pleasant' },
      { id: generateId(), rollValue: 9, resultType: 'event', speciesId: null, text: 'Fish are biting today' },
      { id: generateId(), rollValue: 10, resultType: 'event', speciesId: null, text: 'Found a good fishing spot' },
      { id: generateId(), rollValue: 11, resultType: 'event', speciesId: null, text: 'Lucky catch - bonus fish!' },
      { id: generateId(), rollValue: 12, resultType: 'event', speciesId: null, text: 'Incredible luck - double yield!' },
    ],
  };

  // Fishing event table (rare)
  const rareEventTableId = generateId();
  tables[rareEventTableId] = {
    id: rareEventTableId,
    name: 'Fishing Rare Events',
    tableType: 'FishingEventRare',
    rollMethod: '2d6',
    entries: [
      { id: generateId(), rollValue: 2, resultType: 'event', speciesId: null, text: 'Equipment damaged - repair needed' },
      { id: generateId(), rollValue: 3, resultType: 'event', speciesId: null, text: 'Dangerous creature spotted' },
      { id: generateId(), rollValue: 4, resultType: 'event', speciesId: null, text: 'Sudden storm approaching' },
      { id: generateId(), rollValue: 5, resultType: 'event', speciesId: null, text: 'Hook snagged on debris' },
      { id: generateId(), rollValue: 6, resultType: 'event', speciesId: null, text: 'Other fishers competing' },
      { id: generateId(), rollValue: 7, resultType: 'event', speciesId: null, text: 'Fish are spooked' },
      { id: generateId(), rollValue: 8, resultType: 'event', speciesId: null, text: 'Water too murky' },
      { id: generateId(), rollValue: 9, resultType: 'event', speciesId: null, text: 'Bait stolen by birds' },
      { id: generateId(), rollValue: 10, resultType: 'event', speciesId: null, text: 'Line tangled badly' },
      { id: generateId(), rollValue: 11, resultType: 'event', speciesId: null, text: 'Large predator scares fish' },
      { id: generateId(), rollValue: 12, resultType: 'event', speciesId: null, text: 'Dangerous encounter - GM choice' },
    ],
  };

  return tables;
}

// ============================================================================
// GATHERING ENVIRONMENTS
// ============================================================================

/**
 * Creates sample gathering environments
 */
export function generateSampleEnvironments(
  tableIds: string[]
): Record<string, GatheringEnvironmentExtended> {
  const environments: Record<string, GatheringEnvironmentExtended> = {};

  const envData: Omit<GatheringEnvironmentExtended, 'id'>[] = [
    {
      name: 'Calm River',
      supportedModes: ['Fishing', 'Foraging'],
      defaultsByMode: {
        Fishing: {
          randomCatchTableId: tableIds[0] || null,
          mildEventTableId: tableIds[3] || null,
          rareEventTableId: tableIds[4] || null,
        },
        Foraging: {
          randomCatchTableId: tableIds[2] || null,
          mildEventTableId: null,
          rareEventTableId: null,
        },
      },
      skillMod: 0,
    },
    {
      name: 'Open Ocean',
      supportedModes: ['Fishing'],
      defaultsByMode: {
        Fishing: {
          randomCatchTableId: tableIds[1] || null,
          mildEventTableId: tableIds[3] || null,
          rareEventTableId: tableIds[4] || null,
        },
      },
      skillMod: -2,
    },
    {
      name: 'Coastal Shallows',
      supportedModes: ['Fishing', 'Foraging'],
      defaultsByMode: {
        Fishing: {
          randomCatchTableId: tableIds[1] || null,
          mildEventTableId: tableIds[3] || null,
          rareEventTableId: tableIds[4] || null,
        },
        Foraging: {
          randomCatchTableId: null,
          mildEventTableId: null,
          rareEventTableId: null,
        },
      },
      skillMod: 1,
    },
    {
      name: 'Dense Forest',
      supportedModes: ['Foraging'],
      defaultsByMode: {
        Foraging: {
          randomCatchTableId: tableIds[2] || null,
          mildEventTableId: null,
          rareEventTableId: null,
        },
      },
      skillMod: 0,
    },
    {
      name: 'Mountain Stream',
      supportedModes: ['Fishing'],
      defaultsByMode: {
        Fishing: {
          randomCatchTableId: tableIds[0] || null,
          mildEventTableId: tableIds[3] || null,
          rareEventTableId: tableIds[4] || null,
        },
      },
      skillMod: -1,
    },
  ];

  envData.forEach((env) => {
    const id = generateId();
    environments[id] = { id, ...env };
  });

  return environments;
}

// ============================================================================
// GATHERING BAIT
// ============================================================================

/**
 * Creates sample gathering bait
 */
export function generateSampleBait(speciesIds: string[]): Record<string, GatheringBaitExtended> {
  const bait: Record<string, GatheringBaitExtended> = {};

  const baitData: Omit<GatheringBaitExtended, 'id'>[] = [
    {
      name: 'Earthworms',
      consumableType: 'bait',
      baitTags: ['Worm'],
      attractsSpeciesIds: speciesIds.slice(0, 2),
      quantity: 50,
      rollBonus: 1,
    },
    {
      name: 'Minnows',
      consumableType: 'bait',
      baitTags: ['Fish'],
      attractsSpeciesIds: speciesIds.slice(1, 3),
      quantity: 30,
      rollBonus: 2,
    },
    {
      name: 'Glowworm Larvae',
      consumableType: 'bait',
      baitTags: ['Glow', 'Larva'],
      attractsSpeciesIds: speciesIds.slice(2, 5),
      quantity: 20,
      rollBonus: 3,
    },
    {
      name: 'Crab Chunks',
      consumableType: 'bait',
      baitTags: ['CrabChunk'],
      attractsSpeciesIds: speciesIds.slice(3, 7),
      quantity: 25,
      rollBonus: 2,
    },
    {
      name: 'Blood Bait',
      consumableType: 'bait',
      baitTags: ['Blood'],
      attractsSpeciesIds: speciesIds.slice(1, 4),
      quantity: 15,
      rollBonus: 3,
    },
    {
      name: 'Kelp Strips',
      consumableType: 'bait',
      baitTags: ['Kelp'],
      attractsSpeciesIds: [speciesIds[3] || '', speciesIds[4] || ''],
      quantity: 40,
      rollBonus: 1,
    },
    {
      name: 'Insect Mix',
      consumableType: 'bait',
      baitTags: ['Insect'],
      attractsSpeciesIds: speciesIds.slice(0, 2),
      quantity: 60,
      rollBonus: 0,
    },
  ];

  baitData.forEach((b) => {
    const id = generateId();
    bait[id] = { id, ...b };
  });

  return bait;
}

// ============================================================================
// ALCHEMY REAGENTS
// ============================================================================

/**
 * Creates sample alchemy reagents with various aspects, roles, and hazards
 */
export function generateSampleReagents(): Record<string, AlchemyReagent> {
  const reagents: Record<string, AlchemyReagent> = {};

  const reagentData: Omit<AlchemyReagent, 'id'>[] = [
    {
      name: 'Firemoss Extract',
      quantity: 10,
      aspects: { primary: 'Fire', secondary: 'Earth' },
      refinement: 'prepared',
      basePotency: 'P2',
      concentrationSteps: 0,
      roles: ['Active', 'Catalyst'],
      primaryRole: 'Active',
      hazards: ['Flammable'],
      processingNotes: 'Handle with care, ignites easily',
      identificationLevel: 4,
    },
    {
      name: 'Moonwater',
      quantity: 15,
      aspects: { primary: 'Water', secondary: 'Light' },
      refinement: 'refined',
      basePotency: 'P3',
      concentrationSteps: 1,
      roles: ['Solvent', 'Stabilizer'],
      primaryRole: 'Solvent',
      hazards: [],
      processingNotes: 'Collected under full moon',
      identificationLevel: 4,
    },
    {
      name: 'Shadowroot Powder',
      quantity: 8,
      aspects: { primary: 'Shadow', secondary: 'Earth', tertiary: 'Vital' },
      refinement: 'crude',
      basePotency: 'P1',
      concentrationSteps: 0,
      roles: ['Binder', 'Signature'],
      primaryRole: 'Binder',
      hazards: ['Toxic'],
      processingNotes: 'Wear gloves when handling',
      identificationLevel: 3,
    },
    {
      name: 'Windbloom Petals',
      quantity: 20,
      aspects: { primary: 'Air', secondary: 'Vital' },
      refinement: 'prepared',
      basePotency: 'P2',
      concentrationSteps: 0,
      roles: ['Active', 'Vector'],
      primaryRole: 'Vector',
      hazards: ['Volatile'],
      processingNotes: 'Evaporates quickly if not sealed',
      identificationLevel: 4,
    },
    {
      name: 'Mindcap Spores',
      quantity: 5,
      aspects: { primary: 'Mind', secondary: 'Air' },
      refinement: 'refined',
      basePotency: 'P4',
      concentrationSteps: 2,
      roles: ['Active', 'Signature'],
      primaryRole: 'Active',
      hazards: ['Hallucinogenic', 'Volatile'],
      processingNotes: 'Do not inhale, work in ventilated area',
      identificationLevel: 2,
    },
    {
      name: 'Vitalblood Sap',
      quantity: 12,
      aspects: { primary: 'Vital', secondary: 'Water', tertiary: 'Fire' },
      refinement: 'prepared',
      basePotency: 'P3',
      concentrationSteps: 1,
      roles: ['Active', 'Catalyst', 'Binder'],
      primaryRole: 'Catalyst',
      hazards: ['Reactive'],
      processingNotes: 'Reacts with metal containers',
      identificationLevel: 4,
    },
    {
      name: 'Sunstone Dust',
      quantity: 6,
      aspects: { primary: 'Light', secondary: 'Fire', tertiary: 'Earth' },
      refinement: 'refined',
      basePotency: 'P3',
      concentrationSteps: 0,
      roles: ['Catalyst', 'Stabilizer'],
      primaryRole: 'Stabilizer',
      hazards: ['Unstable'],
      processingNotes: 'Store in dark container',
      identificationLevel: 3,
    },
    {
      name: 'Nullite Crystal',
      quantity: 3,
      aspects: { primary: 'Shadow' },
      refinement: 'crude',
      basePotency: 'P0',
      concentrationSteps: 0,
      roles: ['Stabilizer', 'Binder'],
      primaryRole: 'Stabilizer',
      hazards: [],
      processingNotes: 'Absorbs magical energy',
      identificationLevel: 1,
    },
    {
      name: 'Dreamwine',
      quantity: 7,
      aspects: { primary: 'Mind', secondary: 'Water', tertiary: 'Shadow' },
      refinement: 'refined',
      basePotency: 'P4',
      concentrationSteps: 3,
      roles: ['Solvent', 'Active', 'Tool'],
      primaryRole: 'Solvent',
      hazards: ['Intoxicant', 'Hallucinogenic'],
      processingNotes: 'Highly potent, use sparingly',
      identificationLevel: 4,
    },
    {
      name: 'Ironbark Resin',
      quantity: 18,
      aspects: { primary: 'Earth', secondary: 'Vital' },
      refinement: 'prepared',
      basePotency: 'P2',
      concentrationSteps: 0,
      roles: ['Binder', 'Stabilizer'],
      primaryRole: 'Binder',
      hazards: [],
      processingNotes: 'Excellent binding agent',
      identificationLevel: 4,
    },
  ];

  reagentData.forEach((reagent) => {
    const id = generateId();
    reagents[id] = { id, ...reagent };
  });

  return reagents;
}

// ============================================================================
// CUSTOM TEMPLATES (Weapons, Armor, Ranged, Explosives)
// ============================================================================

/**
 * Creates sample custom templates for weapons, armor, ranged, and explosives
 */
export function generateSampleTemplates(): CustomTemplates {
  return {
    weapons: {
      'short-sword': {
        name: 'Short Sword',
        weight: 2,
        hp: 10,
        damage: 'sw cut or thr+1 imp',
        reach: '1',
        materials: [{ type: 'metal', amount: 2 }],
      },
      'battle-axe': {
        name: 'Battle Axe',
        weight: 4,
        hp: 12,
        damage: 'sw+2 cut',
        reach: '1',
        materials: [
          { type: 'metal', amount: 3 },
          { type: 'wood', amount: 1 },
        ],
      },
      'war-hammer': {
        name: 'War Hammer',
        weight: 5,
        hp: 14,
        damage: 'sw+3 cr',
        reach: '1',
        materials: [
          { type: 'metal', amount: 4 },
          { type: 'wood', amount: 1 },
        ],
      },
      'spear': {
        name: 'Spear',
        weight: 4,
        hp: 11,
        damage: 'thr+2 imp',
        reach: '1,2*',
        materials: [
          { type: 'metal', amount: 1 },
          { type: 'wood', amount: 2 },
        ],
      },
      'quarterstaff': {
        name: 'Quarterstaff',
        weight: 4,
        hp: 10,
        damage: 'sw+2 cr or thr+1 cr',
        reach: '1,2',
        materials: [{ type: 'wood', amount: 3 }],
      },
    },
    armor: {
      'leather-armor': {
        name: 'Leather Armor',
        weight: 10,
        hp: 15,
        dr: 2,
        location: 'torso',
        materials: [{ type: 'leather', amount: 5 }],
      },
      'chain-mail': {
        name: 'Chain Mail',
        weight: 35,
        hp: 25,
        dr: 4,
        location: 'torso',
        materials: [{ type: 'metal', amount: 10 }],
      },
      'plate-cuirass': {
        name: 'Plate Cuirass',
        weight: 25,
        hp: 30,
        dr: 6,
        location: 'torso',
        materials: [
          { type: 'metal', amount: 8 },
          { type: 'leather', amount: 2 },
        ],
      },
      'leather-helm': {
        name: 'Leather Helm',
        weight: 1,
        hp: 8,
        dr: 2,
        location: 'head',
        materials: [{ type: 'leather', amount: 1 }],
      },
      'metal-helm': {
        name: 'Metal Helm',
        weight: 5,
        hp: 12,
        dr: 4,
        location: 'head',
        materials: [{ type: 'metal', amount: 3 }],
      },
      'leather-gloves': {
        name: 'Leather Gloves',
        weight: 0.5,
        hp: 5,
        dr: 1,
        location: 'hands',
        materials: [{ type: 'leather', amount: 1 }],
      },
    },
    ranged: {
      'short-bow': {
        name: 'Short Bow',
        weight: 1.5,
        hp: 8,
        damage: 'thr imp',
        accuracy: 1,
        range: 'ST x 10 / ST x 15',
        rateOfFire: 1,
        shots: 1,
        materials: [
          { type: 'wood', amount: 2 },
          { type: 'cloth', amount: 1 },
        ],
      },
      'longbow': {
        name: 'Longbow',
        weight: 3,
        hp: 11,
        damage: 'thr+2 imp',
        accuracy: 3,
        range: 'ST x 15 / ST x 20',
        rateOfFire: 1,
        shots: 1,
        materials: [
          { type: 'wood', amount: 4 },
          { type: 'cloth', amount: 1 },
        ],
      },
      'crossbow': {
        name: 'Crossbow',
        weight: 6,
        hp: 12,
        damage: 'thr+4 imp',
        accuracy: 4,
        range: 'ST x 20 / ST x 25',
        rateOfFire: 1,
        shots: 1,
        materials: [
          { type: 'wood', amount: 3 },
          { type: 'metal', amount: 2 },
          { type: 'cloth', amount: 1 },
        ],
      },
      'sling': {
        name: 'Sling',
        weight: 0.2,
        hp: 5,
        damage: 'sw-1 cr',
        accuracy: 0,
        range: 'ST x 6 / ST x 10',
        rateOfFire: 1,
        shots: 1,
        materials: [{ type: 'leather', amount: 1 }],
      },
      'throwing-knife': {
        name: 'Throwing Knife',
        weight: 0.5,
        hp: 6,
        damage: 'thr-1 imp',
        accuracy: 0,
        range: 'ST x 0.8 / ST x 1.5',
        rateOfFire: 1,
        shots: 1,
        materials: [{ type: 'metal', amount: 1 }],
      },
    },
    explosives: {
      'smoke-bomb': {
        name: 'Smoke Bomb',
        weight: 0.5,
        damage: 'none',
        blastRadius: 3,
        materials: [
          { type: 'cloth', amount: 1 },
          { type: 'stone', amount: 1 },
        ],
      },
      'flash-bomb': {
        name: 'Flash Bomb',
        weight: 0.5,
        damage: 'HT-3 or blind 1d sec',
        blastRadius: 5,
        materials: [
          { type: 'metal', amount: 1 },
          { type: 'cloth', amount: 1 },
        ],
      },
      'frag-grenade': {
        name: 'Fragmentation Grenade',
        weight: 1,
        damage: '2d+1 cr',
        fragmentationDamage: '1d-1 cut',
        blastRadius: 4,
        materials: [
          { type: 'metal', amount: 2 },
          { type: 'cloth', amount: 1 },
        ],
      },
      'incendiary-bomb': {
        name: 'Incendiary Bomb',
        weight: 1.5,
        damage: '1d burn + fire',
        blastRadius: 3,
        materials: [
          { type: 'metal', amount: 1 },
          { type: 'cloth', amount: 2 },
        ],
      },
      'concussion-bomb': {
        name: 'Concussion Bomb',
        weight: 2,
        damage: '3d cr ex',
        blastRadius: 6,
        materials: [
          { type: 'metal', amount: 3 },
          { type: 'leather', amount: 1 },
        ],
      },
    },
  };
}

// ============================================================================
// COOKING SKILLS
// ============================================================================

/**
 * Creates sample cooking skills
 */
export function generateSampleCookingSkills(): CookingSkill[] {
  return [
    { id: generateId(), name: 'Baking' },
    { id: generateId(), name: 'Grilling' },
    { id: generateId(), name: 'Roasting' },
    { id: generateId(), name: 'Frying' },
    { id: generateId(), name: 'Boiling' },
    { id: generateId(), name: 'Steaming' },
    { id: generateId(), name: 'Smoking' },
    { id: generateId(), name: 'Pickling' },
    { id: generateId(), name: 'Fermenting' },
    { id: generateId(), name: 'Pastry Making' },
    { id: generateId(), name: 'Sauce Craft' },
    { id: generateId(), name: 'Butchery' },
  ];
}

// ============================================================================
// MAIN EXPORT: Generate All Sample Data
// ============================================================================

/**
 * Generates all test sample data for the campaign state.
 * This function is called when the state is empty (first-time setup).
 */
export function generateAllTestSampleData() {
  // Generate gathering data with interconnected IDs
  const gatheringSpecies = generateSampleSpecies();
  const gatheringItems = generateSampleGatheringItems();
  const speciesIds = Object.keys(gatheringSpecies);
  const itemIds = Object.keys(gatheringItems);

  const gatheringTables = generateSampleTables(speciesIds, itemIds);
  const tableIds = Object.keys(gatheringTables);

  const gatheringEnvironments = generateSampleEnvironments(tableIds);
  const gatheringBait = generateSampleBait(speciesIds);
  const gatheringTools = generateSampleTools();

  return {
    // Inventory
    materials: generateSampleMaterials(),
    foods: generateSampleFoods(),

    // Gathering system
    gatheringSpecies,
    gatheringTools,
    gatheringTables,
    gatheringEnvironments,
    gatheringBait,
    gatheringItems,

    // Alchemy
    alchemyReagents: generateSampleReagents(),

    // Crafting
    customTemplates: generateSampleTemplates(),

    // Cooking
    cookingSkills: generateSampleCookingSkills(),
  };
}

/**
 * Checks if the campaign state appears to be empty (no user data).
 * Used to determine if test sample data should be loaded.
 */
export function isStateEmpty(state: {
  entities: {
    inventories: Record<string, { materials: unknown[]; food: unknown[] }>;
    gatheringSpecies: Record<string, unknown>;
    alchemyReagents: Record<string, unknown>;
    cookingSkills: unknown[];
  };
}): boolean {
  return (
    Object.values(state.entities.inventories).every(inventory =>
      inventory.materials.length === 0 && inventory.food.length === 0
    ) &&
    Object.keys(state.entities.gatheringSpecies).length === 0 &&
    Object.keys(state.entities.alchemyReagents).length === 0 &&
    state.entities.cookingSkills.length === 0
  );
}
