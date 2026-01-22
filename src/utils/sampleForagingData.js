/**
 * @fileoverview Sample Foraging Data
 *
 * This module provides sample data for the foraging system including:
 * - Foraging categories with yield formulas
 * - Forageable items with rarities
 * - Biome find tables (2d6)
 * - Event tables (mild and rare)
 *
 * This data can be imported by users to quickly set up foraging.
 */

/**
 * Sample foraging categories
 * @returns {Array<Object>} Array of category objects
 */
export function generateSampleCategories() {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Fruits',
      yieldFormula: '3d+1',
      inventoryOutput: {
        inventoryKind: 'food',
        typeId: 'fruits'
      },
      description: 'Edible fruits and berries'
    },
    {
      id: crypto.randomUUID(),
      name: 'Vegetables',
      yieldFormula: '3d',
      inventoryOutput: {
        inventoryKind: 'food',
        typeId: 'vegetables'
      },
      description: 'Edible roots, tubers, and vegetables'
    },
    {
      id: crypto.randomUUID(),
      name: 'Grains',
      yieldFormula: '2d+2',
      inventoryOutput: {
        inventoryKind: 'food',
        typeId: 'grains'
      },
      description: 'Wild grains and seeds'
    },
    {
      id: crypto.randomUUID(),
      name: 'Mushrooms',
      yieldFormula: '2d',
      inventoryOutput: {
        inventoryKind: 'food',
        typeId: 'mushrooms'
      },
      description: 'Edible fungi'
    },
    {
      id: crypto.randomUUID(),
      name: 'Herbs & Spices',
      yieldFormula: '1d+1',
      inventoryOutput: {
        inventoryKind: 'food',
        typeId: 'herbs_spices'
      },
      description: 'Culinary herbs and spices'
    },
    {
      id: crypto.randomUUID(),
      name: 'Seeds & Nuts',
      yieldFormula: '2d+1',
      inventoryOutput: {
        inventoryKind: 'food',
        typeId: 'nuts_seeds'
      },
      description: 'Nuts and edible seeds'
    },
    {
      id: crypto.randomUUID(),
      name: 'Fibrous Plants',
      yieldFormula: '3d',
      inventoryOutput: {
        inventoryKind: 'material',
        typeId: 'fiber'
      },
      description: 'Common plant fibers for crafting'
    },
    {
      id: crypto.randomUUID(),
      name: 'Strong Fibers',
      yieldFormula: '2d',
      inventoryOutput: {
        inventoryKind: 'material',
        typeId: 'strong_fiber'
      },
      description: 'Durable fibers for rope and textiles'
    },
    {
      id: crypto.randomUUID(),
      name: 'Medicinal Herbs',
      yieldFormula: '1d',
      inventoryOutput: {
        inventoryKind: 'material',
        typeId: 'medicinal_herb'
      },
      description: 'Herbs with healing properties'
    },
    {
      id: crypto.randomUUID(),
      name: 'Alchemical Ingredients',
      yieldFormula: '1d+1',
      inventoryOutput: {
        inventoryKind: 'material',
        typeId: 'alchemical_ingredient'
      },
      description: 'Reagents for alchemy'
    },
    {
      id: crypto.randomUUID(),
      name: 'Resin/Sap',
      yieldFormula: '1d+2',
      inventoryOutput: {
        inventoryKind: 'material',
        typeId: 'resin_sap'
      },
      description: 'Tree resins and saps'
    }
  ];
}

/**
 * Sample forageable items
 * @param {Array<Object>} categories - Array of category objects to link items to
 * @returns {Array<Object>} Array of item objects
 */
