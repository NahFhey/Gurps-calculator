/**
 * Combat View Filter (Phase 5)
 *
 * Produces filtered view models from truth state + reveal state.
 * Enforces information security: Player View cannot access hidden data.
 */

import {
  RevealMode,
  getRevealForInstance,
  calculateHPBand,
  getHPBandText
} from './combatReveal.js';

/**
 * View modes
 */
export const ViewMode = {
  GM: 'gm',
  PLAYER: 'player'
};

/**
 * Get filtered combat state view model
 *
 * @param {object} combatState - Truth combat state (combatActive)
 * @param {object} revealState - Reveal state (combatReveal)
 * @param {string} viewMode - 'gm' or 'player'
 * @returns {object} Filtered view model (safe for rendering)
 */
export function getCombatView(combatState, revealState, viewMode) {
  if (!combatState) return null;

  // GM View: return truth state as-is (with reveal metadata attached for UI)
  if (viewMode === ViewMode.GM) {
    return {
      ...combatState,
      _viewMode: ViewMode.GM,
      _revealState: revealState, // Attach for reveal panel UI
      participants: combatState.participants.map(p => ({
        ...p,
        _reveal: getRevealForInstance(revealState, p.instanceId, p.side)
      }))
    };
  }

  // Player View: filter based on reveal state
  return {
    version: combatState.version,
    id: combatState.id,
    name: combatState.name,
    startTime: combatState.startTime,
    currentTurnIndex: combatState.currentTurnIndex,
    currentRound: combatState.currentRound,
    turnOrder: combatState.turnOrder,
    _viewMode: ViewMode.PLAYER,

    // Filter participants
    participants: combatState.participants.map(p =>
      filterParticipant(p, revealState)
    ),

    // Log filtering handled separately by combatLogFilter.js
    log: combatState.log || []
  };
}

/**
 * Filter a single participant based on reveal state
 *
 * @param {object} participant - Truth participant data
 * @param {object} revealState - Reveal state
 * @returns {object} Filtered participant (safe for Player View)
 */
function filterParticipant(participant, revealState) {
  const reveal = getRevealForInstance(
    revealState,
    participant.instanceId,
    participant.side
  );

  const filtered = {
    instanceId: participant.instanceId,
    id: participant.id, // Legacy support
    side: participant.side,
    category: participant.category, // Always show category
    _reveal: reveal // Attach reveal metadata for UI rendering
  };

  // Copy non-secret combat stats (always visible for UI purposes)
  filtered.basicSpeed = participant.basicSpeed;
  filtered.dx = participant.dx;
  filtered.maxHP = participant.maxHP || participant.hp;
  filtered.maxFP = participant.maxFP || participant.fp;
  filtered.maxMP = participant.maxMP || participant.mp;

  // Name
  filtered.name = filterName(participant.name, participant.instanceId, reveal.name);

  // Tags
  filtered.tags = filterTags(participant.tags, reveal.tags);

  // HP
  filtered.hp = filterNumericResource(
    participant.currentHP,
    participant.maxHP,
    reveal.hp
  );

  // FP
  if (participant.maxFP !== undefined) {
    filtered.fp = filterNumericResource(
      participant.currentFP,
      participant.maxFP,
      reveal.fp
    );
  }

  // MP
  if (participant.maxMP !== undefined) {
    filtered.mp = filterNumericResource(
      participant.currentMP,
      participant.maxMP,
      reveal.mp
    );
  }

  // Defenses
  filtered.defenses = filterDefenses(
    {
      dodge: participant.dodge,
      parry: participant.parry,
      block: participant.block
    },
    reveal.defenses
  );

  // DR
  filtered.dr = filterDR(participant.dr, participant.drByLocation, reveal.dr);

  // Attacks
  filtered.attacks = filterAttacks(participant.attacks, reveal.attacks);

  // Notes
  filtered.notes = filterNotes(participant.notes, reveal.notes);

  // Phase 4 injury system fields - only show if HP exact or if status is obvious
  if (reveal.hp.mode === RevealMode.NUMERIC_EXACT || participant.isDead) {
    filtered.shockPenalty = participant.shockPenalty;
    filtered.isStunned = participant.isStunned;
    filtered.isUnconscious = participant.isUnconscious;
    filtered.isDead = participant.isDead;
    filtered.bleeding = participant.bleeding;
    filtered.crippled = participant.crippled;
  } else {
    // Show only obvious status
    filtered.isDead = participant.isDead || false;
    filtered.isUnconscious = participant.isUnconscious || false;
  }

  return filtered;
}

/**
 * Filter name based on reveal mode
 */
function filterName(trueName, instanceId, nameReveal) {
  switch (nameReveal) {
    case RevealMode.NAME_FULL:
      return trueName;

    case RevealMode.NAME_PARTIAL:
      // Return generic label based on instanceId
      return `Unknown #${instanceId.slice(-4)}`;

    case RevealMode.NAME_HIDDEN:
    default:
      return 'Unknown Foe';
  }
}

/**
 * Filter tags/keywords
 */
function filterTags(tags, tagsReveal) {
  if (tagsReveal === RevealMode.NOTES_FULL) {
    return tags;
  }
  return []; // Hidden
}

