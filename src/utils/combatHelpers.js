/**
 * Combat Runner utility functions
 * Handles turn order generation, HP status calculation, and combat log formatting
 */

import { HP_STATUS } from '../constants';

/**
 * Calculate HP status based on current and max HP
 * @param {number} currentHP - Current HP value
 * @param {number} maxHP - Maximum HP value
 * @returns {string} Status: 'healthy', 'injured', 'critical', or 'dead'
 */
export function calculateHPStatus(currentHP, maxHP) {
  if (!maxHP || maxHP <= 0) return HP_STATUS.HEALTHY;

  if (currentHP <= -maxHP) return HP_STATUS.DEAD;
  if (currentHP <= 0) return HP_STATUS.CRITICAL;
  if (currentHP <= maxHP / 3) return HP_STATUS.INJURED;
  return HP_STATUS.HEALTHY;
}

/**
 * Generate turn order from combatants
 * Sort by Basic Speed (desc), then DX (desc), then stable by name
 * Objects do NOT take turns in Phase 1
 *
 * @param {Array} combatants - Array of combatant objects
 * @returns {Array} Sorted array of combatant IDs
 */
export function generateTurnOrder(combatants) {
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

  return sorted.map(c => c.id);
}

/**
 * Format a combat log entry for display
 * Handles both Phase 1 (old format) and Phase 2 (structured format)
 * @param {Object} entry - Log entry object
 * @returns {string} Formatted log entry text
 */
export function formatLogEntry(entry) {
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
export function exportCombatLog(logEntries, encounterInfo = {}) {
  let output = '=== GURPS Combat Log ===\n';

  if (encounterInfo.name) {
    output += `Encounter: ${encounterInfo.name}\n`;
  }
  if (encounterInfo.date) {
    output += `Date: ${new Date(encounterInfo.date).toLocaleString()}\n`;
  }

  output += '\n';

  logEntries.forEach(entry => {
    output += formatLogEntry(entry) + '\n';
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
export function exportActiveCombat(combatState, historyState) {
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
export function parseImportedCombat(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      return { valid: false, data: null, error: 'Invalid JSON format' };
    }

    if (!data.combatState) {
      return { valid: false, data: null, error: 'Missing combatState in import' };
    }

    return { valid: true, data, error: null };
  } catch (error) {
    return { valid: false, data: null, error: error.message };
  }
}

/**
 * Generate unique ID for combat entities
 * @returns {string} Unique ID
 */
export function generateId() {
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
  actorInstanceId = null,
  targetInstanceId = null,
  text,
  hpDelta = null,
  fpDelta = null,
  mpDelta = null,
  roll = null
}) {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    round,
    turn,
    entryType,
    actorInstanceId,
    targetInstanceId,
    text,
    hpDelta,
    fpDelta,
    mpDelta,
    roll
  };
}

/**
 * Create a turn change log entry
 */
export function createTurnLogEntry(round, turn, actorInstanceId, actorName) {
  return createLogEntry({
    entryType: 'turn',
    round,
    turn,
    actorInstanceId,
    text: `${actorName}'s turn`
  });
}

/**
 * Create a resource change log entry
 */
export function createResourceLogEntry(round, turn, actorInstanceId, actorName, resource, oldValue, newValue) {
  const delta = newValue - oldValue;
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

  let resourceDelta = {};
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
export function createRollLogEntry(round, turn, actorInstanceId, actorName, rollResult) {
  const { expression, dice, modifier, total, target, margin, success } = rollResult;

  let text;
  if (target !== undefined) {
    const marginStr = margin >= 0 ? `+${margin}` : `${margin}`;
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
      margin: margin !== undefined ? margin : null,
      success: success !== undefined ? success : null
    }
  });
}

/**
 * Create a note log entry
 */
export function createNoteLogEntry(round, turn, actorInstanceId, actorName, note) {
  const text = actorName ? `${actorName}: ${note}` : note;
  return createLogEntry({
    entryType: 'note',
    round,
    turn,
    actorInstanceId,
    text
  });
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
  actorInstanceId,
  actorName,
  targetInstanceId = null,
  targetName = null,
  maneuver = null,
  action = null
}) {
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
    timestamp: new Date().toISOString(),
    round,
    turn,
    entryType: 'action',
    actorInstanceId,
    targetInstanceId,
    text,
    maneuver,
    action
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
export function createNumberedEnemies(baseName, quantity, template) {
  const enemies = [];

  for (let i = 1; i <= quantity; i++) {
    enemies.push({
      ...template,
      id: generateId(),
      name: quantity > 1 ? `${baseName} #${i}` : baseName,
      currentHP: template.hp,
      currentFP: template.fp || 0,
      currentMP: template.mp || 0
    });
  }

  return enemies;
}
