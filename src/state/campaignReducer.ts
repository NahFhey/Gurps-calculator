import { enableMapSet, produce } from 'immer';
import { createPartyToolState, PARTY_TOOL_SKILLS } from '../components/partyToolSeed';
import { advanceTimeSlot, type TimeLogEntry } from '../utils/timeSystem';
import { SLOT_NAMES, SLOTS_PER_DAY } from '../constants';

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
    characters: Record<
      string,
      {
        id: string;
        name: string;
        work?: {
          skills?: Record<string, number>;
        };
      }
    >;
    tools: {
      reservations: Record<string, string[]>;
    };
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
    state: Record<string, unknown> | null;
    reveal: {
      revealedTargets: Set<string>;
      revealedHP: Set<string>;
      revealedDefenseValues: Record<string, { dodge?: number }>;
    };
  };
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
    characters: initialPartyToolState.characters,
    tools: {
      reservations: {}
    }
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
    state: null,
    reveal: {
      revealedTargets: new Set(),
      revealedHP: new Set(),
      revealedDefenseValues: {}
    }
  }
});

export const initialCampaignState: CampaignState = createCampaignState();

export type CampaignAction =
  | { type: 'setActiveModule'; payload: string }
  | { type: 'selectCharacter'; payload: string | null }
  | { type: 'toggleGmMode' }
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
  | { type: 'applyDebugState'; payload: CampaignState };

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
        draft.entities.tools.reservations = action.payload;
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
        draft.activities = nextState.activities;
        draft.logs = nextState.logs;
        draft.combat = normalizeCombatReveal(nextState.combat);
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
        return;
      }
      case 'registerCombatDamage': {
        const { targetId, remainingHp } = action.payload;
        draft.combat.reveal.revealedTargets.add(targetId);
        if (remainingHp <= 0) {
          draft.combat.reveal.revealedHP.add(targetId);
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
        draft.activities = nextState.activities;
        draft.logs = nextState.logs;
        draft.checkpoints = nextState.checkpoints;
        draft.combat = normalizeCombatReveal(nextState.combat);
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
        draft.activities = restoredSnapshot.activities;
        draft.logs = {
          entries: [rollbackEntry, ...restoredSnapshot.logs.entries]
        };
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
        return;
      }
      default:
        return;
    }
  });
}