/**
 * Filter numeric resource (HP/FP/MP)
 * For HP: Always show health band for gameplay (healthy/wounded/critical/dead)
 */
function filterNumericResource(current, max, reveal) {
  if (!reveal) {
    // Default: show band for HP (for gameplay), unknown for FP/MP
    const band = calculateHPBand(current, max);
    return {
      mode: RevealMode.NUMERIC_BAND,
      band,
      bandText: getHPBandText(band)
    };
  }

  switch (reveal.mode) {
    case RevealMode.NUMERIC_EXACT:
      return {
        mode: RevealMode.NUMERIC_EXACT,
        current,
        max
      };

    case RevealMode.NUMERIC_BAND:
      const band = calculateHPBand(current, max);
      return {
        mode: RevealMode.NUMERIC_BAND,
        band,
        bandText: getHPBandText(band)
      };

    case RevealMode.NUMERIC_UNKNOWN:
    default:
      // For HP: still show band for gameplay purposes
      // For FP/MP: truly unknown
      const hpBand = calculateHPBand(current, max);
      return {
        mode: RevealMode.NUMERIC_BAND, // Changed from UNKNOWN to BAND
        band: hpBand,
        bandText: getHPBandText(hpBand)
      };
  }
}

/**
 * Filter defenses (dodge/parry/block)
 */
function filterDefenses(truthDefenses, reveal) {
  const filtered = {};

  ['dodge', 'parry', 'block'].forEach(defType => {
    const mode = reveal?.[defType] || RevealMode.DEFENSE_UNKNOWN;

    switch (mode) {
      case RevealMode.DEFENSE_EXACT:
        filtered[defType] = {
          mode: RevealMode.DEFENSE_EXACT,
          value: truthDefenses[defType]
        };
        break;

      case RevealMode.DEFENSE_APPROX:
        filtered[defType] = {
          mode: RevealMode.DEFENSE_APPROX,
          value: reveal.approxValue?.[defType] || truthDefenses[defType]
        };
        break;

      case RevealMode.DEFENSE_UNKNOWN:
      default:
        filtered[defType] = {
          mode: RevealMode.DEFENSE_UNKNOWN
        };
        break;
    }
  });

  return filtered;
}

/**
 * Filter DR (general and by location)
 */
function filterDR(generalDR, drByLocation, reveal) {
  const filtered = {};

  // General DR
  switch (reveal?.general) {
    case RevealMode.DR_EXACT:
      filtered.general = {
        mode: RevealMode.DR_EXACT,
        value: generalDR
      };
      break;

    case RevealMode.DR_MIN_KNOWN:
      filtered.general = {
        mode: RevealMode.DR_MIN_KNOWN,
        min: reveal.generalMin || 0
      };
      break;

    case RevealMode.DR_UNKNOWN:
    default:
      filtered.general = {
        mode: RevealMode.DR_UNKNOWN
      };
      break;
  }

  // Location-specific DR
  filtered.byLocation = {};
  if (drByLocation) {
    Object.keys(drByLocation).forEach(locationKey => {
      const locationReveal = reveal?.byLocation?.[locationKey];

      if (!locationReveal || locationReveal.mode === RevealMode.DR_UNKNOWN) {
        filtered.byLocation[locationKey] = {
          mode: RevealMode.DR_UNKNOWN
        };
      } else if (locationReveal.mode === RevealMode.DR_MIN_KNOWN) {
        filtered.byLocation[locationKey] = {
          mode: RevealMode.DR_MIN_KNOWN,
          min: locationReveal.min || 0
        };
      } else if (locationReveal.mode === RevealMode.DR_EXACT) {
        filtered.byLocation[locationKey] = {
          mode: RevealMode.DR_EXACT,
          value: drByLocation[locationKey]
        };
      }
    });
  }

  return filtered;
}

/**
 * Filter attacks
 */
function filterAttacks(attacks, attacksReveal) {
  if (!attacks || attacks.length === 0) {
    return [];
  }

  switch (attacksReveal) {
    case RevealMode.ATTACKS_FULL:
      return attacks;

    case RevealMode.ATTACKS_NAMES_ONLY:
      return attacks.map(atk => ({
        name: atk.name,
        // Hide stats
        _hidden: true
      }));

    case RevealMode.ATTACKS_HIDDEN:
    default:
      return [];
  }
}

/**
 * Filter notes
 */
function filterNotes(notes, notesReveal) {
  if (notesReveal === RevealMode.NOTES_FULL) {
    return notes;
  }
  return ''; // Hidden
}

/**
 * Check if participant has any hidden information
 * (useful for UI to show reveal indicators)
 */
export function hasHiddenInfo(participant) {
  const reveal = participant._reveal;
  if (!reveal) return false;

  return (
    reveal.name !== RevealMode.NAME_FULL ||
    reveal.hp?.mode !== RevealMode.NUMERIC_EXACT ||
    reveal.defenses?.dodge !== RevealMode.DEFENSE_EXACT ||
    reveal.dr?.general !== RevealMode.DR_EXACT ||
    reveal.attacks !== RevealMode.ATTACKS_FULL
  );
}
