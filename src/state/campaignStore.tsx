import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  campaignReducer,
  createCampaignState,
  CampaignState,
  LegacyAppState,
  LogEntry
} from './campaignReducer';
import { saveCampaignState } from '../persistence/campaignStorage';
import type {
  Id,
  Character,
  Material,
  Food,
  Recipe,
  FoodType,
  MaterialType,
  Craft,
  CraftDesign,
  CustomTemplates,
  AlchemyReagent,
  AlchemyFormula,
  AlchemyBatch,
  AlchemyLab,
  AlchemySettings,
  GatheringSpecies,
  GatheringTool,
  GatheringTable,
  GatheringEnvironment,
  GatheringSession,
  GatheringBait,
  GatheringCategory,
  GatheringItem,
  GatheringDailyEvents,
  TimeSlot,
  TaskAssignment,
  DayLedger,
  CombatCharacter,
  CombatSession,
  CombatItem,
  Kitchen,
  CookingSkill,
  EffectFamilyMap,
  Inventory
} from '../types/campaign';

type CampaignStoreValue = {
  state: CampaignState;
  actions: {
    // UI Actions
    setActiveModule: (moduleId: string) => void;
    selectCharacter: (id: string | null) => void;
    toggleGmMode: () => void;
    setGmUnlocked: (value: boolean) => void;
    toggleDebug: () => void;
    setActivitiesSubview: (view: string | null) => void;

    // Time & Activities
    advanceTime: () => void;
    setPausedSessionIds: (ids: string[]) => void;
    setActivitiesState: (payload: Partial<CampaignState['activities']>) => void;
    setPartyToolState: (payload: CampaignState['activities']['partyToolState']) => void;
    setToolReservations: (payload: Record<string, string[]>) => void;

    // Logs & Checkpoints
    addLogEntry: (payload: LogEntry) => void;
    setLogsEntries: (payload: LogEntry[]) => void;
    createCheckpoint: (label: string) => void;
    restoreCheckpoint: (id: string) => void;
    importCampaignState: (state: CampaignState, label?: string) => void;
    applyDebugState: (state: CampaignState) => void;

    // Combat (legacy)
    startCombat: (encounterId?: string) => void;
    registerCombatDamage: (targetId: string, remainingHp: number) => void;
    registerCombatDefenseSuccess: (targetId: string, defense: { dodge?: number }) => void;

    // Character Actions
    addCharacter: (character: Character) => void;
    updateCharacter: (id: Id, changes: Partial<Character>) => void;
    removeCharacter: (id: Id) => void;
    setCharacters: (characters: Record<Id, Character>) => void;

    // Material Actions
    addMaterial: (material: Material) => void;
    updateMaterial: (id: Id, changes: Partial<Material>) => void;
    removeMaterial: (id: Id) => void;
    consumeMaterials: (materials: Array<{ id: Id; amount: number }>) => void;
    setMaterials: (materials: Record<Id, Material>) => void;

    // Food Actions
    addFood: (food: Food) => void;
    updateFood: (id: Id, changes: Partial<Food>) => void;
    removeFood: (id: Id) => void;
    consumeFoods: (foods: Array<{ id: Id; amount: number }>) => void;
    setFoods: (foods: Record<Id, Food>) => void;

    // Recipe Actions
    addRecipe: (recipe: Recipe) => void;
    updateRecipe: (id: Id, changes: Partial<Recipe>) => void;
    removeRecipe: (id: Id) => void;
    setRecipes: (recipes: Record<Id, Recipe>) => void;

    // Type Actions
    setFoodTypes: (types: FoodType[]) => void;
    addFoodType: (type: FoodType) => void;
    setMaterialTypes: (types: MaterialType[]) => void;
    addMaterialType: (type: MaterialType) => void;

    // Craft Actions
    addCraft: (craft: Craft) => void;
    updateCraft: (id: Id, changes: Partial<Craft>) => void;
    removeCraft: (id: Id) => void;
    completeCraft: (id: Id, finalStats: Craft['finalStats']) => void;
    setCrafts: (crafts: Record<Id, Craft>) => void;

    // Craft Design Actions
    addCraftDesign: (design: CraftDesign) => void;
    updateCraftDesign: (id: Id, changes: Partial<CraftDesign>) => void;
    removeCraftDesign: (id: Id) => void;
    setCraftDesigns: (designs: Record<Id, CraftDesign>) => void;

    // Template Actions
    setCustomTemplates: (templates: CustomTemplates) => void;
    addCustomTemplate: (category: keyof CustomTemplates, templateName: string, template: any) => void;

    // Alchemy Actions
    addAlchemyReagent: (reagent: AlchemyReagent) => void;
    updateAlchemyReagent: (id: Id, changes: Partial<AlchemyReagent>) => void;
    removeAlchemyReagent: (id: Id) => void;
    setAlchemyReagents: (reagents: Record<Id, AlchemyReagent>) => void;
    addAlchemyFormula: (formula: AlchemyFormula) => void;
    updateAlchemyFormula: (id: Id, changes: Partial<AlchemyFormula>) => void;
    removeAlchemyFormula: (id: Id) => void;
    setAlchemyFormulas: (formulas: Record<Id, AlchemyFormula>) => void;
    addAlchemyBatch: (batch: AlchemyBatch) => void;
    updateAlchemyBatch: (id: Id, changes: Partial<AlchemyBatch>) => void;
    removeAlchemyBatch: (id: Id) => void;
    setAlchemyBatches: (batches: Record<Id, AlchemyBatch>) => void;
    setAlchemyLabs: (labs: Record<Id, AlchemyLab>) => void;
    addAlchemyLab: (lab: AlchemyLab) => void;
    updateAlchemySettings: (settings: Partial<AlchemySettings>) => void;

    // Gathering Actions
    setGatheringSpecies: (species: Record<Id, GatheringSpecies>) => void;
    addGatheringSpecies: (species: GatheringSpecies) => void;
    setGatheringTools: (tools: Record<Id, GatheringTool>) => void;
    addGatheringTool: (tool: GatheringTool) => void;
    setGatheringTables: (tables: Record<Id, GatheringTable>) => void;
    addGatheringTable: (table: GatheringTable) => void;
    setGatheringEnvironments: (environments: Record<Id, GatheringEnvironment>) => void;
    addGatheringEnvironment: (environment: GatheringEnvironment) => void;
    addGatheringSession: (session: GatheringSession) => void;
    updateGatheringSession: (id: Id, changes: Partial<GatheringSession>) => void;
    setGatheringSessions: (sessions: Record<Id, GatheringSession>) => void;
    setGatheringDailyEvents: (events: GatheringDailyEvents) => void;
    setGatheringBait: (bait: Record<Id, GatheringBait>) => void;
    addGatheringBait: (bait: GatheringBait) => void;
    setGatheringCategories: (categories: Record<Id, GatheringCategory>) => void;
    addGatheringCategory: (category: GatheringCategory) => void;
    setGatheringItems: (items: Record<Id, GatheringItem>) => void;
    addGatheringItem: (item: GatheringItem) => void;

    // Day Planner Actions
    setTimeSlots: (slots: TimeSlot[]) => void;
    addTaskAssignment: (task: TaskAssignment) => void;
    updateTaskAssignment: (id: Id, changes: Partial<TaskAssignment>) => void;
    setTaskAssignments: (tasks: TaskAssignment[]) => void;
    setPendingDayLedger: (ledger: DayLedger | null) => void;

    // Combat Actions
    addCombatCharacter: (character: CombatCharacter) => void;
    updateCombatCharacter: (id: Id, changes: Partial<CombatCharacter>) => void;
    removeCombatCharacter: (id: Id) => void;
    setCombatCharacters: (characters: Record<Id, CombatCharacter>) => void;
    setCombatActive: (session: CombatSession | null) => void;
    updateCombatActive: (changes: Partial<CombatSession>) => void;
    setCombatHistory: (history: CombatSession[]) => void;
    setCombatTombstones: (tombstones: CombatCharacter[]) => void;
    setCombatRulesPreset: (preset: string) => void;
    setCombatItems: (items: Record<Id, CombatItem>) => void;
    addCombatItem: (item: CombatItem) => void;

    // Config Actions
    setKitchens: (kitchens: Record<Id, Kitchen>) => void;
    addKitchen: (kitchen: Kitchen) => void;
    setCookingSkills: (skills: CookingSkill[]) => void;
    setEffectFamilyMap: (map: EffectFamilyMap) => void;

    // Inventory Actions
    addInventory: (inventory: Inventory) => void;
    updateInventory: (id: Id, changes: Partial<Inventory>) => void;
    setInventories: (inventories: Record<Id, Inventory>) => void;
  };
};

