/**
 * Combat Tracker Types
 *
 * TypeScript interfaces for the CombatTracker component and its views.
 * Extracted from CombatTracker.tsx for better organization and reusability.
 */

import type { Id, ItemInstance } from './campaign';

// ============================================================================
// CORE COMBAT TYPES
// ============================================================================

export interface Attack {
  name: string;
  skill: number;
  damage?: string;
}

export interface ConditionDuration {
  type: string;
  value?: number | null;
}

export interface ConditionExpiry {
  type: 'turn' | 'round' | 'endOfCombat';
  turnsRemaining?: number;
  round?: number;
}

/**
 * Player-visibility state of a single condition instance (Phase 12a.6).
 * - 'closed' — hidden from players entirely
 * - 'half'   — telegraphed as an anonymous "Afflicted" placeholder
 * - 'open'   — fully visible to players
 */
export type ConditionRevealState = 'closed' | 'half' | 'open';

/**
 * Canonical condition instance shape (Phase 12a.6 consolidation).
 * Matches what createConditionInstance() in utils/conditionsEngine.js returns.
 */
export interface ConditionInstance {
  instanceId: string;
  conditionId: string;
  label: string;
  severity?: number | null;
  source?: string | null;
  startedAtRound?: number;
  startedAtTurn?: number;
  duration?: ConditionDuration | null;
  expiresAt?: ConditionExpiry | null;
  notes?: string | null;
  /** GM-controlled player visibility. Seeded from the catalog isObvious flag at creation. */
  revealed?: ConditionRevealState;
  /** Set on player-view stand-ins for 'half'-revealed conditions; conditionId is a sentinel. */
  placeholder?: boolean;
}

export interface Participant {
  instanceId: string;
  id?: string;
  libraryId?: string;
  name: string;
  category: string;
  st: number;
  dx: number;
  iq: number;
  ht: number;
  hp: number | HPValue;
  fp: number | FPValue;
  mp: number | MPValue;
  maxHP?: number;
  maxFP?: number;
  maxMP?: number;
  currentHP?: number;
  currentFP?: number;
  currentMP?: number;
  currentRound?: number;
  basicSpeed: number;
  basicMove: number;
  dodge?: number;
  parry?: number;
  block?: number;
  dr?: number;
  defenses?: {
    dodge?: number;
    parry?: number;
    block?: number;
  };
  attacks?: Attack[];
  position?: { q: number; r: number };
  shockPenalty?: number;
  /** Legacy prone flag; superseded by the PRONE condition but still read for back-compat. */
  isProne?: boolean;
  /** Legacy grappled flag; superseded by the GRAPPLED condition but still read for back-compat. */
  isGrappled?: boolean;
  isDead?: boolean;
  bleeding?: { rate: number; round: number } | null;
  crippled?: string[];
  conditions?: ConditionInstance[];
  /** Whether this participant was added from the party roster (Phase 11c) */
  isFromParty?: boolean;
  /** Link back to the campaign Character.id for post-combat sync (Phase 11c) */
  partyCharacterId?: string;
  /** Combat token image (base64 data URL, from Character.images.token) */
  tokenImage?: string;
  /** Armor DR by hit location (derived from equipped armor at combat start) */
  armorByLocation?: Array<{ location: string; dr: number }>;
  /** Encumbrance-adjusted dodge (overrides dodge field when set) */
  encumbranceDodge?: number;
  /** Encumbrance-adjusted move (overrides basicMove when set) */
  encumbranceMove?: number;
}

export interface HPValue {
  mode: 'exact' | 'band' | 'unknown';
  current?: number;
  max?: number;
  band?: string;
  bandText?: string;
}

export interface FPValue {
  mode: 'exact' | 'unknown';
  current?: number;
  max?: number;
}

export interface MPValue {
  mode: 'exact' | 'unknown';
  current?: number;
  max?: number;
}

// ============================================================================
// LOG TYPES
// ============================================================================

export interface LogEntry {
  id?: string;
  timestamp: number;
  entryType?: string;
  text?: string;
  message?: string;
  round?: number;
  turn?: number;
  roll?: RollData;
  action?: ActionData;
  maneuver?: string;
}

