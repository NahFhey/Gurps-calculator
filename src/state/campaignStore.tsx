import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  campaignReducer,
  createCampaignState,
  CampaignState,
  LegacyAppState,
  LogEntry,
  CharacterPanelView
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
  Inventory,
  Facility,
  EncounterTemplate,
  AcquiredItem,
  InventoryOwner,
  AcquisitionSource
} from '../types/campaign';
import type {
  Location,
  LocationState,
  LocationModifiers,
  WeatherTable,
  WeatherEffects,
  TravelAction,
  ActiveWeather
} from '../types/location';
import type { DowntimeState } from '../types/downtime';
import type { ForageZoneProfile } from '../types/foraging';
import type { RevealState } from '../types/combatTracker';
import type {
  MapState,
  MapModel,
  MapId,
  TileId,
  TerrainId,
  MarkerId,
  LinkId,
  MapScale,
  TerrainModel,
  MarkerModel,
  LinkModel,
  TravelWizardState,
  TravelMode,
} from '../types/map';

type CampaignStoreValue = {
  state: CampaignState;
  actions: {
    // UI Actions
    setActiveModule: (moduleId: string) => void;
    selectCharacter: (id: string | null) => void;
    setCharacterPanelView: (view: CharacterPanelView) => void;
    toggleGmMode: () => void;
    setGmMode: (enabled: boolean) => void;
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

    // Forage Zone Profile Actions
    addForageZoneProfile: (zone: ForageZoneProfile) => void;
    updateForageZoneProfile: (id: Id, changes: Partial<ForageZoneProfile>) => void;
    removeForageZoneProfile: (id: Id) => void;

    // Downtime Actions
    setDowntime: (downtime: DowntimeState) => void;

    // Day Planner Actions
    setTimeSlots: (slots: TimeSlot[]) => void;
    addTaskAssignment: (task: TaskAssignment) => void;
    updateTaskAssignment: (id: Id, changes: Partial<TaskAssignment>) => void;
    setTaskAssignments: (tasks: TaskAssignment[]) => void;
    setPendingDayLedger: (ledger: DayLedger | null) => void;
    setDayPlannerSlot: (slot: number) => void;
    setTimeDay: (day: number) => void;

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
    setCombatRevealState: (revealState: RevealState | null) => void;

    // Encounter Template Actions (Phase 11c)
    addEncounterTemplate: (template: EncounterTemplate) => void;
    updateEncounterTemplate: (id: Id, changes: Partial<EncounterTemplate>) => void;
    removeEncounterTemplate: (id: Id) => void;
    setEncounterTemplates: (templates: Record<Id, EncounterTemplate>) => void;

    // Config Actions
    setKitchens: (kitchens: Record<Id, Kitchen>) => void;
    addKitchen: (kitchen: Kitchen) => void;
    setFacilities: (facilities: Record<Id, Facility>) => void;
    setCookingSkills: (skills: CookingSkill[]) => void;
    setEffectFamilyMap: (map: EffectFamilyMap) => void;

    // Inventory Actions
    addInventory: (inventory: Inventory) => void;
    updateInventory: (id: Id, changes: Partial<Inventory>) => void;
    setInventories: (inventories: Record<Id, Inventory>) => void;
    /** Inventory bus (Phase 12a.5): land an item with an owner. Always succeeds. */
    acquireItem: (item: AcquiredItem, owner: InventoryOwner, source: AcquisitionSource) => void;
    /** Inventory bus (Phase 12a.5): move an item/ref to a new owner. Always succeeds. */
    retagItem: (itemId: Id, newOwner: InventoryOwner) => void;

    // Location & Weather Actions
    setLocationsState: (payload: Partial<LocationState>) => void;
    addLocation: (location: Location) => void;
    updateLocation: (id: Id, changes: Partial<Location>) => void;
    removeLocation: (id: Id) => void;
    setCurrentLocation: (id: Id) => void;
    setLocationWeather: (locationId: Id, weather: ActiveWeather) => void;
    rollNewWeather: (locationId: Id) => void;
    addWeatherTable: (table: WeatherTable) => void;
    updateWeatherTable: (id: Id, changes: Partial<WeatherTable>) => void;
    removeWeatherTable: (id: Id) => void;
    addTravel: (travel: TravelAction) => void;
    updateTravel: (id: Id, changes: Partial<TravelAction>) => void;
    completeTravel: (id: Id) => void;
    cancelTravel: (id: Id) => void;
    // Custom climate/terrain
    addCustomClimate: (key: string, label: string) => void;
    removeCustomClimate: (key: string) => void;
    addCustomTerrain: (key: string, label: string) => void;
    removeCustomTerrain: (key: string) => void;
    setTerrainModifierOverrides: (overrides: Record<string, Partial<LocationModifiers>>) => void;
    setWeatherEffectOverrides: (overrides: Record<string, Partial<WeatherEffects>>) => void;

    // Map Actions
    setMaps: (maps: MapState) => void;
    mapCreateMap: (params: { name: string; description?: string; scaleMilesPerTile: MapScale; startTerrainId: TerrainId }) => void;
    mapDeleteMap: (mapId: MapId) => void;
    mapUpdateMap: (mapId: MapId, changes: Partial<Pick<MapModel, 'name' | 'description' | 'visionMode' | 'sightRangeTiles'>>) => void;
    mapSetActiveMap: (mapId: MapId | null) => void;
    mapSetTileTerrain: (mapId: MapId, tileId: TileId, terrainId: TerrainId) => void;
    mapStampTerrain: (mapId: MapId, tileIds: TileId[], terrainId: TerrainId) => void;
    mapSetTileElevation: (mapId: MapId, tileIds: TileId[], elevation: number | null) => void;
    mapAddTerrain: (mapId: MapId, terrain: TerrainModel) => void;
    mapUpdateTerrain: (mapId: MapId, terrainId: TerrainId, changes: Partial<TerrainModel>) => void;
    mapRemoveTerrain: (mapId: MapId, terrainId: TerrainId) => void;
    mapAddMarker: (mapId: MapId, marker: MarkerModel) => void;
    mapUpdateMarker: (mapId: MapId, markerId: MarkerId, changes: Partial<MarkerModel>) => void;
    mapRemoveMarker: (mapId: MapId, markerId: MarkerId) => void;
    mapAddLink: (link: LinkModel) => void;
    mapRemoveLink: (mapId: MapId, linkId: LinkId) => void;
    mapRevealTiles: (mapId: MapId, tileIds: TileId[]) => void;
    mapSetPartyTile: (mapId: MapId, tileId: TileId | null) => void;
    mapSetTravelWizard: (wizard: TravelWizardState) => void;
    mapClearTravelWizard: () => void;
    mapExecuteTravel: (params: { mapId: MapId; routeTileIds: TileId[]; destinationTileId: TileId; mode: TravelMode; gmOverride: boolean }) => void;
    mapSetPendingTerrain: (tileIds: TileId[]) => void;
    mapClearPendingTerrain: () => void;
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
      setCharacterPanelView: (view: 'sheet' | 'skills' | 'equipment' | 'inventory') => dispatch({ type: 'setCharacterPanelView', payload: view }),
      toggleGmMode: () => dispatch({ type: 'toggleGmMode' }),
      setGmMode: (enabled: boolean) => dispatch({ type: 'setGmMode', payload: enabled }),
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

      // Forage Zone Profile Actions
      addForageZoneProfile: (zone: ForageZoneProfile) =>
        dispatch({ type: 'addForageZoneProfile', payload: zone }),
      updateForageZoneProfile: (id: Id, changes: Partial<ForageZoneProfile>) =>
        dispatch({ type: 'updateForageZoneProfile', payload: { id, changes } }),
      removeForageZoneProfile: (id: Id) =>
        dispatch({ type: 'removeForageZoneProfile', payload: id }),

      // Downtime Actions
      setDowntime: (downtime: DowntimeState) => dispatch({ type: 'setDowntime', payload: downtime }),

      // Day Planner Actions
      setTimeSlots: (slots: TimeSlot[]) => dispatch({ type: 'setTimeSlots', payload: slots }),
      addTaskAssignment: (task: TaskAssignment) => dispatch({ type: 'addTaskAssignment', payload: task }),
      updateTaskAssignment: (id: Id, changes: Partial<TaskAssignment>) =>
        dispatch({ type: 'updateTaskAssignment', payload: { id, changes } }),
      setTaskAssignments: (tasks: TaskAssignment[]) => dispatch({ type: 'setTaskAssignments', payload: tasks }),
      setPendingDayLedger: (ledger: DayLedger | null) =>
        dispatch({ type: 'setPendingDayLedger', payload: ledger }),
      setDayPlannerSlot: (slot: number) => dispatch({ type: 'setDayPlannerSlot', payload: slot }),
      setTimeDay: (day: number) => dispatch({ type: 'setTimeDay', payload: day }),

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
      setCombatRevealState: (revealState: RevealState | null) =>
        dispatch({ type: 'setCombatRevealState', payload: revealState }),

      // Encounter Template Actions (Phase 11c)
      addEncounterTemplate: (template: EncounterTemplate) =>
        dispatch({ type: 'addEncounterTemplate', payload: template }),
      updateEncounterTemplate: (id: Id, changes: Partial<EncounterTemplate>) =>
        dispatch({ type: 'updateEncounterTemplate', payload: { id, changes } }),
      removeEncounterTemplate: (id: Id) =>
        dispatch({ type: 'removeEncounterTemplate', payload: id }),
      setEncounterTemplates: (templates: Record<Id, EncounterTemplate>) =>
        dispatch({ type: 'setEncounterTemplates', payload: templates }),

      // Config Actions
      setKitchens: (kitchens: Record<Id, Kitchen>) => dispatch({ type: 'setKitchens', payload: kitchens }),
      addKitchen: (kitchen: Kitchen) => dispatch({ type: 'addKitchen', payload: kitchen }),
      setFacilities: (facilities: Record<Id, Facility>) => dispatch({ type: 'setFacilities', payload: facilities }),
      setCookingSkills: (skills: CookingSkill[]) => dispatch({ type: 'setCookingSkills', payload: skills }),
      setEffectFamilyMap: (map: EffectFamilyMap) => dispatch({ type: 'setEffectFamilyMap', payload: map }),

      // Inventory Actions
      addInventory: (inventory: Inventory) => dispatch({ type: 'addInventory', payload: inventory }),
      updateInventory: (id: Id, changes: Partial<Inventory>) =>
        dispatch({ type: 'updateInventory', payload: { id, changes } }),
      setInventories: (inventories: Record<Id, Inventory>) =>
        dispatch({ type: 'setInventories', payload: inventories }),
      acquireItem: (item: AcquiredItem, owner: InventoryOwner, source: AcquisitionSource) =>
        dispatch({ type: 'inventory/itemAcquired', payload: { item, owner, source } }),
      retagItem: (itemId: Id, newOwner: InventoryOwner) =>
        dispatch({ type: 'inventory/itemRetagged', payload: { itemId, newOwner } }),

      // Location & Weather Actions
      setLocationsState: (payload: Partial<LocationState>) =>
        dispatch({ type: 'setLocationsState', payload }),
      addLocation: (location: Location) => dispatch({ type: 'addLocation', payload: location }),
      updateLocation: (id: Id, changes: Partial<Location>) =>
        dispatch({ type: 'updateLocation', payload: { id, changes } }),
      removeLocation: (id: Id) => dispatch({ type: 'removeLocation', payload: id }),
      setCurrentLocation: (id: Id) => dispatch({ type: 'setCurrentLocation', payload: id }),
      setLocationWeather: (locationId: Id, weather: ActiveWeather) =>
        dispatch({ type: 'setLocationWeather', payload: { locationId, weather } }),
      rollNewWeather: (locationId: Id) => dispatch({ type: 'rollNewWeather', payload: { locationId } }),
      addWeatherTable: (table: WeatherTable) => dispatch({ type: 'addWeatherTable', payload: table }),
      updateWeatherTable: (id: Id, changes: Partial<WeatherTable>) =>
        dispatch({ type: 'updateWeatherTable', payload: { id, changes } }),
      removeWeatherTable: (id: Id) => dispatch({ type: 'removeWeatherTable', payload: id }),
      addTravel: (travel: TravelAction) => dispatch({ type: 'addTravel', payload: travel }),
      updateTravel: (id: Id, changes: Partial<TravelAction>) =>
        dispatch({ type: 'updateTravel', payload: { id, changes } }),
      completeTravel: (id: Id) => dispatch({ type: 'completeTravel', payload: id }),
      cancelTravel: (id: Id) => dispatch({ type: 'cancelTravel', payload: id }),
      // Custom climate/terrain
      addCustomClimate: (key: string, label: string) =>
        dispatch({ type: 'addCustomClimate', payload: { key, label } }),
      removeCustomClimate: (key: string) =>
        dispatch({ type: 'removeCustomClimate', payload: key }),
      addCustomTerrain: (key: string, label: string) =>
        dispatch({ type: 'addCustomTerrain', payload: { key, label } }),
      removeCustomTerrain: (key: string) =>
        dispatch({ type: 'removeCustomTerrain', payload: key }),
      setTerrainModifierOverrides: (overrides: Record<string, Partial<LocationModifiers>>) =>
        dispatch({ type: 'setTerrainModifierOverrides', payload: overrides }),
      setWeatherEffectOverrides: (overrides: Record<string, Partial<WeatherEffects>>) =>
        dispatch({ type: 'setWeatherEffectOverrides', payload: overrides }),

      // Map Actions
      setMaps: (maps: MapState) => dispatch({ type: 'setMaps', payload: maps }),
      mapCreateMap: (params: { name: string; description?: string; scaleMilesPerTile: MapScale; startTerrainId: TerrainId }) =>
        dispatch({ type: 'map/createMap', payload: params }),
      mapDeleteMap: (mapId: MapId) => dispatch({ type: 'map/deleteMap', payload: mapId }),
      mapUpdateMap: (mapId: MapId, changes: Partial<Pick<MapModel, 'name' | 'description' | 'visionMode' | 'sightRangeTiles'>>) =>
        dispatch({ type: 'map/updateMap', payload: { mapId, changes } }),
      mapSetActiveMap: (mapId: MapId | null) => dispatch({ type: 'map/setActiveMap', payload: mapId }),
      mapSetTileTerrain: (mapId: MapId, tileId: TileId, terrainId: TerrainId) =>
        dispatch({ type: 'map/setTileTerrain', payload: { mapId, tileId, terrainId } }),
      mapStampTerrain: (mapId: MapId, tileIds: TileId[], terrainId: TerrainId) =>
        dispatch({ type: 'map/stampTerrain', payload: { mapId, tileIds, terrainId } }),
      mapSetTileElevation: (mapId: MapId, tileIds: TileId[], elevation: number | null) =>
        dispatch({ type: 'map/setTileElevation', payload: { mapId, tileIds, elevation } }),
      mapAddTerrain: (mapId: MapId, terrain: TerrainModel) =>
        dispatch({ type: 'map/addTerrain', payload: { mapId, terrain } }),
      mapUpdateTerrain: (mapId: MapId, terrainId: TerrainId, changes: Partial<TerrainModel>) =>
        dispatch({ type: 'map/updateTerrain', payload: { mapId, terrainId, changes } }),
      mapRemoveTerrain: (mapId: MapId, terrainId: TerrainId) =>
        dispatch({ type: 'map/removeTerrain', payload: { mapId, terrainId } }),
      mapAddMarker: (mapId: MapId, marker: MarkerModel) =>
        dispatch({ type: 'map/addMarker', payload: { mapId, marker } }),
      mapUpdateMarker: (mapId: MapId, markerId: MarkerId, changes: Partial<MarkerModel>) =>
        dispatch({ type: 'map/updateMarker', payload: { mapId, markerId, changes } }),
      mapRemoveMarker: (mapId: MapId, markerId: MarkerId) =>
        dispatch({ type: 'map/removeMarker', payload: { mapId, markerId } }),
      mapAddLink: (link: LinkModel) => dispatch({ type: 'map/addLink', payload: { link } }),
      mapRemoveLink: (mapId: MapId, linkId: LinkId) =>
        dispatch({ type: 'map/removeLink', payload: { mapId, linkId } }),
      mapRevealTiles: (mapId: MapId, tileIds: TileId[]) =>
        dispatch({ type: 'map/revealTiles', payload: { mapId, tileIds } }),
      mapSetPartyTile: (mapId: MapId, tileId: TileId | null) =>
        dispatch({ type: 'map/setPartyTile', payload: { mapId, tileId } }),
      mapSetTravelWizard: (wizard: TravelWizardState) =>
        dispatch({ type: 'map/setTravelWizard', payload: wizard }),
      mapClearTravelWizard: () => dispatch({ type: 'map/clearTravelWizard' }),
      mapExecuteTravel: (params: { mapId: MapId; routeTileIds: TileId[]; destinationTileId: TileId; mode: TravelMode; gmOverride: boolean }) =>
        dispatch({ type: 'map/executeTravel', payload: params }),
      mapSetPendingTerrain: (tileIds: TileId[]) =>
        dispatch({ type: 'map/setPendingTerrain', payload: tileIds }),
      mapClearPendingTerrain: () => dispatch({ type: 'map/clearPendingTerrain' }),

      // Storage cleanup
      clearCheckpoints: () => dispatch({ type: 'clearCheckpoints' }),
      clearLogs: () => dispatch({ type: 'clearLogs' }),
      clearCombatHistory: () => dispatch({ type: 'clearCombatHistory' }),
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
