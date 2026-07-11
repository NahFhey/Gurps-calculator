import ConditionsPanel from '../ConditionsPanel';
import type { ActionPanelParticipant } from '../../../types/actionPanel';
import type { ConditionDuration, ConditionInstance } from '../../../types/combatTracker';

interface ActionPanelConditionsWorkflowProps {
  currentActor: ActionPanelParticipant;
  currentRound: number;
  currentTurn: number;
  onAddCondition: (condition: ConditionInstance) => void;
  onRemoveCondition: (conditionInstanceId: string) => void;
  onUpdateCondition?: (conditionInstanceId: string, newDuration: ConditionDuration) => void;
  onCancel: () => void;
}

export default function ActionPanelConditionsWorkflow({
  currentActor,
  currentRound,
  currentTurn,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onCancel,
}: ActionPanelConditionsWorkflowProps) {
  return (
    <div className="border-t border-gray-700 pt-4">
      <ConditionsPanel
        participant={{ ...currentActor, id: currentActor.instanceId }}
        currentRound={currentRound}
        currentTurn={currentTurn}
        onAddCondition={onAddCondition}
        onRemoveCondition={onRemoveCondition}
        onUpdateCondition={
          onUpdateCondition
            ? (id: string, duration: number) =>
                onUpdateCondition(id, { type: 'rounds', value: duration })
            : undefined
        }
      />
      <div className="mt-4">
        <button
          onClick={onCancel}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}