export interface RollData {
  expression: string;
  dice: number[];
  modifier: number;
  total: number;
  target: number | null;
  margin: number;
  success: boolean;
  valid?: boolean;
  error?: string;
}

export interface ActionData {
  kind: string;
  attack?: AttackActionData;
  defense?: DefenseActionData;
  damage?: DamageActionData;
}

export interface AttackActionData {
  name?: string;
  skill?: number;
  damage?: string;
  hitLocation?: {
    key: string;
    label: string;
    drKey?: string;
    toHitPenalty?: number;
  } | null;
  hitLocationRoll?: {
    dice: number[];
    total: number;
  } | null;
  rollTotal?: number | null;
  effectiveSkill?: number;
  margin?: number | null;
  success?: boolean;
  modifiers?: { label: string; value: number }[];
}

export interface DefenseActionData {
  type?: string;
  baseDefense?: number;
  effectiveDefense?: number;
  rollTotal?: number | null;
  margin?: number | null;
  success?: boolean | null;
  modifiers?: { label: string; value: number }[];
}

export interface DamageActionData {
  expression?: string;
  rolledDamage?: number;
  generalDRUsed?: number;
  penetrating?: number | null;
}

// ============================================================================
// COMBAT STATE TYPES
// ============================================================================

export interface ConsumptionEntry {
  id: Id;
  participantId: Id;
  participantName: string;
  characterId: Id;
  itemSnapshot: ItemInstance;
  quantity: number;
  round: number;
}

export interface CombatState {
  version?: number;
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  mapId?: string;
  participants: Participant[];
  turnOrder: string[];
  currentTurnIndex: number;
  currentRound: number;
  turnDecisions: Record<string, TurnDecision>;
  log: LogEntry[];
  consumptions?: ConsumptionEntry[];
}

export interface MovementRecord {
  fromPosition: { q: number; r: number };
  toPosition: { q: number; r: number };
  path: string[];
  costYards: number;
}

export interface TurnDecision {
  maneuverId?: string;
  notes?: string;
  aim?: { targetInstanceId?: string; turnsAimed?: number };
  wait?: { triggerText?: string };
  movement?: MovementRecord;
}

export interface HistoryCheckpoint {
  at: number;
  snapshot: unknown;
}

export interface HistoryState {
  version: number;
  actions: unknown[];
  cursor: number;
  checkpoints: HistoryCheckpoint[];
  checkpointEvery: number;
  maxActions: number;
  maxCheckpoints: number;
}

// Reveal mode literal unions. These mirror the `RevealMode` runtime consts in
// src/utils/combatReveal.ts (the module that constructs every reveal entry via
// createDefaultRevealForInstance) — keep the two in sync.
export type NameRevealMode = 'hidden' | 'partial' | 'full';
export type NumericRevealMode = 'unknown' | 'band' | 'exact';
export type DefenseRevealMode = 'unknown' | 'approx' | 'exact';
export type DRRevealMode = 'unknown' | 'minKnown' | 'exact';
export type AttacksRevealMode = 'hidden' | 'namesOnly' | 'full';
export type NotesRevealMode = 'hidden' | 'full';

/**
 * Per-participant reveal record, shaped exactly as
 * `createDefaultRevealForInstance` builds it. The mode fields are always
 * present on constructed entries; the auxiliary value fields (`approxValue`,
 * `generalMin`, per-location DR) are only added when the GM reveals them.
 */
export interface RevealEntry {
  name: NameRevealMode;
  tags: NotesRevealMode;
  hp: { mode: NumericRevealMode };
  fp: { mode: NumericRevealMode };
  mp: { mode: NumericRevealMode };
  defenses: {
    dodge: DefenseRevealMode;
    parry: DefenseRevealMode;
    block: DefenseRevealMode;
    /** GM-entered approximate values shown in DEFENSE_APPROX mode. */
    approxValue?: Partial<Record<'dodge' | 'parry' | 'block', number>>;
  };
  dr: {
    general: DRRevealMode;
    /** Known minimum shown in DR_MIN_KNOWN mode. */
    generalMin?: number;
    byLocation: Record<string, { mode: DRRevealMode; min?: number }>;
  };
  attacks: AttacksRevealMode;
  notes: NotesRevealMode;
}

