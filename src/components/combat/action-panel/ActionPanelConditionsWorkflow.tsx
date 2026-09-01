import ConditionsPanel from '../ConditionsPanel';
import type { ConditionInstance, Participant } from '../../../types/combatTracker';

interface ActionPanelConditionsWorkflowProps {
  currentActor: Participant;
  currentRound: number;
  currentTurn: number;
  onAddCondition: (condition: ConditionInstance) => void;
  onRemoveCondition: (conditionInstanceId: string) => void;
  onCycleRevealed?: (conditionInstanceId: string) => void;
  onClose: () => void;
}

/** ActionPanelConditionsWorkflow - Condition management workflow view for the active combatant. */
export default function ActionPanelConditionsWorkflow({
  currentActor,
  currentRound,
  currentTurn,
  onAddCondition,
  onRemoveCondition,
  onCycleRevealed,
  onClose,
}: ActionPanelConditionsWorkflowProps) {
  return (
    <div className="border-t border-edge pt-4">
      <ConditionsPanel participant={{ ...currentActor, id: currentActor.instanceId }} currentRound={currentRound} currentTurn={currentTurn} onAddCondition={onAddCondition} onRemoveCondition={onRemoveCondition} onCycleRevealed={onCycleRevealed} />
      <button onClick={onClose} className="w-full mt-4 px-4 py-2 bg-surface-3 hover:bg-surface-4 rounded" aria-label="Close conditions panel">Close</button>
    </div>
  );
}
