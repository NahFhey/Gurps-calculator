import { enableMapSet, produce } from 'immer';
import { translateCombatMovement } from '../utils/mapTokenSpatial';
import { findTileGridPos } from '../utils/mapUtils';
import type { Draft } from 'immer';
import { createPartyToolState, PARTY_TOOL_SKILLS } from '../components/partyToolSeed';
import {
  advanceTimeSlot,
  DEFAULT_CALENDAR,
  getCurrentSeason,
  type CalendarConfig,
  type TimeLogEntry,
} from '../utils/timeSystem';
import { DEFAULT_STUDY_CONFIG, SLOT_NAMES, SLOTS_PER_DAY } from '../constants';
import { logger } from '../utils/logger';
import {
  fromCampaignDTO,
  fromSnapshotDTO,
  toSnapshotDTO,
  type CampaignDTO,
  type CampaignSnapshotDTO,
} from '../persistence/campaignCodec';
import { REPLACEMENT_POLICIES, replaceCampaignState } from './campaignReplacement';
import type {
  Id,
  Character,
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
  CombatItem,
  Kitchen,
  CookingSkill,
  EffectFamilyMap,
  ToolTemplate,
  ToolInstance,
  Facility,
  Inventory,
  CurrencyLog,
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
  WeatherTable,
  ActiveWeather
} from '../types/location';
import type { LocationModifiers, WeatherEffects } from '../types/location';
import type { DowntimeState } from '../types/downtime';
import type { MapState } from '../types/map';
import { initialMapState } from '../types/map';
import type { TravelGroup, Vehicle, VehicleTypeDef } from '../types/party';
import type { TravelEventTable, TravelEventTableSet } from '../types/travelEvents';
import type { ForageZoneProfile, ForageItem, ForagingConfig } from '../types/foraging';
import { DEFAULT_FORAGING_CONFIG } from '../constants/foraging';
import {
  createInitialLocationState,
  generateWeather,
} from '../utils/weatherSystem';
import { downtimeInitialState, DOWNTIME_SCHEMA_VERSION } from './downtime';
import { isInventoryAction, handleInventoryAction } from './inventory';
import { isGatheringAction, handleGatheringAction } from './gathering';
import { isAlchemyAction, handleAlchemyAction } from './alchemy';
import { isCraftingAction, handleCraftingAction } from './crafting';
import { isCharacterAction, handleCharacterAction } from './character';
import { isCombatAction, handleCombatAction } from './combat';
import { isMapAction, handleMapAction, type MapAction } from './map';
import { isPartyAction, handlePartyAction, type PartyAction } from './party';
import { resolveGroupPosition } from '../utils/partyPosition';
import { CAMPAIGN_SCHEMA_VERSION } from '../../shared/campaignVersion';
import { mapsWithPresence, regenerateMapWeatherIfNeeded, resolveWeatherContext } from '../utils/ambientWeather';
import {
  handleJourneyDayBoundary,
  handleLocationArrival,
  progressJourneys,
  syncCurrentLocationToActiveGroup,
} from './party/journeyEngine';

export const CAMPAIGN_META = {
  rulesVersion: '1.0.0',
  schemaVersion: CAMPAIGN_SCHEMA_VERSION
};

enableMapSet();

export type LegacyAppState = Record<string, unknown>;

export type CharacterPanelView = 'sheet' | 'skills' | 'equipment' | 'inventory';

export type PendingIntent =
  | { kind: 'cook'; foodIds: string[] }
  | { kind: 'craft' }
  | { kind: 'promote'; sourceNames: string[] }
  | { kind: 'encounter'; templateId: Id | null; groupId?: Id; mapId?: string };