/**
 * Reveal container as persisted by the combat store. Freshly-built containers
 * from `createInitialRevealState` carry `encounterId`; useCombatSession maps
 * that onto `combatId` before the first save, so persisted state may hold
 * either (or both) — hence both optional.
 */
export interface RevealState {
  version?: number;
  combatId?: string;
  encounterId?: string;
  byInstanceId: Record<string, RevealEntry>;
}

// ============================================================================
// MANEUVER TYPES
// ============================================================================

export interface Maneuver {
  id: string;
  label: string;
  group?: string;
  notes?: string;
  prompts?: ManeuverPrompts;
  workflow?: ManeuverWorkflow;
}

export interface ManeuverPrompts {
  allowsAttackPanel?: boolean;
  allowsDefensePanel?: boolean;
  allowsAimPanel?: boolean;
  allowsWaitPanel?: boolean;
}

export interface ManeuverWorkflow {
  attack?: { modifiers: { label: string; value: number }[] };
  defense?: { modifiers: { label: string; value: number }[] };
  damage?: { modifiers: { label: string; value: number }[] };
}

export interface TurnContext {
  canAct: boolean;
  isStunned: boolean;
  isProne: boolean;
  isGrappled: boolean;
  isUnconscious: boolean;
  shockPenalty: number;
  moveAvailable: number | null;
}

export interface ManeuverSelection {
  selectedId: string | null;
  prompts: Partial<ManeuverPrompts>;
  workflow: Partial<ManeuverWorkflow>;
}

// ============================================================================
// REINFORCEMENT TYPES
// ============================================================================

export interface ReinforcementData {
  characterId: string;
  category: string;
  previewNames: string[];
  insertionMode: string;
  manualOrder?: string[] | null;
}

export interface Character {
  id: string;
  name: string;
  category: string;
  hp: number;
  fp: number;
  mp: number;
  basicSpeed: number;
  dx: number;
  st: number;
  iq: number;
  ht: number;
  dodge: number;
  parry: number;
  block: number;
  dr: number;
}

// ============================================================================
// INJURY TYPES
// ============================================================================

export interface InjuryEffect {
  type: string;
  autoApplied?: boolean;
  value?: number;
  success?: boolean;
  outcome?: string;
  locationKey?: string;
  locationLabel?: string;
}

export interface InjuryData {
  hitLocation?: {
    profileId?: string;
    locationKey?: string;
    locationLabel?: string;
    rolled?: { dice: number[]; total: number } | null;
  } | null;
  damageBreakdown?: {
    raw?: number;
    dr?: number;
    penetrating?: number;
    damageType?: string;
    woundingMultiplier?: number;
    baseWoundingMultiplier?: number;
    locationWoundingMultiplier?: number;
    locationLabel?: string | null;
    injuryApplied: number;
  };
  effects?: InjuryEffect[];
  newHP?: number;
  targetInstanceId?: string;
}

export interface ActionCompleteData {
  maneuver?: string | null;
  kind: string;
  attack?: AttackActionData;
  defense?: DefenseActionData;
  damage?: DamageActionData;
  injury?: InjuryData;
  note?: string;
  targetInstanceId?: string | null;
  newHP?: number;
}

// ============================================================================
// VIEW PROPS INTERFACES
// ============================================================================

export interface CombatHeaderViewProps {
  combat: CombatState;
  history: HistoryState;
  viewMode: string;
  gmMode: boolean;
  showExportMenu: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onShowReinforcements: () => void;
  onToggleExportMenu: () => void;
  onExportPlayerView: () => void;
  onExportGMLocked: () => void;
  onSaveCombat: () => void;
  onExportLog: () => void;
  onLoadCombat: () => void;
  onEndCombat: () => void;
}

export interface TurnControlsViewProps {
  currentActor: Participant | undefined;
  combat: CombatState;
  onPrevTurn: () => void;
  onNextTurn: () => void;
}

export interface DicePanelViewProps {
  showDicePanel: boolean;
  diceExpression: string;
  rollTarget: string;
  onToggleDicePanel: () => void;
  onSetDiceExpression: (value: string) => void;
  onSetRollTarget: (value: string) => void;
  onRoll: () => void;
}

