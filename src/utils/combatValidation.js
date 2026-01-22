/**
 * Combat State Validation for Import/Export
 * Validates imported combat data and ensures required fields exist
 */

import { generateId } from './combatHelpers';

/**
 * Validate and migrate a combat state to Phase 2 format
 * Handles Phase 1 -> Phase 2 migration automatically
 *
 * @param {object} data - Imported combat state
 * @returns {{valid: boolean, combat: object|null, errors: string[]}}
 */
export function validateCombatState(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, combat: null, errors: ['Invalid data format'] };
  }

  // Check required fields
  if (!data.id) {
    errors.push('Missing combat id');
  }

  if (!data.name) {
    errors.push('Missing combat name');
  }

  if (!Array.isArray(data.participants)) {
    errors.push('Missing or invalid participants array');
  }

  if (!Array.isArray(data.turnOrder)) {
    errors.push('Missing or invalid turnOrder array');
  }

  if (!Array.isArray(data.log)) {
    errors.push('Missing or invalid log array');
  }

  if (errors.length > 0) {
    return { valid: false, combat: null, errors };
  }

  // Migrate Phase 1 -> Phase 2 if needed
  const migrated = migrateCombatState(data);

  // Validate migrated state
  const validationErrors = validateMigratedState(migrated);
  if (validationErrors.length > 0) {
    return { valid: false, combat: null, errors: validationErrors };
  }

  return { valid: true, combat: migrated, errors: [] };
}

/**
 * Migrate Phase 1 combat state to Phase 2
 * - Ensures version: 2
 * - Migrates participant.id -> participant.instanceId
 * - Adds logEntry.id if missing
 * - Ensures structured log format
 *
 * @param {object} combat - Phase 1 or Phase 2 combat state
 * @returns {object} Phase 2 combat state
 */
function migrateCombatState(combat) {
  const version = combat.version || 1;

  if (version >= 2) {
    // Already Phase 2, just validate IDs
    return ensureStableIds(combat);
  }

  // Phase 1 -> Phase 2 migration
  const migrated = {
    ...combat,
    version: 2
  };

  // Migrate participants: id -> instanceId
  migrated.participants = combat.participants.map(p => {
    const instanceId = p.instanceId || p.id || generateId();
    return {
      ...p,
      instanceId,
      // Keep old id for backward compatibility
      id: p.id || instanceId
    };
  });

  // Update turnOrder to use instanceIds
  migrated.turnOrder = combat.turnOrder.map(oldId => {
    const participant = migrated.participants.find(p => p.id === oldId || p.instanceId === oldId);
    return participant ? participant.instanceId : oldId;
  });

  // Migrate log entries
  migrated.log = combat.log.map(entry => migrateLogEntry(entry, migrated));

  return migrated;
}

/**
 * Ensure all entities have stable IDs
 */
function ensureStableIds(combat) {
  const updated = { ...combat };

  // Ensure participants have instanceId
  updated.participants = combat.participants.map(p => {
    if (!p.instanceId) {
      const instanceId = p.id || generateId();
      return {
        ...p,
        instanceId,
        id: p.id || instanceId
      };
    }
    return p;
  });

  // Ensure log entries have id
  updated.log = combat.log.map(entry => {
    if (!entry.id) {
      return {
        ...entry,
        id: generateId()
      };
    }
    return entry;
  });

  return updated;
}

/**
 * Migrate a Phase 1 log entry to Phase 2 structured format
 */
function migrateLogEntry(entry, combat) {
  // If already has Phase 2 structure, return as-is (with ID ensured)
  if (entry.entryType) {
    return {
      ...entry,
      id: entry.id || generateId()
    };
  }

  // Phase 1 -> Phase 2 migration
  const migrated = {
    id: entry.id || generateId(),
    timestamp: entry.timestamp,
    round: combat.currentRound || 1,
    turn: combat.currentTurnIndex !== undefined ? combat.currentTurnIndex : 0,
    entryType: mapOldTypeToEntryType(entry.type),
    actorInstanceId: entry.actorId || null,
    targetInstanceId: null,
    text: generateTextFromOldEntry(entry),
    hpDelta: null,
    fpDelta: null,
    mpDelta: null,
    roll: null
  };

  // Extract resource deltas
  if (entry.type === 'hp_change') {
    migrated.hpDelta = (entry.newValue || 0) - (entry.oldValue || 0);
  } else if (entry.type === 'fp_change') {
    migrated.fpDelta = (entry.newValue || 0) - (entry.oldValue || 0);
  } else if (entry.type === 'mp_change') {
    migrated.mpDelta = (entry.newValue || 0) - (entry.oldValue || 0);
  }

  return migrated;
}

