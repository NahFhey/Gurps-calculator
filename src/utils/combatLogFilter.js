/**
 * Combat Log Filter (Phase 5)
 *
 * Filters combat log entries for Player View to prevent leaking secret information.
 * Implements the PLAYER-SAFE LOG REDACTION POLICY.
 */

import { RevealMode } from './combatReveal.js';

/**
 * Filter combat log for Player View
 *
 * @param {array} log - Full truth combat log
 * @param {object} revealState - Current reveal state
 * @param {object} combatState - Combat state (for participant lookup)
 * @returns {array} Filtered log safe for Player View
 */
export function filterLogForPlayerView(log, revealState, combatState) {
  if (!log || log.length === 0) return [];

  return log.map(entry => filterLogEntry(entry, revealState, combatState));
}

/**
 * Filter a single log entry based on reveal state
 */
function filterLogEntry(entry, revealState, combatState) {
  // Get reveal state for actor and target
  const actorReveal = entry.actorInstanceId
    ? revealState?.byInstanceId?.[entry.actorInstanceId]
    : null;
  const targetReveal = entry.targetInstanceId
    ? revealState?.byInstanceId?.[entry.targetInstanceId]
    : null;

  // Get participants for name/side lookup
  const actor = entry.actorInstanceId
    ? combatState.participants.find(p => p.instanceId === entry.actorInstanceId)
    : null;
  const target = entry.targetInstanceId
    ? combatState.participants.find(p => p.instanceId === entry.targetInstanceId)
    : null;

  // Always show turn and note entries as-is
  if (entry.entryType === 'turn' || entry.entryType === 'note') {
    return {
      ...entry,
      text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
    };
  }

  // Filter by entry type
  switch (entry.entryType) {
    case 'resource':
      return filterResourceEntry(entry, actorReveal, actor);

    case 'roll':
      return filterRollEntry(entry, actorReveal, actor);

    case 'action':
      return filterActionEntry(entry, actorReveal, targetReveal, actor, target);

    case 'injury':
      return filterInjuryEntry(entry, actorReveal, targetReveal, actor, target);

    case 'effect':
      return filterEffectEntry(entry, actorReveal, actor);

    default:
      // Unknown entry type - show generic text
      return {
        ...entry,
        text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
      };
  }
}

/**
 * Filter resource change entries (HP/FP/MP deltas)
 */
function filterResourceEntry(entry, actorReveal, actor) {
  // If actor is player/ally or HP is revealed as exact, show as-is
  if (actor?.side === 'player' || actor?.side === 'ally' || actorReveal?.hp?.mode === RevealMode.NUMERIC_EXACT) {
    return {
      ...entry,
      text: redactName(entry.text, actorReveal, actor)
    };
  }

  // Otherwise, hide exact numbers
  const name = getDisplayName(actor, actorReveal);
  const resource = entry.text.match(/HP|FP|MP/)?.[0] || 'resource';

  let change = '';
  if (entry.hpDelta && entry.hpDelta < 0) {
    change = 'took damage';
  } else if (entry.hpDelta && entry.hpDelta > 0) {
    change = 'recovered';
  } else if (entry.fpDelta) {
    change = 'changed fatigue';
  } else if (entry.mpDelta) {
    change = 'changed mana';
  }

  return {
    ...entry,
    text: `${name} ${change}`,
    hpDelta: undefined,
    fpDelta: undefined,
    mpDelta: undefined
  };
}

/**
 * Filter roll entries (dice rolls)
 */
function filterRollEntry(entry, actorReveal, actor) {
  // If actor is player/ally, show full roll
  if (actor?.side === 'player' || actor?.side === 'ally') {
    return {
      ...entry,
      text: redactName(entry.text, actorReveal, actor)
    };
  }

  // For enemies, hide roll details unless revealed
  if (actorReveal?.defenses?.dodge === RevealMode.DEFENSE_EXACT ||
      actorReveal?.defenses?.parry === RevealMode.DEFENSE_EXACT ||
      actorReveal?.defenses?.block === RevealMode.DEFENSE_EXACT) {
    // Defense is revealed, show roll
    return {
      ...entry,
      text: redactName(entry.text, actorReveal, actor)
    };
  }

  // Hide enemy rolls
  const name = getDisplayName(actor, actorReveal);
  return {
    ...entry,
    text: `${name} acted`,
    roll: undefined
  };
}

/**
 * Filter action entries (attack/defense/damage)
 */