export interface ParticipantListViewProps {
  participants: Participant[];
  currentActorInstanceId: string;
  viewMode: string;
  onUpdateResource: (instanceId: string, resource: string, value: number) => void;
  /** GM-only (Phase 12a.6): opens the condition popover for a participant at a screen point. */
  onOpenConditions?: (instanceId: string, anchor: { x: number; y: number }) => void;
}

export interface ParticipantCardProps {
  participant: Participant;
  isCurrent: boolean;
  onUpdateResource: (instanceId: string, resource: string, value: number) => void;
  viewMode: string;
  /** GM-only (Phase 12a.6): opens the condition popover for a participant at a screen point. */
  onOpenConditions?: (instanceId: string, anchor: { x: number; y: number }) => void;
}

export interface CombatLogViewProps {
  displayLog: LogEntry[];
  noteText: string;
  onSetNoteText: (value: string) => void;
  onAddNote: () => void;
}

export interface RollLogEntryProps {
  timestamp: string;
  entry: LogEntry;
}

export interface ActionLogEntryProps {
  timestamp: string;
  entry: LogEntry;
}

// ============================================================================
// ENCOUNTER TEMPLATE TYPES
// ============================================================================

export interface EncounterTemplateParticipant {
  /** Reference to a combat library character ID */
  libraryId: string;
  /** Character name (snapshot — used if library char is deleted) */
  name: string;
  /** Combat category */
  category: string;
  /** Number of this character to spawn */
  quantity: number;
}

export interface EncounterTemplate {
  id: string;
  name: string;
  description?: string;
  participants: EncounterTemplateParticipant[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// POST-COMBAT SUMMARY TYPES
// ============================================================================

export interface ParticipantSummary {
  instanceId: string;
  name: string;
  category: string;
  /** Whether this participant is linked to a party character */
  isFromParty: boolean;
  /** Party character ID for sync-back */
  partyCharacterId?: string;
  /** HP at combat start */
  startHP: number;
  maxHP: number;
  /** HP at combat end */
  endHP: number;
  /** FP at combat start */
  startFP: number;
  maxFP: number;
  /** FP at combat end */
  endFP: number;
  /**
   * Final status flags. Frozen snapshot fields: since 12a.6 stun/unconsciousness
   * live in conditions[], these are populated via hasCondition() at snapshot time.
   */
  isStunned: boolean;
  isUnconscious: boolean;
  isDead: boolean;
  /** Active conditions at combat end */
  conditions: ConditionInstance[];
  /** Crippled locations */
  crippled: string[];
  /** Bleeding state */
  bleeding: { rate: number; round: number } | null;
}

export interface HealingEstimate {
  /** Days to full HP recovery at 1 HP/day with rest */
  daysToFullHP: number;
  /** Days to full FP recovery (1 FP per 10 min rest, so usually < 1 day) */
  daysToFullFP: number;
  /** HP recoverable by First Aid (typically 1d-2 or 1d-3) */
  firstAidEstimate: { min: number; max: number };
}

export interface CombatSummaryData {
  combatId: string;
  combatName: string;
  /** Duration in rounds */
  rounds: number;
  /** Duration in real time (ms) */
  durationMs: number;
  /** Summary per participant */
  participants: ParticipantSummary[];
  /** Healing estimates for party characters */
  healingEstimates: Record<string, HealingEstimate>;
}

// ============================================================================
// LOOT DISTRIBUTION TYPES
// ============================================================================

export interface LootItem {
  id: string;
  name: string;
  type: 'currency' | 'material' | 'food' | 'equipment' | 'other';
  quantity: number;
  /** Value in copper pieces (base currency) */
  value?: number;
  notes?: string;
  /**
   * For `type: 'material'` only — the referenced `MaterialType.name`.
   * When absent, the item is acquired as an untyped `'loot'` material
   * (legacy behavior). See INVENTORY_INTEGRATION_FOLLOWUPS.md #9.
   */
  materialType?: string;
  /** Whether equipment/other loot should arrive marked as magical. */
  magical?: boolean;
}

export interface LootDistributionEntry {
  lootItemId: string;
  /** Target: 'party' or a character ID */
  targetId: string;
  quantity: number;
}