export function generateSampleItems(categories) {
  const fruitsCategory = categories.find(c => c.name === 'Fruits');
  const herbsCategory = categories.find(c => c.name === 'Herbs & Spices');
  const mushroomsCategory = categories.find(c => c.name === 'Mushrooms');
  const alchemyCategory = categories.find(c => c.name === 'Alchemical Ingredients');

  return [
    {
      id: crypto.randomUUID(),
      name: 'Tamrya Berries',
      categoryId: fruitsCategory?.id,
      rarity: 'Common',
      description: 'Sweet purple berries, safe to eat'
    },
    {
      id: crypto.randomUUID(),
      name: 'Sporekelp Fronds',
      categoryId: herbsCategory?.id,
      rarity: 'Uncommon',
      description: 'Spicy kelp fronds used in coastal cuisine'
    },
    {
      id: crypto.randomUUID(),
      name: 'Glowcap Mushrooms',
      categoryId: mushroomsCategory?.id,
      rarity: 'Rare',
      description: 'Bioluminescent mushrooms with mild flavor',
      yieldOverrideFormula: '1d+1'
    },
    {
      id: crypto.randomUUID(),
      name: 'Silverleaf',
      categoryId: alchemyCategory?.id,
      rarity: 'VeryRare',
      description: 'Rare herb with silver-tinted leaves, prized by alchemists',
      yieldOverrideFormula: '1d'
    },
    {
      id: crypto.randomUUID(),
      name: 'Moonpetal Flower',
      categoryId: alchemyCategory?.id,
      rarity: 'Legendary',
      description: 'Legendary flower that only blooms under moonlight',
      yieldOverrideFormula: '1d-1'
    }
  ];
}

/**
 * Sample biome find tables (2d6)
 * @param {Array<Object>} categories - Array of category objects
 * @param {Array<Object>} items - Array of item objects
 * @returns {Array<Object>} Array of table objects
 */
