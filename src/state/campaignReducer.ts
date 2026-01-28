import { enableMapSet, produce } from 'immer';
import { createPartyToolState, PARTY_TOOL_SKILLS } from '../components/partyToolSeed';
import { advanceTimeSlot, type TimeLogEntry } from '../utils/timeSystem';
import { SLOT_NAMES, SLOTS_PER_DAY } from '../constants';
import type {
  Id,
  Character,
  Material,
  Food,
  FoodType,
  MaterialType,
  Recipe,
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
  ToolTemplate,
  ToolInstance,
  Facility,
  Inventory,
  CurrencyLog
} from '../types/campaign';
import type {
  Location,
  LocationState,
  WeatherTable,
  TravelAction,
  ActiveWeather
} from '../types/location';
import {
  createInitialLocationState,
  generateWeather,
  isWeatherExpired,
  getCurrentLocation
} from '../utils/weatherSystem';

export const CAMPAIGN_META = {
  rulesVersion: '1.0.0',
  schemaVersion: '1.0.0'
};

enableMapSet();

export type LegacyAppState = Record<string, unknown>;

export type CampaignState = {
  ui: {
    activeModule: string;
    selectedCharacterId: string | null;
    gmModeEnabled: boolean;
    gmSessionUnlocked: boolean;
    debugMode: boolean;
    activitiesSubview: string | null;
    blockingError: null | {
      type: string;
      system: 'time';
      reason: string;
      suggestedFixes: string[];
    };
  };
  meta: {
    rulesVersion: string;
    schemaVersion: string;
  };
  entities: {
    // Shared characters (merged workers + party characters)
    characters: Record<Id, Character>;

    // Inventory system
    materials: Record<Id, Material>;
    foods: Record<Id, Food>;
    recipes: Record<Id, Recipe>;
    foodTypes: FoodType[];
    materialTypes: MaterialType[];

    // Crafting system
    crafts: Record<Id, Craft>;
    craftDesigns: Record<Id, CraftDesign>;
    customTemplates: CustomTemplates;

    // Alchemy system
    alchemyReagents: Record<Id, AlchemyReagent>;
    alchemyFormulas: Record<Id, AlchemyFormula>;
    alchemyBatches: Record<Id, AlchemyBatch>;
    alchemyLabs: Record<Id, AlchemyLab>;
    alchemySettings: AlchemySettings;

    // Gathering system
    gatheringSpecies: Record<Id, GatheringSpecies>;
    gatheringTools: Record<Id, GatheringTool>;
    gatheringTables: Record<Id, GatheringTable>;
    gatheringEnvironments: Record<Id, GatheringEnvironment>;
    gatheringSessions: Record<Id, GatheringSession>;
    gatheringDailyEvents: GatheringDailyEvents;
    gatheringBait: Record<Id, GatheringBait>;
    gatheringCategories: Record<Id, GatheringCategory>;
    gatheringItems: Record<Id, GatheringItem>;

    // Combat system
    combatCharacters: Record<Id, CombatCharacter>;
    combatItems: Record<Id, CombatItem>;
    combatHistory: CombatSession[];
    combatTombstones: CombatCharacter[];

    // Config/Facilities
    kitchens: Record<Id, Kitchen>;
    cookingSkills: CookingSkill[];
    effectFamilyMap: EffectFamilyMap;

    // Tools & Facilities (unified)
    toolTemplates: Record<Id, ToolTemplate>;
    toolInstances: Record<Id, ToolInstance>;
    facilities: Record<Id, Facility>;
    toolReservations: Record<Id, string[]>;

    // Inventories (unified for all systems)
    inventories: Record<Id, Inventory>;
    currencyLogs: CurrencyLog[];
  };
  legacy: {
    appState: LegacyAppState;
  };
  time: {
    day: number;
    slot: number;
    slotsPerDay: number;
    slotLabels: string[];
    history: Array<TimeLogEntry & { day: number }>;
  };
  inventory: {
    // UI state for inventory tab
    activeTab?: string;
  };
  crafting: {
    // UI state for crafting tab
    currentProject?: string | null;
  };
  alchemy: {
    // UI state for alchemy tab
    activeBatch?: string | null;
  };
  gathering: {
    // UI state for gathering tab
    activeSession?: string | null;
  };
  dayPlanner: {
    timeSlots: TimeSlot[];
    taskAssignments: TaskAssignment[];
    pendingDayLedger: DayLedger | null;
    currentSlot: number;
  };
  activities: {
    pausedSessionIds: string[];
    partyToolState: ReturnType<typeof createPartyToolState>;
    activeTab: string;
    activityLogs: Array<Record<string, unknown>>;
    timeLogs: TimeLogEntry[];
    currentSlot: number;
    selectedSkill: string;
    primaryWorkerId: string;
    helperIds: string[];
    toolSelections: Record<string, string>;
    selectedFacilityId: string;
    gmOverride: boolean;
    transferState: Record<string, unknown> | null;
  };
  logs: {
    entries: LogEntry[];
  };
  checkpoints: {
    maxSize: number;
    entries: Checkpoint[];
  };
  combat: {
    active: boolean;
    encounterId: string | null;
    activeSession: CombatSession | null;
    rulesPreset: string;
    reveal: {
      revealedTargets: Set<string>;
      revealedHP: Set<string>;
      revealedDefenseValues: Record<string, { dodge?: number }>;
    };
  };
  locations: LocationState;
};

export const initialLegacyAppState: LegacyAppState = {};
const initialPartyToolState = createPartyToolState();

export type LogVisibility = 'gmOnly' | 'player' | 'mixed';

export type LogEntry = {
  id: string;
  timestamp: number;
  type: string;
  visibility: LogVisibility;
  payload: Record<string, unknown>;
};

export type CampaignSnapshot = Omit<CampaignState, 'checkpoints'>;

export type Checkpoint = {
  id: string;
  label: string;
  createdAt: number;
  snapshot: CampaignSnapshot;
};

