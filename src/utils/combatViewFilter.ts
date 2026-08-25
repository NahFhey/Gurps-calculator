/**
 * Combat View Filter (Phase 5 & 6)
 *
 * Produces filtered view models from truth state + reveal state.
 * Enforces information security: Player View cannot access hidden data.
 */

import {
  RevealMode,
  getRevealForInstance,
  calculateHPBand,
  getHPBandText,
} from './combatReveal';
import { isConditionObvious } from '../constants/conditions';
import type {
  Attack,
  CombatState,
  ConditionInstance,
  DefenseRevealMode,
  DRRevealMode,
  NameRevealMode,
  NumericRevealMode,
  Participant,
  RevealEntry,
  RevealState,
} from '../types/combatTracker';
import type { HPBandValue } from './combatReveal';

type DefenseKey = 'dodge' | 'parry' | 'block';
type NumericTruthValue = Participant['hp'] | Participant['fp'] | Participant['mp'];

interface ParticipantWithLegacyFields extends Participant {
  side?: string;
  tags?: string[];
  drByLocation?: Record<string, number>;
  notes?: string;
}

interface RevealedParticipant extends Participant {
  _reveal: RevealEntry;
}

interface FilteredNumericResource {
  mode: NumericRevealMode;
  current?: number;
  max?: NumericTruthValue;
  band?: HPBandValue;
  bandText?: string;
}

interface FilteredDefense {
  mode: DefenseRevealMode;
  value?: number;
}

type FilteredDefenses = Record<DefenseKey, FilteredDefense>;

interface FilteredDRValue {
  mode: DRRevealMode;
  value?: number;
  min?: number;
}

interface FilteredDR {
  general: FilteredDRValue;
  byLocation: Record<string, FilteredDRValue>;
}

interface HiddenAttack {
  name: string;
  _hidden: true;
}

interface FilteredParticipant {
  instanceId: string;
  id: string | undefined;
  side: string | undefined;
  category: string;
  _reveal: RevealEntry;
  partyCharacterId?: string;
  isFromParty?: boolean;
  basicSpeed?: number;
  dx?: number;
  position?: Participant['position'];
  maxHP?: NumericTruthValue;
  maxFP?: NumericTruthValue;
  maxMP?: NumericTruthValue;
  name?: string;
  tags?: string[];
  hp?: FilteredNumericResource;
  fp?: FilteredNumericResource;
  mp?: FilteredNumericResource;
  defenses?: FilteredDefenses;
  dr?: FilteredDR;
  attacks?: Array<Attack | HiddenAttack>;
  notes?: string;
  shockPenalty?: number;
  isDead?: boolean;
  bleeding?: Participant['bleeding'];
  crippled?: string[];
  conditions?: ConditionInstance[];
}

interface GMCombatView extends Omit<CombatState, 'participants'> {
  _viewMode: 'gm';
  _revealState: RevealState | undefined;
  participants: RevealedParticipant[];
}

interface PlayerCombatView {
  version: CombatState['version'];
  id: string;
  name: string;
  startTime: number;
  currentTurnIndex: number;
  currentRound: number;
  turnOrder: string[];
  _viewMode: 'player';
  participants: FilteredParticipant[];
  log: CombatState['log'];
}

type CombatViewImplementation =
  | GMCombatView
  | PlayerCombatView
  | { participants: Participant[] };

export type ViewModeType = 'gm' | 'player';

/**
 * View modes
 */