export function generateSampleBiomeTables(categories, _items) {
  const fruitsCategory = categories.find(c => c.name === 'Fruits');
  const vegetablesCategory = categories.find(c => c.name === 'Vegetables');
  const mushroomsCategory = categories.find(c => c.name === 'Mushrooms');
  const herbsCategory = categories.find(c => c.name === 'Herbs & Spices');
  const fibersCategory = categories.find(c => c.name === 'Fibrous Plants');
  const nutsCategory = categories.find(c => c.name === 'Seeds & Nuts');
  const medicinalCategory = categories.find(c => c.name === 'Medicinal Herbs');

  return [
    {
      id: crypto.randomUUID(),
      name: 'Tropical Forest Find Table',
      tableType: 'ForagingRandomFind',
      rollMethod: '2d6',
      entries: [
        { id: crypto.randomUUID(), rollValue: 2, resultType: 'nothing', text: 'Nothing found' },
        { id: crypto.randomUUID(), rollValue: 3, resultType: 'category', categoryId: fibersCategory?.id },
        { id: crypto.randomUUID(), rollValue: 4, resultType: 'category', categoryId: vegetablesCategory?.id },
        { id: crypto.randomUUID(), rollValue: 5, resultType: 'category', categoryId: fruitsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 6, resultType: 'category', categoryId: fruitsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 7, resultType: 'category', categoryId: nutsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 8, resultType: 'category', categoryId: herbsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 9, resultType: 'category', categoryId: mushroomsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 10, resultType: 'category', categoryId: medicinalCategory?.id },
        { id: crypto.randomUUID(), rollValue: 11, resultType: 'special', text: 'Rare tropical flower (GM discretion)' },
        { id: crypto.randomUUID(), rollValue: 12, resultType: 'special', text: 'Exotic spice cluster (GM discretion)' }
      ]
    },
    {
      id: crypto.randomUUID(),
      name: 'Coastal & Tidepools Find Table',
      tableType: 'ForagingRandomFind',
      rollMethod: '2d6',
      entries: [
        { id: crypto.randomUUID(), rollValue: 2, resultType: 'nothing', text: 'Nothing found' },
        { id: crypto.randomUUID(), rollValue: 3, resultType: 'category', categoryId: fibersCategory?.id },
        { id: crypto.randomUUID(), rollValue: 4, resultType: 'special', text: 'Seaweed (edible kelp)' },
        { id: crypto.randomUUID(), rollValue: 5, resultType: 'special', text: 'Shellfish (if shallow water)' },
        { id: crypto.randomUUID(), rollValue: 6, resultType: 'category', categoryId: herbsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 7, resultType: 'category', categoryId: vegetablesCategory?.id },
        { id: crypto.randomUUID(), rollValue: 8, resultType: 'special', text: 'Salt deposits' },
        { id: crypto.randomUUID(), rollValue: 9, resultType: 'special', text: 'Sponge' },
        { id: crypto.randomUUID(), rollValue: 10, resultType: 'category', categoryId: medicinalCategory?.id },
        { id: crypto.randomUUID(), rollValue: 11, resultType: 'special', text: 'Coral fragments' },
        { id: crypto.randomUUID(), rollValue: 12, resultType: 'special', text: 'Rare tidepool treasure (GM discretion)' }
      ]
    },
    {
      id: crypto.randomUUID(),
      name: 'Cave & Underground Find Table',
      tableType: 'ForagingRandomFind',
      rollMethod: '2d6',
      entries: [
        { id: crypto.randomUUID(), rollValue: 2, resultType: 'nothing', text: 'Nothing found' },
        { id: crypto.randomUUID(), rollValue: 3, resultType: 'special', text: 'Lichen (edible if prepared)' },
        { id: crypto.randomUUID(), rollValue: 4, resultType: 'category', categoryId: mushroomsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 5, resultType: 'category', categoryId: mushroomsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 6, resultType: 'category', categoryId: mushroomsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 7, resultType: 'category', categoryId: mushroomsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 8, resultType: 'special', text: 'Cave moss (medicinal)' },
        { id: crypto.randomUUID(), rollValue: 9, resultType: 'special', text: 'Mineral deposit' },
        { id: crypto.randomUUID(), rollValue: 10, resultType: 'special', text: 'Glowing fungi' },
        { id: crypto.randomUUID(), rollValue: 11, resultType: 'special', text: 'Bat guano (fertilizer)' },
        { id: crypto.randomUUID(), rollValue: 12, resultType: 'special', text: 'Rare cave crystal (GM discretion)' }
      ]
    },
    {
      id: crypto.randomUUID(),
      name: 'Swamp & Wetland Find Table',
      tableType: 'ForagingRandomFind',
      rollMethod: '2d6',
      entries: [
        { id: crypto.randomUUID(), rollValue: 2, resultType: 'nothing', text: 'Nothing found' },
        { id: crypto.randomUUID(), rollValue: 3, resultType: 'category', categoryId: fibersCategory?.id },
        { id: crypto.randomUUID(), rollValue: 4, resultType: 'category', categoryId: vegetablesCategory?.id },
        { id: crypto.randomUUID(), rollValue: 5, resultType: 'category', categoryId: mushroomsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 6, resultType: 'category', categoryId: herbsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 7, resultType: 'category', categoryId: medicinalCategory?.id },
        { id: crypto.randomUUID(), rollValue: 8, resultType: 'special', text: 'Swamp reeds (fiber)' },
        { id: crypto.randomUUID(), rollValue: 9, resultType: 'special', text: 'Medicinal moss' },
        { id: crypto.randomUUID(), rollValue: 10, resultType: 'special', text: 'Rare swamp herb' },
        { id: crypto.randomUUID(), rollValue: 11, resultType: 'special', text: 'Toxic plant (alchemy ingredient)' },
        { id: crypto.randomUUID(), rollValue: 12, resultType: 'special', text: 'Legendary swamp bloom (GM discretion)' }
      ]
    },
    {
      id: crypto.randomUUID(),
      name: 'Grasslands & Hills Find Table',
      tableType: 'ForagingRandomFind',
      rollMethod: '2d6',
      entries: [
        { id: crypto.randomUUID(), rollValue: 2, resultType: 'nothing', text: 'Nothing found' },
        { id: crypto.randomUUID(), rollValue: 3, resultType: 'category', categoryId: fibersCategory?.id },
        { id: crypto.randomUUID(), rollValue: 4, resultType: 'category', categoryId: vegetablesCategory?.id },
        { id: crypto.randomUUID(), rollValue: 5, resultType: 'category', categoryId: herbsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 6, resultType: 'category', categoryId: fruitsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 7, resultType: 'category', categoryId: nutsCategory?.id },
        { id: crypto.randomUUID(), rollValue: 8, resultType: 'special', text: 'Wild grains' },
        { id: crypto.randomUUID(), rollValue: 9, resultType: 'category', categoryId: medicinalCategory?.id },
        { id: crypto.randomUUID(), rollValue: 10, resultType: 'special', text: 'Wildflowers (decorative)' },
        { id: crypto.randomUUID(), rollValue: 11, resultType: 'special', text: 'Rare grassland herb' },
        { id: crypto.randomUUID(), rollValue: 12, resultType: 'special', text: 'Legendary wildflower (GM discretion)' }
      ]
    }
  ];
}

/**
 * Sample event tables for foraging
 * @returns {Array<Object>} Array of event table objects
 */
