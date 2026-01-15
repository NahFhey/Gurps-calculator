import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, ChefHat, Hammer, Package, Beaker, FileText, BookOpen, Fish } from 'lucide-react';
import { TEMPLATES } from './constants';
import { safeParse } from './utils/helpers';
import { useKeyedDebouncedStorageSave } from './hooks/useStorage';
import { InventoryTab } from './components/InventoryTab';
import { CookingTab } from './components/CookingTab';
import { CraftingTab } from './components/CraftingTab';
import { ManagerTab } from './components/ManagerTab';
import { AlchemyTab } from './components/AlchemyTab';
import { ChangelogTab } from './components/ChangelogTab';
import { RulesTab } from './components/RulesTab';
import { GatheringTab } from './components/GatheringTab';
import { VERSION } from './version';

export default function GURPSPartyTool() {
  console.log('GURPSPartyTool rendering');
  const [activeTab, setActiveTab] = useState('inventory');
  const [materials, setMaterials] = useState([]);
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [crafts, setCrafts] = useState([]);
  const [foodTypes, setFoodTypes] = useState([
    { name: 'fish', color: '#60A5FA' },      // blue-400
    { name: 'poultry', color: '#F59E0B' },   // amber-500
    { name: 'meat', color: '#EF4444' },      // red-500
    { name: 'fruit', color: '#EC4899' },     // pink-500
    { name: 'vegetable', color: '#10B981' }  // green-500
  ]);
  const [craftDesigns, setCraftDesigns] = useState([]);
  const [materialTypes, setMaterialTypes] = useState([
    { name: 'wood', difficulty: -2, effects: '', ht: 10, drShift: 0, weightMod: -10, hpMod: 0 },
    { name: 'metal', difficulty: 0, effects: '', ht: 12, drShift: 0, weightMod: 0, hpMod: 0 },
    { name: 'leather', difficulty: -1, effects: '', ht: 8, drShift: 0, weightMod: -20, hpMod: -10 },
    { name: 'cloth', difficulty: -1, effects: '', ht: 6, drShift: 0, weightMod: -30, hpMod: -20 },
    { name: 'stone', difficulty: 1, effects: '', ht: 14, drShift: 0, weightMod: 50, hpMod: 10 }
  ]);
  const [workers, setWorkers] = useState([
    { id: '1', name: 'Worker 1', skills: { cooking: 10, designing: 10, crafting: 10, alchemy: 10, fishing: 10, stealth: 10, spear: 10, survival: 10, naturalist: 10, herbLore: 10 }, st: 10 },
    { id: '2', name: 'Worker 2', skills: { cooking: 10, designing: 10, crafting: 10, alchemy: 10, fishing: 10, stealth: 10, spear: 10, survival: 10, naturalist: 10, herbLore: 10 }, st: 10 },
    { id: '3', name: 'Worker 3', skills: { cooking: 10, designing: 10, crafting: 10, alchemy: 10, fishing: 10, stealth: 10, spear: 10, survival: 10, naturalist: 10, herbLore: 10 }, st: 10 }
  ]);
  const [customTemplates, setCustomTemplates] = useState({ weapons: {}, armor: {}, ranged: {}, explosives: {} });
  const [alchemyReagents, setAlchemyReagents] = useState([]);
  const [alchemyFormulas, setAlchemyFormulas] = useState([]);
  const [alchemyBatches, setAlchemyBatches] = useState([]);
  const [alchemyLabs, setAlchemyLabs] = useState([
    { id: 'default', name: 'Basic Lab', rating: 0, description: 'Standard workspace' }
  ]);
  const [kitchens, setKitchens] = useState([
    { id: 'default', name: 'Basic Kitchen', rating: 0, description: 'Standard cooking area' }
  ]);
  const [cookingSkills, setCookingSkills] = useState([]);
  const [effectFamilyMap, setEffectFamilyMap] = useState({});
  const [alchemySettings, setAlchemySettings] = useState({ defaultLabRating: 0, workBlockMinutes: 120 });
  const [loading, setLoading] = useState(true);
  const [gmMode, setGmMode] = useState(false);
  const [gmLockData, setGmLockData] = useState(null); // Stores gmLock from locked imports

  // Gathering system state
  const [gatheringSpecies, setGatheringSpecies] = useState([]);
  const [gatheringTools, setGatheringTools] = useState([]);
  const [gatheringTables, setGatheringTables] = useState([]);
  const [gatheringEnvironments, setGatheringEnvironments] = useState([]);
  const [gatheringSessions, setGatheringSessions] = useState([]);
  const [gatheringDailyEvents, setGatheringDailyEvents] = useState({}); // { dayKey: { groupKey: { rolled, resultType, ... } } }
  const [gatheringBait, setGatheringBait] = useState([]);
  const [gatheringCategories, setGatheringCategories] = useState([]); // Foraging categories
  const [gatheringItems, setGatheringItems] = useState([]); // Forageable items
  const [currentDay, setCurrentDay] = useState(1); // Campaign day counter

  // Day Planner system state
  const [timeSlots, setTimeSlots] = useState([]); // TimeSlot objects
  const [taskAssignments, setTaskAssignments] = useState([]); // TaskAssignment objects
  const [pendingDayLedger, setPendingDayLedger] = useState(null); // Current day's pending results
  const [currentSlot, setCurrentSlot] = useState(0); // Current slot index (0-2)

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    // Guard against missing storage
    if (!window?.storage?.get || !window?.storage?.set) {
      console.warn('Storage unavailable');
      setLoading(false);
      return;
    }

    try {
      const [matsR, foodsR, recipesR, craftsR, typesR, templatesR, matTypesR, workersR, reagentsR, formulasR, batchesR, labsR, kitchensR, cookingSkillsR, effectMapR, alchemySettingsR, craftDesignsR,
        speciesR, toolsR, tablesR, environmentsR, sessionsR, dailyEventsR, baitR, categoriesR, itemsR, currentDayR,
        timeSlotsR, taskAssignmentsR, pendingDayLedgerR, currentSlotR] = await Promise.all([
        window.storage.get('materials', true).catch(() => null),
        window.storage.get('foods', true).catch(() => null),
        window.storage.get('recipes', true).catch(() => null),
        window.storage.get('crafts', true).catch(() => null),
        window.storage.get('foodTypes', true).catch(() => null),
        window.storage.get('customTemplates', true).catch(() => null),
        window.storage.get('materialTypes', true).catch(() => null),
        window.storage.get('workers', true).catch(() => null),
        window.storage.get('alchemyReagents', true).catch(() => null),
        window.storage.get('alchemyFormulas', true).catch(() => null),
        window.storage.get('alchemyBatches', true).catch(() => null),
        window.storage.get('alchemyLabs', true).catch(() => null),
        window.storage.get('kitchens', true).catch(() => null),
        window.storage.get('cookingSkills', true).catch(() => null),
        window.storage.get('effectFamilyMap', true).catch(() => null),
        window.storage.get('alchemySettings', true).catch(() => null),
        window.storage.get('craftDesigns', true).catch(() => null),
        // Gathering system data
        window.storage.get('gatheringSpecies', true).catch(() => null),
        window.storage.get('gatheringTools', true).catch(() => null),
        window.storage.get('gatheringTables', true).catch(() => null),
        window.storage.get('gatheringEnvironments', true).catch(() => null),
        window.storage.get('gatheringSessions', true).catch(() => null),
        window.storage.get('gatheringDailyEvents', true).catch(() => null),
        window.storage.get('gatheringBait', true).catch(() => null),
        window.storage.get('gatheringCategories', true).catch(() => null),
        window.storage.get('gatheringItems', true).catch(() => null),
        window.storage.get('currentDay', true).catch(() => null),
        // Day Planner system data
        window.storage.get('timeSlots', true).catch(() => null),
        window.storage.get('taskAssignments', true).catch(() => null),
        window.storage.get('pendingDayLedger', true).catch(() => null),
        window.storage.get('currentSlot', true).catch(() => null)
      ]);
      if (matsR?.value) setMaterials(JSON.parse(matsR.value));
      if (foodsR?.value) setFoods(JSON.parse(foodsR.value));
      if (recipesR?.value) setRecipes(JSON.parse(recipesR.value));
      if (craftsR?.value) setCrafts(JSON.parse(craftsR.value));

      // Load workers with backward compatibility (convert string array to object array)
      if (workersR?.value) {
        const loadedWorkers = JSON.parse(workersR.value);
        if (Array.isArray(loadedWorkers) && loadedWorkers.length > 0) {
          if (typeof loadedWorkers[0] === 'string') {
            // Old format - convert to new format
            setWorkers(loadedWorkers.map((name, idx) => ({
              id: String(idx + 1),
              name,
              skills: { cooking: 10, designing: 10, crafting: 10, alchemy: 10, fishing: 10, stealth: 10, spear: 10 }
            })));
          } else {
            // New format - ensure all workers have required fields including gathering skills
            setWorkers(loadedWorkers.map((w, idx) => ({
              id: w.id || String(idx + 1),
              name: w.name || `Worker ${idx + 1}`,
              skills: {
                cooking: w.skills?.cooking ?? 10,
                designing: w.skills?.designing ?? 10,
                crafting: w.skills?.crafting ?? 10,
                alchemy: w.skills?.alchemy ?? 10,
                fishing: w.skills?.fishing ?? 10,
                stealth: w.skills?.stealth ?? 10,
                spear: w.skills?.spear ?? 10,
                survival: w.skills?.survival ?? 10,
                naturalist: w.skills?.naturalist ?? 10,
                herbLore: w.skills?.herbLore ?? 10
              },
              st: w.st ?? 10 // Strength for large fish struggle
            })));
          }
        }
      }

      // Load food types with backward compatibility (convert string array to object array)
      if (typesR?.value) {
        const loadedTypes = JSON.parse(typesR.value);
        if (Array.isArray(loadedTypes) && loadedTypes.length > 0) {
          if (typeof loadedTypes[0] === 'string') {
            // Old format - convert to new format
            const colors = ['#60A5FA', '#F59E0B', '#EF4444', '#EC4899', '#10B981', '#8B5CF6', '#06B6D4', '#F97316'];
            setFoodTypes(loadedTypes.map((name, idx) => ({ name, color: colors[idx % colors.length] })));
          } else {
            // New format
            setFoodTypes(loadedTypes);
          }
        }
      }

      // Load craft designs
      setCraftDesigns(safeParse(craftDesignsR?.value, []));

      // Load alchemy data with identification system migration
      const loadedReagents = safeParse(reagentsR?.value, []);
      const migratedReagents = loadedReagents.map(r => ({
        ...r,
        identificationLevel: r.identificationLevel ?? 0,
        analysisHistory: r.analysisHistory ?? [],
        falseProfile: r.falseProfile ?? null
      }));
      setAlchemyReagents(migratedReagents);

      setAlchemyFormulas(safeParse(formulasR?.value, []));
      setAlchemyBatches(safeParse(batchesR?.value, []));
      setAlchemyLabs(safeParse(labsR?.value, [{ id: 'default', name: 'Basic Lab', rating: 0, description: 'Standard workspace' }]));
      setKitchens(safeParse(kitchensR?.value, [{ id: 'default', name: 'Basic Kitchen', rating: 0, description: 'Standard cooking area' }]));
      setCookingSkills(safeParse(cookingSkillsR?.value, []));
      setEffectFamilyMap(safeParse(effectMapR?.value, {}));

      // Load alchemy settings with identification toggle
      const loadedSettings = safeParse(alchemySettingsR?.value, { defaultLabRating: 0, workBlockMinutes: 120 });
      setAlchemySettings({
        ...loadedSettings,
        showObviousRoles: loadedSettings.showObviousRoles ?? true
      });

      // Load and ensure material types have all required properties
      if (matTypesR?.value) {
        const loadedMatTypes = JSON.parse(matTypesR.value);
        const updatedMatTypes = loadedMatTypes.map(mt => ({
          ...mt,
          weightMod: mt.weightMod !== undefined ? mt.weightMod : 0,
          hpMod: mt.hpMod !== undefined ? mt.hpMod : 0
        }));
        setMaterialTypes(updatedMatTypes);
      }

      // Merge built-in templates with custom templates
      let templates = templatesR?.value ? JSON.parse(templatesR.value) : { weapons: {}, armor: {}, ranged: {}, explosives: {} };
      let needsSave = false;

      ['weapons', 'armor', 'ranged', 'explosives'].forEach(type => {
        Object.keys(TEMPLATES[type]).forEach(name => {
          if (!templates[type][name]) {
            templates[type][name] = {...TEMPLATES[type][name], materials: []};
            needsSave = true;
          } else if (!templates[type][name].materials) {
            templates[type][name].materials = [];
            needsSave = true;
          }
        });
      });

      setCustomTemplates(templates);
      if (needsSave) {
        try { await window.storage.set('customTemplates', JSON.stringify(templates), true); } catch (e) {}
      }

      // Load gathering system data
      setGatheringSpecies(safeParse(speciesR?.value, []));
      setGatheringTools(safeParse(toolsR?.value, []));
      setGatheringTables(safeParse(tablesR?.value, []));
      setGatheringEnvironments(safeParse(environmentsR?.value, []));
      setGatheringSessions(safeParse(sessionsR?.value, []));
      setGatheringDailyEvents(safeParse(dailyEventsR?.value, {}));
      setGatheringBait(safeParse(baitR?.value, []));
      setGatheringCategories(safeParse(categoriesR?.value, []));
      setGatheringItems(safeParse(itemsR?.value, []));
      setCurrentDay(safeParse(currentDayR?.value, 1));

      // Load Day Planner system data
      setTimeSlots(safeParse(timeSlotsR?.value, []));
      setTaskAssignments(safeParse(taskAssignmentsR?.value, []));
      setPendingDayLedger(safeParse(pendingDayLedgerR?.value, null));
      setCurrentSlot(safeParse(currentSlotR?.value, 0));
    } catch (error) {
      console.error('Error loading:', error);
    }
    setLoading(false);
  }

  async function saveMaterials(d) {
    setMaterials(d);
    debouncedStorageSave('materials', d);
  }
  async function saveFoods(d) {
    setFoods(d);
    debouncedStorageSave('foods', d);
  }
  async function saveRecipes(d) {
    setRecipes(d);
    debouncedStorageSave('recipes', d);
  }
  async function saveCrafts(d) {
    setCrafts(d);
    debouncedStorageSave('crafts', d);
  }
  async function saveFoodTypes(d) {
    setFoodTypes(d);
    debouncedStorageSave('foodTypes', d);
  }
  async function saveMaterialTypes(d) {
    setMaterialTypes(d);
    debouncedStorageSave('materialTypes', d);
  }
  async function saveWorkers(d) {
    setWorkers(d);
    debouncedStorageSave('workers', d);
  }
  async function saveCustomTemplates(d) {
    setCustomTemplates(d);
    debouncedStorageSave('customTemplates', d);
  }
  async function saveAlchemyReagents(d) {
    setAlchemyReagents(d);
    debouncedStorageSave('alchemyReagents', d);
  }
  async function saveAlchemyFormulas(d) {
    setAlchemyFormulas(d);
    debouncedStorageSave('alchemyFormulas', d);
  }
  async function saveAlchemyBatches(d) {
    setAlchemyBatches(d);
    debouncedStorageSave('alchemyBatches', d);
  }
  async function saveAlchemyLabs(d) {
    setAlchemyLabs(d);
    debouncedStorageSave('alchemyLabs', d);
  }
  async function saveKitchens(d) {
    setKitchens(d);
    debouncedStorageSave('kitchens', d);
  }
  async function saveCookingSkills(d) {
    setCookingSkills(d);
    debouncedStorageSave('cookingSkills', d);
  }
  async function saveEffectFamilyMap(d) {
    setEffectFamilyMap(d);
    debouncedStorageSave('effectFamilyMap', d);
  }
  async function saveAlchemySettings(d) {
    setAlchemySettings(d);
    debouncedStorageSave('alchemySettings', d);
  }
  async function saveCraftDesigns(d) {
    setCraftDesigns(d);
    debouncedStorageSave('craftDesigns', d);
  }

  // Gathering system save functions
  async function saveGatheringSpecies(d) {
    setGatheringSpecies(d);
    debouncedStorageSave('gatheringSpecies', d);
  }
  async function saveGatheringTools(d) {
    setGatheringTools(d);
    debouncedStorageSave('gatheringTools', d);
  }
  async function saveGatheringTables(d) {
    setGatheringTables(d);
    debouncedStorageSave('gatheringTables', d);
  }
  async function saveGatheringEnvironments(d) {
    setGatheringEnvironments(d);
    debouncedStorageSave('gatheringEnvironments', d);
  }
  async function saveGatheringSessions(d) {
    setGatheringSessions(d);
    debouncedStorageSave('gatheringSessions', d);
  }
  async function saveGatheringDailyEvents(d) {
    setGatheringDailyEvents(d);
    debouncedStorageSave('gatheringDailyEvents', d);
  }
  async function saveGatheringBait(d) {
    setGatheringBait(d);
    debouncedStorageSave('gatheringBait', d);
  }
  async function saveGatheringCategories(d) {
    setGatheringCategories(d);
    debouncedStorageSave('gatheringCategories', d);
  }
  async function saveGatheringItems(d) {
    setGatheringItems(d);
    debouncedStorageSave('gatheringItems', d);
  }
  async function saveCurrentDay(d) {
    setCurrentDay(d);
    debouncedStorageSave('currentDay', d);
  }

  // Day Planner system save functions
  async function saveTimeSlots(d) {
    setTimeSlots(d);
    debouncedStorageSave('timeSlots', d);
  }
  async function saveTaskAssignments(d) {
    setTaskAssignments(d);
    debouncedStorageSave('taskAssignments', d);
  }
  async function savePendingDayLedger(d) {
    setPendingDayLedger(d);
    debouncedStorageSave('pendingDayLedger', d);
  }
  async function saveCurrentSlot(d) {
    setCurrentSlot(d);
    debouncedStorageSave('currentSlot', d);
  }

  // Keyed debounced storage writer - maintains separate timers per key
  const debouncedStorageSave = useKeyedDebouncedStorageSave(500);

  // Cascade material type rename to all dependent structures
  function renameMaterialType(oldName, newName) {
    // Update material types
    saveMaterialTypes(materialTypes.map(mt =>
      mt.name === oldName ? {...mt, name: newName} : mt
    ));

    // Update materials that use this type
    saveMaterials(materials.map(m =>
      m.type === oldName ? {...m, type: newName} : m
    ));

    // Update all template material requirements
    const updatedTemplates = {};
    Object.keys(customTemplates).forEach(templateType => {
      updatedTemplates[templateType] = {};
      Object.keys(customTemplates[templateType]).forEach(templateName => {
        const template = customTemplates[templateType][templateName];
        updatedTemplates[templateType][templateName] = {
          ...template,
          materials: (template.materials || []).map(mat =>
            mat.type === oldName ? {...mat, type: newName} : mat
          )
        };
      });
    });
    saveCustomTemplates(updatedTemplates);
  }

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6 text-center">
          GURPS Party Management <span className="text-xl text-gray-400">v{VERSION}</span>
        </h1>
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          <button onClick={() => setActiveTab('inventory')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'inventory' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <Package size={20} />Inventory
          </button>
          <button onClick={() => setActiveTab('cooking')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'cooking' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <ChefHat size={20} />Cooking
          </button>
          <button onClick={() => setActiveTab('crafting')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'crafting' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <Hammer size={20} />Crafting
          </button>
          <button onClick={() => setActiveTab('manager')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'manager' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <Edit2 size={20} />Manager
          </button>
          <button onClick={() => setActiveTab('alchemy')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'alchemy' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <Beaker size={20} />Alchemy
          </button>
          <button onClick={() => setActiveTab('gathering')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'gathering' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <Fish size={20} />Gathering
          </button>
          <button onClick={() => setActiveTab('rules')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'rules' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <BookOpen size={20} />Rules
          </button>
          <button onClick={() => setActiveTab('changelog')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'changelog' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <FileText size={20} />Changelog
          </button>
        </div>

        {activeTab === 'inventory' && <InventoryTab materials={materials} foods={foods} foodTypes={foodTypes} materialTypes={materialTypes} gmMode={gmMode} saveMaterials={saveMaterials} saveFoods={saveFoods} />}
        {activeTab === 'cooking' && <CookingTab foods={foods} recipes={recipes} saveFoods={saveFoods} saveRecipes={saveRecipes} workers={workers} kitchens={kitchens} cookingSkills={cookingSkills} />}
        {activeTab === 'crafting' && <CraftingTab materials={materials} crafts={crafts} craftDesigns={craftDesigns} customTemplates={customTemplates} materialTypes={materialTypes} workers={workers} saveMaterials={saveMaterials} saveCrafts={saveCrafts} saveCraftDesigns={saveCraftDesigns} />}
        {activeTab === 'manager' && <ManagerTab foodTypes={foodTypes} materialTypes={materialTypes} workers={workers} crafts={crafts} craftDesigns={craftDesigns} customTemplates={customTemplates} materials={materials} effectFamilyMap={effectFamilyMap} alchemySettings={alchemySettings} alchemyReagents={alchemyReagents} alchemyFormulas={alchemyFormulas} alchemyBatches={alchemyBatches} alchemyLabs={alchemyLabs} kitchens={kitchens} cookingSkills={cookingSkills} foods={foods} recipes={recipes} gmMode={gmMode} gmLockData={gmLockData} setGmMode={setGmMode} setGmLockData={setGmLockData} saveMaterials={saveMaterials} saveFoods={saveFoods} saveRecipes={saveRecipes} saveFoodTypes={saveFoodTypes} saveMaterialTypes={saveMaterialTypes} saveWorkers={saveWorkers} saveCrafts={saveCrafts} saveCraftDesigns={saveCraftDesigns} saveCustomTemplates={saveCustomTemplates} saveEffectFamilyMap={saveEffectFamilyMap} saveAlchemySettings={saveAlchemySettings} saveAlchemyReagents={saveAlchemyReagents} saveAlchemyFormulas={saveAlchemyFormulas} saveAlchemyBatches={saveAlchemyBatches} saveAlchemyLabs={saveAlchemyLabs} saveKitchens={saveKitchens} saveCookingSkills={saveCookingSkills} renameMaterialType={renameMaterialType}
          gatheringSpecies={gatheringSpecies} gatheringTools={gatheringTools} gatheringTables={gatheringTables} gatheringEnvironments={gatheringEnvironments} gatheringBait={gatheringBait} gatheringCategories={gatheringCategories} gatheringItems={gatheringItems} currentDay={currentDay}
          saveGatheringSpecies={saveGatheringSpecies} saveGatheringTools={saveGatheringTools} saveGatheringTables={saveGatheringTables} saveGatheringEnvironments={saveGatheringEnvironments} saveGatheringBait={saveGatheringBait} saveGatheringCategories={saveGatheringCategories} saveGatheringItems={saveGatheringItems} saveCurrentDay={saveCurrentDay}
        />}
        {activeTab === 'alchemy' && <AlchemyTab reagents={alchemyReagents} formulas={alchemyFormulas} batches={alchemyBatches} labs={alchemyLabs} workers={workers} alchemySettings={alchemySettings} saveReagents={saveAlchemyReagents} saveFormulas={saveAlchemyFormulas} saveBatches={saveAlchemyBatches} saveLabs={saveAlchemyLabs} />}
        {activeTab === 'gathering' && <GatheringTab
          species={gatheringSpecies}
          tools={gatheringTools}
          tables={gatheringTables}
          environments={gatheringEnvironments}
          sessions={gatheringSessions}
          dailyEvents={gatheringDailyEvents}
          bait={gatheringBait}
          categories={gatheringCategories}
          items={gatheringItems}
          workers={workers}
          foods={foods}
          materials={materials}
          foodTypes={foodTypes}
          materialTypes={materialTypes}
          currentDay={currentDay}
          saveSessions={saveGatheringSessions}
          saveDailyEvents={saveGatheringDailyEvents}
          saveFoods={saveFoods}
          saveMaterials={saveMaterials}
        />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'changelog' && <ChangelogTab />}
      </div>
    </div>
  );
}
