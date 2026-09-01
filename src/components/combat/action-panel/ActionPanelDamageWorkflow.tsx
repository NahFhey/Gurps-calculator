import type { ChangeEvent } from 'react';
import type { CombatState, RevealState } from '../../../types/combatTracker';
import InjuryResolutionPanel from '../InjuryResolutionPanel';
import { getPublicDefenderLabel } from '../../../utils/combatViewSelectors';
import type { Participant } from '../../../types/combatTracker';
import type { HitLocation, LocationRoll } from './types';

interface ActionPanelDamageWorkflowProps {
  currentActor: Participant;
  targets: Participant[];
  selectedTargetId: string | null;
  boundTarget: Participant | null;
  resolvedTarget: Participant | null;
  combatState?: CombatState | null;
  revealState?: RevealState | null;
  combatRulesPreset: string;
  damageModifiers: Array<{ label: string; value: number }>;
  boundDamageExpression: string | null;
  boundHitLocation: HitLocation | null;
  boundHitLocationRoll: LocationRoll | null;
  forceTargetSelection: boolean;
  onSelectTarget: (targetId: string) => void;
  onForceTargetSelection: () => void;
  onComplete: (injuryData: { targetInstanceId?: string; newHP?: number }) => void;
  onCancel: () => void;
}

/** ActionPanelDamageWorkflow - Injury/damage resolution workflow view for the active combatant. */
export default function ActionPanelDamageWorkflow({
  currentActor,
  targets,
  selectedTargetId,
  boundTarget,
  resolvedTarget,
  combatState,
  revealState,
  combatRulesPreset,
  damageModifiers,
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
    <div className="border-t border-edge pt-4">
      <h4 className="text-lg font-semibold mb-3">Injury Workflow</h4>
      {boundTarget && !forceTargetSelection && (
        <div className="mb-3 bg-surface-2/40 rounded p-3">
          <div className="text-xs text-fg-muted mb-1">Target (from attack)</div>
          <div className="text-sm font-semibold">{getPublicDefenderLabel(combatState, revealState, boundTarget.instanceId)}</div>
          <button onClick={onForceTargetSelection} className="mt-2 text-xs text-accent-300 hover:text-accent-200" type="button" aria-label="Change attack target">Change Target</button>
        </div>
      )}
      {(!boundTarget || forceTargetSelection) && (
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-2">Target</label>
          <select className="w-full px-3 py-2 bg-surface-2 rounded" value={selectedTargetId || targets[0]?.instanceId || ''} onChange={(e: ChangeEvent<HTMLSelectElement>) => onSelectTarget(e.target.value)} aria-label="Select target">
            {targets.map((t) => (<option key={t.instanceId} value={t.instanceId}>{t.name}</option>))}
          </select>
        </div>
      )}
      {targets.length > 0 ? (
        <InjuryResolutionPanel attacker={{ st: currentActor.st ?? 10, name: currentActor.name }} target={resolvedTarget as any} combatRulesPreset={combatRulesPreset} damageExpression={boundDamageExpression || ''} injectedDamageModifiers={damageModifiers} initialLocation={boundHitLocation as any} initialLocationRoll={boundHitLocationRoll as any} onComplete={onComplete} onCancel={onCancel} />
      ) : (
        <div className="text-fg-muted text-sm">No valid targets available</div>
      )}
    </div>
  );
}