export const logEvent = (
  type: string,
  visibility: LogVisibility,
  payload: Record<string, unknown>
): LogEntry => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  timestamp: Date.now(),
  type,
  visibility,
  payload
});

const createCheckpointSnapshot = (state: CampaignState): CampaignSnapshot => {
  const { checkpoints, ...rest } = state;
  return JSON.parse(JSON.stringify(rest)) as CampaignSnapshot;
};

const createCheckpointEntry = (state: CampaignState, label: string): Checkpoint => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  label,
  createdAt: Date.now(),
  snapshot: createCheckpointSnapshot(state)
});

const normalizeCombatReveal = (combat: CampaignState['combat']) => {
  const revealedTargets =
    combat.reveal.revealedTargets instanceof Set
      ? combat.reveal.revealedTargets
      : new Set(combat.reveal.revealedTargets || []);
  const revealedHP =
    combat.reveal.revealedHP instanceof Set ? combat.reveal.revealedHP : new Set(combat.reveal.revealedHP || []);
  return {
    ...combat,
    reveal: {
      ...combat.reveal,
      revealedTargets,
      revealedHP
    }
  };
};

export const createCampaignState = (legacyAppState: LegacyAppState = initialLegacyAppState): CampaignState => ({
  ui: {
    activeModule: 'inventory',
    selectedCharacterId: null,
    gmModeEnabled: false,
    gmSessionUnlocked: false,
    debugMode: false,
    activitiesSubview: null,
    blockingError: null
  },
  meta: {
    rulesVersion: CAMPAIGN_META.rulesVersion,
    schemaVersion: CAMPAIGN_META.schemaVersion
  },
  entities: {
    // Characters (from Party Tool initially)
    characters: initialPartyToolState.characters,

    // Inventory system (empty initially)
    materials: {},
    foods: {},
    recipes: {},
    foodTypes: [
      { name: 'fish', color: '#60A5FA' },
      { name: 'poultry', color: '#F59E0B' },
      { name: 'meat', color: '#EF4444' },
      { name: 'fruit', color: '#EC4899' },
      { name: 'vegetable', color: '#10B981' }
    ],
    materialTypes: [
      { name: 'wood', difficulty: -2, effects: '', ht: 10, drShift: 0, weightMod: -10, hpMod: 0 },
      { name: 'metal', difficulty: 0, effects: '', ht: 12, drShift: 0, weightMod: 0, hpMod: 0 },
      { name: 'leather', difficulty: -1, effects: '', ht: 8, drShift: 0, weightMod: -20, hpMod: -10 },
      { name: 'cloth', difficulty: -1, effects: '', ht: 6, drShift: 0, weightMod: -30, hpMod: -20 },
      { name: 'stone', difficulty: 1, effects: '', ht: 14, drShift: 0, weightMod: 50, hpMod: 10 }
    ],

    // Crafting system
    crafts: {},
    craftDesigns: {},
    customTemplates: { weapons: {}, armor: {}, ranged: {}, explosives: {} },

    // Alchemy system
    alchemyReagents: {},
    alchemyFormulas: {},
    alchemyBatches: {},
    alchemyLabs: {
      'default': { id: 'default', name: 'Basic Lab', rating: 0, description: 'Standard workspace' }
    },
    alchemySettings: { defaultLabRating: 0, workBlockMinutes: 120 },

    // Gathering system
    gatheringSpecies: {},
    gatheringTools: {},
    gatheringTables: {},
    gatheringEnvironments: {},
    gatheringSessions: {},
    gatheringDailyEvents: {},
    gatheringBait: {},
    gatheringCategories: {},
    gatheringItems: {},

    // Combat system
    combatCharacters: {},
    combatItems: {},
    combatHistory: [],
    combatTombstones: [],

    // Config/Facilities
    kitchens: {
      'default': { id: 'default', name: 'Basic Kitchen', rating: 0, description: 'Standard cooking area' }
    },
    cookingSkills: [],
    effectFamilyMap: {},

    // Tools & Facilities (from Party Tool initially)
    toolTemplates: initialPartyToolState.toolTemplates,
    toolInstances: initialPartyToolState.toolInstances,
    facilities: initialPartyToolState.facilities,
    toolReservations: {},

    // Inventories (from Party Tool initially)
    inventories: initialPartyToolState.inventories,
    currencyLogs: initialPartyToolState.currencyLogs
  },
  legacy: {
    appState: legacyAppState
  },
  time: {
    day: 1,
    slot: 0,
    slotsPerDay: SLOTS_PER_DAY,
    slotLabels: SLOT_NAMES,
    history: []
  },
  inventory: {
    activeTab: 'materials'
  },
  crafting: {
    currentProject: null
  },
  alchemy: {
    activeBatch: null
  },
  gathering: {
    activeSession: null
  },
  dayPlanner: {
    timeSlots: [],
    taskAssignments: [],
    pendingDayLedger: null,
    currentSlot: 0
  },
  activities: {
    pausedSessionIds: [],
    partyToolState: initialPartyToolState,
    activeTab: 'activity',
    activityLogs: [],
    timeLogs: [],
    currentSlot: 0,
    selectedSkill: PARTY_TOOL_SKILLS[0],
    primaryWorkerId: '',
    helperIds: [],
    toolSelections: {},
    selectedFacilityId: 'implicit',
    gmOverride: false,
    transferState: null
  },
  logs: {
    entries: []
  },
  checkpoints: {
    maxSize: 10,
    entries: []
  },
  combat: {
    active: false,
    encounterId: null,
    activeSession: null,
    rulesPreset: 'standard',
    reveal: {
      revealedTargets: new Set(),
      revealedHP: new Set(),
      revealedDefenseValues: {}
    }
  },
  locations: createInitialLocationState({ day: 1, slot: 0 })
});

export const initialCampaignState: CampaignState = createCampaignState();