/**
 * Map Phase 1 log type to Phase 2 entryType
 */
function mapOldTypeToEntryType(oldType) {
  switch (oldType) {
    case 'turn_change':
    case 'round_change':
      return 'turn';
    case 'hp_change':
    case 'fp_change':
    case 'mp_change':
      return 'resource';
    case 'note':
      return 'note';
    case 'combat_start':
    case 'combat_end':
      return 'note';
    default:
      return 'note';
  }
}

/**
 * Generate text from old log entry
 */
function generateTextFromOldEntry(entry) {
  if (entry.note) {
    return entry.note;
  }

  switch (entry.type) {
    case 'combat_start':
      return 'Combat started';
    case 'combat_end':
      return 'Combat ended';
    case 'round_change':
      return `Round ${entry.round}`;
    case 'turn_change':
      return `${entry.actorName}'s turn`;
    case 'hp_change':
      return `HP ${entry.oldValue} → ${entry.newValue}`;
    case 'fp_change':
      return `FP ${entry.oldValue} → ${entry.newValue}`;
    case 'mp_change':
      return `MP ${entry.oldValue} → ${entry.newValue}`;
    default:
      return entry.message || 'Unknown event';
  }
}

/**
 * Validate a migrated combat state
 */
function validateMigratedState(combat) {
  const errors = [];

  // Check version
  if (combat.version !== 2) {
    errors.push('Invalid version (expected 2)');
  }

  // Check participants have instanceId
  if (combat.participants) {
    for (const p of combat.participants) {
      if (!p.instanceId) {
        errors.push(`Participant ${p.name || 'unknown'} missing instanceId`);
      }
    }
  }

  // Check log entries have id
  if (combat.log) {
    for (let i = 0; i < combat.log.length; i++) {
      if (!combat.log[i].id) {
        errors.push(`Log entry at index ${i} missing id`);
      }
    }
  }

  // Check turnOrder references valid instanceIds
  if (combat.turnOrder && combat.participants) {
    const validIds = new Set(combat.participants.map(p => p.instanceId));
    for (const id of combat.turnOrder) {
      if (!validIds.has(id)) {
        errors.push(`turnOrder contains invalid instanceId: ${id}`);
      }
    }
  }

  return errors;
}

/**
 * Validate and prepare combat export
 * @param {object} combatState - Combat state to export
 * @param {object} historyState - History state to export
 * @returns {{valid: boolean, data: object|null, errors: string[]}}
 */
export function validateCombatExport(combatState, historyState) {
  const errors = [];

  if (!combatState) {
    errors.push('No combat state to export');
  }

  if (!historyState) {
    errors.push('No history state to export');
  }

  if (errors.length > 0) {
    return { valid: false, data: null, errors };
  }

  // Ensure stable IDs
  const validatedCombat = ensureStableIds(combatState);

  const exportData = {
    version: 1,
    combatState: validatedCombat,
    history: historyState
  };

  return { valid: true, data: exportData, errors: [] };
}

/**
 * Validate import data and extract combat + history
 * @param {object} data - Imported data
 * @returns {{valid: boolean, combatState: object|null, historyState: object|null, errors: string[]}}
 */
export function validateCombatImport(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, combatState: null, historyState: null, errors: ['Invalid data format'] };
  }

  if (!data.combatState) {
    errors.push('Missing combatState in import');
  }

  if (!data.history) {
    errors.push('Missing history in import');
  }

  if (errors.length > 0) {
    return { valid: false, combatState: null, historyState: null, errors };
  }

  // Validate combat state
  const combatValidation = validateCombatState(data.combatState);
  if (!combatValidation.valid) {
    return {
      valid: false,
      combatState: null,
      historyState: null,
      errors: combatValidation.errors
    };
  }

  return {
    valid: true,
    combatState: combatValidation.combat,
    historyState: data.history,
    errors: []
  };
}
