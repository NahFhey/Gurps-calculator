import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  campaignReducer,
  createCampaignState,
  CampaignState,
  LegacyAppState,
  LogEntry,
  CharacterPanelView,
  PendingIntent
} from './campaignReducer';
import { saveCampaignState, CampaignStateConflictError } from '../persistence/campaignStorage';
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
  CombatItem,
  Kitchen,
  CookingSkill,
  EffectFamilyMap,
  Inventory,
  Facility,
  EncounterTemplate,
  AcquiredItem,
  InventoryOwner,
  AcquisitionSource,
  MealBuff,
  CurrencyConfig,
  PriceBookEntry,
  StudyConfig,
  StudyProject,
  ContactEntry,
  CharacterTemplateEntity
} from '../types/campaign';
import type {
  Location,
  LocationState,
  LocationModifiers,
  WeatherTable,
  WeatherEffects,
  ActiveWeather,
  ClimateType,
} from '../types/location';
import type { CalendarConfig } from '../utils/timeSystem';
import type { DowntimeState } from '../types/downtime';
import type { ForageZoneProfile } from '../types/foraging';
import type { CombatState, RevealState } from '../types/combatTracker';
import type { ReagentPromotedAction } from './inventory/inventoryActions';
import type {
  MapState,
  MapModel,
  MapId,
  TileId,
  TerrainId,
  MarkerId,
  LinkId,
  ImageLayerId,
  StructureLayerId,
  MapScale,
  TerrainModel,
  MarkerModel,
  LinkModel,
  MapImageLayer,
  StructureLayer,
} from '../types/map';
import type { Vehicle, VehicleTypeDef } from '../types/party';
import type { ArmJourneyInput } from './party/partyActions';

