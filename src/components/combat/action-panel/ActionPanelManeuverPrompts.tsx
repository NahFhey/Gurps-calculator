import ManeuverWorkflowWidgets from '../ManeuverWorkflowWidgets';
import type {
  ManeuverPrompts,
  Participant,
  TurnDecision,
} from '../../../types/combatTracker';

interface ActionPanelManeuverPromptsProps {
  maneuverPrompts: ManeuverPrompts;
  turnDecision: TurnDecision | null;
  targets: Participant[];
  onManeuverWorkflow?: (update: {
    type: string;
    targetInstanceId?: string;
    turnsAimed?: number;
    triggerText?: string;
  }) => void;
}

/** ActionPanelManeuverPrompts - Aim and wait workflow prompts for the active combatant. */
export default function ActionPanelManeuverPrompts({
  maneuverPrompts,
  turnDecision,
  targets,
  onManeuverWorkflow,
}: ActionPanelManeuverPromptsProps) {
  if (!maneuverPrompts.allowsAimPanel && !maneuverPrompts.allowsWaitPanel) {
    return null;
  }

  return (
    <ManeuverWorkflowWidgets maneuverPrompts={maneuverPrompts} turnDecision={turnDecision} targets={targets} onManeuverWorkflow={onManeuverWorkflow} />
  );
}
