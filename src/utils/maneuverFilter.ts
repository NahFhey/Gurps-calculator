/**
 * Phase 7: Maneuver filtering based on turn context.
 */

import type { Maneuver, ManeuverPrompts } from '../constants/maneuvers';
import type { TurnContext } from '../types/combatTracker';

const DEFAULT_WARNING = 'Resolve manually based on table adjudication.';

// Callers pass the looser `Maneuver` shape from `../types/combatTracker`
// (via `ManeuverCatalog as Maneuver[]`), which only guarantees `id`/`label`
// and omits `requires`/`forbids`. Accept that shape while still allowing the
// `maneuver.requires?.` read below.
type FilterableManeuver = Partial<Maneuver> & Pick<Maneuver, 'id' | 'label'>;

export interface FilteredManeuver {
  id: string;
  label: string;
  group?: string;
  disabled: boolean;
  reason: string | null;
  warning: string | null;
  recommended: boolean;
  notes?: string;
  prompts?: ManeuverPrompts;
}

export function filterManeuvers(
  maneuvers: FilterableManeuver[],
  turnContext: TurnContext | null | undefined,
  combatRulesPreset: string = 'standard'
): FilteredManeuver[] {
  const preset = combatRulesPreset || 'standard';
  const context: Partial<TurnContext> = turnContext || {};
  const unconscious = Boolean(context.isUnconscious) || context.canAct === false;
  const stunned = Boolean(context.isStunned);
  const prone = Boolean(context.isProne);
  const grappled = Boolean(context.isGrappled);

  const grappleWarning = preset === 'lite'
    ? 'Grappled: resolve manually.'
    : 'Grappled: actions may be restricted; resolve manually.';

  const stunnedAllowed = new Set([
    'do_nothing',
    'all_out_defense_increased',
    'all_out_defense_dodge',
    'change_posture'
  ]);

  return maneuvers.map(maneuver => {
    let disabled = false;
    let reason: string | null = null;
    let warning: string | null = null;
    let recommended = false;

    if (unconscious && maneuver.id !== 'do_nothing') {
      disabled = true;
      reason = 'Unconscious: cannot act.';
    } else if (stunned && !stunnedAllowed.has(maneuver.id)) {
      disabled = true;
      reason = 'Stunned: must recover before taking other actions.';
    }

    if (!disabled) {
      if (grappled) {
        warning = grappleWarning;
      }
      if (prone && maneuver.id === 'change_posture') {
        recommended = true;
      }
    }

    if (!warning && maneuver.requires?.notUnconscious === false) {
      warning = DEFAULT_WARNING;
    }

    return {
      id: maneuver.id,
      label: maneuver.label,
      group: maneuver.group,
      disabled,
      reason,
      warning,
      recommended,
      notes: maneuver.notes,
      prompts: maneuver.prompts
    };
  });
}
