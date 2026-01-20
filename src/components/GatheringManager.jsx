import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Save, X, Trash2, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import {
  GATHERING_MODES,
  GATHERING_TOOL_TYPES,
  FISHING_METHODS,
  BAIT_TAGS,
  SPECIES_TAGS,
  FISH_SECONDARY_MATERIALS,
  SPECIES_SPECIAL_RULES,
  GATHERING_TABLE_TYPES,
  FISH_ST_RANGE,
  FORAGING_TOOL_TYPES,
  FORAGING_RARITIES,
  FORAGING_FOOD_TYPES,
  FORAGING_MATERIAL_TYPES
} from '../constants';

/**
 * Helper to calculate expected entries for a roll method
 * @param {string} rollMethod - e.g., '2d6', '1d6', '3d6'
 * @returns {Object} - { min, max, count }
 */
function getRollMethodRange(rollMethod) {
  switch (rollMethod) {
    case '1d6': return { min: 1, max: 6, count: 6 };
    case '2d6': return { min: 2, max: 12, count: 11 };
    case '3d6': return { min: 3, max: 18, count: 16 };
    default: return { min: 2, max: 12, count: 11 };
  }
}

/**
 * GatheringManager Component - Manages gathering system configuration
 *
 * This component provides management interfaces for:
 * - Species (fish and other gatherable creatures)
 * - Tools (fishing rods, nets, spears)
 * - Tables (catch tables, event tables)
 * - Environments (locations with table mappings)
 * - Bait (consumables)
 * - Campaign day tracking
 *
 * @param {Object} props - Component props
 */