type CampaignStoreValue = {
  state: CampaignState;
  actions: {
    // UI Actions
    setActiveModule: (moduleId: string) => void;
    setPendingIntent: (intent: PendingIntent) => void;
    clearPendingIntent: () => void;
    selectCharacter: (id: string | null) => void;
    setCharacterPanelView: (view: CharacterPanelView) => void;
    toggleGmMode: () => void;
    setGmMode: (enabled: boolean) => void;
    setGmUnlocked: (value: boolean) => void;
    toggleDebug: () => void;
    setActivitiesSubview: (view: string | null) => void;
    setMealBuff: (buff: MealBuff | null) => void;

    // Time & Activities
    advanceTime: () => void;
    setCalendarConfig: (config: CalendarConfig) => void;
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
    upsertCharacterTemplate: (template: CharacterTemplateEntity) => void;
    removeCharacterTemplate: (id: Id) => void;

    // Material Actions
    addMaterial: (material: Material) => void;
    updateMaterial: (id: Id, changes: Partial<Material>) => void;
    removeMaterial: (id: Id) => void;
    consumeMaterials: (owner: InventoryOwner, entries: Array<{ name?: string; type?: string; quantity: number }>) => void;
    transferMaterial: (sourceOwner: InventoryOwner, targetOwner: InventoryOwner, entryId: Id, quantity: number) => void;

    // Food Actions
    addFood: (food: Food) => void;
    updateFood: (id: Id, changes: Partial<Food>) => void;
    removeFood: (id: Id) => void;
    consumeFoods: (owner: InventoryOwner, entries: Array<{ name?: string; type?: string; quantity: number }>) => void;
    transferFood: (sourceOwner: InventoryOwner, targetOwner: InventoryOwner, entryId: Id, quantity: number) => void;

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
    setCombatActive: (session: CombatState | null) => void;
    updateCombatActive: (changes: Partial<CombatState>) => void;
    setCombatHistory: (history: CombatState[]) => void;
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
    setCurrencyConfig: (config: CurrencyConfig) => void;
    setPriceBookEntry: (entry: PriceBookEntry) => void;
    removePriceBookEntry: (key: string) => void;
    setStudyConfig: (config: StudyConfig) => void;
    upsertStudyProject: (project: StudyProject) => void;
    removeStudyProject: (id: Id) => void;
    creditStudyHours: (projectId: Id, hours: number) => void;
    awardStudyPoint: (projectId: Id) => void;
    upsertContact: (contact: ContactEntry) => void;
    removeContact: (id: Id) => void;
    shiftContactModifier: (id: Id, delta: number, cause: string, dayKey: number) => void;

    // Inventory Actions
    addInventory: (inventory: Inventory) => void;
    updateInventory: (id: Id, changes: Partial<Inventory>) => void;
    setInventories: (inventories: Record<Id, Inventory>) => void;
    /** Inventory bus (Phase 12a.5): land an item with an owner. Always succeeds. */
    acquireItem: (item: AcquiredItem, owner: InventoryOwner, source: AcquisitionSource) => void;
    spendCurrency: (owner: InventoryOwner, currencyKey: string, amount: number) => void;
    /** Inventory bus (Phase 12a.5): move an item/ref to a new owner. Always succeeds. */
    retagItem: (itemId: Id, newOwner: InventoryOwner) => void;
    /** Explicitly set an item's attunement flag. Always succeeds. */
    setItemAttunement: (itemId: Id, attuned: boolean) => void;
    /** Explicitly set an item's magical flag. Always succeeds. */
    setItemMagical: (itemId: Id, magical: boolean) => void;
    /** Consume an item and optionally record it in the active combat session. Always succeeds. */
    consumeItem: (itemId: Id, quantity?: number, combat?: { participantId: Id; participantName: string; round: number }) => void;
    /** Restore a recorded combat consumption through acquire semantics. Always succeeds. */
    revertItemConsumption: (entryId: Id) => void;
    /** Promote party material or food stock into alchemy reagent stock atomically. */
    promoteReagent: (payload: ReagentPromotedAction['payload']) => void;

    // Location & Weather Actions
    setLocationsState: (payload: Partial<LocationState>) => void;
    addLocation: (location: Location) => void;
    updateLocation: (id: Id, changes: Partial<Location>) => void;
    removeLocation: (id: Id) => void;
    setCurrentLocation: (id: Id) => void;
    setMapWeather: (mapId: Id, weather: ActiveWeather) => void;
    rollNewWeather: (mapId: Id) => void;
    addWeatherTable: (table: WeatherTable) => void;
    updateWeatherTable: (id: Id, changes: Partial<WeatherTable>) => void;
    removeWeatherTable: (id: Id) => void;
    // Custom climate/terrain
    addCustomClimate: (key: string, label: string) => void;
    removeCustomClimate: (key: string) => void;
    addCustomTerrain: (key: string, label: string) => void;
    removeCustomTerrain: (key: string) => void;
    setTerrainModifierOverrides: (overrides: Record<string, Partial<LocationModifiers>>) => void;
    setWeatherEffectOverrides: (overrides: Record<string, Partial<WeatherEffects>>) => void;

    // Map Actions
    setMaps: (maps: MapState) => void;
    mapCreateMap: (params: { name: string; description?: string; scaleMilesPerTile: MapScale; startTerrainId: TerrainId; climate: ClimateType }) => void;
    mapDeleteMap: (mapId: MapId) => void;
    mapUpdateMap: (mapId: MapId, changes: Partial<Pick<MapModel, 'name' | 'description' | 'visionMode' | 'sightRangeTiles' | 'climate' | 'weatherTableId'>>) => void;
    mapSetActiveMap: (mapId: MapId | null) => void;
    mapSetTileTerrain: (mapId: MapId, tileId: TileId, terrainId: TerrainId, elevationOverride?: number) => void;
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
    mapAddImageLayer: (mapId: MapId, layer: MapImageLayer) => void;
    mapUpdateImageLayer: (mapId: MapId, layerId: ImageLayerId, changes: Partial<Omit<MapImageLayer, 'id'>>) => void;
    mapRemoveImageLayer: (mapId: MapId, layerId: ImageLayerId) => void;
    mapAddStructureLayer: (mapId: MapId, layer: StructureLayer) => void;
    mapUpdateStructureLayer: (mapId: MapId, layerId: StructureLayerId, changes: Partial<Omit<StructureLayer, 'id' | 'cells'>>) => void;
    mapRemoveStructureLayer: (mapId: MapId, layerId: StructureLayerId) => void;
    mapSetStructureCells: (mapId: MapId, layerId: StructureLayerId, tileIds: TileId[], terrainId: TerrainId | null) => void;
    mapRevealTiles: (mapId: MapId, tileIds: TileId[]) => void;
    mapSetPendingTerrain: (tileIds: TileId[]) => void;
    mapClearPendingTerrain: () => void;

    // Travel groups & vehicles
    partyCreateGroup: (params: { name: string; memberIds: Id[]; fromGroupId: Id }) => void;
    partyMoveMembers: (params: { memberIds: Id[]; toGroupId: Id }) => void;
    partyRenameGroup: (groupId: Id, name: string) => void;
    partySetActiveGroup: (groupId: Id) => void;
    partyBoardVehicle: (groupId: Id, vehicleId: Id) => void;
    partyDisembark: (groupId: Id) => void;
    partyPlaceGroup: (groupId: Id, mapId: MapId, tileId: TileId) => void;
    partyUpsertVehicle: (vehicle: Vehicle) => void;
    partyRemoveVehicle: (vehicleId: Id) => void;
    partyPlaceVehicle: (vehicleId: Id, mapId: MapId, tileId: TileId) => void;
    partyDockVehicle: (vehicleId: Id, carrierId: Id) => void;
    partyUndockVehicle: (vehicleId: Id) => void;
    partyUpsertVehicleType: (def: VehicleTypeDef) => void;
    partyRemoveVehicleType: (typeId: string) => void;
    partyArmJourney: (groupId: Id, journey: ArmJourneyInput) => void;
    partyPauseJourney: (groupId: Id) => void;
    partyResumeJourney: (groupId: Id) => void;
    partyAbortJourney: (groupId: Id) => void;
    partyRerouteJourney: (groupId: Id, routeTileIds: TileId[]) => void;
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
      setPendingIntent: (intent: PendingIntent) => dispatch({ type: 'setPendingIntent', payload: intent }),
      clearPendingIntent: () => dispatch({ type: 'clearPendingIntent' }),
      selectCharacter: (id: string | null) => dispatch({ type: 'selectCharacter', payload: id }),
      setCharacterPanelView: (view: 'sheet' | 'skills' | 'equipment' | 'inventory') => dispatch({ type: 'setCharacterPanelView', payload: view }),
      toggleGmMode: () => dispatch({ type: 'toggleGmMode' }),
      setGmMode: (enabled: boolean) => dispatch({ type: 'setGmMode', payload: enabled }),
      setGmUnlocked: (value: boolean) => dispatch({ type: 'setGmUnlocked', payload: value }),
      toggleDebug: () => dispatch({ type: 'toggleDebug' }),
      setActivitiesSubview: (view: string | null) => dispatch({ type: 'setActivitiesSubview', payload: view }),
      setMealBuff: (buff: MealBuff | null) => dispatch({ type: 'setMealBuff', payload: buff }),
      advanceTime: () => dispatch({ type: 'advanceTime' }),
      setCalendarConfig: (config: CalendarConfig) =>
        dispatch({ type: 'setCalendarConfig', payload: config }),
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
      upsertCharacterTemplate: (template: CharacterTemplateEntity) =>
        dispatch({ type: 'upsertCharacterTemplate', payload: template }),
      removeCharacterTemplate: (id: Id) =>
        dispatch({ type: 'removeCharacterTemplate', payload: id }),

      // Material Actions
      addMaterial: (material: Material) => dispatch({ type: 'addMaterial', payload: material }),
      updateMaterial: (id: Id, changes: Partial<Material>) =>
        dispatch({ type: 'updateMaterial', payload: { id, changes } }),
      removeMaterial: (id: Id) => dispatch({ type: 'removeMaterial', payload: id }),
      consumeMaterials: (owner: InventoryOwner, entries: Array<{ name?: string; type?: string; quantity: number }>) =>
        dispatch({ type: 'inventory/materialsConsumed', payload: { owner, entries } }),
      transferMaterial: (sourceOwner: InventoryOwner, targetOwner: InventoryOwner, entryId: Id, quantity: number) =>
        dispatch({ type: 'inventory/materialTransferred', payload: { sourceOwner, targetOwner, entryId, quantity } }),

      // Food Actions
      addFood: (food: Food) => dispatch({ type: 'addFood', payload: food }),
      updateFood: (id: Id, changes: Partial<Food>) =>
        dispatch({ type: 'updateFood', payload: { id, changes } }),
      removeFood: (id: Id) => dispatch({ type: 'removeFood', payload: id }),
      consumeFoods: (owner: InventoryOwner, entries: Array<{ name?: string; type?: string; quantity: number }>) =>
        dispatch({ type: 'inventory/foodsConsumed', payload: { owner, entries } }),
      transferFood: (sourceOwner: InventoryOwner, targetOwner: InventoryOwner, entryId: Id, quantity: number) =>
        dispatch({ type: 'inventory/foodTransferred', payload: { sourceOwner, targetOwner, entryId, quantity } }),

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
      setCombatActive: (session: CombatState | null) =>
        dispatch({ type: 'setCombatActive', payload: session }),
      updateCombatActive: (changes: Partial<CombatState>) =>
        dispatch({ type: 'updateCombatActive', payload: changes }),
      setCombatHistory: (history: CombatState[]) => dispatch({ type: 'setCombatHistory', payload: history }),
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
      setCurrencyConfig: (config: CurrencyConfig) => dispatch({ type: 'setCurrencyConfig', payload: config }),
      setPriceBookEntry: (entry: PriceBookEntry) => dispatch({ type: 'setPriceBookEntry', payload: entry }),
      removePriceBookEntry: (key: string) => dispatch({ type: 'removePriceBookEntry', payload: key }),
      setStudyConfig: (config: StudyConfig) => dispatch({ type: 'setStudyConfig', payload: config }),
      upsertStudyProject: (project: StudyProject) => dispatch({ type: 'upsertStudyProject', payload: project }),
      removeStudyProject: (id: Id) => dispatch({ type: 'removeStudyProject', payload: id }),
      creditStudyHours: (projectId: Id, hours: number) =>
        dispatch({ type: 'creditStudyHours', payload: { projectId, hours } }),
      awardStudyPoint: (projectId: Id) => dispatch({ type: 'awardStudyPoint', payload: projectId }),
      upsertContact: (contact: ContactEntry) => dispatch({ type: 'upsertContact', payload: contact }),
      removeContact: (id: Id) => dispatch({ type: 'removeContact', payload: id }),
      shiftContactModifier: (id: Id, delta: number, cause: string, dayKey: number) =>
        dispatch({ type: 'shiftContactModifier', payload: { id, delta, cause, dayKey } }),

      // Inventory Actions
      addInventory: (inventory: Inventory) => dispatch({ type: 'addInventory', payload: inventory }),
      updateInventory: (id: Id, changes: Partial<Inventory>) =>
        dispatch({ type: 'updateInventory', payload: { id, changes } }),
      setInventories: (inventories: Record<Id, Inventory>) =>
        dispatch({ type: 'setInventories', payload: inventories }),
      acquireItem: (item: AcquiredItem, owner: InventoryOwner, source: AcquisitionSource) =>
        dispatch({ type: 'inventory/itemAcquired', payload: { item, owner, source } }),
      spendCurrency: (owner: InventoryOwner, currencyKey: string, amount: number) =>
        dispatch({ type: 'inventory/currencySpent', payload: { owner, currencyKey, amount } }),
      retagItem: (itemId: Id, newOwner: InventoryOwner) =>
        dispatch({ type: 'inventory/itemRetagged', payload: { itemId, newOwner } }),
      setItemAttunement: (itemId: Id, attuned: boolean) =>
        dispatch({ type: 'inventory/itemAttunementSet', payload: { itemId, attuned } }),
      setItemMagical: (itemId: Id, magical: boolean) =>
        dispatch({ type: 'inventory/itemMagicalSet', payload: { itemId, magical } }),
      consumeItem: (itemId: Id, quantity?: number, combat?: { participantId: Id; participantName: string; round: number }) =>
        dispatch({ type: 'inventory/itemConsumed', payload: { itemId, quantity, combat } }),
      revertItemConsumption: (entryId: Id) =>
        dispatch({ type: 'inventory/itemConsumptionReverted', payload: { entryId } }),
      promoteReagent: (payload: ReagentPromotedAction['payload']) =>
        dispatch({ type: 'inventory/reagentPromoted', payload }),

      // Location & Weather Actions
      setLocationsState: (payload: Partial<LocationState>) =>
        dispatch({ type: 'setLocationsState', payload }),
      addLocation: (location: Location) => dispatch({ type: 'addLocation', payload: location }),
      updateLocation: (id: Id, changes: Partial<Location>) =>
        dispatch({ type: 'updateLocation', payload: { id, changes } }),
      removeLocation: (id: Id) => dispatch({ type: 'removeLocation', payload: id }),
      setCurrentLocation: (id: Id) => dispatch({ type: 'setCurrentLocation', payload: id }),
      setMapWeather: (mapId: Id, weather: ActiveWeather) =>
        dispatch({ type: 'setMapWeather', payload: { mapId, weather } }),
      rollNewWeather: (mapId: Id) => dispatch({ type: 'rollNewWeather', payload: { mapId } }),
      addWeatherTable: (table: WeatherTable) => dispatch({ type: 'addWeatherTable', payload: table }),
      updateWeatherTable: (id: Id, changes: Partial<WeatherTable>) =>
        dispatch({ type: 'updateWeatherTable', payload: { id, changes } }),
      removeWeatherTable: (id: Id) => dispatch({ type: 'removeWeatherTable', payload: id }),
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
      mapCreateMap: (params: { name: string; description?: string; scaleMilesPerTile: MapScale; startTerrainId: TerrainId; climate: ClimateType }) =>
        dispatch({ type: 'map/createMap', payload: params }),
      mapDeleteMap: (mapId: MapId) => dispatch({ type: 'map/deleteMap', payload: mapId }),
      mapUpdateMap: (mapId: MapId, changes: Partial<Pick<MapModel, 'name' | 'description' | 'visionMode' | 'sightRangeTiles' | 'climate' | 'weatherTableId'>>) =>
        dispatch({ type: 'map/updateMap', payload: { mapId, changes } }),
      mapSetActiveMap: (mapId: MapId | null) => dispatch({ type: 'map/setActiveMap', payload: mapId }),
      mapSetTileTerrain: (mapId: MapId, tileId: TileId, terrainId: TerrainId, elevationOverride?: number) =>
        dispatch({ type: 'map/setTileTerrain', payload: { mapId, tileId, terrainId, elevationOverride } }),
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
      mapAddImageLayer: (mapId: MapId, layer: MapImageLayer) =>
        dispatch({ type: 'map/addImageLayer', payload: { mapId, layer } }),
      mapUpdateImageLayer: (mapId: MapId, layerId: ImageLayerId, changes: Partial<Omit<MapImageLayer, 'id'>>) =>
        dispatch({ type: 'map/updateImageLayer', payload: { mapId, layerId, changes } }),
      mapRemoveImageLayer: (mapId: MapId, layerId: ImageLayerId) =>
        dispatch({ type: 'map/removeImageLayer', payload: { mapId, layerId } }),
      mapAddStructureLayer: (mapId: MapId, layer: StructureLayer) =>
        dispatch({ type: 'map/addStructureLayer', payload: { mapId, layer } }),
      mapUpdateStructureLayer: (mapId: MapId, layerId: StructureLayerId, changes: Partial<Omit<StructureLayer, 'id' | 'cells'>>) =>
        dispatch({ type: 'map/updateStructureLayer', payload: { mapId, layerId, changes } }),
      mapRemoveStructureLayer: (mapId: MapId, layerId: StructureLayerId) =>
        dispatch({ type: 'map/removeStructureLayer', payload: { mapId, layerId } }),
      mapSetStructureCells: (mapId: MapId, layerId: StructureLayerId, tileIds: TileId[], terrainId: TerrainId | null) =>
        dispatch({ type: 'map/setStructureCells', payload: { mapId, layerId, tileIds, terrainId } }),
      mapRevealTiles: (mapId: MapId, tileIds: TileId[]) =>
        dispatch({ type: 'map/revealTiles', payload: { mapId, tileIds } }),
      mapSetPendingTerrain: (tileIds: TileId[]) =>
        dispatch({ type: 'map/setPendingTerrain', payload: tileIds }),
      mapClearPendingTerrain: () => dispatch({ type: 'map/clearPendingTerrain' }),

      partyCreateGroup: (params: { name: string; memberIds: Id[]; fromGroupId: Id }) =>
        dispatch({ type: 'party/createGroup', payload: params }),
      partyMoveMembers: (params: { memberIds: Id[]; toGroupId: Id }) =>
        dispatch({ type: 'party/moveMembers', payload: params }),
      partyRenameGroup: (groupId: Id, name: string) =>
        dispatch({ type: 'party/renameGroup', payload: { groupId, name } }),
      partySetActiveGroup: (groupId: Id) =>
        dispatch({ type: 'party/setActiveGroup', payload: { groupId } }),
      partyBoardVehicle: (groupId: Id, vehicleId: Id) =>
        dispatch({ type: 'party/boardVehicle', payload: { groupId, vehicleId } }),
      partyDisembark: (groupId: Id) =>
        dispatch({ type: 'party/disembark', payload: { groupId } }),
      partyPlaceGroup: (groupId: Id, mapId: MapId, tileId: TileId) =>
        dispatch({ type: 'party/placeGroup', payload: { groupId, mapId, tileId } }),
      partyUpsertVehicle: (vehicle: Vehicle) =>
        dispatch({ type: 'party/upsertVehicle', payload: { vehicle } }),
      partyRemoveVehicle: (vehicleId: Id) =>
        dispatch({ type: 'party/removeVehicle', payload: { vehicleId } }),
      partyPlaceVehicle: (vehicleId: Id, mapId: MapId, tileId: TileId) =>
        dispatch({ type: 'party/placeVehicle', payload: { vehicleId, mapId, tileId } }),
      partyDockVehicle: (vehicleId: Id, carrierId: Id) =>
        dispatch({ type: 'party/dockVehicle', payload: { vehicleId, carrierId } }),
      partyUndockVehicle: (vehicleId: Id) =>
        dispatch({ type: 'party/undockVehicle', payload: { vehicleId } }),
      partyUpsertVehicleType: (def: VehicleTypeDef) =>
        dispatch({ type: 'party/upsertVehicleType', payload: { def } }),
      partyRemoveVehicleType: (typeId: string) =>
        dispatch({ type: 'party/removeVehicleType', payload: { typeId } }),
      partyArmJourney: (groupId: Id, journey: ArmJourneyInput) =>
        dispatch({ type: 'party/armJourney', payload: { groupId, journey } }),
      partyPauseJourney: (groupId: Id) =>
        dispatch({ type: 'party/pauseJourney', payload: { groupId } }),
      partyResumeJourney: (groupId: Id) =>
        dispatch({ type: 'party/resumeJourney', payload: { groupId } }),
      partyAbortJourney: (groupId: Id) =>
        dispatch({ type: 'party/abortJourney', payload: { groupId } }),
      partyRerouteJourney: (groupId: Id, routeTileIds: TileId[]) =>
        dispatch({ type: 'party/rerouteJourney', payload: { groupId, routeTileIds } }),

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
        if (error instanceof CampaignStateConflictError) {
          // Another tab owns the saved state now; storage already announced
          // the conflict via the 'campaign-state-conflict' event.
          console.warn(error.message);
        } else {
          console.error('Failed to save campaign state', error);
        }
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
