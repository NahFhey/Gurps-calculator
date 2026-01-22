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
 * @param {Object} entry - Log entry object
 * @returns {string} Formatted log entry text
 */
export function formatLogEntry(entry) {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();

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
 * Generate unique ID for combat entities
 * @returns {string} Unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