export const ViewMode: { readonly GM: 'gm'; readonly PLAYER: 'player' } = {
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
export function getCombatView(
  combatState: CombatState,
  revealState: RevealState | undefined,
  viewMode: ViewModeType
): { participants: Participant[] } | null;
export function getCombatView(
  combatState: CombatState | null,
  revealState: RevealState | undefined,
  viewMode: ViewModeType
): CombatViewImplementation | null {
  if (!combatState) return null;

  // GM View: return truth state as-is (with reveal metadata attached for UI)
  if (viewMode === ViewMode.GM) {
    return {
      ...combatState,
      _viewMode: ViewMode.GM,
      _revealState: revealState, // Attach for reveal panel UI
      participants: combatState.participants.map((p: ParticipantWithLegacyFields): RevealedParticipant => ({
        ...p,
        _reveal: getRevealForInstance(revealState, p.instanceId, p.category || p.side)
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
    participants: combatState.participants.map((p: ParticipantWithLegacyFields): FilteredParticipant =>
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
function filterParticipant(
  participant: ParticipantWithLegacyFields,
  revealState: RevealState | undefined
): FilteredParticipant {
  const side = participant.category || participant.side || 'enemy'; // Use category field (category is the actual field used)
  const reveal = getRevealForInstance(
    revealState,
    participant.instanceId,
    side
  );

  const filtered: FilteredParticipant = {
    instanceId: participant.instanceId,
    id: participant.id, // Legacy support
    side: participant.category || participant.side, // Use category as side
    category: participant.category, // Always show category
    _reveal: reveal // Attach reveal metadata for UI rendering
  };

  // Copy non-secret combat stats (always visible for UI purposes)
  filtered.basicSpeed = participant.basicSpeed;
  filtered.dx = participant.dx;
  // Party linkage is not secret — it's the player's own character reference, and
  // stripping it broke the Items workflow in player view (PCs rendered as
  // library combatants with no inventory).
  filtered.partyCharacterId = participant.partyCharacterId;
  filtered.isFromParty = participant.isFromParty;
  // Board position is public — a token on the shared map is visible to everyone;
  // concealment is fog/LOS's job, not field-stripping (dropping it made player
  // view render zero tokens).
  filtered.position = participant.position;
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
    participant.maxHP || participant.hp,
    reveal.hp
  );

  // FP
  if (participant.maxFP !== undefined || participant.fp !== undefined) {
    filtered.fp = filterNumericResource(
      participant.currentFP,
      participant.maxFP || participant.fp,
      reveal.fp
    );
  }

  // MP
  if (participant.maxMP !== undefined || participant.mp !== undefined) {
    filtered.mp = filterNumericResource(
      participant.currentMP,
      participant.maxMP || participant.mp,
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

  // Phase 4 injury system fields - only show if HP exact or if status is obvious.
  // Stun/unconsciousness are absent here since 12a.6: they live in conditions[]
  // and flow through the eye-state filter below.
  if (reveal.hp.mode === RevealMode.NUMERIC_EXACT || participant.isDead) {
    filtered.shockPenalty = participant.shockPenalty;
    filtered.isDead = participant.isDead;
    filtered.bleeding = participant.bleeding;
    filtered.crippled = participant.crippled;
  } else {
    // Show only obvious status
    filtered.isDead = participant.isDead || false;
  }

  // Phase 12a.6: Conditions - filter on per-instance eye state
  filtered.conditions = filterConditions(participant.conditions, side);

  return filtered;
}

/**
 * Filter name based on reveal mode
 */
function filterName(trueName: string, instanceId: string, nameReveal: NameRevealMode): string {
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
function filterTags(tags: string[] | undefined, tagsReveal: RevealEntry['tags']): string[] | undefined {
  if (tagsReveal === RevealMode.NOTES_FULL) {
    return tags;
  }
  return []; // Hidden
}

/**
 * Filter numeric resource (HP/FP/MP)
 * For HP: Always show health band for gameplay (healthy/wounded/critical/dead)
 */
function filterNumericResource(
  current: number | undefined,
  max: NumericTruthValue,
  reveal: RevealEntry['hp'] | undefined
): FilteredNumericResource {
  if (!reveal) {
    // Default: show band for HP (for gameplay), unknown for FP/MP
    const band = calculateHPBand(current!, max as number);
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
      const band = calculateHPBand(current!, max as number);
      return {
        mode: RevealMode.NUMERIC_BAND,
        band,
        bandText: getHPBandText(band)
      };

    case RevealMode.NUMERIC_UNKNOWN:
    default:
      // Truly unknown - don't reveal actual health status
      return {
        mode: RevealMode.NUMERIC_UNKNOWN
      };
  }
}

/**
 * Filter defenses (dodge/parry/block)
 */
function filterDefenses(
  truthDefenses: Partial<Record<DefenseKey, number>>,
  reveal: RevealEntry['defenses'] | undefined
): FilteredDefenses {
  const filtered = {} as FilteredDefenses;

  (['dodge', 'parry', 'block'] as const).forEach((defType): void => {
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
          value: reveal?.approxValue?.[defType] || truthDefenses[defType]
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
function filterDR(
  generalDR: number | undefined,
  drByLocation: Record<string, number> | undefined,
  reveal: RevealEntry['dr'] | undefined
): FilteredDR {
  let general: FilteredDRValue;

  switch (reveal?.general) {
    case RevealMode.DR_EXACT:
      general = {
        mode: RevealMode.DR_EXACT,
        value: generalDR
      };
      break;

    case RevealMode.DR_MIN_KNOWN:
      general = {
        mode: RevealMode.DR_MIN_KNOWN,
        min: reveal.generalMin || 0
      };
      break;

    case RevealMode.DR_UNKNOWN:
    default:
      general = {
        mode: RevealMode.DR_UNKNOWN
      };
      break;
  }

  // Location-specific DR
  const byLocation: Record<string, FilteredDRValue> = {};
  if (drByLocation) {
    Object.keys(drByLocation).forEach((locationKey: string): void => {
      const locationReveal = reveal?.byLocation?.[locationKey];

      if (!locationReveal || locationReveal.mode === RevealMode.DR_UNKNOWN) {
        byLocation[locationKey] = {
          mode: RevealMode.DR_UNKNOWN
        };
      } else if (locationReveal.mode === RevealMode.DR_MIN_KNOWN) {
        byLocation[locationKey] = {
          mode: RevealMode.DR_MIN_KNOWN,
          min: locationReveal.min || 0
        };
      } else if (locationReveal.mode === RevealMode.DR_EXACT) {
        byLocation[locationKey] = {
          mode: RevealMode.DR_EXACT,
          value: drByLocation[locationKey]
        };
      }
    });
  }

  return { general, byLocation };
}

/**
 * Filter attacks
 */
function filterAttacks(
  attacks: Attack[] | undefined,
  attacksReveal: RevealEntry['attacks']
): Array<Attack | HiddenAttack> {
  if (!attacks || attacks.length === 0) {
    return [];
  }

  switch (attacksReveal) {
    case RevealMode.ATTACKS_FULL:
      return attacks;

    case RevealMode.ATTACKS_NAMES_ONLY:
      return attacks.map((atk): HiddenAttack => ({
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
function filterNotes(notes: string | undefined, notesReveal: RevealEntry['notes']): string | undefined {
  if (notesReveal === RevealMode.NOTES_FULL) {
    return notes;
  }
  return ''; // Hidden
}

/**
 * Sentinel conditionId used for player-view placeholders of half-revealed
 * conditions. Not in the catalog on purpose — it resolves to the generic
 * "❓" icon and carries no mechanical information.
 */
export const CONCEALED_CONDITION_ID: '__concealed__' = '__concealed__';

/**
 * Phase 12a.6: Filter conditions on per-instance eye state
 *
 * Rules:
 * - Player/ally conditions: always shown in full (PC-side eye control is a
 *   deferred followup).
 * - NPC conditions follow the GM-controlled eye state on each instance:
 *   - 'closed' → omitted entirely
 *   - 'half'   → replaced with an anonymous "Afflicted" placeholder (one per
 *     instance — the count is deliberately exposed so the GM can telegraph
 *     individual effects)
 *   - 'open'   → passed through unchanged
 * - Instances without an eye state (unmigrated runtime data, e.g. an old
 *   export) fall back to the catalog isObvious default, matching what the
 *   revealed-backfill migration would seed.
 *
 * @param {array} conditions - Array of condition instances
 * @param {string} side - Combatant's side/category (player/ally/enemy)
 * @returns {array} Filtered conditions (safe for Player View)
 */
function filterConditions(
  conditions: ConditionInstance[] | undefined,
  side: string
): ConditionInstance[] {
  if (!conditions || !Array.isArray(conditions)) {
    return [];
  }

  // Player/ally: show all conditions
  if (side === 'player' || side === 'ally') {
    return conditions;
  }

  const visible: ConditionInstance[] = [];
  for (const condition of conditions) {
    if (!condition || typeof condition !== 'object') continue;

    const revealed = condition.revealed !== undefined
      ? condition.revealed
      : (isConditionObvious(condition.conditionId) ? 'open' : 'closed');

    if (revealed === 'open') {
      visible.push(condition);
    } else if (revealed === 'half') {
      // Anonymous placeholder: keeps the truth instanceId (a random id, safe
      // to expose, stable for React keys) but no name/icon/duration/severity.
      visible.push({
        instanceId: condition.instanceId,
        conditionId: CONCEALED_CONDITION_ID,
        label: 'Afflicted',
        placeholder: true
      });
    }
    // 'closed' → omitted
  }
  return visible;
}

/**
 * Check whether a participant contains hidden information
 * (useful for UI to show reveal indicators)
 */
export function hasHiddenInfo(participant: Participant): boolean {
  const reveal = (participant as Participant & { _reveal?: RevealEntry })._reveal;
  if (!reveal) return false;

  return (
    reveal.name !== RevealMode.NAME_FULL ||
    reveal.hp?.mode !== RevealMode.NUMERIC_EXACT ||
    reveal.defenses?.dodge !== RevealMode.DEFENSE_EXACT ||
    reveal.dr?.general !== RevealMode.DR_EXACT ||
    reveal.attacks !== RevealMode.ATTACKS_FULL
  );
}
