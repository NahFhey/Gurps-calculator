import React, { useState, useEffect } from 'react';
import { Edit2, ChefHat, Hammer, Package, Beaker, FileText, BookOpen, Fish, Swords, LayoutGrid } from 'lucide-react';
import { logger } from './utils/logger';
import { InventoryTab } from './components/InventoryTab';
import { CookingTab } from './components/CookingTab';
import { CraftingTab } from './components/CraftingTab';
import { ManagerTab } from './components/ManagerTab';
import { AlchemyTab } from './components/AlchemyTab';
import { ChangelogTab } from './components/ChangelogTab';
import { RulesTab } from './components/RulesTab';
import { DayPlannerTab } from './components/DayPlannerTab';
import { CombatTab } from './components/CombatTab';
import { PartyToolContainer } from './components/party-tool/PartyToolContainer';
import { VERSION } from './version';
import { UNIFIED_UI_ENABLED } from './constants';
import { InventoryProvider, useInventory } from './contexts/InventoryContext';
import { CraftingProvider, useCrafting } from './contexts/CraftingContext';
import { AlchemyProvider, useAlchemy } from './contexts/AlchemyContext';
import { GatheringProvider, useGathering } from './contexts/GatheringContext';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';
import { CombatProvider } from './contexts/CombatContext';
import { UnifiedShell } from './unified/UnifiedShell';
import { CampaignStoreProvider } from './state/campaignStore';
import { loadCampaignState } from './persistence/campaignStorage';
import { checkMigrationNeeded, migrateToV2 } from './persistence/dataMigration';

/**
 * Inner component that has access to all contexts
 * Extracts data from contexts to pass as props to legacy components
 */