function filterActionEntry(entry, actorReveal, targetReveal, actor, target) {
  const actorName = getDisplayName(actor, actorReveal);
  const targetName = getDisplayName(target, targetReveal);

  const { action } = entry;
  if (!action) {
    return {
      ...entry,
      text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
    };
  }

  // Attack
  if (action.kind === 'attack') {
    const { attack } = action;
    if (!attack) return entry;

    // Show if actor is player/ally
    if (actor?.side === 'player' || actor?.side === 'ally') {
      return {
        ...entry,
        text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
      };
    }

    // Enemy attack - hide exact numbers
    const outcome = attack.success ? 'attacked' : 'attacked but missed';
    return {
      ...entry,
      text: `${actorName} ${outcome} ${targetName}`,
      action: {
        kind: 'attack',
        attack: {
          name: attack.name,
          success: attack.success
          // Hide rollTotal, effectiveSkill, margin
        }
      }
    };
  }

  // Defense
  if (action.kind === 'defense') {
    const { defense } = action;
    if (!defense) return entry;

    // Show if defender is player/ally
    if (target?.side === 'player' || target?.side === 'ally') {
      return {
        ...entry,
        text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
      };
    }

    // Enemy defense - check if revealed
    const defenseType = defense.type; // 'dodge', 'parry', 'block'
    if (targetReveal?.defenses?.[defenseType] === RevealMode.DEFENSE_EXACT) {
      // Revealed - show full
      return {
        ...entry,
        text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
      };
    }

    // Hide exact defense numbers
    const outcome = defense.success ? 'defended successfully' : 'failed to defend';
    return {
      ...entry,
      text: `${targetName} ${outcome}`,
      action: {
        kind: 'defense',
        defense: {
          type: defense.type,
          success: defense.success
          // Hide rollTotal, effectiveDefense, margin
        }
      }
    };
  }

  // Damage
  if (action.kind === 'damage') {
    const { damage } = action;
    if (!damage) return entry;

    // Show if target is player/ally
    if (target?.side === 'player' || target?.side === 'ally') {
      return {
        ...entry,
        text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
      };
    }

    // Enemy taking damage - check reveal
    const hpRevealed = targetReveal?.hp?.mode === RevealMode.NUMERIC_EXACT;
    const drRevealed = targetReveal?.dr?.general === RevealMode.DR_EXACT ||
                       targetReveal?.dr?.general === RevealMode.DR_MIN_KNOWN;

    if (hpRevealed && drRevealed) {
      // Both revealed - show full
      return {
        ...entry,
        text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
      };
    }

    // Hide exact damage/DR numbers
    let outcome;
    if (damage.penetrating === 0) {
      if (drRevealed && targetReveal.dr.general === RevealMode.DR_MIN_KNOWN) {
        outcome = `armor resisted the blow (DR ≥ ${targetReveal.dr.generalMin || 0})`;
      } else {
        outcome = 'armor resisted the blow';
      }
    } else if (damage.penetrating > 0) {
      outcome = hpRevealed ? `took ${damage.penetrating} injury` : 'was wounded';
    }

    return {
      ...entry,
      text: `${targetName} ${outcome}`,
      action: {
        kind: 'damage',
        damage: hpRevealed || drRevealed ? damage : {
          // Hide exact numbers
        }
      }
    };
  }

  // Unknown action kind
  return {
    ...entry,
    text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
  };
}

/**
 * Filter injury entries (Phase 4 injury system)
 */
function filterInjuryEntry(entry, actorReveal, targetReveal, actor, target) {
  const targetName = getDisplayName(target, targetReveal);

  // Show if target is player/ally
  if (target?.side === 'player' || target?.side === 'ally') {
    return {
      ...entry,
      text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
    };
  }

  // Enemy injury - check reveal
  const hpRevealed = targetReveal?.hp?.mode === RevealMode.NUMERIC_EXACT;

  if (hpRevealed) {
    // HP revealed - show full
    return {
      ...entry,
      text: redactNames(entry.text, actorReveal, targetReveal, actor, target)
    };
  }

  // Hide exact HP and injury details
  // Parse generic injury level from text
  let severity = 'was injured';
  if (entry.text.includes('crippled') || entry.text.includes('severely')) {
    severity = 'was badly wounded';
  } else if (entry.text.includes('died') || entry.text.includes('killed')) {
    severity = 'was killed';
  } else if (entry.text.includes('unconscious')) {
    severity = 'fell unconscious';
  }

  return {
    ...entry,
    text: `${targetName} ${severity}`
  };
}

/**
 * Filter effect entries (buffs/debuffs)
 */
function filterEffectEntry(entry, actorReveal, actor) {
  // Effects are generally visible (they have obvious in-game signs)
  // But hide for enemies if notes are hidden
  if (actor?.side === 'enemy' && actorReveal?.notes === RevealMode.NOTES_HIDDEN) {
    const name = getDisplayName(actor, actorReveal);
    return {
      ...entry,
      text: `${name} gained an effect`
    };
  }

  return {
    ...entry,
    text: redactName(entry.text, actorReveal, actor)
  };
}

/**
 * Get display name based on reveal state
 */
function getDisplayName(participant, reveal) {
  if (!participant) return 'Unknown';

  if (!reveal || reveal.name === RevealMode.NAME_HIDDEN) {
    return 'Unknown Foe';
  }

  if (reveal.name === RevealMode.NAME_PARTIAL) {
    return `Unknown #${participant.instanceId.slice(-4)}`;
  }

  return participant.name;
}

/**
 * Redact name in text string (single actor)
 */
function redactName(text, reveal, participant) {
  if (!participant || !reveal) return text;

  const trueName = participant.name;
  const displayName = getDisplayName(participant, reveal);

  if (trueName === displayName) return text;

  return text.replace(new RegExp(trueName, 'g'), displayName);
}

/**
 * Redact names in text string (actor and target)
 */
function redactNames(text, actorReveal, targetReveal, actor, target) {
  let result = text;

  if (actor && actorReveal) {
    const trueName = actor.name;
    const displayName = getDisplayName(actor, actorReveal);
    if (trueName !== displayName) {
      result = result.replace(new RegExp(trueName, 'g'), displayName);
    }
  }

  if (target && targetReveal) {
    const trueName = target.name;
    const displayName = getDisplayName(target, targetReveal);
    if (trueName !== displayName) {
      result = result.replace(new RegExp(trueName, 'g'), displayName);
    }
  }

  return result;
}
