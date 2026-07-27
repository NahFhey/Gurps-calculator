/**
 * Combat Runner utility functions
 * Handles turn order generation, HP status calculation, and combat log formatting
 */

import { HP_STATUS, COMBAT_CATEGORIES } from '../constants';
import type { CombatCategory } from '../constants';
import { DAMAGE_TYPE_LABELS } from './wounding';
import { getCombatView } from './combatViewFilter';
import { filterLogForPlayerView } from './combatLogFilter';
import { encryptJSON, decryptJSON } from './cryptoLock';
import { CombatExportSchema } from './importSchemas';
import type {
  Participant,
  LogEntry,
  CombatState,
  HistoryState,
  RevealState,
  RollData,
  ActionData,
} from '../types/combatTracker';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type HPStatusValue = 'healthy' | 'injured' | 'critical' | 'dead';

/**
 * True when the value is one of the four combat library categories
 * ('player' | 'ally' | 'enemy' | 'object').
 */
export function isCombatCategory(value: unknown): value is CombatCategory {
  return typeof value === 'string' && (COMBAT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Resolve a CombatCharacter category from possibly-legacy data.
 *
 * Records saved before schema 1.5.1 have no `category`; the only signal is
 * `isNPC`, so true maps to 'enemy' and anything else to 'player'. Used by both
 * the load-time backfill and the library import path so the two stay in
 * lockstep.
 */
export function deriveCombatCategory(category: unknown, isNPC?: unknown): CombatCategory {
  if (isCombatCategory(category)) return category;
  return isNPC === true ? 'enemy' : 'player';
}

export interface ImportResult<T> {
  valid: boolean;
  data: T | null;
  error: string | null;
}

export interface CombatExportData {
  version: number;
  exportDate?: string;
  exportType?: string;
  combatState: CombatState;
  history?: HistoryState | null;
  revealState?: RevealState | null;
  gmLock?: string;
}

export interface GMLockedImportResult extends ImportResult<CombatExportData> {
  isLocked: boolean;
}

export interface EncounterInfo {
  name?: string;
  date?: string | number;
}

export interface LogEntryParams {
  entryType: string;
  round: number;
  turn: number;
  actorInstanceId?: string | null;
  targetInstanceId?: string | null;
  text: string;
  hpDelta?: number | null;
  fpDelta?: number | null;
  mpDelta?: number | null;
  roll?: RollData | null;
}

export interface RollResult {
  expression: string;
  dice: number[];
  modifier?: number;
  total: number;
  target?: number;
  margin?: number;
  success?: boolean;
}

export interface TurnOrderCombatant {
  instanceId?: string;
  id?: string;
  name: string;
  category?: string;
  basicSpeed: number;
  dx: number;
}

export interface ActionLogEntryParams {
  round: number;
  turn: number;
  actorInstanceId: string;
  actorName: string;
  targetInstanceId?: string | null;
  targetName?: string | null;
  maneuver?: string | null;
  action?: ActionData | null;
}

export interface InjuryLogEntryParams {
  round: number;
  turn: number;
  targetInstanceId: string;
  targetName: string;
  hitLocation?: {
    locationLabel?: string;
    locationKey?: string;
  } | null;
  damageBreakdown: {
    raw?: number;
    dr?: number;
    penetrating?: number;
    injuryApplied: number;
    damageType?: string;
    baseWoundingMultiplier?: number;
    locationWoundingMultiplier?: number;
    woundingMultiplier?: number;
    locationLabel?: string;
  };
  effects?: unknown[] | null;
  currentHP?: number | null;
  newHP?: number | null;
}

export interface EffectLogEntryParams {
  round: number;
  turn: number;
  targetInstanceId: string;
  targetName: string;
  effectType: string;
  effectData: unknown;
  text?: string | null;
}

export interface ManeuverLogEntryParams {
  round: number;
  turn: number;
  actorInstanceId: string;
  actorName: string;
  maneuverId: string;
  maneuverLabel: string;
  aim?: unknown | null;
  wait?: unknown | null;
  constraints?: unknown | null;
}

export interface ReinforcementLogEntryParams {
  round: number;
  turn: number;
  category: string;
  displayName: string;
  quantity: number;
  insertionMode: string;
}

export interface ItemLogEntryParams {
  round: number;
  turn: number;
  actorInstanceId: string;
  actorName: string;
  targetInstanceId?: string | null;
  targetName?: string | null;
  item: {
    itemId: string;
    itemName: string;
    qtyBefore: number;
    qtyAfter: number;
  };
  effect?: unknown;
  text?: string | null;
}

export interface ConditionLogEntryParams {
  round: number;
  turn: number;
  targetInstanceId: string;
  targetName: string;
  changeType: 'applied' | 'removed' | 'expired' | string;
  conditionId: string;
  conditionLabel: string;
  duration?: unknown | null;
  source?: string | null;
  text?: string | null;
}

export interface EnemyTemplate {
  hp: number;
  fp?: number;
  mp?: number;
  [key: string]: unknown;
}

/**
 * Calculate HP status based on current and max HP
 * @param {number} currentHP - Current HP value
 * @param {number} maxHP - Maximum HP value
 * @returns {string} Status: 'healthy', 'injured', 'critical', or 'dead'
 */
export function calculateHPStatus(currentHP: number, maxHP: number): HPStatusValue {
  if (!maxHP || maxHP <= 0) return HP_STATUS.HEALTHY as HPStatusValue;

  if (currentHP <= -maxHP) return HP_STATUS.DEAD as HPStatusValue;
  if (currentHP <= 0) return HP_STATUS.CRITICAL as HPStatusValue;
  if (currentHP <= maxHP / 3) return HP_STATUS.INJURED as HPStatusValue;
  return HP_STATUS.HEALTHY as HPStatusValue;
}

/**
 * Generate turn order from combatants
 * Sort by Basic Speed (desc), then DX (desc), then stable by name
 * Objects do NOT take turns in Phase 1
 *
 * @param {Array} combatants - Array of combatant objects
 * @returns {Array} Sorted array of combatant IDs
 */
export function generateTurnOrder(combatants: TurnOrderCombatant[]): string[] {
  // Filter out objects - they don't take turns
  const activeCombatants = combatants.filter(c => c.category !== 'object');

  // Sort by Basic Speed desc, DX desc, then name (stable)
  const sorted = [...activeCombatants].sort((a, b) => {
    // Primary: Basic Speed (descending)
    if (b.basicSpeed !== a.basicSpeed) {
      return b.basicSpeed - a.basicSpeed;
    }

    // Secondary: DX (descending)
    if (b.dx !== a.dx) {
      return b.dx - a.dx;
    }

    // Tertiary: Name (ascending, stable sort)
    return a.name.localeCompare(b.name);
  });

  return sorted.map(c => c.instanceId || c.id || '');
}

// Extended log entry for Phase 1 compatibility (has additional legacy fields)
interface LegacyLogEntry extends LogEntry {
  type?: string;
  actorName?: string;
  oldValue?: number;
  newValue?: number;
  note?: string;
}

/**
 * Format a combat log entry for display
 * Handles both Phase 1 (old format) and Phase 2 (structured format)
 * @param {Object} entry - Log entry object
 * @returns {string} Formatted log entry text
 */
export function formatLogEntry(entry: LegacyLogEntry): string {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();

  // Phase 2 structured format - just use the text field
  if (entry.entryType) {
    return `[${timestamp}] ${entry.text}`;
  }

  // Phase 1 format (backward compatibility)
  switch (entry.type) {
    case 'combat_start':
      return `[${timestamp}] Combat started`;

    case 'combat_end':
      return `[${timestamp}] Combat ended`;

    case 'round_change':
      return `[${timestamp}] === Round ${entry.round} ===`;

    case 'turn_change':
      return `[${timestamp}] ${entry.actorName}'s turn`;

    case 'hp_change':
      return `[${timestamp}] ${entry.actorName}: HP ${entry.oldValue} → ${entry.newValue}`;

    case 'fp_change':
      return `[${timestamp}] ${entry.actorName}: FP ${entry.oldValue} → ${entry.newValue}`;

    case 'mp_change':
      return `[${timestamp}] ${entry.actorName}: MP ${entry.oldValue} → ${entry.newValue}`;

    case 'note':
      return `[${timestamp}] ${entry.actorName ? entry.actorName + ': ' : ''}${entry.note}`;

    default:
      return `[${timestamp}] ${entry.message || 'Unknown event'}`;
  }
}

/**
 * Export combat log as plain text
 * @param {Array} logEntries - Array of log entry objects
 * @param {Object} encounterInfo - Optional encounter metadata
 * @returns {string} Formatted plain text log
 */
export function exportCombatLog(logEntries: LogEntry[], encounterInfo: EncounterInfo = {}): string {
  let output = '=== GURPS Combat Log ===\n';

  if (encounterInfo.name) {
    output += `Encounter: ${encounterInfo.name}\n`;
  }
  if (encounterInfo.date) {
    output += `Date: ${new Date(encounterInfo.date).toLocaleString()}\n`;
  }

  output += '\n';

  logEntries.forEach(entry => {
    output += formatLogEntry(entry as LegacyLogEntry) + '\n';
  });

  output += '\n=== End of Log ===\n';

  return output;
}

/**
 * Export active combat as JSON (Phase 2 format)
 * Includes combat state and history
 * @param {Object} combatState - Combat state object
 * @param {Object} historyState - History state object
 * @returns {string} JSON string
 */
export function exportActiveCombat(combatState: CombatState, historyState: HistoryState | null): string {
  const exportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    combatState,
    history: historyState
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Parse and validate imported combat JSON
 * @param {string} jsonString - JSON string to parse
 * @returns {{valid: boolean, data: Object|null, error: string|null}}
 */
export function parseImportedCombat(jsonString: string): ImportResult<CombatExportData> {
  try {
    const data = JSON.parse(jsonString);

    // Structural validation via Zod
    const zodResult = CombatExportSchema.safeParse(data);
    if (!zodResult.success) {
      const issue = zodResult.error.issues[0];
      const path = issue?.path?.join('.') || '';
      return { valid: false, data: null, error: `Validation error${path ? ` at ${path}` : ''}: ${issue?.message}` };
    }

    return { valid: true, data: data as CombatExportData, error: null };
  } catch (error) {
    return { valid: false, data: null, error: (error as Error).message };
  }
}

/**
 * Generate unique ID for combat entities
 * @returns {string} Unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a structured log entry (Phase 2 format)
 * @param {Object} params - Log entry parameters
 * @returns {Object} Structured log entry
 */
export function createLogEntry({
  entryType,
  round,
  turn,
  actorInstanceId: _actorInstanceId = null,
  targetInstanceId: _targetInstanceId = null,
  text,
  hpDelta: _hpDelta = null,
  fpDelta: _fpDelta = null,
  mpDelta: _mpDelta = null,
  roll = null
}: LogEntryParams): LogEntry {
  return {
    id: generateId(),
    timestamp: Date.now(),
    round,
    turn,
    entryType,
    text,
    roll: roll ?? undefined,
  };
}

/**
 * Create a turn change log entry
 */
export function createTurnLogEntry(
  round: number,
  turn: number,
  actorInstanceId: string | null,
  actorName?: string | null
): LogEntry {
  return createLogEntry({
    entryType: 'turn',
    round,
    turn,
    actorInstanceId: actorInstanceId ?? undefined,
    text: actorName ? `${actorName}'s turn` : `Turn ${turn}`
  });
}

/**
 * Create a resource change log entry
 */
export function createResourceLogEntry(
  round: number,
  turn: number,
  actorInstanceId: string,
  actorName: string,
  resource: 'HP' | 'FP' | 'MP',
  oldValue: number,
  newValue: number
): LogEntry {
  const delta = newValue - oldValue;
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

  const resourceDelta: { hpDelta?: number; fpDelta?: number; mpDelta?: number } = {};
  if (resource === 'HP') {
    resourceDelta.hpDelta = delta;
  } else if (resource === 'FP') {
    resourceDelta.fpDelta = delta;
  } else if (resource === 'MP') {
    resourceDelta.mpDelta = delta;
  }

  return createLogEntry({
    entryType: 'resource',
    round,
    turn,
    actorInstanceId,
    text: `${actorName}: ${resource} ${oldValue} → ${newValue} (${deltaStr})`,
    ...resourceDelta
  });
}

/**
 * Create a roll log entry
 */
export function createRollLogEntry(
  round: number,
  turn: number,
  actorInstanceId: string,
  actorName: string,
  rollResult: RollResult
): LogEntry {
  const { expression, dice, modifier, total, target, margin, success } = rollResult;

  let text: string;
  if (target !== undefined) {
    const marginStr = (margin ?? 0) >= 0 ? `+${margin}` : `${margin}`;
    const resultStr = success ? 'SUCCESS' : 'FAILURE';
    text = `${actorName} rolled ${expression}: ${total} vs ${target} [${marginStr}] ${resultStr}`;
  } else {
    text = `${actorName} rolled ${expression}: ${total}`;
  }

  return createLogEntry({
    entryType: 'roll',
    round,
    turn,
    actorInstanceId,
    text,
    roll: {
      expression,
      dice,
      modifier: modifier || 0,
      total,
      target: target !== undefined ? target : null,
      margin: margin !== undefined ? margin : 0,
      success: success !== undefined ? success : false
    }
  });
}

/**
 * Create a note log entry
 */
export function createNoteLogEntry(
  round: number,
  turn: number,
  actorInstanceId: string | null,
  actorName: string | null,
  note: string
): LogEntry {
  const text = actorName ? `${actorName}: ${note}` : note;
  return createLogEntry({
    entryType: 'note',
    round,
    turn,
    actorInstanceId,
    text
  });
}

// Extended action data with additional fields for action log entries
interface ExtendedAttackData {
  name?: string;
  rollTotal?: number | null;
  effectiveSkill?: number;
  margin?: number | null;
  success?: boolean;
  modifiers?: { label: string; value: number }[];
}

interface ExtendedDefenseData {
  type?: string;
  rollTotal?: number | null;
  effectiveDefense?: number;
  margin?: number | null;
  success?: boolean | null;
  modifiers?: { label: string; value: number }[];
}

interface ExtendedDamageData {
  penetrating?: number | null;
  rolledDamage?: number;
  generalDRUsed?: number;
  expression?: string;
}

interface ExtendedActionData {
  kind: string;
  attack?: ExtendedAttackData;
  defense?: ExtendedDefenseData;
  damage?: ExtendedDamageData;
}

/**
 * Create an action log entry (Phase 3)
 * For structured combat actions (attack/defense/damage)
 *
 * @param {Object} params - Action parameters
 * @returns {Object} Structured action log entry
 */
export function createActionLogEntry({
  round,
  turn,
  actorInstanceId: _actorInstanceId,
  actorName,
  targetInstanceId: _targetInstanceId = null,
  targetName = null,
  maneuver = null,
  action = null
}: ActionLogEntryParams & { action?: ExtendedActionData | null }): LogEntry & { action?: ExtendedActionData } {
  // Build descriptive text
  let text = actorName;

  if (maneuver) {
    text += ` (${maneuver})`;
  }

  if (action) {
    if (action.kind === 'attack' && action.attack) {
      const att = action.attack;
      text += ` attacks`;
      if (targetName) {
        text += ` ${targetName}`;
      }
      text += ` with ${att.name}`;
      if (att.rollTotal !== null && att.rollTotal !== undefined) {
        text += ` [${att.rollTotal} vs ${att.effectiveSkill}`;
        if (att.margin !== null && att.margin !== undefined) {
          const marginStr = att.margin >= 0 ? `+${att.margin}` : `${att.margin}`;
          text += `, ${marginStr}`;
          text += att.success ? ' SUCCESS' : ' FAILURE';
        }
        text += `]`;
      }
    } else if (action.kind === 'defense' && action.defense) {
      const def = action.defense;
      text += ` defends`;
      if (def.type) {
        text += ` (${def.type})`;
      }
      if (def.rollTotal !== null && def.rollTotal !== undefined) {
        text += ` [${def.rollTotal} vs ${def.effectiveDefense}`;
        if (def.margin !== null && def.margin !== undefined) {
          const marginStr = def.margin >= 0 ? `+${def.margin}` : `${def.margin}`;
          text += `, ${marginStr}`;
          text += def.success ? ' SUCCESS' : ' FAILURE';
        }
        text += `]`;
      }
    } else if (action.kind === 'damage' && action.damage) {
      const dmg = action.damage;
      text += ` takes`;
      if (dmg.penetrating !== null && dmg.penetrating !== undefined) {
        text += ` ${dmg.penetrating} HP`;
        if (dmg.generalDRUsed) {
          text += ` (${dmg.rolledDamage} - ${dmg.generalDRUsed} DR)`;
        }
      }
    }
  }

  return {
    id: generateId(),
    timestamp: Date.now(),
    round,
    turn,
    entryType: 'action',
    text,
    maneuver: maneuver ?? undefined,
    action: action ?? undefined
  };
}

/**
 * Auto-number enemies with same base name
 * e.g., "Goblin" with quantity 3 becomes ["Goblin #1", "Goblin #2", "Goblin #3"]
 *
 * @param {string} baseName - Base name of the enemy
 * @param {number} quantity - Number of enemies to create
 * @param {Object} template - Template object with character data
 * @returns {Array} Array of character objects with numbered names
 */
export function createNumberedEnemies(
  baseName: string,
  quantity: number,
  template: EnemyTemplate
): Participant[] {
  const enemies: Participant[] = [];

  for (let i = 1; i <= quantity; i++) {
    enemies.push({
      ...template,
      instanceId: generateId(),
      id: generateId(),
      name: quantity > 1 ? `${baseName} #${i}` : baseName,
      category: (template.category as string) || 'enemy',
      st: (template.st as number) || 10,
      dx: (template.dx as number) || 10,
      iq: (template.iq as number) || 10,
      ht: (template.ht as number) || 10,
      hp: template.hp,
      fp: template.fp || 0,
      mp: template.mp || 0,
      basicSpeed: (template.basicSpeed as number) || 5,
      basicMove: (template.basicMove as number) || 5,
      currentHP: template.hp,
      currentFP: template.fp || 0,
      currentMP: template.mp || 0,
      // Phase 4 fields
      shockPenalty: 0,
      isDead: false,
      bleeding: null,
      crippled: [],
      // Phase 6 fields
      conditions: []
    });
  }

  return enemies;
}

/**
 * Create an injury resolution log entry (Phase 4)
 * For detailed injury pipeline with hit location, DR, wounding, effects
 *
 * @param {Object} params - Injury parameters
 * @returns {Object} Structured injury log entry
 */
export function createInjuryLogEntry({
  round,
  turn,
  targetInstanceId: _targetInstanceId,
  targetName,
  hitLocation,
  damageBreakdown,
  effects: _effects = null,
  currentHP = null,
  newHP = null
}: InjuryLogEntryParams): LogEntry {
  let text = `${targetName} takes ${damageBreakdown.injuryApplied} injury`;

  if (hitLocation && hitLocation.locationLabel) {
    text += ` to ${hitLocation.locationLabel}`;
  }

  if (damageBreakdown.raw !== undefined && damageBreakdown.dr !== undefined) {
    if ((damageBreakdown.penetrating ?? 0) <= 0) {
      text += ` (${damageBreakdown.raw} raw - ${damageBreakdown.dr} DR = 0 pen; no penetration)`;
    } else {
      const baseMultiplier = damageBreakdown.baseWoundingMultiplier ?? 1;
      const locationMultiplier = damageBreakdown.locationWoundingMultiplier ?? 1;
      const totalMultiplier = damageBreakdown.woundingMultiplier ?? 1;
      const parts = [`${damageBreakdown.raw} raw - ${damageBreakdown.dr} DR = ${damageBreakdown.penetrating} pen`];
      const damageTypeLabel = (DAMAGE_TYPE_LABELS as Record<string, string>)[damageBreakdown.damageType || ''] || damageBreakdown.damageType || 'damage';

      if (baseMultiplier !== 1) {
        const afterBase = Math.floor((damageBreakdown.penetrating ?? 0) * baseMultiplier);
        parts.push(`×${baseMultiplier} ${damageTypeLabel} = ${afterBase}`);
      }

      if (locationMultiplier !== 1 && damageBreakdown.locationLabel) {
        const afterLocation = Math.floor((damageBreakdown.penetrating ?? 0) * totalMultiplier);
        parts.push(`×${locationMultiplier} (${damageBreakdown.locationLabel}) = ${afterLocation}`);
      } else if (totalMultiplier !== 1 && baseMultiplier === 1) {
        const afterTotal = Math.floor((damageBreakdown.penetrating ?? 0) * totalMultiplier);
        parts.push(`×${totalMultiplier} ${damageTypeLabel} = ${afterTotal}`);
      }

      text += ` (${parts.join('; ')})`;
    }
  }

  if (currentHP !== null && newHP !== null) {
    text += ` → HP ${currentHP}→${newHP}`;
  }

  return {
    id: generateId(),
    timestamp: Date.now(),
    round,
    turn,
    entryType: 'injury',
    text,
  };
}

/**
 * Create an effect resolution log entry (Phase 4)
 * For shock, major wound, stun, consciousness, death, bleeding, crippling
 *
 * @param {Object} params - Effect parameters
 * @returns {Object} Structured effect log entry
 */
export function createEffectLogEntry({
  round,
  turn,
  targetInstanceId: _targetInstanceId,
  targetName,
  effectType,
  effectData: _effectData,
  text = null
}: EffectLogEntryParams): LogEntry {
  const displayText = text || `${targetName}: ${effectType}`;

  return {
    id: generateId(),
    timestamp: Date.now(),
    round,
    turn,
    entryType: 'effect',
    text: displayText,
  };
}

/**
 * Phase 7: Create a maneuver selection log entry
 */
export function createManeuverLogEntry({
  round,
  turn,
  actorInstanceId: _actorInstanceId,
  actorName,
  maneuverId,
  maneuverLabel,
  aim: _aim = null,
  wait: _wait = null,
  constraints: _constraints = null
}: ManeuverLogEntryParams): LogEntry {
  return {
    id: generateId(),
    timestamp: Date.now(),
    round,
    turn,
    entryType: 'maneuver',
    text: `${actorName}: Turn Maneuver: ${maneuverLabel}`,
    maneuver: maneuverId,
  };
}

/**
 * Phase 8: Create a reinforcement log entry
 */
export function createReinforcementLogEntry({
  round,
  turn,
  category: _category,
  displayName,
  quantity,
  insertionMode
}: ReinforcementLogEntryParams): LogEntry {
  const countLabel = quantity > 1 ? `x${quantity}` : 'x1';
  const modeLabel = insertionMode.replace(/_/g, ' ');
  return {
    id: generateId(),
    timestamp: Date.now(),
    round,
    turn,
    entryType: 'reinforcement',
    text: `Reinforcements: ${displayName} ${countLabel} (${modeLabel})`,
  };
}

// ============================================================================
// Phase 6: Items and Conditions Log Entries
// ============================================================================

/**
 * Create an item usage log entry (Phase 6)
 *
 * @param {Object} params - Item usage parameters
 * @returns {Object} Structured item log entry
 */
export function createItemLogEntry({
  round,
  turn,
  actorInstanceId,
  actorName,
  targetInstanceId,
  targetName,
  item,
  effect: _effect,
  text = null
}: ItemLogEntryParams): LogEntry {
  let displayText = text;
  if (!displayText) {
    if (targetInstanceId && targetInstanceId !== actorInstanceId) {
      displayText = `${actorName} used ${item.itemName} on ${targetName}`;
    } else {
      displayText = `${actorName} used ${item.itemName}`;
    }
  }

  return {
    id: generateId(),
    timestamp: Date.now(),
    round,
    turn,
    entryType: 'item',
    text: displayText,
  };
}

/**
 * Create a condition change log entry (Phase 6)
 *
 * @param {Object} params - Condition parameters
 * @returns {Object} Structured condition log entry
 */
/**
 * Phase F (Map Integration): Create a movement log entry
 */
export function createMovementLogEntry({
  round,
  turn,
  actorInstanceId: _actorInstanceId,
  actorName,
  yardsSpent,
}: {
  round: number;
  turn: number;
  actorInstanceId: string;
  actorName: string;
  yardsSpent: number;
}): LogEntry {
  return {
    id: generateId(),
    timestamp: Date.now(),
    round,
    turn,
    entryType: 'note',
    text: `${actorName}: Moved ${yardsSpent} yard${yardsSpent !== 1 ? 's' : ''}`,
  };
}

export function createConditionLogEntry({
  round,
  turn,
  targetInstanceId: _targetInstanceId,
  targetName,
  changeType,
  conditionId: _conditionId,
  conditionLabel,
  duration: _duration = null,
  source = null,
  text = null
}: ConditionLogEntryParams): LogEntry {
  let displayText = text;
  if (!displayText) {
    switch (changeType) {
      case 'applied':
        displayText = source
          ? `${targetName}: ${conditionLabel} applied (${source})`
          : `${targetName}: ${conditionLabel} applied`;
        break;
      case 'removed':
        displayText = `${targetName}: ${conditionLabel} removed`;
        break;
      case 'expired':
        displayText = `${targetName}: ${conditionLabel} expired`;
        break;
      default:
        displayText = `${targetName}: ${conditionLabel} (${changeType})`;
    }
  }

  return {
    id: generateId(),
    timestamp: Date.now(),
    round,
    turn,
    entryType: 'condition',
    text: displayText,
  };
}

// ============================================================================
// Phase 5: Progressive Reveal Export/Import
// ============================================================================

/**
 * Export combat in Player View format (Phase 5)
 * Filters combat state based on reveal state - safe to share with players
 *
 * @param {Object} combatState - Full combat state
 * @param {Object} revealState - Reveal state
 * @param {Object} historyState - History state (optional)
 * @returns {string} JSON string (unencrypted, filtered)
 */
export function exportCombatPlayerView(
  combatState: CombatState,
  revealState: RevealState,
  _historyState: HistoryState | null = null
): string {
  // Get filtered view
  const combatView = getCombatView(combatState, revealState, 'player');

  // Filter log
  const filteredLog = filterLogForPlayerView(combatState.log, revealState, combatState);

  // Build player-safe export
  const exportData = {
    version: 2, // Phase 5 format
    exportDate: new Date().toISOString(),
    exportType: 'player-view',
    combatState: {
      ...combatView,
      log: filteredLog
    },
    // Include reveal state so the view can be reconstructed
    revealState,
    // Do NOT include history - players don't need undo/redo
    history: null
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export combat with GM lock (Phase 5)
 * Public payload: player-safe view
 * Encrypted payload: full truth state + reveal state
 *
 * @param {Object} combatState - Full combat state
 * @param {Object} revealState - Reveal state
 * @param {Object} historyState - History state (optional)
 * @param {string} password - GM password for encryption
 * @returns {Promise<string>} JSON string with gmLock
 */
export async function exportCombatGMLocked(
  combatState: CombatState,
  revealState: RevealState,
  historyState: HistoryState | null,
  password: string
): Promise<string> {
  // Get filtered player view
  const combatView = getCombatView(combatState, revealState, 'player');
  const filteredLog = filterLogForPlayerView(combatState.log, revealState, combatState);

  // Build GM secret payload (will be encrypted)
  const gmSecrets = {
    combatStateTruth: combatState,
    revealState,
    history: historyState
  };

  // Encrypt GM secrets
  const gmLock = await encryptJSON(gmSecrets, password);

  // Build export with public player view + encrypted GM data
  const exportData = {
    version: 2, // Phase 5 format
    exportDate: new Date().toISOString(),
    exportType: 'gm-locked',
    combatState: {
      ...combatView,
      log: filteredLog
    },
    // Encrypted GM data
    gmLock
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import and optionally unlock GM-locked combat (Phase 5)
 *
 * @param {string} jsonString - JSON string to import
 * @param {string|null} password - GM password (if unlocking)
 * @returns {Promise<{valid: boolean, data: Object|null, error: string|null, isLocked: boolean}>}
 */
export async function importCombatWithGMLock(
  jsonString: string,
  password: string | null = null
): Promise<GMLockedImportResult> {
  try {
    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      return { valid: false, data: null, error: 'Invalid JSON format', isLocked: false };
    }

    if (!data.combatState) {
      return { valid: false, data: null, error: 'Missing combatState in import', isLocked: false };
    }

    // Check if this is a GM-locked export
    const isLocked = data.exportType === 'gm-locked' && data.gmLock;

    if (isLocked && password) {
      // Attempt to unlock
      try {
        const gmSecrets = await decryptJSON(data.gmLock, password) as {
          combatStateTruth: CombatState;
          revealState: RevealState;
          history: HistoryState | null;
        };

        // Return full truth data
        return {
          valid: true,
          data: {
            version: data.version,
            combatState: gmSecrets.combatStateTruth,
            revealState: gmSecrets.revealState,
            history: gmSecrets.history,
            exportType: data.exportType
          },
          error: null,
          isLocked: false // Successfully unlocked
        };
      } catch (unlockError) {
        return {
          valid: false,
          data: null,
          error: `Failed to unlock: ${(unlockError as Error).message}`,
          isLocked: true
        };
      }
    } else if (isLocked) {
      // Locked but no password provided - return player view
      return {
        valid: true,
        data: {
          version: data.version,
          combatState: data.combatState,
          revealState: data.revealState || null,
          history: null,
          exportType: data.exportType,
          gmLock: data.gmLock // Store for later unlocking
        },
        error: null,
        isLocked: true
      };
    } else {
      // Not locked (player-view export or legacy)
      return {
        valid: true,
        data: {
          version: data.version,
          combatState: data.combatState,
          revealState: data.revealState || null,
          history: data.history || null,
          exportType: data.exportType || 'legacy'
        },
        error: null,
        isLocked: false
      };
    }
  } catch (error) {
    return {
      valid: false,
      data: null,
      error: (error as Error).message,
      isLocked: false
    };
  }
}