function AppContent({ activeTab, setActiveTab }) {
  const inventory = useInventory();
  const crafting = useCrafting();
  const alchemy = useAlchemy();
  const gathering = useGathering();
  const config = useConfig();

  // Build prop objects for components that haven't been updated to use hooks yet
  const managerTabProps = {
    foodTypes: inventory.foodTypes,
    materialTypes: inventory.materialTypes,
    workers: config.workers,
    crafts: crafting.crafts,
    craftDesigns: crafting.craftDesigns,
    customTemplates: crafting.customTemplates,
    materials: inventory.materials,
    effectFamilyMap: alchemy.effectFamilyMap,
    alchemySettings: alchemy.alchemySettings,
    alchemyReagents: alchemy.alchemyReagents,
    alchemyFormulas: alchemy.alchemyFormulas,
    alchemyBatches: alchemy.alchemyBatches,
    alchemyLabs: alchemy.alchemyLabs,
    kitchens: config.kitchens,
    cookingSkills: config.cookingSkills,
    foods: inventory.foods,
    recipes: config.recipes,
    gmMode: config.gmMode,
    gmLockData: config.gmLockData,
    setGmMode: config.setGmMode,
    setGmLockData: config.setGmLockData,
    saveMaterials: inventory.saveMaterials,
    saveFoods: inventory.saveFoods,
    saveRecipes: config.saveRecipes,
    saveFoodTypes: inventory.saveFoodTypes,
    saveMaterialTypes: inventory.saveMaterialTypes,
    saveWorkers: config.saveWorkers,
    saveCrafts: crafting.saveCrafts,
    saveCraftDesigns: crafting.saveCraftDesigns,
    saveCustomTemplates: crafting.saveCustomTemplates,
    saveEffectFamilyMap: alchemy.saveEffectFamilyMap,
    saveAlchemySettings: alchemy.saveAlchemySettings,
    saveAlchemyReagents: alchemy.saveAlchemyReagents,
    saveAlchemyFormulas: alchemy.saveAlchemyFormulas,
    saveAlchemyBatches: alchemy.saveAlchemyBatches,
    saveAlchemyLabs: alchemy.saveAlchemyLabs,
    saveKitchens: config.saveKitchens,
    saveCookingSkills: config.saveCookingSkills,
    gatheringSpecies: gathering.gatheringSpecies,
    gatheringTools: gathering.gatheringTools,
    gatheringTables: gathering.gatheringTables,
    gatheringEnvironments: gathering.gatheringEnvironments,
    gatheringBait: gathering.gatheringBait,
    gatheringCategories: gathering.gatheringCategories,
    gatheringItems: gathering.gatheringItems,
    currentDay: gathering.currentDay,
    saveGatheringSpecies: gathering.saveGatheringSpecies,
    saveGatheringTools: gathering.saveGatheringTools,
    saveGatheringTables: gathering.saveGatheringTables,
    saveGatheringEnvironments: gathering.saveGatheringEnvironments,
    saveGatheringBait: gathering.saveGatheringBait,
    saveGatheringCategories: gathering.saveGatheringCategories,
    saveGatheringItems: gathering.saveGatheringItems,
    saveCurrentDay: gathering.saveCurrentDay
  };

  const dayPlannerTabProps = {
    species: gathering.gatheringSpecies,
    tools: gathering.gatheringTools,
    tables: gathering.gatheringTables,
    environments: gathering.gatheringEnvironments,
    bait: gathering.gatheringBait,
    categories: gathering.gatheringCategories,
    items: gathering.gatheringItems,
    workers: config.workers,
    foods: inventory.foods,
    materials: inventory.materials,
    foodTypes: inventory.foodTypes,
    materialTypes: inventory.materialTypes,
    timeSlots: gathering.timeSlots,
    taskAssignments: gathering.taskAssignments,
    pendingDayLedger: gathering.pendingDayLedger,
    currentDay: gathering.currentDay,
    currentSlot: gathering.currentSlot,
    saveTimeSlots: gathering.saveTimeSlots,
    saveTaskAssignments: gathering.saveTaskAssignments,
    savePendingDayLedger: gathering.savePendingDayLedger,
    saveCurrentDay: gathering.saveCurrentDay,
    saveCurrentSlot: gathering.saveCurrentSlot,
    saveFoods: inventory.saveFoods,
    saveMaterials: inventory.saveMaterials
  };

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
          <button onClick={() => setActiveTab('combat')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'combat' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <Swords size={20} />Combat
          </button>
          <button onClick={() => setActiveTab('party-tool')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'party-tool' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <LayoutGrid size={20} />Party Tool
          </button>
          <button onClick={() => setActiveTab('rules')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'rules' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <BookOpen size={20} />Rules
          </button>
          <button onClick={() => setActiveTab('changelog')} className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'changelog' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
            <FileText size={20} />Changelog
          </button>
        </div>

        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'cooking' && <CookingTab />}
        {activeTab === 'crafting' && <CraftingTab />}
        {activeTab === 'manager' && <ManagerTab {...managerTabProps} />}
        {activeTab === 'alchemy' && <AlchemyTab />}
        {activeTab === 'gathering' && <DayPlannerTab {...dayPlannerTabProps} />}
        {activeTab === 'combat' && <CombatTab />}
        {activeTab === 'party-tool' && <PartyToolContainer />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'changelog' && <ChangelogTab />}
      </div>
    </div>
  );
}

export default function GURPSPartyTool() {
  logger.log('GURPSPartyTool rendering');
  const [initialCampaignState, setInitialCampaignState] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [migrationStatus, setMigrationStatus] = useState('checking'); // 'checking' | 'migrating' | 'ready'

  // Check for migration on startup and load campaign state
  useEffect(() => {
    let cancelled = false;

    async function initializeApp() {
      try {
        logger.log('Checking for migration...');
        const needsMigration = await checkMigrationNeeded();

        if (needsMigration) {
          logger.log('Migration needed - running migration...');
          setMigrationStatus('migrating');

          const migratedState = await migrateToV2();

          if (migratedState && !cancelled) {
            logger.log('Migration successful');
            setInitialCampaignState(migratedState);
            setMigrationStatus('ready');
          } else {
            logger.error('Migration failed');
            setMigrationStatus('ready');
          }
        } else {
          logger.log('No migration needed - loading campaign state');
          const loadedState = await loadCampaignState();

          if (!cancelled) {
            setInitialCampaignState(loadedState);
            setMigrationStatus('ready');
          }
        }
      } catch (error) {
        logger.error('Error during initialization:', error);
        setMigrationStatus('ready');
      }
    }

    initializeApp();

    return () => {
      cancelled = true;
    };
  }, []);

  // Show loading screen while migration/initialization is in progress
  if (migrationStatus === 'checking') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-100">
        Checking for updates...
      </div>
    );
  }

  if (migrationStatus === 'migrating') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-100">
        <div className="text-center">
          <div className="text-xl mb-2">Migrating to new storage format...</div>
          <div className="text-sm text-gray-400">This may take a moment</div>
        </div>
      </div>
    );
  }

  // Wait for campaign state to load
  if (!initialCampaignState) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <CampaignStoreProvider initialCampaignState={initialCampaignState}>
      <InventoryProvider>
        <CraftingProvider>
          <AlchemyProvider>
            <GatheringProvider>
              <ConfigProvider>
                <CombatProvider>
                  {UNIFIED_UI_ENABLED ? (
                    <UnifiedShell />
                  ) : (
                    <AppContent activeTab={activeTab} setActiveTab={setActiveTab} />
                  )}
                </CombatProvider>
              </ConfigProvider>
            </GatheringProvider>
          </AlchemyProvider>
        </CraftingProvider>
      </InventoryProvider>
    </CampaignStoreProvider>
  );
}