const CampaignStoreContext = createContext<CampaignStoreValue | undefined>(undefined);

type CampaignStoreProviderProps = {
  children: React.ReactNode;
  initialLegacyAppState?: LegacyAppState;
  initialCampaignState?: CampaignState;
};

export function CampaignStoreProvider({
  children,
  initialLegacyAppState,
  initialCampaignState
}: CampaignStoreProviderProps) {
  const [state, dispatch] = useReducer(
    campaignReducer,
    initialCampaignState ?? initialLegacyAppState,
    (initialArg) => {
      if (initialArg && typeof initialArg === 'object' && 'ui' in initialArg) {
        return initialArg as CampaignState;
      }
      return createCampaignState(initialArg as LegacyAppState | undefined);
    }
  );
  const saveTimeoutRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  const actions = useMemo(
    () => ({
      setActiveModule: (moduleId: string) => dispatch({ type: 'setActiveModule', payload: moduleId }),
      selectCharacter: (id: string | null) => dispatch({ type: 'selectCharacter', payload: id }),
      toggleGmMode: () => dispatch({ type: 'toggleGmMode' }),
      setGmUnlocked: (value: boolean) => dispatch({ type: 'setGmUnlocked', payload: value }),
      toggleDebug: () => dispatch({ type: 'toggleDebug' }),
      setActivitiesSubview: (view: string | null) => dispatch({ type: 'setActivitiesSubview', payload: view }),
      advanceTime: () => dispatch({ type: 'advanceTime' }),
      setPausedSessionIds: (ids: string[]) => dispatch({ type: 'setPausedSessionIds', payload: ids }),
      setActivitiesState: (payload: Partial<CampaignState['activities']>) =>
        dispatch({ type: 'setActivitiesState', payload }),
      setPartyToolState: (payload: CampaignState['activities']['partyToolState']) =>
        dispatch({ type: 'setPartyToolState', payload }),
      setToolReservations: (payload: Record<string, string[]>) =>
        dispatch({ type: 'setToolReservations', payload }),
      addLogEntry: (payload: LogEntry) => dispatch({ type: 'addLogEntry', payload }),
      setLogsEntries: (payload: LogEntry[]) => dispatch({ type: 'setLogsEntries', payload }),
      createCheckpoint: (label: string) => dispatch({ type: 'createCheckpoint', payload: label }),
      restoreCheckpoint: (id: string) => dispatch({ type: 'restoreCheckpoint', payload: id }),
      importCampaignState: (state: CampaignState, label?: string) =>
        dispatch({ type: 'importCampaignState', payload: { state, label } }),
      startCombat: (encounterId?: string) =>
        dispatch({ type: 'startCombat', payload: encounterId ? { encounterId } : undefined }),
      registerCombatDamage: (targetId: string, remainingHp: number) =>
        dispatch({ type: 'registerCombatDamage', payload: { targetId, remainingHp } }),
      registerCombatDefenseSuccess: (targetId: string, defense: { dodge?: number }) =>
        dispatch({ type: 'registerCombatDefenseSuccess', payload: { targetId, defense } }),
      applyDebugState: (state: CampaignState) => dispatch({ type: 'applyDebugState', payload: state }),

      // Character Actions
      addCharacter: (character: Character) => dispatch({ type: 'addCharacter', payload: character }),
      updateCharacter: (id: Id, changes: Partial<Character>) =>
        dispatch({ type: 'updateCharacter', payload: { id, changes } }),
      removeCharacter: (id: Id) => dispatch({ type: 'removeCharacter', payload: id }),
      setCharacters: (characters: Record<Id, Character>) =>
        dispatch({ type: 'setCharacters', payload: characters }),

      // Material Actions
      addMaterial: (material: Material) => dispatch({ type: 'addMaterial', payload: material }),
      updateMaterial: (id: Id, changes: Partial<Material>) =>
        dispatch({ type: 'updateMaterial', payload: { id, changes } }),
      removeMaterial: (id: Id) => dispatch({ type: 'removeMaterial', payload: id }),
      consumeMaterials: (materials: Array<{ id: Id; amount: number }>) =>
        dispatch({ type: 'consumeMaterials', payload: materials }),
      setMaterials: (materials: Record<Id, Material>) => dispatch({ type: 'setMaterials', payload: materials }),

      // Food Actions
      addFood: (food: Food) => dispatch({ type: 'addFood', payload: food }),
      updateFood: (id: Id, changes: Partial<Food>) =>
        dispatch({ type: 'updateFood', payload: { id, changes } }),
      removeFood: (id: Id) => dispatch({ type: 'removeFood', payload: id }),
      consumeFoods: (foods: Array<{ id: Id; amount: number }>) =>
        dispatch({ type: 'consumeFoods', payload: foods }),
      setFoods: (foods: Record<Id, Food>) => dispatch({ type: 'setFoods', payload: foods }),

      // Recipe Actions
      addRecipe: (recipe: Recipe) => dispatch({ type: 'addRecipe', payload: recipe }),
      updateRecipe: (id: Id, changes: Partial<Recipe>) =>
        dispatch({ type: 'updateRecipe', payload: { id, changes } }),
      removeRecipe: (id: Id) => dispatch({ type: 'removeRecipe', payload: id }),
      setRecipes: (recipes: Record<Id, Recipe>) => dispatch({ type: 'setRecipes', payload: recipes }),

      // Type Actions
      setFoodTypes: (types: FoodType[]) => dispatch({ type: 'setFoodTypes', payload: types }),
      addFoodType: (type: FoodType) => dispatch({ type: 'addFoodType', payload: type }),
      setMaterialTypes: (types: MaterialType[]) => dispatch({ type: 'setMaterialTypes', payload: types }),
      addMaterialType: (type: MaterialType) => dispatch({ type: 'addMaterialType', payload: type }),

      // Craft Actions
      addCraft: (craft: Craft) => dispatch({ type: 'addCraft', payload: craft }),
      updateCraft: (id: Id, changes: Partial<Craft>) =>
        dispatch({ type: 'updateCraft', payload: { id, changes } }),
      removeCraft: (id: Id) => dispatch({ type: 'removeCraft', payload: id }),
      completeCraft: (id: Id, finalStats: Craft['finalStats']) =>
        dispatch({ type: 'completeCraft', payload: { id, finalStats } }),
      setCrafts: (crafts: Record<Id, Craft>) => dispatch({ type: 'setCrafts', payload: crafts }),

      // Craft Design Actions
      addCraftDesign: (design: CraftDesign) => dispatch({ type: 'addCraftDesign', payload: design }),
      updateCraftDesign: (id: Id, changes: Partial<CraftDesign>) =>
        dispatch({ type: 'updateCraftDesign', payload: { id, changes } }),
      removeCraftDesign: (id: Id) => dispatch({ type: 'removeCraftDesign', payload: id }),
      setCraftDesigns: (designs: Record<Id, CraftDesign>) =>
        dispatch({ type: 'setCraftDesigns', payload: designs }),

      // Template Actions
      setCustomTemplates: (templates: CustomTemplates) =>
        dispatch({ type: 'setCustomTemplates', payload: templates }),
      addCustomTemplate: (category: keyof CustomTemplates, templateName: string, template: any) =>
        dispatch({ type: 'addCustomTemplate', payload: { category, templateName, template } }),

      // Alchemy Actions
      addAlchemyReagent: (reagent: AlchemyReagent) =>
        dispatch({ type: 'addAlchemyReagent', payload: reagent }),
      updateAlchemyReagent: (id: Id, changes: Partial<AlchemyReagent>) =>
        dispatch({ type: 'updateAlchemyReagent', payload: { id, changes } }),
      removeAlchemyReagent: (id: Id) => dispatch({ type: 'removeAlchemyReagent', payload: id }),
      setAlchemyReagents: (reagents: Record<Id, AlchemyReagent>) =>
        dispatch({ type: 'setAlchemyReagents', payload: reagents }),
      addAlchemyFormula: (formula: AlchemyFormula) =>
        dispatch({ type: 'addAlchemyFormula', payload: formula }),
      updateAlchemyFormula: (id: Id, changes: Partial<AlchemyFormula>) =>
        dispatch({ type: 'updateAlchemyFormula', payload: { id, changes } }),
      removeAlchemyFormula: (id: Id) => dispatch({ type: 'removeAlchemyFormula', payload: id }),
      setAlchemyFormulas: (formulas: Record<Id, AlchemyFormula>) =>
        dispatch({ type: 'setAlchemyFormulas', payload: formulas }),
      addAlchemyBatch: (batch: AlchemyBatch) => dispatch({ type: 'addAlchemyBatch', payload: batch }),
      updateAlchemyBatch: (id: Id, changes: Partial<AlchemyBatch>) =>
        dispatch({ type: 'updateAlchemyBatch', payload: { id, changes } }),
      removeAlchemyBatch: (id: Id) => dispatch({ type: 'removeAlchemyBatch', payload: id }),
      setAlchemyBatches: (batches: Record<Id, AlchemyBatch>) =>
        dispatch({ type: 'setAlchemyBatches', payload: batches }),
      setAlchemyLabs: (labs: Record<Id, AlchemyLab>) => dispatch({ type: 'setAlchemyLabs', payload: labs }),
      addAlchemyLab: (lab: AlchemyLab) => dispatch({ type: 'addAlchemyLab', payload: lab }),
      updateAlchemySettings: (settings: Partial<AlchemySettings>) =>
        dispatch({ type: 'updateAlchemySettings', payload: settings }),

      // Gathering Actions
      setGatheringSpecies: (species: Record<Id, GatheringSpecies>) =>
        dispatch({ type: 'setGatheringSpecies', payload: species }),
      addGatheringSpecies: (species: GatheringSpecies) =>
        dispatch({ type: 'addGatheringSpecies', payload: species }),
      setGatheringTools: (tools: Record<Id, GatheringTool>) =>
        dispatch({ type: 'setGatheringTools', payload: tools }),
      addGatheringTool: (tool: GatheringTool) => dispatch({ type: 'addGatheringTool', payload: tool }),
      setGatheringTables: (tables: Record<Id, GatheringTable>) =>
        dispatch({ type: 'setGatheringTables', payload: tables }),
      addGatheringTable: (table: GatheringTable) => dispatch({ type: 'addGatheringTable', payload: table }),
      setGatheringEnvironments: (environments: Record<Id, GatheringEnvironment>) =>
        dispatch({ type: 'setGatheringEnvironments', payload: environments }),
      addGatheringEnvironment: (environment: GatheringEnvironment) =>
        dispatch({ type: 'addGatheringEnvironment', payload: environment }),
      addGatheringSession: (session: GatheringSession) =>
        dispatch({ type: 'addGatheringSession', payload: session }),
      updateGatheringSession: (id: Id, changes: Partial<GatheringSession>) =>
        dispatch({ type: 'updateGatheringSession', payload: { id, changes } }),
      setGatheringSessions: (sessions: Record<Id, GatheringSession>) =>
        dispatch({ type: 'setGatheringSessions', payload: sessions }),
      setGatheringDailyEvents: (events: GatheringDailyEvents) =>
        dispatch({ type: 'setGatheringDailyEvents', payload: events }),
      setGatheringBait: (bait: Record<Id, GatheringBait>) =>
        dispatch({ type: 'setGatheringBait', payload: bait }),
      addGatheringBait: (bait: GatheringBait) => dispatch({ type: 'addGatheringBait', payload: bait }),
      setGatheringCategories: (categories: Record<Id, GatheringCategory>) =>
        dispatch({ type: 'setGatheringCategories', payload: categories }),
      addGatheringCategory: (category: GatheringCategory) =>
        dispatch({ type: 'addGatheringCategory', payload: category }),
      setGatheringItems: (items: Record<Id, GatheringItem>) =>
        dispatch({ type: 'setGatheringItems', payload: items }),
      addGatheringItem: (item: GatheringItem) => dispatch({ type: 'addGatheringItem', payload: item }),

      // Day Planner Actions
      setTimeSlots: (slots: TimeSlot[]) => dispatch({ type: 'setTimeSlots', payload: slots }),
      addTaskAssignment: (task: TaskAssignment) => dispatch({ type: 'addTaskAssignment', payload: task }),
      updateTaskAssignment: (id: Id, changes: Partial<TaskAssignment>) =>
        dispatch({ type: 'updateTaskAssignment', payload: { id, changes } }),
      setTaskAssignments: (tasks: TaskAssignment[]) => dispatch({ type: 'setTaskAssignments', payload: tasks }),
      setPendingDayLedger: (ledger: DayLedger | null) =>
        dispatch({ type: 'setPendingDayLedger', payload: ledger }),

      // Combat Actions
      addCombatCharacter: (character: CombatCharacter) =>
        dispatch({ type: 'addCombatCharacter', payload: character }),
      updateCombatCharacter: (id: Id, changes: Partial<CombatCharacter>) =>
        dispatch({ type: 'updateCombatCharacter', payload: { id, changes } }),
      removeCombatCharacter: (id: Id) => dispatch({ type: 'removeCombatCharacter', payload: id }),
      setCombatCharacters: (characters: Record<Id, CombatCharacter>) =>
        dispatch({ type: 'setCombatCharacters', payload: characters }),
      setCombatActive: (session: CombatSession | null) =>
        dispatch({ type: 'setCombatActive', payload: session }),
      updateCombatActive: (changes: Partial<CombatSession>) =>
        dispatch({ type: 'updateCombatActive', payload: changes }),
      setCombatHistory: (history: CombatSession[]) => dispatch({ type: 'setCombatHistory', payload: history }),
      setCombatTombstones: (tombstones: CombatCharacter[]) =>
        dispatch({ type: 'setCombatTombstones', payload: tombstones }),
      setCombatRulesPreset: (preset: string) => dispatch({ type: 'setCombatRulesPreset', payload: preset }),
      setCombatItems: (items: Record<Id, CombatItem>) => dispatch({ type: 'setCombatItems', payload: items }),
      addCombatItem: (item: CombatItem) => dispatch({ type: 'addCombatItem', payload: item }),

      // Config Actions
      setKitchens: (kitchens: Record<Id, Kitchen>) => dispatch({ type: 'setKitchens', payload: kitchens }),
      addKitchen: (kitchen: Kitchen) => dispatch({ type: 'addKitchen', payload: kitchen }),
      setCookingSkills: (skills: CookingSkill[]) => dispatch({ type: 'setCookingSkills', payload: skills }),
      setEffectFamilyMap: (map: EffectFamilyMap) => dispatch({ type: 'setEffectFamilyMap', payload: map }),

      // Inventory Actions
      addInventory: (inventory: Inventory) => dispatch({ type: 'addInventory', payload: inventory }),
      updateInventory: (id: Id, changes: Partial<Inventory>) =>
        dispatch({ type: 'updateInventory', payload: { id, changes } }),
      setInventories: (inventories: Record<Id, Inventory>) =>
        dispatch({ type: 'setInventories', payload: inventories })
    }),
    []
  );

  const value = useMemo(
    () => ({
      state: {
        ...state,
        legacy: {
          appState: initialLegacyAppState ?? state.legacy.appState
        }
      },
      actions
    }),
    [actions, initialLegacyAppState, state]
  );

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      saveCampaignState(state).catch((error) => {
        console.error('Failed to save campaign state', error);
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state]);

  return <CampaignStoreContext.Provider value={value}>{children}</CampaignStoreContext.Provider>;
}

export function useCampaignStore() {
  const context = useContext(CampaignStoreContext);
  if (!context) {
    throw new Error('useCampaignStore must be used within CampaignStoreProvider');
  }
  return context;
}

export function useLegacyAppState() {
  return useCampaignStore().state.legacy.appState;
}

export function useCampaignCharacters() {
  const { state } = useCampaignStore();
  return Object.values(state.entities.characters);
}

export function useSelectedCharacterId() {
  return useCampaignStore().state.ui.selectedCharacterId;
}

export function useSelectedCharacter() {
  const { state } = useCampaignStore();
  const selectedId = state.ui.selectedCharacterId;
  return selectedId ? state.entities.characters[selectedId] : null;
}