export function GatheringManager({
  species,
  tools,
  tables,
  environments,
  bait,
  categories,
  items,
  currentDay,
  foodTypes = [],
  materialTypes = [],
  saveSpecies,
  saveTools,
  saveTables,
  saveEnvironments,
  saveBait,
  saveCategories,
  saveItems,
  saveCurrentDay
}) {
  const [view, setView] = useState('species');
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Species form state
  const [newSpeciesName, setNewSpeciesName] = useState('');
  const [newSpeciesType, setNewSpeciesType] = useState('fish');
  const [newSpeciesTags, setNewSpeciesTags] = useState([]);
  const [newSpeciesFoodType, setNewSpeciesFoodType] = useState('fish');
  const [newSpeciesMeatFormula, setNewSpeciesMeatFormula] = useState('2d');
  const [newSpeciesSecondaryType, setNewSpeciesSecondaryType] = useState('');
  const [newSpeciesSecondaryFormula, setNewSpeciesSecondaryFormula] = useState('');
  const [newSpeciesSecondaryNameOverride, setNewSpeciesSecondaryNameOverride] = useState('');
  const [newSpeciesST, setNewSpeciesST] = useState('14');
  const [newSpeciesSpecialRules, setNewSpeciesSpecialRules] = useState([]);

  // Get food type names from manager
  const availableFoodTypes = useMemo(() => {
    return foodTypes.map(ft => typeof ft === 'string' ? ft : ft.name);
  }, [foodTypes]);

  // Tool form state
  const [newToolName, setNewToolName] = useState('');
  const [newToolType, setNewToolType] = useState('fishing_rod');
  const [newToolModes, setNewToolModes] = useState(['Fishing']);
  const [newToolMethods, setNewToolMethods] = useState([]);
  const [newToolSkillBonus, setNewToolSkillBonus] = useState('0');
  const [newToolDurability, setNewToolDurability] = useState('');
  const [newToolNotes, setNewToolNotes] = useState('');

  // Table form state
  const [newTableName, setNewTableName] = useState('');
  const [newTableType, setNewTableType] = useState('FishingRandomCatch');
  const [newTableRollMethod, setNewTableRollMethod] = useState('2d6');
  const [newTableEntries, setNewTableEntries] = useState([]);

  // Environment form state
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvModes, setNewEnvModes] = useState(['Fishing']);
  const [newEnvCatchTableId, setNewEnvCatchTableId] = useState('');
  const [newEnvMildTableId, setNewEnvMildTableId] = useState('');
  const [newEnvRareTableId, setNewEnvRareTableId] = useState('');
  const [newEnvForagingFindTableId, setNewEnvForagingFindTableId] = useState('');
  const [newEnvForagingMildTableId, setNewEnvForagingMildTableId] = useState('');
  const [newEnvForagingRareTableId, setNewEnvForagingRareTableId] = useState('');
  const [newEnvSkillMod, setNewEnvSkillMod] = useState('0');

  // Bait form state
  const [newBaitName, setNewBaitName] = useState('');
  const [newBaitTags, setNewBaitTags] = useState([]);
  const [newBaitAttracts, setNewBaitAttracts] = useState([]);
  const [newBaitQuantity, setNewBaitQuantity] = useState('10');
  const [newBaitRollBonus, setNewBaitRollBonus] = useState('1');

  // Category form state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryYieldFormula, setNewCategoryYieldFormula] = useState('3d');
  const [newCategoryInventoryKind, setNewCategoryInventoryKind] = useState('food');
  const [newCategoryTypeId, setNewCategoryTypeId] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  // Item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemInventoryKind, setNewItemInventoryKind] = useState('food');
  const [newItemTypeId, setNewItemTypeId] = useState('');
  const [newItemYieldFormula, setNewItemYieldFormula] = useState('3d');
  const [newItemRarity, setNewItemRarity] = useState('Common');
  const [newItemDescription, setNewItemDescription] = useState('');

  // Add or update species
  function addSpecies() {
    if (!newSpeciesName.trim()) {
      alert('Enter species name');
      return;
    }

    const entryData = {
      name: newSpeciesName.trim(),
      type: newSpeciesType,
      tags: newSpeciesTags,
      foodType: newSpeciesFoodType,
      yieldMeatFormula: newSpeciesMeatFormula || '1d',
      secondaryMaterialType: newSpeciesSecondaryType || null,
      yieldSecondaryFormula: newSpeciesSecondaryFormula || null,
      secondaryNameOverride: newSpeciesSecondaryNameOverride.trim() || null,
      st: newSpeciesTags.includes('LargeFish') ? parseInt(newSpeciesST) || 14 : null,
      specialRules: newSpeciesSpecialRules
    };

    if (editingId) {
      // Update existing
      saveSpecies(species.map(s => s.id === editingId ? { ...s, ...entryData } : s));
    } else {
      // Add new
      saveSpecies([...species, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetSpeciesForm();
  }

  // Start editing a species
  function editSpecies(s) {
    setEditingId(s.id);
    setNewSpeciesName(s.name);
    setNewSpeciesType(s.type || 'fish');
    setNewSpeciesTags(s.tags || []);
    setNewSpeciesFoodType(s.foodType || 'fish');
    setNewSpeciesMeatFormula(s.yieldMeatFormula || '2d');
    setNewSpeciesSecondaryType(s.secondaryMaterialType || '');
    setNewSpeciesSecondaryFormula(s.yieldSecondaryFormula || '');
    setNewSpeciesSecondaryNameOverride(s.secondaryNameOverride || '');
    setNewSpeciesST(String(s.st || 14));
    setNewSpeciesSpecialRules(s.specialRules || []);
    setShowAdd(true);
  }

  function resetSpeciesForm() {
    setEditingId(null);
    setNewSpeciesName('');
    setNewSpeciesType('fish');
    setNewSpeciesTags([]);
    setNewSpeciesFoodType('fish');
    setNewSpeciesMeatFormula('2d');
    setNewSpeciesSecondaryType('');
    setNewSpeciesSecondaryFormula('');
    setNewSpeciesSecondaryNameOverride('');
    setNewSpeciesST('14');
    setNewSpeciesSpecialRules([]);
    setShowAdd(false);
  }

  // Add or update tool
  function addTool() {
    if (!newToolName.trim()) {
      alert('Enter tool name');
      return;
    }

    const bonuses = [];
    if (parseInt(newToolSkillBonus)) {
      bonuses.push({ type: 'skill_bonus', skill: 'Fishing', value: parseInt(newToolSkillBonus) });
    }

    const entryData = {
      name: newToolName.trim(),
      toolType: newToolType,
      allowedModes: newToolModes,
      allowedMethods: newToolMethods,
      bonuses,
      durability: newToolDurability ? parseInt(newToolDurability) : null,
      notes: newToolNotes
    };

    if (editingId) {
      saveTools(tools.map(t => t.id === editingId ? { ...t, ...entryData } : t));
    } else {
      saveTools([...tools, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetToolForm();
  }

  function editTool(t) {
    setEditingId(t.id);
    setNewToolName(t.name);
    setNewToolType(t.toolType || 'fishing_rod');
    setNewToolModes(t.allowedModes || ['Fishing']);
    setNewToolMethods(t.allowedMethods || []);
    setNewToolSkillBonus(String(t.bonuses?.find(b => b.type === 'skill_bonus')?.value || 0));
    setNewToolDurability(t.durability ? String(t.durability) : '');
    setNewToolNotes(t.notes || '');
    setShowAdd(true);
  }

  function resetToolForm() {
    setEditingId(null);
    setNewToolName('');
    setNewToolType('fishing_rod');
    setNewToolModes(['Fishing']);
    setNewToolMethods([]);
    setNewToolSkillBonus('0');
    setNewToolDurability('');
    setNewToolNotes('');
    setShowAdd(false);
  }

  // Add or update table
  function addTable() {
    if (!newTableName.trim()) {
      alert('Enter table name');
      return;
    }

    // Validate entry count matches roll method
    const range = getRollMethodRange(newTableRollMethod);
    if (newTableEntries.length !== range.count) {
      alert(`Table must have exactly ${range.count} entries for ${newTableRollMethod} (${range.min}-${range.max}). Currently has ${newTableEntries.length}.`);
      return;
    }

    const entryData = {
      name: newTableName.trim(),
      tableType: newTableType,
      rollMethod: newTableRollMethod,
      entries: newTableEntries
    };

    if (editingId) {
      saveTables(tables.map(t => t.id === editingId ? { ...t, ...entryData } : t));
    } else {
      saveTables([...tables, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetTableForm();
  }

  function editTable(t) {
    setEditingId(t.id);
    setNewTableName(t.name);
    setNewTableType(t.tableType || 'FishingRandomCatch');
    setNewTableRollMethod(t.rollMethod || '2d6');
    setNewTableEntries(t.entries || []);
    setShowAdd(true);
  }

  function resetTableForm() {
    setEditingId(null);
    setNewTableName('');
    setNewTableType('FishingRandomCatch');
    setNewTableRollMethod('2d6');
    setNewTableEntries([]);
    setShowAdd(false);
  }

  // Auto-populate table entries when roll method changes
  function initializeTableEntries(rollMethod) {
    const range = getRollMethodRange(rollMethod);
    const entries = [];
    for (let i = range.min; i <= range.max; i++) {
      entries.push({
        id: crypto.randomUUID(),
        rollValue: i,
        resultType: 'nothing',
        speciesId: null,
        text: ''
      });
    }
    setNewTableEntries(entries);
  }

  // Add or update environment
  function addEnvironment() {
    if (!newEnvName.trim()) {
      alert('Enter environment name');
      return;
    }

    // Build defaultsByMode object
    const defaultsByMode = {};

    if (newEnvModes.includes('Fishing')) {
      defaultsByMode.Fishing = {
        randomCatchTableId: newEnvCatchTableId || null,
        mildEventTableId: newEnvMildTableId || null,
        rareEventTableId: newEnvRareTableId || null
      };
    }

    if (newEnvModes.includes('Foraging')) {
      defaultsByMode.Foraging = {
        randomCatchTableId: newEnvForagingFindTableId || null,
        mildEventTableId: newEnvForagingMildTableId || null,
        rareEventTableId: newEnvForagingRareTableId || null
      };
    }

    // Validate at least one table is selected across all modes
    const hasTables = Object.values(defaultsByMode).some(mode =>
      mode.randomCatchTableId || mode.mildEventTableId || mode.rareEventTableId
    );

    if (!hasTables) {
      alert('Environment must have at least one table selected');
      return;
    }

    const entryData = {
      name: newEnvName.trim(),
      supportedModes: newEnvModes,
      defaultsByMode,
      skillMod: parseInt(newEnvSkillMod) || 0
    };

    if (editingId) {
      saveEnvironments(environments.map(e => e.id === editingId ? { ...e, ...entryData } : e));
    } else {
      saveEnvironments([...environments, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetEnvForm();
  }

  function editEnvironment(e) {
    setEditingId(e.id);
    setNewEnvName(e.name);
    setNewEnvModes(e.supportedModes || ['Fishing']);

    const fishingDefaults = e.defaultsByMode?.Fishing || {};
    setNewEnvCatchTableId(fishingDefaults.randomCatchTableId || '');
    setNewEnvMildTableId(fishingDefaults.mildEventTableId || '');
    setNewEnvRareTableId(fishingDefaults.rareEventTableId || '');

    const foragingDefaults = e.defaultsByMode?.Foraging || {};
    setNewEnvForagingFindTableId(foragingDefaults.randomCatchTableId || '');
    setNewEnvForagingMildTableId(foragingDefaults.mildEventTableId || '');
    setNewEnvForagingRareTableId(foragingDefaults.rareEventTableId || '');

    setNewEnvSkillMod(String(e.skillMod || 0));
    setShowAdd(true);
  }

  function resetEnvForm() {
    setEditingId(null);
    setNewEnvName('');
    setNewEnvModes(['Fishing']);
    setNewEnvCatchTableId('');
    setNewEnvMildTableId('');
    setNewEnvRareTableId('');
    setNewEnvForagingFindTableId('');
    setNewEnvForagingMildTableId('');
    setNewEnvForagingRareTableId('');
    setNewEnvSkillMod('0');
    setShowAdd(false);
  }

  // Add or update bait
  function addBait() {
    if (!newBaitName.trim()) {
      alert('Enter bait name');
      return;
    }

    // Validate at least one species is selected
    if (newBaitAttracts.length === 0) {
      alert('Bait must attract at least one species');
      return;
    }

    const entryData = {
      name: newBaitName.trim(),
      consumableType: 'bait',
      baitTags: newBaitTags,
      attractsSpeciesIds: newBaitAttracts,
      quantity: parseInt(newBaitQuantity) || 10,
      rollBonus: parseInt(newBaitRollBonus) || 1
    };

    if (editingId) {
      saveBait(bait.map(b => b.id === editingId ? { ...b, ...entryData } : b));
    } else {
      saveBait([...bait, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetBaitForm();
  }

  function editBait(b) {
    setEditingId(b.id);
    setNewBaitName(b.name);
    setNewBaitTags(b.baitTags || []);
    setNewBaitAttracts(b.attractsSpeciesIds || []);
    setNewBaitQuantity(String(b.quantity || 10));
    setNewBaitRollBonus(String(b.rollBonus || 1));
    setShowAdd(true);
  }

  function resetBaitForm() {
    setEditingId(null);
    setNewBaitName('');
    setNewBaitTags([]);
    setNewBaitAttracts([]);
    setNewBaitQuantity('10');
    setNewBaitRollBonus('1');
    setShowAdd(false);
  }

  // Add or update category
  function addCategory() {
    if (!newCategoryName.trim()) {
      alert('Enter category name');
      return;
    }

    const entryData = {
      name: newCategoryName.trim(),
      yieldFormula: newCategoryYieldFormula || '3d',
      inventoryOutput: {
        inventoryKind: newCategoryInventoryKind,
        typeId: newCategoryTypeId.trim() || newCategoryName.trim().toLowerCase().replace(/\s+/g, '_')
      },
      description: newCategoryDescription.trim()
    };

    if (editingId) {
      saveCategories(categories.map(c => c.id === editingId ? { ...c, ...entryData } : c));
    } else {
      saveCategories([...categories, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetCategoryForm();
  }

  function editCategory(c) {
    setEditingId(c.id);
    setNewCategoryName(c.name);
    setNewCategoryYieldFormula(c.yieldFormula || '3d');
    setNewCategoryInventoryKind(c.inventoryOutput?.inventoryKind || 'food');
    setNewCategoryTypeId(c.inventoryOutput?.typeId || '');
    setNewCategoryDescription(c.description || '');
    setShowAdd(true);
  }

  function resetCategoryForm() {
    setEditingId(null);
    setNewCategoryName('');
    setNewCategoryYieldFormula('3d');
    setNewCategoryInventoryKind('food');
    setNewCategoryTypeId('');
    setNewCategoryDescription('');
    setShowAdd(false);
  }

  // Add or update item
  function addItem() {
    if (!newItemName.trim()) {
      alert('Enter item name');
      return;
    }

    const entryData = {
      name: newItemName.trim(),
      inventoryKind: newItemInventoryKind,
      typeId: newItemTypeId.trim() || newItemName.trim().toLowerCase().replace(/\s+/g, '_'),
      yieldFormula: newItemYieldFormula || '3d',
      rarity: newItemRarity,
      description: newItemDescription.trim()
    };

    if (editingId) {
      saveItems(items.map(i => i.id === editingId ? { ...i, ...entryData } : i));
    } else {
      saveItems([...items, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetItemForm();
  }

  function editItem(i) {
    setEditingId(i.id);
    setNewItemName(i.name);
    setNewItemInventoryKind(i.inventoryKind || 'food');
    setNewItemTypeId(i.typeId || '');
    setNewItemYieldFormula(i.yieldFormula || '3d');
    setNewItemRarity(i.rarity || 'Common');
    setNewItemDescription(i.description || '');
    setShowAdd(true);
  }

  function resetItemForm() {
    setEditingId(null);
    setNewItemName('');
    setNewItemInventoryKind('food');
    setNewItemTypeId('');
    setNewItemYieldFormula('3d');
    setNewItemRarity('Common');
    setNewItemDescription('');
    setShowAdd(false);
  }

  // Delete handlers
  function confirmDelete(type, id, name) {
    setDeleteConfirm({ type, id, name });
  }

  function executeDelete() {
    if (!deleteConfirm) return;

    switch (deleteConfirm.type) {
      case 'species':
        saveSpecies(species.filter(s => s.id !== deleteConfirm.id));
        break;
      case 'tool':
        saveTools(tools.filter(t => t.id !== deleteConfirm.id));
        break;
      case 'table':
        saveTables(tables.filter(t => t.id !== deleteConfirm.id));
        break;
      case 'environment':
        saveEnvironments(environments.filter(e => e.id !== deleteConfirm.id));
        break;
      case 'bait':
        saveBait(bait.filter(b => b.id !== deleteConfirm.id));
        break;
      case 'category':
        saveCategories(categories.filter(c => c.id !== deleteConfirm.id));
        break;
      case 'item':
        saveItems(items.filter(i => i.id !== deleteConfirm.id));
        break;
    }
    setDeleteConfirm(null);
  }

  // Add table entry
  function addTableEntry() {
    setNewTableEntries([
      ...newTableEntries,
      { id: crypto.randomUUID(), rollValue: newTableEntries.length + 2, resultType: 'nothing', speciesId: null, text: '' }
    ]);
  }

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Delete "{deleteConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={executeDelete} className="px-4 py-2 bg-red-600 rounded">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex gap-2 border-b border-gray-700 pb-2 flex-wrap">
        <button onClick={() => { setView('species'); setShowAdd(false); }} className={`px-3 py-1 rounded ${view === 'species' ? 'bg-blue-600' : 'bg-gray-700'}`}>Species</button>
        <button onClick={() => { setView('categories'); setShowAdd(false); }} className={`px-3 py-1 rounded ${view === 'categories' ? 'bg-blue-600' : 'bg-gray-700'}`}>Categories</button>
        <button onClick={() => { setView('items'); setShowAdd(false); }} className={`px-3 py-1 rounded ${view === 'items' ? 'bg-blue-600' : 'bg-gray-700'}`}>Items</button>
        <button onClick={() => { setView('tools'); setShowAdd(false); }} className={`px-3 py-1 rounded ${view === 'tools' ? 'bg-blue-600' : 'bg-gray-700'}`}>Tools</button>
        <button onClick={() => { setView('tables'); setShowAdd(false); }} className={`px-3 py-1 rounded ${view === 'tables' ? 'bg-blue-600' : 'bg-gray-700'}`}>Tables</button>
        <button onClick={() => { setView('environments'); setShowAdd(false); }} className={`px-3 py-1 rounded ${view === 'environments' ? 'bg-blue-600' : 'bg-gray-700'}`}>Environments</button>
        <button onClick={() => { setView('bait'); setShowAdd(false); }} className={`px-3 py-1 rounded ${view === 'bait' ? 'bg-blue-600' : 'bg-gray-700'}`}>Bait</button>
        <button onClick={() => { setView('campaign'); setShowAdd(false); }} className={`px-3 py-1 rounded ${view === 'campaign' ? 'bg-blue-600' : 'bg-gray-700'}`}>Campaign Day</button>
      </div>

      {/* Species View */}
      {view === 'species' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-bold">Species ({species.length})</h3>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
              <Plus size={16} className="inline" /> Add Species
            </button>
          </div>

          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input
                    value={newSpeciesName}
                    onChange={(e) => setNewSpeciesName(e.target.value)}
                    placeholder="e.g., Coastal Trout"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type</label>
                  <select value={newSpeciesType} onChange={(e) => setNewSpeciesType(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                    <option value="fish">Fish</option>
                    <option value="shellfish">Shellfish</option>
                    <option value="crustacean">Crustacean</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIES_TAGS.map(tag => (
                    <label key={tag} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={newSpeciesTags.includes(tag)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewSpeciesTags([...newSpeciesTags, tag]);
                          } else {
                            setNewSpeciesTags(newSpeciesTags.filter(t => t !== tag));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      {tag}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Food Type</label>
                  <select value={newSpeciesFoodType} onChange={(e) => setNewSpeciesFoodType(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                    {availableFoodTypes.length > 0 ? (
                      availableFoodTypes.map(ft => (
                        <option key={ft} value={ft}>{ft.charAt(0).toUpperCase() + ft.slice(1)}</option>
                      ))
                    ) : (
                      <>
                        <option value="fish">Fish</option>
                        <option value="shellfish">Shellfish</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Meat Yield Formula</label>
                  <input
                    value={newSpeciesMeatFormula}
                    onChange={(e) => setNewSpeciesMeatFormula(e.target.value)}
                    placeholder="e.g., 2d+1"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Secondary Material</label>
                  <select value={newSpeciesSecondaryType} onChange={(e) => setNewSpeciesSecondaryType(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                    <option value="">None</option>
                    {FISH_SECONDARY_MATERIALS.map(mat => (
                      <option key={mat} value={mat}>{mat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Secondary Yield Formula</label>
                  <input
                    value={newSpeciesSecondaryFormula}
                    onChange={(e) => setNewSpeciesSecondaryFormula(e.target.value)}
                    placeholder="e.g., 1d"
                    disabled={!newSpeciesSecondaryType}
                    className="w-full bg-gray-600 px-3 py-2 rounded disabled:opacity-50"
                  />
                </div>
              </div>

              {newSpeciesSecondaryType && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Secondary Name Override (optional)</label>
                  <input
                    value={newSpeciesSecondaryNameOverride}
                    onChange={(e) => setNewSpeciesSecondaryNameOverride(e.target.value)}
                    placeholder={`Default: ${newSpeciesName || 'Species'} ${newSpeciesSecondaryType || 'Material'}`}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank for "{newSpeciesName || 'Species'} {newSpeciesSecondaryType || 'Material'}"</p>
                </div>
              )}

              {newSpeciesTags.includes('LargeFish') && (
                <div className="w-1/2">
                  <label className="block text-xs text-gray-400 mb-1">ST (for struggle, {FISH_ST_RANGE.min}-{FISH_ST_RANGE.max})</label>
                  <input
                    type="number"
                    value={newSpeciesST}
                    onChange={(e) => setNewSpeciesST(e.target.value)}
                    min={FISH_ST_RANGE.min}
                    max={FISH_ST_RANGE.max}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={addSpecies} className="flex-1 bg-green-600 px-4 py-2 rounded">
                  <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetSpeciesForm} className="bg-red-600 px-4 py-2 rounded">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {species.length === 0 ? (
              <p className="text-gray-500 italic">No species defined. Add some to enable fishing!</p>
            ) : (
              species.map(s => (
                <div key={s.id} className="bg-gray-700 rounded">
                  <div
                    className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
                    onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                  >
                    <span>{expanded[s.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                    <span className="flex-1 font-medium">{s.name}</span>
                    <span className="text-sm text-gray-400">{s.type}</span>
                    {s.tags?.includes('LargeFish') && (
                      <span className="text-xs bg-orange-600 px-2 py-1 rounded">Large</span>
                    )}
                  </div>
                  {expanded[s.id] && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-600 pt-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-400">Meat:</span> {s.yieldMeatFormula} → {s.foodType}</div>
                        {s.secondaryMaterialType && (
                          <div><span className="text-gray-400">Secondary:</span> {s.yieldSecondaryFormula} → {s.secondaryNameOverride || `${s.name} ${s.secondaryMaterialType}`}</div>
                        )}
                        {s.st && <div><span className="text-gray-400">ST:</span> {s.st}</div>}
                      </div>
                      {s.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.tags.map(tag => (
                            <span key={tag} className="text-xs bg-gray-600 px-2 py-1 rounded">{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); editSpecies(s); }}
                          className="text-blue-400 text-sm"
                        >
                          <Edit2 size={14} className="inline mr-1" /> Edit
                        </button>
                        <button
                          onClick={() => confirmDelete('species', s.id, s.name)}
                          className="text-red-400 text-sm"
                        >
                          <Trash2 size={14} className="inline mr-1" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Categories View */}
      {view === 'categories' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-bold">Foraging Categories ({categories.length})</h3>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
              <Plus size={16} className="inline" /> Add Category
            </button>
          </div>

          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Fruits"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Yield Formula</label>
                  <input
                    value={newCategoryYieldFormula}
                    onChange={(e) => setNewCategoryYieldFormula(e.target.value)}
                    placeholder="e.g., 3d+1"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Inventory Type</label>
                  <select value={newCategoryInventoryKind} onChange={(e) => setNewCategoryInventoryKind(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                    <option value="food">Food</option>
                    <option value="material">Material</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type ID</label>
                  {newCategoryInventoryKind === 'food' ? (
                    <select value={newCategoryTypeId} onChange={(e) => setNewCategoryTypeId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                      <option value="">Auto-generate from name</option>
                      {FORAGING_FOOD_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  ) : (
                    <select value={newCategoryTypeId} onChange={(e) => setNewCategoryTypeId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                      <option value="">Auto-generate from name</option>
                      {FORAGING_MATERIAL_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <input
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="Brief description of this category..."
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={addCategory} className="flex-1 bg-green-600 px-4 py-2 rounded">
                  <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetCategoryForm} className="bg-red-600 px-4 py-2 rounded">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-gray-500 italic">No categories defined. Add some to enable foraging!</p>
            ) : (
              categories.map(c => (
                <div key={c.id} className="bg-gray-700 rounded">
                  <div
                    className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
                    onClick={() => setExpanded(prev => ({ ...prev, [`cat-${c.id}`]: !prev[`cat-${c.id}`] }))}
                  >
                    <span>{expanded[`cat-${c.id}`] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                    <span className="flex-1 font-medium">{c.name}</span>
                    <span className="text-sm text-gray-400">{c.yieldFormula}</span>
                    <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                      {c.inventoryOutput?.inventoryKind || 'food'}
                    </span>
                  </div>
                  {expanded[`cat-${c.id}`] && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-600 pt-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-400">Type ID:</span> {c.inventoryOutput?.typeId || 'N/A'}</div>
                        <div><span className="text-gray-400">Yield:</span> {c.yieldFormula}</div>
                      </div>
                      {c.description && (
                        <div className="text-sm text-gray-400">{c.description}</div>
                      )}
                      <div className="flex gap-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); editCategory(c); }}
                          className="text-blue-400 text-sm"
                        >
                          <Edit2 size={14} className="inline mr-1" /> Edit
                        </button>
                        <button
                          onClick={() => confirmDelete('category', c.id, c.name)}
                          className="text-red-400 text-sm"
                        >
                          <Trash2 size={14} className="inline mr-1" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Items View */}
      {view === 'items' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-bold">Forageable Items ({items.length})</h3>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
              <Plus size={16} className="inline" /> Add Item
            </button>
          </div>

          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g., Tamrya Berries"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Yield Formula</label>
                  <input
                    value={newItemYieldFormula}
                    onChange={(e) => setNewItemYieldFormula(e.target.value)}
                    placeholder="e.g., 3d+1"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Inventory Type</label>
                  <select value={newItemInventoryKind} onChange={(e) => setNewItemInventoryKind(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                    <option value="food">Food</option>
                    <option value="material">Material</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type ID</label>
                  {newItemInventoryKind === 'food' ? (
                    <select value={newItemTypeId} onChange={(e) => setNewItemTypeId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                      <option value="">Auto-generate from name</option>
                      {FORAGING_FOOD_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  ) : (
                    <select value={newItemTypeId} onChange={(e) => setNewItemTypeId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                      <option value="">Auto-generate from name</option>
                      {FORAGING_MATERIAL_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rarity</label>
                  <select value={newItemRarity} onChange={(e) => setNewItemRarity(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                    {Object.entries(FORAGING_RARITIES).map(([key, data]) => (
                      <option key={key} value={key}>{data.label} ({data.penalty})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Description</label>
                  <input
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                    placeholder="Brief description..."
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={addItem} className="flex-1 bg-green-600 px-4 py-2 rounded">
                  <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetItemForm} className="bg-red-600 px-4 py-2 rounded">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-gray-500 italic">No items defined. Add specific forageable items!</p>
            ) : (
              items.map(i => {
                const rarityData = FORAGING_RARITIES[i.rarity];
                return (
                  <div key={i.id} className="bg-gray-700 rounded">
                    <div
                      className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => setExpanded(prev => ({ ...prev, [`item-${i.id}`]: !prev[`item-${i.id}`] }))}
                    >
                      <span>{expanded[`item-${i.id}`] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                      <span className="flex-1 font-medium">{i.name}</span>
                      <span className="text-sm text-gray-400">{i.yieldFormula}</span>
                      <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                        {i.inventoryKind || 'food'}
                      </span>
                      <span className="text-xs bg-purple-600 px-2 py-1 rounded">
                        {rarityData?.label || i.rarity}
                      </span>
                    </div>
                    {expanded[`item-${i.id}`] && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-600 pt-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-400">Type ID:</span> {i.typeId || 'N/A'}</div>
                          <div><span className="text-gray-400">Yield:</span> {i.yieldFormula}</div>
                          <div><span className="text-gray-400">Inventory:</span> {i.inventoryKind || 'food'}</div>
                          <div><span className="text-gray-400">Rarity:</span> {rarityData?.label || i.rarity} ({rarityData?.penalty || 0})</div>
                        </div>
                        {i.description && (
                          <div className="text-sm text-gray-400">{i.description}</div>
                        )}
                        <div className="flex gap-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); editItem(i); }}
                            className="text-blue-400 text-sm"
                          >
                            <Edit2 size={14} className="inline mr-1" /> Edit
                          </button>
                          <button
                            onClick={() => confirmDelete('item', i.id, i.name)}
                            className="text-red-400 text-sm"
                          >
                            <Trash2 size={14} className="inline mr-1" /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tools View */}
      {view === 'tools' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-bold">Gathering Tools ({tools.length})</h3>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
              <Plus size={16} className="inline" /> Add Tool
            </button>
          </div>

          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input
                    value={newToolName}
                    onChange={(e) => setNewToolName(e.target.value)}
                    placeholder="e.g., Quality Fishing Rod"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tool Type</label>
                  <select value={newToolType} onChange={(e) => setNewToolType(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                    {Object.entries(GATHERING_TOOL_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Allowed Modes</label>
                <div className="flex flex-wrap gap-2">
                  {GATHERING_MODES.map(mode => (
                    <label key={mode} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={newToolModes.includes(mode)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewToolModes([...newToolModes, mode]);
                          } else {
                            setNewToolModes(newToolModes.filter(m => m !== mode));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      {mode}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Allowed Methods (empty = all)</label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(FISHING_METHODS).map(method => (
                    <label key={method} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={newToolMethods.includes(method)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewToolMethods([...newToolMethods, method]);
                          } else {
                            setNewToolMethods(newToolMethods.filter(m => m !== method));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      {method}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Skill Bonus</label>
                  <input
                    type="number"
                    value={newToolSkillBonus}
                    onChange={(e) => setNewToolSkillBonus(e.target.value)}
                    placeholder="e.g., +1"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Durability (optional)</label>
                  <input
                    type="number"
                    value={newToolDurability}
                    onChange={(e) => setNewToolDurability(e.target.value)}
                    placeholder="Uses before breaking"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <input
                  value={newToolNotes}
                  onChange={(e) => setNewToolNotes(e.target.value)}
                  placeholder="Special properties..."
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={addTool} className="flex-1 bg-green-600 px-4 py-2 rounded">
                  <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetToolForm} className="bg-red-600 px-4 py-2 rounded">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {tools.length === 0 ? (
              <p className="text-gray-500 italic">No tools defined. Add fishing rods, nets, etc.</p>
            ) : (
              tools.map(t => (
                <div key={t.id} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                  <div>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-sm text-gray-400 ml-2">({GATHERING_TOOL_TYPES[t.toolType] || t.toolType})</span>
                    {t.bonuses?.find(b => b.type === 'skill_bonus')?.value > 0 && (
                      <span className="text-green-400 ml-2">+{t.bonuses.find(b => b.type === 'skill_bonus').value}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editTool(t)} className="text-blue-400">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => confirmDelete('tool', t.id, t.name)} className="text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tables View */}
      {view === 'tables' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-bold">Gathering Tables ({tables.length})</h3>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
              <Plus size={16} className="inline" /> Add Table
            </button>
          </div>

          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="e.g., Coastal Waters Catch Table"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Table Type</label>
                  <select value={newTableType} onChange={(e) => setNewTableType(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                    {GATHERING_TABLE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-gray-400">Roll Method</label>
                  <button
                    onClick={() => initializeTableEntries(newTableRollMethod)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                    type="button"
                  >
                    Initialize Entries
                  </button>
                </div>
                <select
                  value={newTableRollMethod}
                  onChange={(e) => {
                    setNewTableRollMethod(e.target.value);
                    if (newTableEntries.length === 0) {
                      initializeTableEntries(e.target.value);
                    }
                  }}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="2d6">2d6 (2-12, 11 entries)</option>
                  <option value="1d6">1d6 (1-6, 6 entries)</option>
                  <option value="3d6">3d6 (3-18, 16 entries)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Required entries: {getRollMethodRange(newTableRollMethod).count} | Current: {newTableEntries.length}
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-gray-400">Table Entries</label>
                  <button onClick={addTableEntry} className="text-sm text-blue-400">+ Add Entry</button>
                </div>
                {newTableEntries.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-2 mb-2 items-center">
                    <input
                      type="number"
                      value={entry.rollValue}
                      onChange={(e) => {
                        const updated = [...newTableEntries];
                        updated[idx].rollValue = parseInt(e.target.value);
                        setNewTableEntries(updated);
                      }}
                      className="w-16 bg-gray-600 px-2 py-1 rounded"
                      placeholder="Roll"
                    />
                    <select
                      value={entry.resultType}
                      onChange={(e) => {
                        const updated = [...newTableEntries];
                        updated[idx].resultType = e.target.value;
                        setNewTableEntries(updated);
                      }}
                      className="w-24 bg-gray-600 px-2 py-1 rounded"
                    >
                      <option value="species">Species</option>
                      <option value="nothing">Nothing</option>
                      <option value="event">Event</option>
                      <option value="special">Special</option>
                    </select>
                    {entry.resultType === 'species' && (
                      <select
                        value={entry.speciesId || ''}
                        onChange={(e) => {
                          const updated = [...newTableEntries];
                          updated[idx].speciesId = e.target.value;
                          setNewTableEntries(updated);
                        }}
                        className="flex-1 bg-gray-600 px-2 py-1 rounded"
                      >
                        <option value="">-- Select Species --</option>
                        {species.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                    {(entry.resultType === 'event' || entry.resultType === 'special') && (
                      <input
                        value={entry.text || ''}
                        onChange={(e) => {
                          const updated = [...newTableEntries];
                          updated[idx].text = e.target.value;
                          setNewTableEntries(updated);
                        }}
                        placeholder="Event text..."
                        className="flex-1 bg-gray-600 px-2 py-1 rounded"
                      />
                    )}
                    <button
                      onClick={() => setNewTableEntries(newTableEntries.filter((_, i) => i !== idx))}
                      className="text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={addTable} className="flex-1 bg-green-600 px-4 py-2 rounded">
                  <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetTableForm} className="bg-red-600 px-4 py-2 rounded">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {tables.length === 0 ? (
              <p className="text-gray-500 italic">No tables defined. Create catch and event tables.</p>
            ) : (
              tables.map(t => (
                <div key={t.id} className="bg-gray-700 rounded">
                  <div
                    className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
                    onClick={() => setExpanded(prev => ({ ...prev, [`table-${t.id}`]: !prev[`table-${t.id}`] }))}
                  >
                    <span>{expanded[`table-${t.id}`] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                    <span className="flex-1 font-medium">{t.name}</span>
                    <span className="text-sm text-gray-400">{t.tableType}</span>
                    <span className="text-xs bg-gray-600 px-2 py-1 rounded">{t.entries?.length || 0} entries</span>
                  </div>
                  {expanded[`table-${t.id}`] && (
                    <div className="px-3 pb-3 border-t border-gray-600 pt-2">
                      <div className="text-sm text-gray-400 mb-2">Roll: {t.rollMethod}</div>
                      {t.entries?.length > 0 && (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {t.entries.map(entry => {
                            const speciesName = entry.speciesId
                              ? species.find(s => s.id === entry.speciesId)?.name
                              : null;
                            return (
                              <div key={entry.id} className="text-sm flex gap-2">
                                <span className="text-gray-400 w-8">{entry.rollValue}:</span>
                                <span>
                                  {entry.resultType === 'species' && speciesName}
                                  {entry.resultType === 'nothing' && 'Nothing'}
                                  {(entry.resultType === 'event' || entry.resultType === 'special') && entry.text}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex gap-4 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); editTable(t); }}
                          className="text-blue-400 text-sm"
                        >
                          <Edit2 size={14} className="inline mr-1" /> Edit
                        </button>
                        <button
                          onClick={() => confirmDelete('table', t.id, t.name)}
                          className="text-red-400 text-sm"
                        >
                          <Trash2 size={14} className="inline mr-1" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Environments View */}
      {view === 'environments' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-bold">Environments ({environments.length})</h3>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
              <Plus size={16} className="inline" /> Add Environment
            </button>
          </div>

          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name *</label>
                <input
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  placeholder="e.g., Tuto Coastal Waters"
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Supported Modes</label>
                <div className="flex flex-wrap gap-2">
                  {GATHERING_MODES.map(mode => (
                    <label key={mode} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={newEnvModes.includes(mode)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewEnvModes([...newEnvModes, mode]);
                          } else {
                            setNewEnvModes(newEnvModes.filter(m => m !== mode));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      {mode}
                    </label>
                  ))}
                </div>
              </div>

              {newEnvModes.includes('Fishing') && (
                <>
                  <div className="text-sm font-medium text-gray-300 mt-4 mb-2">Fishing Tables</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Catch Table</label>
                      <select value={newEnvCatchTableId} onChange={(e) => setNewEnvCatchTableId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                        <option value="">-- None --</option>
                        {tables.filter(t => t.tableType.includes('RandomCatch')).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Mild Event Table</label>
                      <select value={newEnvMildTableId} onChange={(e) => setNewEnvMildTableId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                        <option value="">-- None --</option>
                        {tables.filter(t => t.tableType.includes('EventMild')).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Rare Event Table</label>
                      <select value={newEnvRareTableId} onChange={(e) => setNewEnvRareTableId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                        <option value="">-- None --</option>
                        {tables.filter(t => t.tableType.includes('EventRare')).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {newEnvModes.includes('Foraging') && (
                <>
                  <div className="text-sm font-medium text-gray-300 mt-4 mb-2">Foraging Tables</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Find Table</label>
                      <select value={newEnvForagingFindTableId} onChange={(e) => setNewEnvForagingFindTableId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                        <option value="">-- None --</option>
                        {tables.filter(t => t.tableType.includes('ForagingRandomFind')).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Mild Event Table</label>
                      <select value={newEnvForagingMildTableId} onChange={(e) => setNewEnvForagingMildTableId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                        <option value="">-- None --</option>
                        {tables.filter(t => t.tableType.includes('ForagingEventMild')).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Rare Event Table</label>
                      <select value={newEnvForagingRareTableId} onChange={(e) => setNewEnvForagingRareTableId(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                        <option value="">-- None --</option>
                        {tables.filter(t => t.tableType.includes('ForagingEventRare')).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="w-1/3">
                <label className="block text-xs text-gray-400 mb-1">Skill Modifier</label>
                <input
                  type="number"
                  value={newEnvSkillMod}
                  onChange={(e) => setNewEnvSkillMod(e.target.value)}
                  placeholder="e.g., -1"
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={addEnvironment} className="flex-1 bg-green-600 px-4 py-2 rounded">
                  <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetEnvForm} className="bg-red-600 px-4 py-2 rounded">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {environments.length === 0 ? (
              <p className="text-gray-500 italic">No environments defined. Create fishing locations.</p>
            ) : (
              environments.map(e => (
                <div key={e.id} className="bg-gray-700 p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{e.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => editEnvironment(e)} className="text-blue-400">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => confirmDelete('environment', e.id, e.name)} className="text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Modes: {e.supportedModes?.join(', ') || 'All'}
                    {e.skillMod !== 0 && <span className="ml-2">Skill: {e.skillMod >= 0 ? '+' : ''}{e.skillMod}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bait View */}
      {view === 'bait' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-bold">Bait ({bait.length})</h3>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
              <Plus size={16} className="inline" /> Add Bait
            </button>
          </div>

          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input
                    value={newBaitName}
                    onChange={(e) => setNewBaitName(e.target.value)}
                    placeholder="e.g., Glowing Worms"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={newBaitQuantity}
                    onChange={(e) => setNewBaitQuantity(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Bait Tags</label>
                <div className="flex flex-wrap gap-2">
                  {BAIT_TAGS.map(tag => (
                    <label key={tag} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={newBaitTags.includes(tag)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewBaitTags([...newBaitTags, tag]);
                          } else {
                            setNewBaitTags(newBaitTags.filter(t => t !== tag));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      {tag}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Attracts Species (required) *</label>
                <select
                  multiple
                  value={newBaitAttracts}
                  onChange={(e) => setNewBaitAttracts(Array.from(e.target.selectedOptions, opt => opt.value))}
                  className="w-full bg-gray-600 px-3 py-2 rounded h-24"
                >
                  {species.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple. Bait must attract at least one species.</p>
              </div>

              <div className="w-1/3">
                <label className="block text-xs text-gray-400 mb-1">Roll Bonus (when used on random catch)</label>
                <input
                  type="number"
                  value={newBaitRollBonus}
                  onChange={(e) => setNewBaitRollBonus(e.target.value)}
                  min="0"
                  max="10"
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                />
                <p className="text-xs text-gray-500 mt-1">Added to catch table roll when line fishing</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={addBait} className="flex-1 bg-green-600 px-4 py-2 rounded">
                  <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
                </button>
                <button onClick={resetBaitForm} className="bg-red-600 px-4 py-2 rounded">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {bait.length === 0 ? (
              <p className="text-gray-500 italic">No bait defined. Add some for fishing bonuses.</p>
            ) : (
              bait.map(b => (
                <div key={b.id} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                  <div>
                    <span className="font-medium">{b.name}</span>
                    <span className="text-sm text-gray-400 ml-2">({b.quantity || 0} available)</span>
                    {b.rollBonus > 0 && (
                      <span className="text-green-400 ml-2">+{b.rollBonus} to catch roll</span>
                    )}
                    {b.baitTags?.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {b.baitTags.map(tag => (
                          <span key={tag} className="text-xs bg-gray-600 px-2 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={b.quantity || 0}
                      onChange={(e) => {
                        saveBait(bait.map(x => x.id === b.id ? { ...x, quantity: parseInt(e.target.value) || 0 } : x));
                      }}
                      className="w-20 bg-gray-600 px-2 py-1 rounded"
                    />
                    <button onClick={() => editBait(b)} className="text-blue-400">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => confirmDelete('bait', b.id, b.name)} className="text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Campaign Day View */}
      {view === 'campaign' && (
        <div>
          <h3 className="text-lg font-bold mb-4">Campaign Day Tracker</h3>
          <div className="bg-gray-700 p-4 rounded space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Current Campaign Day</label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={currentDay}
                  onChange={(e) => saveCurrentDay(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-32 bg-gray-600 px-3 py-2 rounded text-2xl font-bold text-center"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveCurrentDay(Math.max(1, currentDay - 1))}
                    className="bg-gray-600 px-4 py-2 rounded"
                  >
                    - Day
                  </button>
                  <button
                    onClick={() => saveCurrentDay(currentDay + 1)}
                    className="bg-blue-600 px-4 py-2 rounded"
                  >
                    + Day
                  </button>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              The campaign day is used to track daily events in gathering.
              Each gathering group can only trigger one daily event per day.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