export type CampaignAction =
  | { type: 'setActiveModule'; payload: string }
  | { type: 'selectCharacter'; payload: string | null }
  | { type: 'toggleGmMode' }
  | { type: 'setGmMode'; payload: boolean }
  | { type: 'setGmUnlocked'; payload: boolean }
  | { type: 'toggleDebug' }
  | { type: 'setActivitiesSubview'; payload: string | null }
  | { type: 'advanceTime' }
  | { type: 'setPausedSessionIds'; payload: string[] }
  | { type: 'setActivitiesState'; payload: Partial<CampaignState['activities']> }
  | { type: 'setPartyToolState'; payload: CampaignState['activities']['partyToolState'] }
  | { type: 'setToolReservations'; payload: Record<string, string[]> }
  | { type: 'addLogEntry'; payload: LogEntry }
  | { type: 'setLogsEntries'; payload: LogEntry[] }
  | { type: 'createCheckpoint'; payload: string }
  | { type: 'restoreCheckpoint'; payload: string }
  | { type: 'importCampaignState'; payload: { state: CampaignState; label?: string } }
  | { type: 'startCombat'; payload?: { encounterId?: string } }
  | { type: 'registerCombatDamage'; payload: { targetId: string; remainingHp: number } }
  | { type: 'registerCombatDefenseSuccess'; payload: { targetId: string; defense: { dodge?: number } } }
  | { type: 'applyDebugState'; payload: CampaignState }
  // Character actions
  | { type: 'addCharacter'; payload: Character }
  | { type: 'updateCharacter'; payload: { id: Id; changes: Partial<Character> } }
  | { type: 'removeCharacter'; payload: Id }
  | { type: 'setCharacters'; payload: Record<Id, Character> }
  // Material actions
  | { type: 'addMaterial'; payload: Material }
  | { type: 'updateMaterial'; payload: { id: Id; changes: Partial<Material> } }
  | { type: 'removeMaterial'; payload: Id }
  | { type: 'consumeMaterials'; payload: Array<{ id: Id; amount: number }> }
  | { type: 'setMaterials'; payload: Record<Id, Material> }
  // Food actions
  | { type: 'addFood'; payload: Food }
  | { type: 'updateFood'; payload: { id: Id; changes: Partial<Food> } }
  | { type: 'removeFood'; payload: Id }
  | { type: 'consumeFoods'; payload: Array<{ id: Id; amount: number }> }
  | { type: 'setFoods'; payload: Record<Id, Food> }
  // Recipe actions
  | { type: 'addRecipe'; payload: Recipe }
  | { type: 'updateRecipe'; payload: { id: Id; changes: Partial<Recipe> } }
  | { type: 'removeRecipe'; payload: Id }
  | { type: 'setRecipes'; payload: Record<Id, Recipe> }
  // FoodType actions
  | { type: 'setFoodTypes'; payload: FoodType[] }
  | { type: 'addFoodType'; payload: FoodType }
  // MaterialType actions
  | { type: 'setMaterialTypes'; payload: MaterialType[] }
  | { type: 'addMaterialType'; payload: MaterialType }
  // Craft actions
  | { type: 'addCraft'; payload: Craft }
  | { type: 'updateCraft'; payload: { id: Id; changes: Partial<Craft> } }
  | { type: 'removeCraft'; payload: Id }
  | { type: 'completeCraft'; payload: { id: Id; finalStats: Craft['finalStats'] } }
  | { type: 'setCrafts'; payload: Record<Id, Craft> }
  // CraftDesign actions
  | { type: 'addCraftDesign'; payload: CraftDesign }
  | { type: 'updateCraftDesign'; payload: { id: Id; changes: Partial<CraftDesign> } }
  | { type: 'removeCraftDesign'; payload: Id }
  | { type: 'setCraftDesigns'; payload: Record<Id, CraftDesign> }
  // CustomTemplates actions
  | { type: 'setCustomTemplates'; payload: CustomTemplates }
  | { type: 'addCustomTemplate'; payload: { category: keyof CustomTemplates; templateName: string; template: any } }
  // Alchemy Reagent actions
  | { type: 'addAlchemyReagent'; payload: AlchemyReagent }
  | { type: 'updateAlchemyReagent'; payload: { id: Id; changes: Partial<AlchemyReagent> } }
  | { type: 'removeAlchemyReagent'; payload: Id }
  | { type: 'setAlchemyReagents'; payload: Record<Id, AlchemyReagent> }
  // Alchemy Formula actions
  | { type: 'addAlchemyFormula'; payload: AlchemyFormula }
  | { type: 'updateAlchemyFormula'; payload: { id: Id; changes: Partial<AlchemyFormula> } }
  | { type: 'removeAlchemyFormula'; payload: Id }
  | { type: 'setAlchemyFormulas'; payload: Record<Id, AlchemyFormula> }
  // Alchemy Batch actions
  | { type: 'addAlchemyBatch'; payload: AlchemyBatch }
  | { type: 'updateAlchemyBatch'; payload: { id: Id; changes: Partial<AlchemyBatch> } }
  | { type: 'removeAlchemyBatch'; payload: Id }
  | { type: 'setAlchemyBatches'; payload: Record<Id, AlchemyBatch> }
  // Alchemy Lab actions
  | { type: 'setAlchemyLabs'; payload: Record<Id, AlchemyLab> }
  | { type: 'addAlchemyLab'; payload: AlchemyLab }
  // Alchemy Settings actions
  | { type: 'updateAlchemySettings'; payload: Partial<AlchemySettings> }
  // Gathering Species actions
  | { type: 'setGatheringSpecies'; payload: Record<Id, GatheringSpecies> }
  | { type: 'addGatheringSpecies'; payload: GatheringSpecies }
  // Gathering Tool actions
  | { type: 'setGatheringTools'; payload: Record<Id, GatheringTool> }
  | { type: 'addGatheringTool'; payload: GatheringTool }
  // Gathering Table actions
  | { type: 'setGatheringTables'; payload: Record<Id, GatheringTable> }
  | { type: 'addGatheringTable'; payload: GatheringTable }
  // Gathering Environment actions
  | { type: 'setGatheringEnvironments'; payload: Record<Id, GatheringEnvironment> }
  | { type: 'addGatheringEnvironment'; payload: GatheringEnvironment }
  // Gathering Session actions
  | { type: 'addGatheringSession'; payload: GatheringSession }
  | { type: 'updateGatheringSession'; payload: { id: Id; changes: Partial<GatheringSession> } }
  | { type: 'setGatheringSessions'; payload: Record<Id, GatheringSession> }
  // Gathering Daily Events actions
  | { type: 'setGatheringDailyEvents'; payload: GatheringDailyEvents }
  // Gathering Bait actions
  | { type: 'setGatheringBait'; payload: Record<Id, GatheringBait> }
  | { type: 'addGatheringBait'; payload: GatheringBait }
  // Gathering Category actions
  | { type: 'setGatheringCategories'; payload: Record<Id, GatheringCategory> }
  | { type: 'addGatheringCategory'; payload: GatheringCategory }
  // Gathering Item actions
  | { type: 'setGatheringItems'; payload: Record<Id, GatheringItem> }
  | { type: 'addGatheringItem'; payload: GatheringItem }
  // Day Planner actions
  | { type: 'setTimeSlots'; payload: TimeSlot[] }
  | { type: 'addTaskAssignment'; payload: TaskAssignment }
  | { type: 'updateTaskAssignment'; payload: { id: Id; changes: Partial<TaskAssignment> } }
  | { type: 'setTaskAssignments'; payload: TaskAssignment[] }
  | { type: 'setPendingDayLedger'; payload: DayLedger | null }
  // Combat Character actions
  | { type: 'addCombatCharacter'; payload: CombatCharacter }
  | { type: 'updateCombatCharacter'; payload: { id: Id; changes: Partial<CombatCharacter> } }
  | { type: 'removeCombatCharacter'; payload: Id }
  | { type: 'setCombatCharacters'; payload: Record<Id, CombatCharacter> }
  // Combat Session actions
  | { type: 'setCombatActive'; payload: CombatSession | null }
  | { type: 'updateCombatActive'; payload: Partial<CombatSession> }
  | { type: 'setCombatHistory'; payload: CombatSession[] }
  | { type: 'setCombatTombstones'; payload: CombatCharacter[] }
  | { type: 'setCombatRulesPreset'; payload: string }
  // Combat Item actions
  | { type: 'setCombatItems'; payload: Record<Id, CombatItem> }
  | { type: 'addCombatItem'; payload: CombatItem }
  // Kitchen actions
  | { type: 'setKitchens'; payload: Record<Id, Kitchen> }
  | { type: 'addKitchen'; payload: Kitchen }
  // Cooking Skill actions
  | { type: 'setCookingSkills'; payload: CookingSkill[] }
  // Effect Family Map actions
  | { type: 'setEffectFamilyMap'; payload: EffectFamilyMap }
  // Inventory actions
  | { type: 'addInventory'; payload: Inventory }
  | { type: 'updateInventory'; payload: { id: Id; changes: Partial<Inventory> } }
  | { type: 'setInventories'; payload: Record<Id, Inventory> }
  // Location & Weather actions
  | { type: 'setLocationsState'; payload: Partial<LocationState> }
  | { type: 'addLocation'; payload: Location }
  | { type: 'updateLocation'; payload: { id: Id; changes: Partial<Location> } }
  | { type: 'removeLocation'; payload: Id }
  | { type: 'setCurrentLocation'; payload: Id }
  | { type: 'setLocationWeather'; payload: { locationId: Id; weather: ActiveWeather } }
  | { type: 'rollNewWeather'; payload: { locationId: Id } }
  | { type: 'addWeatherTable'; payload: WeatherTable }
  | { type: 'updateWeatherTable'; payload: { id: Id; changes: Partial<WeatherTable> } }
  | { type: 'removeWeatherTable'; payload: Id }
  | { type: 'addTravel'; payload: TravelAction }
  | { type: 'updateTravel'; payload: { id: Id; changes: Partial<TravelAction> } }
  | { type: 'completeTravel'; payload: Id }
  | { type: 'cancelTravel'; payload: Id };

