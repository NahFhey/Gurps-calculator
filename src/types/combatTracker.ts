/**
 * Combat Tracker Types
 *
 * TypeScript interfaces for the CombatTracker component and its views.
 * Extracted from CombatTracker.tsx for better organization and reusability.
 */

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
  value?: number;
}

export interface ConditionInstance {
  instanceId: string;
  conditionId: string;
  label: string;
  duration?: ConditionDuration;
  source?: string;
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
  isStunned?: boolean;
  isUnconscious?: boolean;
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
  modifiers?: { label: string; value: number }[];
}

export interface DefenseActionData {
  type?: string;
  success?: boolean;
  modifiers?: { label: string; value: number }[];
}

export interface DamageActionData {
  expression?: string;
  rolledDamage?: number;
  generalDRUsed?: number;
}

// ============================================================================
// COMBAT STATE TYPES
// ============================================================================

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

export interface HistoryState {
  actions: unknown[];
  undoStack: unknown[];
  redoStack: unknown[];
}

export interface RevealState {
  combatId: string;
  byInstanceId: Record<string, RevealEntry>;
}

export interface RevealEntry {
  name?: { mode: string };
  hp?: { mode: string };
  defenses?: { dodge?: { mode: string }; parry?: { mode: string }; block?: { mode: string } };
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
  isStunned: boolean;
  isProne: boolean;
  isGrappled: boolean;
  isUnconscious: boolean;
  shockPenalty: number;
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
  manualOrder?: string[];
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
  hitLocation?: unknown;
  damageBreakdown?: unknown;
  effects?: InjuryEffect[];
  newHP?: number;
  targetInstanceId?: string;
}

export interface ActionCompleteData {
  maneuver?: string | null;
  kind: string;
  attack?: unknown;
  defense?: DefenseActionData;
  damage?: unknown;
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
}

export interface ParticipantCardProps {
  participant: Participant;
  isCurrent: boolean;
  onUpdateResource: (instanceId: string, resource: string, value: number) => void;
  viewMode: string;
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
  /** Final status flags */
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
}

export interface LootDistributionEntry {
  lootItemId: string;
  /** Target: 'party' or a character ID */
  targetId: string;
  quantity: number;
}