export function generateSampleEventTables() {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Foraging Mild Events',
      tableType: 'ForagingEventMild',
      rollMethod: '2d6',
      entries: [
        { id: crypto.randomUUID(), rollValue: 2, resultType: 'event', text: 'Animal tracks nearby - fresh trail to follow (+1 to next foraging check)' },
        { id: crypto.randomUUID(), rollValue: 3, resultType: 'event', text: 'Recent storm damage - fallen branches and exposed roots (+2 to yield this session)' },
        { id: crypto.randomUUID(), rollValue: 4, resultType: 'event', text: 'Bird flock overhead - sign of nearby food source (+1 to yield)' },
        { id: crypto.randomUUID(), rollValue: 5, resultType: 'event', text: 'Old forager\'s cache discovered - contains dried herbs (bonus 1d medicinal herbs)' },
        { id: crypto.randomUUID(), rollValue: 6, resultType: 'event', text: 'Helpful local spotted - offers advice (+1 to this check)' },
        { id: crypto.randomUUID(), rollValue: 7, resultType: 'event', text: 'Perfect weather conditions - ideal foraging (+1 to yield)' },
        { id: crypto.randomUUID(), rollValue: 8, resultType: 'event', text: 'Discovered animal den - edible plants nearby (automatic find)' },
        { id: crypto.randomUUID(), rollValue: 9, resultType: 'event', text: 'Ancient marker stone - indicates sacred grove (+2 to yield if foraging medicinal herbs)' },
        { id: crypto.randomUUID(), rollValue: 10, resultType: 'event', text: 'Fresh spring discovered - plants here are thriving (double yield this session)' },
        { id: crypto.randomUUID(), rollValue: 11, resultType: 'event', text: 'Rare plant cluster - bonus find of uncommon item' },
        { id: crypto.randomUUID(), rollValue: 12, resultType: 'event', text: 'Nature\'s bounty - roll twice on find table, take both results' }
      ]
    },
    {
      id: crypto.randomUUID(),
      name: 'Foraging Rare Events',
      tableType: 'ForagingEventRare',
      rollMethod: '2d6',
      entries: [
        { id: crypto.randomUUID(), rollValue: 2, resultType: 'event', text: 'Territorial predator - must make Stealth check or flee, -2 to foraging' },
        { id: crypto.randomUUID(), rollValue: 3, resultType: 'event', text: 'Poisonous plants everywhere - HT roll or suffer nausea, -1 to all checks' },
        { id: crypto.randomUUID(), rollValue: 4, resultType: 'event', text: 'Disturbed beehive - take 1d-2 damage, must leave area' },
        { id: crypto.randomUUID(), rollValue: 5, resultType: 'event', text: 'Recent wildfire damage - area depleted, -4 to yield' },
        { id: crypto.randomUUID(), rollValue: 6, resultType: 'event', text: 'Quicksand/unstable ground - DX check or stuck, lose 1 hour' },
        { id: crypto.randomUUID(), rollValue: 7, resultType: 'event', text: 'Rival foragers - area already picked clean, must move on' },
        { id: crypto.randomUUID(), rollValue: 8, resultType: 'event', text: 'Toxic spore cloud - HT-2 roll or coughing fit, -2 to checks' },
        { id: crypto.randomUUID(), rollValue: 9, resultType: 'event', text: 'Lost in dense undergrowth - Navigation check or waste 2 hours' },
        { id: crypto.randomUUID(), rollValue: 10, resultType: 'event', text: 'Equipment damaged - one tool breaks (roll randomly)' },
        { id: crypto.randomUUID(), rollValue: 11, resultType: 'event', text: 'Severe weather approaching - must finish quickly, -1 to yield' },
        { id: crypto.randomUUID(), rollValue: 12, resultType: 'event', text: 'Dangerous encounter - hostile creature or terrain hazard, GM discretion' }
      ]
    }
  ];
}

/**
 * Generates a complete sample foraging data set
 * @returns {Object} Complete foraging data including categories, items, tables
 */
export function generateCompleteForagingData() {
  const categories = generateSampleCategories();
  const items = generateSampleItems(categories);
  const biomeTables = generateSampleBiomeTables(categories, items);
  const eventTables = generateSampleEventTables();

  return {
    categories,
    items,
    tables: [...biomeTables, ...eventTables]
  };
}