export function campaignReducer(state: CampaignState, action: CampaignAction) {
  return produce(state, (draft) => {
    switch (action.type) {
      case 'setActiveModule':
        draft.ui.activeModule = action.payload;
        return;
      case 'selectCharacter':
        draft.ui.selectedCharacterId = action.payload;
        return;
      case 'toggleGmMode':
        draft.ui.gmModeEnabled = !draft.ui.gmModeEnabled;
        return;
      case 'setGmMode':
        draft.ui.gmModeEnabled = action.payload;
        return;
      case 'setGmUnlocked':
        draft.ui.gmSessionUnlocked = action.payload;
        return;
      case 'toggleDebug':
        draft.ui.debugMode = !draft.ui.debugMode;
        return;
      case 'setActivitiesSubview':
        draft.ui.activitiesSubview = action.payload;
        return;
      case 'setPausedSessionIds':
        draft.activities.pausedSessionIds = action.payload;
        if (action.payload.length === 0) {
          draft.ui.blockingError = null;
        }
        return;
      case 'setActivitiesState':
        draft.activities = {
          ...draft.activities,
          ...action.payload
        };
        return;
      case 'setPartyToolState':
        draft.activities.partyToolState = action.payload;
        return;
      case 'setToolReservations':
        draft.entities.toolReservations = action.payload;
        return;
      case 'addLogEntry':
        draft.logs.entries.unshift(action.payload);
        return;
      case 'setLogsEntries':
        draft.logs.entries = action.payload;
        return;
      case 'createCheckpoint': {
        const checkpoint = createCheckpointEntry(draft as CampaignState, action.payload);
        draft.checkpoints.entries.unshift(checkpoint);
        if (draft.checkpoints.entries.length > draft.checkpoints.maxSize) {
          draft.checkpoints.entries.pop();
        }
        return;
      }
      case 'importCampaignState': {
        const label = action.payload.label ?? 'Before import';
        const checkpoint = createCheckpointEntry(draft as CampaignState, label);
        draft.checkpoints.entries.unshift(checkpoint);
        if (draft.checkpoints.entries.length > draft.checkpoints.maxSize) {
          draft.checkpoints.entries.pop();
        }
        const { checkpoints: _ignored, ...nextState } = action.payload.state;
        const preservedCheckpoints = draft.checkpoints;
        draft.ui = nextState.ui;
        draft.meta = nextState.meta;
        draft.entities = nextState.entities;
        draft.legacy = nextState.legacy;
        draft.time = nextState.time;
        draft.inventory = nextState.inventory || { activeTab: 'materials' };
        draft.crafting = nextState.crafting || { currentProject: null };
        draft.alchemy = nextState.alchemy || { activeBatch: null };
        draft.gathering = nextState.gathering || { activeSession: null };
        draft.dayPlanner = nextState.dayPlanner || { timeSlots: [], taskAssignments: [], pendingDayLedger: null, currentSlot: 0 };
        draft.activities = nextState.activities;
        draft.logs = nextState.logs;
        draft.combat = normalizeCombatReveal(nextState.combat);
        draft.locations = nextState.locations || createInitialLocationState(nextState.time || { day: 1, slot: 0 });
        draft.checkpoints = preservedCheckpoints;
        return;
      }
      case 'startCombat': {
        const checkpoint = createCheckpointEntry(draft as CampaignState, 'Before combat');
        draft.checkpoints.entries.unshift(checkpoint);
        if (draft.checkpoints.entries.length > draft.checkpoints.maxSize) {
          draft.checkpoints.entries.pop();
        }
        draft.combat.active = true;
        draft.combat.encounterId =
          action.payload?.encounterId ?? `enc-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        // Log combat start
        draft.logs.entries.unshift(
          logEvent('combat.started', 'player', {
            message: 'Combat started'
          })
        );
        return;
      }
      case 'registerCombatDamage': {
        const { targetId, remainingHp } = action.payload;
        draft.combat.reveal.revealedTargets.add(targetId);
        if (remainingHp <= 0) {
          draft.combat.reveal.revealedHP.add(targetId);
          // Log when a combatant is defeated
          const character = draft.entities.combatCharacters[targetId];
          const characterName = character?.name ?? targetId;
          draft.logs.entries.unshift(
            logEvent('combat.defeated', 'mixed', {
              message: `${characterName} was defeated`,
              maskedMessage: 'A combatant was defeated'
            })
          );
        }
        return;
      }
      case 'registerCombatDefenseSuccess': {
        const { targetId, defense } = action.payload;
        draft.combat.reveal.revealedDefenseValues[targetId] = {
          ...draft.combat.reveal.revealedDefenseValues[targetId],
          ...defense
        };
        return;
      }
      case 'applyDebugState': {
        const nextState = action.payload;
        draft.ui = nextState.ui;
        draft.meta = nextState.meta;
        draft.entities = nextState.entities;
        draft.legacy = nextState.legacy;
        draft.time = nextState.time;
        draft.inventory = nextState.inventory;
        draft.crafting = nextState.crafting;
        draft.alchemy = nextState.alchemy;
        draft.gathering = nextState.gathering;
        draft.dayPlanner = nextState.dayPlanner;
        draft.activities = nextState.activities;
        draft.logs = nextState.logs;
        draft.checkpoints = nextState.checkpoints;
        draft.combat = normalizeCombatReveal(nextState.combat);
        draft.locations = nextState.locations || createInitialLocationState(nextState.time || { day: 1, slot: 0 });
        return;
      }
      case 'restoreCheckpoint': {
        const checkpoint = draft.checkpoints.entries.find((entry) => entry.id === action.payload);
        if (!checkpoint) {
          return;
        }
        const restoredSnapshot = JSON.parse(JSON.stringify(checkpoint.snapshot)) as CampaignSnapshot;
        const rollbackEntry = logEvent('campaign.rollback', 'player', {
          message: 'Rollback occurred.'
        });
        draft.ui = restoredSnapshot.ui;
        draft.meta = restoredSnapshot.meta;
        draft.entities = restoredSnapshot.entities;
        draft.legacy = restoredSnapshot.legacy;
        draft.time = restoredSnapshot.time;
        draft.inventory = restoredSnapshot.inventory;
        draft.crafting = restoredSnapshot.crafting;
        draft.alchemy = restoredSnapshot.alchemy;
        draft.gathering = restoredSnapshot.gathering;
        draft.dayPlanner = restoredSnapshot.dayPlanner;
        draft.activities = restoredSnapshot.activities;
        draft.logs = {
          entries: [rollbackEntry, ...restoredSnapshot.logs.entries]
        };
        draft.combat = restoredSnapshot.combat;
        draft.locations = (restoredSnapshot as CampaignState).locations || createInitialLocationState(restoredSnapshot.time || { day: 1, slot: 0 });
        return;
      }
      case 'advanceTime': {
        if (draft.activities.pausedSessionIds.length > 0) {
          draft.ui.blockingError = {
            type: 'pausedActivities',
            system: 'time',
            reason: 'Paused activities are blocking time advance.',
            suggestedFixes: [
              'Resume or complete all paused activities.',
              'Clear paused sessions in the Activities module.'
            ]
          };
          return;
        }
        const checkpoint = createCheckpointEntry(draft as CampaignState, 'Before time advance');
        draft.checkpoints.entries.unshift(checkpoint);
        if (draft.checkpoints.entries.length > draft.checkpoints.maxSize) {
          draft.checkpoints.entries.pop();
        }
        const { slot, slotsPerDay, slotLabels, day } = draft.time;
        const { nextSlot, logEntry } = advanceTimeSlot(
          slot,
          { clearAllReservations() {} },
          {
            totalSlots: slotsPerDay,
            slotLabels
          }
        );
        const nextDay = nextSlot < slot ? day + 1 : day;
        draft.time.slot = nextSlot;
        draft.time.day = nextDay;
        draft.time.history.push({ ...logEntry, day: nextDay });
        draft.logs.entries.unshift(
          logEvent('time.advance', 'player', {
            message: `Advanced to Day ${nextDay}, Slot ${nextSlot + 1} (${slotLabels[nextSlot]})`
          })
        );
        draft.ui.blockingError = null;

        // Check weather expiration for all locations and generate new weather if needed
        const newTime = { day: nextDay, slot: nextSlot };
        for (const location of Object.values(draft.locations.locations)) {
          if (location.currentWeather && isWeatherExpired(location.currentWeather, newTime)) {
            const weatherTable = location.weatherTableId
              ? draft.locations.weatherTables[location.weatherTableId]
              : undefined;
            const result = generateWeather({
              location: location as Location,
              weatherTable,
              currentTime: newTime
            });
            location.currentWeather = result.weather;
            location.modifiedAt = Date.now();

            // Only log if this is the current location
            if (location.id === draft.locations.currentLocationId) {
              draft.logs.entries.unshift(
                logEvent('weather.changed', 'player', {
                  message: result.logMessage
                })
              );
            }
          }
        }
        return;
      }

      // ========================================================================
      // CHARACTER ACTIONS
      // ========================================================================
      case 'addCharacter':
        draft.entities.characters[action.payload.id] = action.payload;
        return;
      case 'updateCharacter':
        if (draft.entities.characters[action.payload.id]) {
          draft.entities.characters[action.payload.id] = {
            ...draft.entities.characters[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeCharacter':
        delete draft.entities.characters[action.payload];
        return;
      case 'setCharacters':
        draft.entities.characters = action.payload;
        return;

      // ========================================================================
      // MATERIAL ACTIONS
      // ========================================================================
      case 'addMaterial':
        draft.entities.materials[action.payload.id] = action.payload;
        return;
      case 'updateMaterial':
        if (draft.entities.materials[action.payload.id]) {
          draft.entities.materials[action.payload.id] = {
            ...draft.entities.materials[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeMaterial':
        delete draft.entities.materials[action.payload];
        return;
      case 'consumeMaterials':
        action.payload.forEach(({ id, amount }) => {
          if (draft.entities.materials[id]) {
            draft.entities.materials[id].quantity -= amount;
            if (draft.entities.materials[id].quantity <= 0) {
              delete draft.entities.materials[id];
            }
          }
        });
        return;
      case 'setMaterials':
        draft.entities.materials = action.payload;
        return;

      // ========================================================================
      // FOOD ACTIONS
      // ========================================================================
      case 'addFood':
        draft.entities.foods[action.payload.id] = action.payload;
        return;
      case 'updateFood':
        if (draft.entities.foods[action.payload.id]) {
          draft.entities.foods[action.payload.id] = {
            ...draft.entities.foods[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeFood':
        delete draft.entities.foods[action.payload];
        return;
      case 'consumeFoods':
        action.payload.forEach(({ id, amount }) => {
          if (draft.entities.foods[id]) {
            draft.entities.foods[id].quantity -= amount;
            if (draft.entities.foods[id].quantity <= 0) {
              delete draft.entities.foods[id];
            }
          }
        });
        return;
      case 'setFoods':
        draft.entities.foods = action.payload;
        return;

      // ========================================================================
      // RECIPE ACTIONS
      // ========================================================================
      case 'addRecipe':
        draft.entities.recipes[action.payload.id] = action.payload;
        return;
      case 'updateRecipe':
        if (draft.entities.recipes[action.payload.id]) {
          draft.entities.recipes[action.payload.id] = {
            ...draft.entities.recipes[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeRecipe':
        delete draft.entities.recipes[action.payload];
        return;
      case 'setRecipes':
        draft.entities.recipes = action.payload;
        return;

      // ========================================================================
      // FOOD TYPE & MATERIAL TYPE ACTIONS
      // ========================================================================
      case 'setFoodTypes':
        draft.entities.foodTypes = action.payload;
        return;
      case 'addFoodType':
        draft.entities.foodTypes.push(action.payload);
        return;
      case 'setMaterialTypes':
        draft.entities.materialTypes = action.payload;
        return;
      case 'addMaterialType':
        draft.entities.materialTypes.push(action.payload);
        return;

      // ========================================================================
      // CRAFT ACTIONS
      // ========================================================================
      case 'addCraft':
        draft.entities.crafts[action.payload.id] = action.payload;
        return;
      case 'updateCraft':
        if (draft.entities.crafts[action.payload.id]) {
          draft.entities.crafts[action.payload.id] = {
            ...draft.entities.crafts[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeCraft':
        delete draft.entities.crafts[action.payload];
        return;
      case 'completeCraft':
        if (draft.entities.crafts[action.payload.id]) {
          draft.entities.crafts[action.payload.id].phase = 'complete';
          draft.entities.crafts[action.payload.id].finalStats = action.payload.finalStats;
        }
        return;
      case 'setCrafts':
        draft.entities.crafts = action.payload;
        return;

      // ========================================================================
      // CRAFT DESIGN ACTIONS
      // ========================================================================
      case 'addCraftDesign':
        draft.entities.craftDesigns[action.payload.id] = action.payload;
        return;
      case 'updateCraftDesign':
        if (draft.entities.craftDesigns[action.payload.id]) {
          draft.entities.craftDesigns[action.payload.id] = {
            ...draft.entities.craftDesigns[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeCraftDesign':
        delete draft.entities.craftDesigns[action.payload];
        return;
      case 'setCraftDesigns':
        draft.entities.craftDesigns = action.payload;
        return;

      // ========================================================================
      // CUSTOM TEMPLATES ACTIONS
      // ========================================================================
      case 'setCustomTemplates':
        draft.entities.customTemplates = action.payload;
        return;
      case 'addCustomTemplate':
        draft.entities.customTemplates[action.payload.category][action.payload.templateName] = action.payload.template;
        return;

      // ========================================================================
      // ALCHEMY ACTIONS
      // ========================================================================
      case 'addAlchemyReagent':
        draft.entities.alchemyReagents[action.payload.id] = action.payload;
        return;
      case 'updateAlchemyReagent':
        if (draft.entities.alchemyReagents[action.payload.id]) {
          draft.entities.alchemyReagents[action.payload.id] = {
            ...draft.entities.alchemyReagents[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeAlchemyReagent':
        delete draft.entities.alchemyReagents[action.payload];
        return;
      case 'setAlchemyReagents':
        draft.entities.alchemyReagents = action.payload;
        return;
      case 'addAlchemyFormula':
        draft.entities.alchemyFormulas[action.payload.id] = action.payload;
        return;
      case 'updateAlchemyFormula':
        if (draft.entities.alchemyFormulas[action.payload.id]) {
          draft.entities.alchemyFormulas[action.payload.id] = {
            ...draft.entities.alchemyFormulas[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeAlchemyFormula':
        delete draft.entities.alchemyFormulas[action.payload];
        return;
      case 'setAlchemyFormulas':
        draft.entities.alchemyFormulas = action.payload;
        return;
      case 'addAlchemyBatch':
        draft.entities.alchemyBatches[action.payload.id] = action.payload;
        return;
      case 'updateAlchemyBatch':
        if (draft.entities.alchemyBatches[action.payload.id]) {
          draft.entities.alchemyBatches[action.payload.id] = {
            ...draft.entities.alchemyBatches[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeAlchemyBatch':
        delete draft.entities.alchemyBatches[action.payload];
        return;
      case 'setAlchemyBatches':
        draft.entities.alchemyBatches = action.payload;
        return;
      case 'setAlchemyLabs':
        draft.entities.alchemyLabs = action.payload;
        return;
      case 'addAlchemyLab':
        draft.entities.alchemyLabs[action.payload.id] = action.payload;
        return;
      case 'updateAlchemySettings':
        draft.entities.alchemySettings = {
          ...draft.entities.alchemySettings,
          ...action.payload
        };
        return;

      // ========================================================================
      // GATHERING ACTIONS
      // ========================================================================
      case 'setGatheringSpecies':
        draft.entities.gatheringSpecies = action.payload;
        return;
      case 'addGatheringSpecies':
        draft.entities.gatheringSpecies[action.payload.id] = action.payload;
        return;
      case 'setGatheringTools':
        draft.entities.gatheringTools = action.payload;
        return;
      case 'addGatheringTool':
        draft.entities.gatheringTools[action.payload.id] = action.payload;
        return;
      case 'setGatheringTables':
        draft.entities.gatheringTables = action.payload;
        return;
      case 'addGatheringTable':
        draft.entities.gatheringTables[action.payload.id] = action.payload;
        return;
      case 'setGatheringEnvironments':
        draft.entities.gatheringEnvironments = action.payload;
        return;
      case 'addGatheringEnvironment':
        draft.entities.gatheringEnvironments[action.payload.id] = action.payload;
        return;
      case 'addGatheringSession':
        draft.entities.gatheringSessions[action.payload.id] = action.payload;
        return;
      case 'updateGatheringSession':
        if (draft.entities.gatheringSessions[action.payload.id]) {
          draft.entities.gatheringSessions[action.payload.id] = {
            ...draft.entities.gatheringSessions[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'setGatheringSessions':
        draft.entities.gatheringSessions = action.payload;
        return;
      case 'setGatheringDailyEvents':
        draft.entities.gatheringDailyEvents = action.payload;
        return;
      case 'setGatheringBait':
        draft.entities.gatheringBait = action.payload;
        return;
      case 'addGatheringBait':
        draft.entities.gatheringBait[action.payload.id] = action.payload;
        return;
      case 'setGatheringCategories':
        draft.entities.gatheringCategories = action.payload;
        return;
      case 'addGatheringCategory':
        draft.entities.gatheringCategories[action.payload.id] = action.payload;
        return;
      case 'setGatheringItems':
        draft.entities.gatheringItems = action.payload;
        return;
      case 'addGatheringItem':
        draft.entities.gatheringItems[action.payload.id] = action.payload;
        return;

      // ========================================================================
      // DAY PLANNER ACTIONS
      // ========================================================================
      case 'setTimeSlots':
        draft.dayPlanner.timeSlots = action.payload;
        return;
      case 'addTaskAssignment':
        draft.dayPlanner.taskAssignments.push(action.payload);
        return;
      case 'updateTaskAssignment': {
        const taskIndex = draft.dayPlanner.taskAssignments.findIndex(t => t.id === action.payload.id);
        if (taskIndex !== -1) {
          draft.dayPlanner.taskAssignments[taskIndex] = {
            ...draft.dayPlanner.taskAssignments[taskIndex],
            ...action.payload.changes
          };
        }
        return;
      }
      case 'setTaskAssignments':
        draft.dayPlanner.taskAssignments = action.payload;
        return;
      case 'setPendingDayLedger':
        draft.dayPlanner.pendingDayLedger = action.payload;
        return;

      // ========================================================================
      // COMBAT ACTIONS
      // ========================================================================
      case 'addCombatCharacter':
        draft.entities.combatCharacters[action.payload.id] = action.payload;
        return;
      case 'updateCombatCharacter':
        if (draft.entities.combatCharacters[action.payload.id]) {
          draft.entities.combatCharacters[action.payload.id] = {
            ...draft.entities.combatCharacters[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'removeCombatCharacter':
        delete draft.entities.combatCharacters[action.payload];
        return;
      case 'setCombatCharacters':
        draft.entities.combatCharacters = action.payload;
        return;
      case 'setCombatActive':
        draft.combat.activeSession = action.payload;
        return;
      case 'updateCombatActive':
        if (draft.combat.activeSession) {
          draft.combat.activeSession = {
            ...draft.combat.activeSession,
            ...action.payload
          };
        }
        return;
      case 'setCombatHistory':
        draft.entities.combatHistory = action.payload;
        return;
      case 'setCombatTombstones':
        draft.entities.combatTombstones = action.payload;
        return;
      case 'setCombatRulesPreset':
        draft.combat.rulesPreset = action.payload;
        return;
      case 'setCombatItems':
        draft.entities.combatItems = action.payload;
        return;
      case 'addCombatItem':
        draft.entities.combatItems[action.payload.id] = action.payload;
        return;

      // ========================================================================
      // CONFIG ACTIONS (Kitchens, Cooking Skills, Effect Family Map)
      // ========================================================================
      case 'setKitchens':
        draft.entities.kitchens = action.payload;
        return;
      case 'addKitchen':
        draft.entities.kitchens[action.payload.id] = action.payload;
        return;
      case 'setFacilities':
        draft.entities.facilities = action.payload;
        return;
      case 'setCookingSkills':
        draft.entities.cookingSkills = action.payload;
        return;
      case 'setEffectFamilyMap':
        draft.entities.effectFamilyMap = action.payload;
        return;

      // ========================================================================
      // INVENTORY ACTIONS
      // ========================================================================
      case 'addInventory':
        draft.entities.inventories[action.payload.id] = action.payload;
        return;
      case 'updateInventory':
        if (draft.entities.inventories[action.payload.id]) {
          draft.entities.inventories[action.payload.id] = {
            ...draft.entities.inventories[action.payload.id],
            ...action.payload.changes
          };
        }
        return;
      case 'setInventories':
        draft.entities.inventories = action.payload;
        return;

      // ========================================================================
      // LOCATION & WEATHER ACTIONS
      // ========================================================================
      case 'setLocationsState':
        draft.locations = {
          ...draft.locations,
          ...action.payload
        };
        return;

      case 'addLocation':
        draft.locations.locations[action.payload.id] = action.payload;
        // If this is the first location, set it as current
        if (!draft.locations.currentLocationId) {
          draft.locations.currentLocationId = action.payload.id;
        }
        return;

      case 'updateLocation':
        if (draft.locations.locations[action.payload.id]) {
          draft.locations.locations[action.payload.id] = {
            ...draft.locations.locations[action.payload.id],
            ...action.payload.changes,
            modifiedAt: Date.now()
          };
        }
        return;

      case 'removeLocation': {
        const locationId = action.payload;
        delete draft.locations.locations[locationId];
        // If we removed the current location, select another one
        if (draft.locations.currentLocationId === locationId) {
          const remainingIds = Object.keys(draft.locations.locations);
          draft.locations.currentLocationId = remainingIds.length > 0 ? remainingIds[0] : null;
        }
        // Remove any weather tables associated with this location
        for (const tableId of Object.keys(draft.locations.weatherTables)) {
          const table = draft.locations.weatherTables[tableId];
          // Note: weather tables don't have locationId, they're referenced by location.weatherTableId
        }
        return;
      }

      case 'setCurrentLocation':
        if (draft.locations.locations[action.payload]) {
          draft.locations.currentLocationId = action.payload;
          draft.logs.entries.unshift(
            logEvent('location.changed', 'player', {
              message: `Party moved to ${draft.locations.locations[action.payload].name}`
            })
          );
        }
        return;

      case 'setLocationWeather': {
        const { locationId, weather } = action.payload;
        if (draft.locations.locations[locationId]) {
          draft.locations.locations[locationId].currentWeather = weather;
          draft.locations.locations[locationId].modifiedAt = Date.now();
        }
        return;
      }

      case 'rollNewWeather': {
        const { locationId } = action.payload;
        const location = draft.locations.locations[locationId];
        if (location) {
          const weatherTable = location.weatherTableId
            ? draft.locations.weatherTables[location.weatherTableId]
            : undefined;
          const currentTime = { day: draft.time.day, slot: draft.time.slot };
          const result = generateWeather({
            location: location as Location,
            weatherTable,
            currentTime
          });
          location.currentWeather = result.weather;
          location.modifiedAt = Date.now();
          draft.logs.entries.unshift(
            logEvent('weather.changed', 'player', {
              message: result.logMessage
            })
          );
        }
        return;
      }

      case 'addWeatherTable':
        draft.locations.weatherTables[action.payload.id] = action.payload;
        return;

      case 'updateWeatherTable':
        if (draft.locations.weatherTables[action.payload.id]) {
          draft.locations.weatherTables[action.payload.id] = {
            ...draft.locations.weatherTables[action.payload.id],
            ...action.payload.changes
          };
        }
        return;

      case 'removeWeatherTable':
        delete draft.locations.weatherTables[action.payload];
        // Clear references from locations
        for (const loc of Object.values(draft.locations.locations)) {
          if (loc.weatherTableId === action.payload) {
            loc.weatherTableId = undefined;
          }
        }
        return;

      case 'addTravel':
        draft.locations.activeTravels.push(action.payload);
        return;

      case 'updateTravel': {
        const travelIndex = draft.locations.activeTravels.findIndex(t => t.id === action.payload.id);
        if (travelIndex !== -1) {
          draft.locations.activeTravels[travelIndex] = {
            ...draft.locations.activeTravels[travelIndex],
            ...action.payload.changes
          };
        }
        return;
      }

      case 'completeTravel': {
        const travel = draft.locations.activeTravels.find(t => t.id === action.payload);
        if (travel) {
          travel.status = 'completed';
          travel.actualArrival = { day: draft.time.day, slot: draft.time.slot };
          // Set current location to destination
          if (draft.locations.locations[travel.toLocationId]) {
            draft.locations.currentLocationId = travel.toLocationId;
            draft.logs.entries.unshift(
              logEvent('travel.completed', 'player', {
                message: `Party arrived at ${draft.locations.locations[travel.toLocationId].name}`
              })
            );
          }
          // Remove completed travel
          draft.locations.activeTravels = draft.locations.activeTravels.filter(t => t.id !== action.payload);
        }
        return;
      }

      case 'cancelTravel': {
        const travelToCancel = draft.locations.activeTravels.find(t => t.id === action.payload);
        if (travelToCancel) {
          draft.locations.activeTravels = draft.locations.activeTravels.filter(t => t.id !== action.payload);
          draft.logs.entries.unshift(
            logEvent('travel.cancelled', 'player', {
              message: 'Travel was cancelled'
            })
          );
        }
        return;
      }

      default:
        return;
    }
  });
}
