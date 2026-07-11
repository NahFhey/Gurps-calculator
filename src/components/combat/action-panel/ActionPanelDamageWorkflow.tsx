import type { ChangeEvent } from 'react';
import InjuryResolutionPanel from '../InjuryResolutionPanel';
import { getPublicDefenderLabel } from '../../../utils/combatViewSelectors';
import type {
  ActionPanelParticipant,
  HitLocation,
  InjuryData,
  LocationRoll,
  ManeuverWorkflow,
} from '../../../types/actionPanel';

interface ActionPanelDamageWorkflowProps {
  currentActor: ActionPanelParticipant;
  targets: ActionPanelParticipant[];
  selectedTargetId: string | null;
  boundTarget: ActionPanelParticipant | null;
  resolvedTarget: ActionPanelParticipant | null;
  combatState?: unknown;
  revealState?: unknown;
  combatRulesPreset: string;
  maneuverWorkflow?: ManeuverWorkflow;
  boundDamageExpression: string | null;
  boundHitLocation: HitLocation | null;
  boundHitLocationRoll: LocationRoll | null;
  forceTargetSelection: boolean;
  onSelectTarget: (targetId: string) => void;
  onForceTargetSelection: () => void;
  onComplete: (injuryData: InjuryData) => void;
  onCancel: () => void;
}

export default function ActionPanelDamageWorkflow({
  currentActor,
  targets,
  selectedTargetId,
  boundTarget,
  resolvedTarget,
  combatState,
  revealState,
  combatRulesPreset,
  maneuverWorkflow,
  boundDamageExpression,
  boundHitLocation,
  boundHitLocationRoll,
  forceTargetSelection,
  onSelectTarget,
  onForceTargetSelection,
  onComplete,
  onCancel,
}: ActionPanelDamageWorkflowProps) {
  return (
    <div className="border-t border-gray-700 pt-4">
      <h4 className="text-lg font-semibold mb-3">Injury Workflow (Phase 4)</h4>
      {boundTarget && !forceTargetSelection && (
        <div className="mb-3 bg-gray-700/40 rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Target (from attack)</div>
          <div className="text-sm font-semibold">
            {getPublicDefenderLabel(combatState, revealState, boundTarget.instanceId)}
          </div>
          <button
            onClick={onForceTargetSelection}
            className="mt-2 text-xs text-blue-300 hover:text-blue-200"
            type="button"
          >
            Change Target
          </button>
        </div>
      )}
      {(!boundTarget || forceTargetSelection) && (
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-2">Target</label>
          <select
            className="w-full px-3 py-2 bg-gray-700 rounded"
            value={selectedTargetId || targets[0]?.instanceId || ''}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onSelectTarget(event.target.value)
            }
          >
            {targets.map((target) => (
              <option key={target.instanceId} value={target.instanceId}>
                {target.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {resolvedTarget && (
        <InjuryResolutionPanel
          attacker={{ st: currentActor.st ?? 10, name: currentActor.name }}
          target={resolvedTarget as any}
          combatRulesPreset={combatRulesPreset}
          damageExpression={boundDamageExpression || ''}
          injectedDamageModifiers={maneuverWorkflow?.damage?.modifiers || []}
          initialLocation={boundHitLocation}
          initialLocationRoll={boundHitLocationRoll}
          onComplete={onComplete}
          onCancel={onCancel}
        />
      )}
      {targets.length === 0 && (
        <div className="text-gray-400 text-sm">No valid targets available</div>
      )}
    </div>
  );
}