export type CampaignState = {
  ui: {
    activeModule: string;
    selectedCharacterId: string | null;
    characterPanelView: CharacterPanelView;
    gmModeEnabled: boolean;
    activeTravelGroupId?: Id | null;
    gmSessionUnlocked: boolean;
    debugMode: boolean;
    activitiesSubview: string | null;
    pendingIntent: PendingIntent | null;
    blockingError: null | {
      type: string;
      system: 'time';
      reason: string;
      suggestedFixes: string[];
    };
  };
  meta: {
    rulesVersion: string;
    /** The campaign schema-version contract (shared/campaignVersion.ts). */
    schemaVersion: string;
    /**
     * Legacy downtime-only version, kept on read for old saves. Not an
     * authority: `schemaVersion` versions the whole campaign, downtime included.
     */
    downtimeSchemaVersion: number;
  };
  entities: {
    // Shared characters (merged workers + party characters)
    characters: Record<Id, Character>;
    characterTemplates?: Record<Id, CharacterTemplateEntity>;
    deletedBuiltinTemplateIds?: string[];
    travelGroups?: Record<Id, TravelGroup>;
    vehicles?: Record<Id, Vehicle>;
    vehicleTypes?: Record<string, VehicleTypeDef>;
    deletedBuiltinVehicleTypeIds?: string[];
    travelEventTables?: Record<Id, TravelEventTable>;
    travelEventTableSets?: Record<Id, TravelEventTableSet>;
    deletedBuiltinTravelEventIds?: string[];
    groupMeals?: Record<Id, number>;
    starvationFpDebt?: Record<Id, number>;

    // Inventory system
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

    // Foraging system (revamped)
    forageZoneProfiles: Record<Id, ForageZoneProfile>;
    forageItems: Record<Id, ForageItem>;
    foragingConfig: ForagingConfig;

    // Trading system (optional for backwards-compatible saves)
    currencyConfig?: CurrencyConfig;
    priceBook?: Record<string, PriceBookEntry>;

    // Study system (optional for backwards-compatible saves)
    studyProjects?: Record<Id, StudyProject>;
    studyConfig?: StudyConfig;

    // Social relationship ledger (optional for backwards-compatible saves)
    contacts?: Record<Id, ContactEntry>;

    // Combat system
    combatCharacters: Record<Id, CombatCharacter>;
    combatItems: Record<Id, CombatItem>;
    combatHistory: import('../types/combatTracker').CombatState[];
    combatTombstones: CombatCharacter[];
    encounterTemplates: Record<Id, import('../types/combatTracker').EncounterTemplate>;

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
  mealBuff: MealBuff | null;
  time: {
    day: number;
    slot: number;
    slotsPerDay: number;
    slotLabels: string[];
    history: Array<TimeLogEntry & { day: number }>;
    calendar?: CalendarConfig;
    nightSlotIndices?: number[];
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
    activeSession: import('../types/combatTracker').CombatState | null;
    rulesPreset: string;
    reveal: {
      revealedTargets: Set<string>;
      revealedHP: Set<string>;
      revealedDefenseValues: Record<string, { dodge?: number }>;
    };
    // New Phase 5 reveal state (per-instance reveal configuration)
    revealState: import('../types/combatTracker').RevealState | null;
  };
  locations: LocationState;
  downtime: DowntimeState;
  maps: MapState;
};

export const initialLegacyAppState: LegacyAppState = {};
const initialPartyToolState = createPartyToolState();

export type LogVisibility = 'gmOnly' | 'player' | 'mixed';

export type LogEntryMeta = {
  characterIds?: string[];
  characterNames?: string[];
  itemNames?: string[];
  quantity?: number;
  taskId?: string;
};

export type LogEntry = {
  id: string;
  timestamp: number;
  type: string;
  visibility: LogVisibility;
  payload: Record<string, unknown>;
  day?: number;
  slot?: number;
  meta?: LogEntryMeta;
};

const MAX_LOG_ENTRIES = 2000;

export const appendLogEntry = (draft: Draft<CampaignState>, entry: LogEntry): void => {
  draft.logs.entries.unshift({
    ...entry,
    day: entry.day ?? draft.time.day,
    slot: entry.slot ?? draft.time.slot,
  });
  if (draft.logs.entries.length > MAX_LOG_ENTRIES) {
    draft.logs.entries.length = MAX_LOG_ENTRIES;
  }
};

export type CampaignSnapshot = Omit<CampaignState, 'checkpoints'>;

export type Checkpoint = {
  id: string;
  label: string;
  createdAt: number;
  /** Stored as a DTO (arrays, not Sets): it is persisted with the campaign as-is. */
  snapshot: CampaignSnapshotDTO;
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

const createCheckpointEntry = (state: CampaignState, label: string): Checkpoint | null => {
  let snapshot: CampaignSnapshotDTO;
  try {
    snapshot = toSnapshotDTO(state);
  } catch (err) {
    // A state that cannot be JSON-cloned cannot be restored either: skip the
    // checkpoint rather than store live draft proxies.
    logger.error('Failed to create checkpoint snapshot; checkpoint skipped:', err);
    return null;
  }
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label,
    createdAt: Date.now(),
    snapshot
  };
};

const guardTimeAdvance = (draft: Draft<CampaignState>): boolean => {
  if (draft.activities.pausedSessionIds.length === 0) {
    return true;
  }
  draft.ui.blockingError = {
    type: 'pausedActivities',
    system: 'time',
    reason: 'Paused activities are blocking time advance.',
    suggestedFixes: [
      'Resume or complete all paused activities.',
      'Clear paused sessions in the Activities module.'
    ]
  };
  return false;
};

const pushCheckpoint = (draft: Draft<CampaignState>, label: string): void => {
  const checkpoint = createCheckpointEntry(draft as CampaignState, label);
  if (!checkpoint) {
    return;
  }
  draft.checkpoints.entries.unshift(checkpoint);
  if (draft.checkpoints.entries.length > draft.checkpoints.maxSize) {
    draft.checkpoints.entries.pop();
  }
};

const advanceSlotAndRegenerateWeather = (
  draft: Draft<CampaignState>,
  logMessage: (day: number, slot: number, label: string | undefined) => string
): void => {
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
  appendLogEntry(draft,
    logEvent('time.advance', 'player', {
      message: logMessage(nextDay, nextSlot, slotLabels[nextSlot])
    })
  );
  draft.ui.blockingError = null;

  const newTime = { day: nextDay, slot: nextSlot, slotsPerDay };
  const season = getCurrentSeason(nextDay, draft.time.calendar ?? DEFAULT_CALENDAR);
  const activeGroup = draft.ui.activeTravelGroupId
    ? draft.entities.travelGroups?.[draft.ui.activeTravelGroupId]
    : undefined;
  const activeGroupMapId = activeGroup ? resolveGroupPosition(draft, activeGroup)?.mapId : undefined;
  const activeMapId = activeGroupMapId && draft.maps.mapsById[activeGroupMapId]
    ? activeGroupMapId
    : draft.maps.activeMapId;
  for (const mapId of mapsWithPresence(draft)) {
    const changed = regenerateMapWeatherIfNeeded(draft, mapId, newTime, season);
    if (changed && mapId === activeMapId) {
      const map = draft.maps.mapsById[mapId];
      appendLogEntry(draft, logEvent('weather.changed', 'player', {
        message: `Weather on ${map.name} changed to: ${map.currentWeather?.weather.description ?? 'Unknown'}`,
      }));
    }
  }
};

/** Defaults for the root slices a whole-state replacement finds missing. */
const replacementDefaults = (time: CampaignState['time'] | undefined): CampaignState => ({
  ...createCampaignState(),
  locations: createInitialLocationState(time ?? { day: 1, slot: 0 })
});

export const createCampaignState = (legacyAppState: LegacyAppState = initialLegacyAppState): CampaignState => ({
  ui: {
    activeModule: 'inventory',
    selectedCharacterId: null,
    characterPanelView: 'sheet',
    gmModeEnabled: false,
    activeTravelGroupId: null,
    gmSessionUnlocked: false,
    debugMode: false,
    activitiesSubview: null,
    pendingIntent: null,
    blockingError: null
  },
  meta: {
    rulesVersion: CAMPAIGN_META.rulesVersion,
    schemaVersion: CAMPAIGN_META.schemaVersion,
    downtimeSchemaVersion: DOWNTIME_SCHEMA_VERSION,
  },
  entities: {
    // Characters (from Party Tool initially)
    characters: initialPartyToolState.characters,
    characterTemplates: {},
    deletedBuiltinTemplateIds: [],
    travelGroups: {},
    vehicles: {},
    vehicleTypes: {},
    deletedBuiltinVehicleTypeIds: [],
    travelEventTables: {},
    travelEventTableSets: {},
    deletedBuiltinTravelEventIds: [],
    groupMeals: {},
    starvationFpDebt: {},

    // Inventory system (empty initially)
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

    // Foraging system (revamped)
    forageZoneProfiles: {},
    forageItems: {},
    foragingConfig: { ...DEFAULT_FORAGING_CONFIG },

    // Combat system
    combatCharacters: {},
    combatItems: {},
    combatHistory: [],
    combatTombstones: [],
    encounterTemplates: {},

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
  mealBuff: null,
  time: {
    day: 1,
    slot: 0,
    slotsPerDay: SLOTS_PER_DAY,
    slotLabels: [...SLOT_NAMES],
    history: [],
    calendar: DEFAULT_CALENDAR,
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
    },
    revealState: null
  },
  locations: createInitialLocationState({ day: 1, slot: 0 }),
  downtime: downtimeInitialState,
  maps: initialMapState,
});

export const initialCampaignState: CampaignState = createCampaignState();

export type CampaignAction =
  | { type: 'setActiveModule'; payload: string }
  | { type: 'setPendingIntent'; payload: PendingIntent }
  | { type: 'clearPendingIntent' }
  | { type: 'selectCharacter'; payload: string | null }
  | { type: 'setCharacterPanelView'; payload: CharacterPanelView }
  | { type: 'toggleGmMode' }
  | { type: 'setGmMode'; payload: boolean }
  | { type: 'setGmUnlocked'; payload: boolean }
  | { type: 'toggleDebug' }
  | { type: 'setActivitiesSubview'; payload: string | null }
  | { type: 'setMealBuff'; payload: MealBuff | null }
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
  | { type: 'applyDebugState'; payload: CampaignDTO }
  // Character actions
  | { type: 'addCharacter'; payload: Character }
  | { type: 'updateCharacter'; payload: { id: Id; changes: Partial<Character> } }
  | { type: 'removeCharacter'; payload: Id }
  | { type: 'setCharacters'; payload: Record<Id, Character> }
  | { type: 'upsertCharacterTemplate'; payload: CharacterTemplateEntity }
  | { type: 'removeCharacterTemplate'; payload: Id }
  // Material actions
  | import('./inventory').InventoryAction
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
  // Forage Zone Profile actions
  | { type: 'setForageZoneProfiles'; payload: Record<Id, ForageZoneProfile> }
  | { type: 'addForageZoneProfile'; payload: ForageZoneProfile }
  | { type: 'updateForageZoneProfile'; payload: { id: Id; changes: Partial<ForageZoneProfile> } }
  | { type: 'removeForageZoneProfile'; payload: Id }
  // Forage Item actions
  | { type: 'setForageItems'; payload: Record<Id, ForageItem> }
  | { type: 'addForageItem'; payload: ForageItem }
  | { type: 'updateForageItem'; payload: { id: Id; changes: Partial<ForageItem> } }
  | { type: 'removeForageItem'; payload: Id }
  // Foraging Config actions
  | { type: 'setForagingConfig'; payload: ForagingConfig }
  | { type: 'updateForagingConfig'; payload: Partial<ForagingConfig> }
  // Trading config actions
  | { type: 'setCurrencyConfig'; payload: CurrencyConfig }
  | { type: 'setPriceBookEntry'; payload: PriceBookEntry }
  | { type: 'removePriceBookEntry'; payload: string }
  // Study actions
  | { type: 'setStudyConfig'; payload: StudyConfig }
  | { type: 'upsertStudyProject'; payload: StudyProject }
  | { type: 'removeStudyProject'; payload: Id }
  | { type: 'creditStudyHours'; payload: { projectId: Id; hours: number } }
  | { type: 'awardStudyPoint'; payload: Id }
  // Social contact actions
  | { type: 'upsertContact'; payload: ContactEntry }
  | { type: 'removeContact'; payload: Id }
  | { type: 'shiftContactModifier'; payload: { id: Id; delta: number; cause: string; dayKey: number } }
  // Day Planner actions
  | { type: 'setTimeSlots'; payload: TimeSlot[] }
  | { type: 'addTaskAssignment'; payload: TaskAssignment }
  | { type: 'updateTaskAssignment'; payload: { id: Id; changes: Partial<TaskAssignment> } }
  | { type: 'setTaskAssignments'; payload: TaskAssignment[] }
  | { type: 'setPendingDayLedger'; payload: DayLedger | null }
  | { type: 'setDayPlannerSlot'; payload: number }
  | { type: 'setTimeDay'; payload: number }
  // Combat Character actions
  | { type: 'addCombatCharacter'; payload: CombatCharacter }
  | { type: 'updateCombatCharacter'; payload: { id: Id; changes: Partial<CombatCharacter> } }
  | { type: 'removeCombatCharacter'; payload: Id }
  | { type: 'setCombatCharacters'; payload: Record<Id, CombatCharacter> }
  // Combat Session actions
  | { type: 'setCombatActive'; payload: import('../types/combatTracker').CombatState | null }
  | { type: 'updateCombatActive'; payload: Partial<import('../types/combatTracker').CombatState> }
  | { type: 'setCombatHistory'; payload: import('../types/combatTracker').CombatState[] }
  | { type: 'setCombatTombstones'; payload: CombatCharacter[] }
  | { type: 'setCombatRulesPreset'; payload: string }
  // Combat Item actions
  | { type: 'setCombatItems'; payload: Record<Id, CombatItem> }
  | { type: 'addCombatItem'; payload: CombatItem }
  // Combat Reveal State action (Phase 5)
  | { type: 'setCombatRevealState'; payload: { version?: number; combatId?: string; byInstanceId: Record<string, unknown> } | null }
  // Encounter template actions (Phase 11c)
  | { type: 'addEncounterTemplate'; payload: import('../types/combatTracker').EncounterTemplate }
  | { type: 'updateEncounterTemplate'; payload: { id: Id; changes: Partial<import('../types/combatTracker').EncounterTemplate> } }
  | { type: 'removeEncounterTemplate'; payload: Id }
  | { type: 'setEncounterTemplates'; payload: Record<Id, import('../types/combatTracker').EncounterTemplate> }
  // Kitchen actions
  | { type: 'setKitchens'; payload: Record<Id, Kitchen> }
  | { type: 'addKitchen'; payload: Kitchen }
  // Cooking Skill actions
  | { type: 'setCookingSkills'; payload: CookingSkill[] }
  // Facility actions
  | { type: 'setFacilities'; payload: Record<Id, Facility> }
  // Effect Family Map actions
  | { type: 'setEffectFamilyMap'; payload: EffectFamilyMap }
  // Inventory actions
  | { type: 'addInventory'; payload: Inventory }
  | { type: 'updateInventory'; payload: { id: Id; changes: Partial<Inventory> } }
  | { type: 'setInventories'; payload: Record<Id, Inventory> }
  // Inventory integration bus actions (Phase 12a.5)
  | { type: 'inventory/itemAcquired'; payload: { item: AcquiredItem; owner: InventoryOwner; source: AcquisitionSource } }
  | { type: 'inventory/itemRetagged'; payload: { itemId: Id; newOwner: InventoryOwner } }
  | { type: 'inventory/itemAttunementSet'; payload: { itemId: Id; attuned: boolean } }
  | { type: 'inventory/itemMagicalSet'; payload: { itemId: Id; magical: boolean } }
  | { type: 'inventory/itemConsumed'; payload: { itemId: Id; quantity?: number; combat?: { participantId: Id; participantName: string; round: number } } }
  | { type: 'inventory/itemConsumptionReverted'; payload: { entryId: Id } }
  // Location & Weather actions
  | { type: 'setLocationsState'; payload: Partial<LocationState> }
  | { type: 'addLocation'; payload: Location }
  | { type: 'updateLocation'; payload: { id: Id; changes: Partial<Location> } }
  | { type: 'removeLocation'; payload: Id }
  | { type: 'setCurrentLocation'; payload: Id }
  | { type: 'setMapWeather'; payload: { mapId: Id; weather: ActiveWeather } }
  | { type: 'rollNewWeather'; payload: { mapId: Id } }
  | { type: 'setCalendarConfig'; payload: CalendarConfig }
  | { type: 'addWeatherTable'; payload: WeatherTable }
  | { type: 'updateWeatherTable'; payload: { id: Id; changes: Partial<WeatherTable> } }
  | { type: 'removeWeatherTable'; payload: Id }
  // Custom climate/terrain actions
  | { type: 'addCustomClimate'; payload: { key: string; label: string } }
  | { type: 'removeCustomClimate'; payload: string }
  | { type: 'addCustomTerrain'; payload: { key: string; label: string } }
  | { type: 'removeCustomTerrain'; payload: string }
  // Storage cleanup actions
  | { type: 'clearCheckpoints' }
  | { type: 'clearLogs' }
  | { type: 'clearCombatHistory' }
  // Downtime actions
  | { type: 'setDowntime'; payload: DowntimeState }
  // Map actions (bulk setter + delegated map/ prefixed actions)
  | { type: 'setMaps'; payload: MapState }
  | { type: 'setTerrainModifierOverrides'; payload: Record<string, Partial<LocationModifiers>> }
  | { type: 'setWeatherEffectOverrides'; payload: Record<string, Partial<WeatherEffects>> }
  | PartyAction
  | MapAction;

export function campaignReducer(state: CampaignState, action: CampaignAction) {
  return produce(state, (draft) => {
    // Delegate to domain-specific reducers first
    if (isInventoryAction(action)) {
      handleInventoryAction(draft, action);
      return;
    }
    if (isGatheringAction(action)) {
      handleGatheringAction(draft, action);
      return;
    }
    if (isAlchemyAction(action)) {
      handleAlchemyAction(draft, action);
      return;
    }
    if (isCraftingAction(action)) {
      handleCraftingAction(draft, action);
      return;
    }
    if (isCharacterAction(action)) {
      handleCharacterAction(draft, action);
      return;
    }
    if (isPartyAction(action)) {
      const prevActiveGroupId = draft.ui.activeTravelGroupId;
      handlePartyAction(draft, action);

      // Phase 15a: currentLocationId is active-group-scoped — when the active group
      // changes (explicit switch, or implicit reassignment when a drained group
      // dissolves), re-derive it from the new active group's position. Arrivals
      // below handle their own switch; discovery stays objective for every group.
      if (draft.ui.activeTravelGroupId !== prevActiveGroupId) {
        syncCurrentLocationToActiveGroup(draft);
      }
      const placedGroup = action.type === 'party/placeGroup'
        ? draft.entities.travelGroups?.[action.payload.groupId]
        : undefined;
      if (action.type === 'party/placeGroup'
        && placedGroup
        && placedGroup.position?.mapId === action.payload.mapId
        && placedGroup.position.tileId === action.payload.tileId) {
        handleLocationArrival(
          draft,
          action.payload.mapId,
          action.payload.tileId,
          action.payload.groupId === draft.ui.activeTravelGroupId
        );
      }
      const placedPosition = placedGroup ? resolveGroupPosition(draft, placedGroup) : null;
      if (action.type === 'party/placeGroup' && placedPosition?.mapId === action.payload.mapId) {
        regenerateMapWeatherIfNeeded(
          draft,
          action.payload.mapId,
          { day: draft.time.day, slot: draft.time.slot, slotsPerDay: draft.time.slotsPerDay },
          getCurrentSeason(draft.time.day, draft.time.calendar ?? DEFAULT_CALENDAR)
        );
      }
      return;
    }
    if (isCombatAction(action)) {
      handleCombatAction(draft, action);
      return;
    }
    if (isMapAction(action)) {
      const origins = Object.fromEntries(Object.entries(draft.maps.mapsById).map(([id, map]) => [id, map.grid[0]?.[0]]));
      handleMapAction(draft, action);
      for (const [id, tileId] of Object.entries(origins)) {
        const map = draft.maps.mapsById[id];
        const shift = map && tileId ? findTileGridPos(map, tileId) : undefined;
        if (!shift || (!shift.col && !shift.row)) continue;
        if (draft.combat.activeSession) draft.combat.activeSession = translateCombatMovement(draft.combat.activeSession, id, shift.col, shift.row);
        draft.entities.combatHistory = draft.entities.combatHistory.map(combat => translateCombatMovement(combat, id, shift.col, shift.row));
      }
      return;
    }

    switch (action.type) {
      case 'setActiveModule':
        draft.ui.activeModule = action.payload;
        return;
      case 'setPendingIntent':
        draft.ui.pendingIntent = action.payload;
        return;
      case 'clearPendingIntent':
        draft.ui.pendingIntent = null;
        return;
      case 'selectCharacter':
        draft.ui.selectedCharacterId = action.payload;
        // Reset to sheet view when selecting a different character
        draft.ui.characterPanelView = 'sheet';
        return;
      case 'setCharacterPanelView':
        draft.ui.characterPanelView = action.payload;
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
      case 'setMealBuff':
        draft.mealBuff = action.payload;
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
        appendLogEntry(draft, action.payload);
        return;
      case 'setLogsEntries':
        draft.logs.entries = action.payload;
        if (draft.logs.entries.length > MAX_LOG_ENTRIES) {
          draft.logs.entries = action.payload.slice(0, MAX_LOG_ENTRIES);
        }
        return;
      case 'createCheckpoint': {
        pushCheckpoint(draft, action.payload);
        return;
      }
      case 'importCampaignState': {
        pushCheckpoint(draft, action.payload.label ?? 'Before import');
        const next = action.payload.state;
        replaceCampaignState(draft, next, REPLACEMENT_POLICIES.import, replacementDefaults(next.time));
        return;
      }
      case 'startCombat': {
        pushCheckpoint(draft, 'Before combat');
        draft.combat.active = true;
        draft.combat.encounterId =
          action.payload?.encounterId ?? `enc-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        // Log combat start
        appendLogEntry(draft,
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
          appendLogEntry(draft,
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
        // Hand-edited debug JSON may lack whole slices; the defaults fill them.
        const dto: Partial<CampaignDTO> = action.payload;
        const next = fromCampaignDTO(dto);
        replaceCampaignState(draft, next, REPLACEMENT_POLICIES.debug, replacementDefaults(next.time));
        return;
      }
      case 'restoreCheckpoint': {
        const checkpoint = draft.checkpoints.entries.find((entry) => entry.id === action.payload);
        if (!checkpoint) {
          return;
        }
        let restored: Partial<CampaignSnapshot>;
        try {
          // Old snapshots may lack slices added since; the defaults fill them.
          const dto: Partial<CampaignSnapshotDTO> = JSON.parse(JSON.stringify(checkpoint.snapshot));
          restored = fromSnapshotDTO(dto);
        } catch (err) {
          logger.error('Failed to deep-clone checkpoint for restore:', err);
          return;
        }
        replaceCampaignState(draft, restored, REPLACEMENT_POLICIES.restore, replacementDefaults(restored.time));
        appendLogEntry(draft, logEvent('campaign.rollback', 'player', {
          message: 'Rollback occurred.'
        }));
        return;
      }
      case 'advanceTime': {
        if (!guardTimeAdvance(draft)) {
          return;
        }
        pushCheckpoint(draft, 'Before time advance');
        const previousDay = draft.time.day;
        progressJourneys(draft);
        advanceSlotAndRegenerateWeather(
          draft,
          (day, slot, label) =>
            `Advanced to Day ${day}, Slot ${slot + 1} (${label})`
        );
        if (draft.time.day !== previousDay) handleJourneyDayBoundary(draft);
        return;
      }

      // ========================================================================
      // CHARACTER, INVENTORY, GATHERING, ALCHEMY, CRAFTING ACTIONS
      // Delegated to domain-specific reducers (see isXxxAction checks above)
      // ========================================================================

      // ========================================================================
      // DAY PLANNER ACTIONS
      // ========================================================================
      case 'setCurrencyConfig':
        draft.entities.currencyConfig = action.payload;
        return;
      case 'setPriceBookEntry':
        draft.entities.priceBook ??= {};
        draft.entities.priceBook[action.payload.key] = action.payload;
        return;
      case 'removePriceBookEntry':
        if (draft.entities.priceBook) delete draft.entities.priceBook[action.payload];
        return;
      case 'setStudyConfig':
        draft.entities.studyConfig = action.payload;
        return;
      case 'upsertStudyProject':
        draft.entities.studyProjects ??= {};
        draft.entities.studyProjects[action.payload.id] = action.payload;
        return;
      case 'removeStudyProject':
        if (draft.entities.studyProjects) delete draft.entities.studyProjects[action.payload];
        return;
      case 'creditStudyHours': {
        const project = draft.entities.studyProjects?.[action.payload.projectId];
        if (!project) return;
        project.accumulatedHours += action.payload.hours;
        project.updatedAt = Date.now();
        return;
      }
      case 'awardStudyPoint': {
        const project = draft.entities.studyProjects?.[action.payload];
        if (!project) return;
        const hoursPerPoint = draft.entities.studyConfig?.hoursPerPoint ?? DEFAULT_STUDY_CONFIG.hoursPerPoint;
        if (project.accumulatedHours < hoursPerPoint) return;
        project.accumulatedHours = Math.max(0, project.accumulatedHours - hoursPerPoint);
        project.pointsAwarded += 1;
        project.updatedAt = Date.now();
        return;
      }
      case 'upsertContact':
        draft.entities.contacts ??= {};
        draft.entities.contacts[action.payload.id] = {
          ...action.payload,
          modifier: Math.max(-4, Math.min(4, action.payload.modifier)),
        };
        return;
      case 'removeContact':
        if (draft.entities.contacts) delete draft.entities.contacts[action.payload];
        return;
      case 'shiftContactModifier': {
        const contact = draft.entities.contacts?.[action.payload.id];
        if (!contact) return;
        const timestamp = Date.now();
        const newModifier = Math.max(-4, Math.min(4, contact.modifier + action.payload.delta));
        const appliedDelta = newModifier - contact.modifier;
        contact.modifier = newModifier;
        contact.history.push({
          id: `contact-shift-${timestamp}-${contact.history.length}`,
          dayKey: action.payload.dayKey,
          delta: appliedDelta,
          newModifier,
          cause: action.payload.cause,
          timestamp,
        });
        contact.updatedAt = timestamp;
        return;
      }
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
      case 'setDayPlannerSlot':
        draft.dayPlanner.currentSlot = action.payload;
        return;
      case 'setTimeDay':
        draft.time.day = action.payload;
        return;

      // ========================================================================
      // COMBAT ACTIONS
      // Delegated to combat reducer (see isCombatAction check above)
      // ========================================================================

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
      // Delegated to inventory reducer (see isInventoryAction check above)
      // ========================================================================

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
        // Note: weather tables don't have locationId, they're referenced by location.weatherTableId
        return;
      }

      case 'setCurrentLocation':
        if (draft.locations.locations[action.payload]) {
          draft.locations.currentLocationId = action.payload;
          appendLogEntry(draft,
            logEvent('location.changed', 'player', {
              message: `Party moved to ${draft.locations.locations[action.payload].name}`
            })
          );
        }
        return;

      case 'setCalendarConfig':
        draft.time.calendar = action.payload;
        return;

      case 'setMapWeather': {
        const { mapId, weather } = action.payload;
        if (draft.maps.mapsById[mapId]) {
          draft.maps.mapsById[mapId].currentWeather = weather;
        }
        return;
      }

      case 'rollNewWeather': {
        const { mapId } = action.payload;
        const map = draft.maps.mapsById[mapId];
        if (map) {
          const { climate, weatherTable } = resolveWeatherContext(draft, mapId);
          const currentTime = { day: draft.time.day, slot: draft.time.slot };
          const result = generateWeather({
            climate,
            weatherTable,
            currentTime,
            season: getCurrentSeason(
              draft.time.day,
              draft.time.calendar ?? DEFAULT_CALENDAR
            ).def,
            weatherEffectOverrides: draft.locations.weatherEffectOverrides,
            slotsPerDay: draft.time.slotsPerDay,
          });
          map.currentWeather = result.weather;
          appendLogEntry(draft,
            logEvent('weather.changed', 'player', {
              message: `Weather on ${map.name} changed to: ${result.weather.weather.description}`,
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
        // Clear dangling map overrides.
        for (const map of Object.values(draft.maps.mapsById)) {
          if (map.weatherTableId === action.payload) {
            map.weatherTableId = undefined;
          }
        }
        return;

      // ========================================================================
      // CUSTOM CLIMATE/TERRAIN ACTIONS
      // ========================================================================
      case 'addCustomClimate': {
        if (!draft.locations.customClimates) {
          draft.locations.customClimates = [];
        }
        // Prevent duplicates
        if (!draft.locations.customClimates.some(c => c.key === action.payload.key)) {
          draft.locations.customClimates.push(action.payload);
        }
        return;
      }

      case 'removeCustomClimate': {
        if (draft.locations.customClimates) {
          draft.locations.customClimates = draft.locations.customClimates.filter(
            c => c.key !== action.payload
          );
        }
        return;
      }

      case 'addCustomTerrain': {
        if (!draft.locations.customTerrains) {
          draft.locations.customTerrains = [];
        }
        // Prevent duplicates
        if (!draft.locations.customTerrains.some(t => t.key === action.payload.key)) {
          draft.locations.customTerrains.push(action.payload);
        }
        return;
      }

      case 'removeCustomTerrain': {
        if (draft.locations.customTerrains) {
          draft.locations.customTerrains = draft.locations.customTerrains.filter(
            t => t.key !== action.payload
          );
        }
        return;
      }

      case 'setTerrainModifierOverrides':
        draft.locations.terrainModifierOverrides = action.payload;
        return;

      case 'setWeatherEffectOverrides':
        draft.locations.weatherEffectOverrides = action.payload;
        return;

      // ========================================================================
      // DOWNTIME ACTIONS
      // ========================================================================
      case 'setDowntime':
        draft.downtime = action.payload;
        return;

      // ========================================================================
      // MAP ACTIONS
      // ========================================================================
      case 'setMaps':
        draft.maps = action.payload;
        return;

      // ========================================================================
      // STORAGE CLEANUP ACTIONS
      // ========================================================================
      case 'clearCheckpoints':
        draft.checkpoints.entries = [];
        return;
      case 'clearLogs':
        draft.logs.entries = [];
        return;
      case 'clearCombatHistory':
        draft.entities.combatHistory = [];
        return;

      default:
        return;
    }
  });
}
