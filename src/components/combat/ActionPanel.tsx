import { useState, useEffect } from 'react';
import AttackAssist from './AttackAssist';
import DefenseAssist from './DefenseAssist';
import ActionPanelCollapsedView from './action-panel/ActionPanelCollapsedView';
import ActionPanelHeader from './action-panel/ActionPanelHeader';
import ActionPanelDamageWorkflow from './action-panel/ActionPanelDamageWorkflow';
import ActionPanelConditionsWorkflow from './action-panel/ActionPanelConditionsWorkflow';
import ActionPanelItemsWorkflow from './action-panel/ActionPanelItemsWorkflow';
import ActionPanelManeuverPrompts from './action-panel/ActionPanelManeuverPrompts';
import ActionPanelNoteWorkflow from './action-panel/ActionPanelNoteWorkflow';
import ActionPanelWorkflowSelector from './action-panel/ActionPanelWorkflowSelector';
import { getPublicDefenderLabel } from '../../utils/combatViewSelectors';
import { ViewMode } from '../../utils/combatViewFilter';
import type {
  ActionPanelParticipant,
  ActionPanelProps,
  Attack,
  AttackData,
  DefenseData,
  HitLocation,
  InjuryData,
  LocationRoll,
  WorkflowType,
} from '../../types/actionPanel';

/**
 * ActionPanel Component - Phase 3, 4 & 6
 * Main action interface for the active combatant
 * Provides workflows for Attack, Defense, Damage (Injury), Notes, Items, and Conditions
 */
export default function ActionPanel({
  currentActor,
  participants,
  combatState,
  revealState,
  viewMode = ViewMode.GM,
  onActionComplete,
  combatRulesPreset = 'standard',
  expanded = true,
  onToggleExpanded,
  maneuverSelection = null,
  onManeuverWorkflow,
  turnDecision = null,
  // Phase 6: Condition management handlers
  currentRound = 0,
  currentTurn = 0,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition
}: ActionPanelProps) {
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowType>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [boundTargetId, setBoundTargetId] = useState<string | null>(null);
  const [boundHitLocation, setBoundHitLocation] = useState<HitLocation | null>(null);
  const [boundHitLocationRoll, setBoundHitLocationRoll] = useState<LocationRoll | null>(null);
  const [boundDamageExpression, setBoundDamageExpression] = useState<string | null>(null);
  const [forceTargetSelection, setForceTargetSelection] = useState(false);
  const selectedManeuver = maneuverSelection?.selectedId || null;
  const maneuverPrompts = maneuverSelection?.prompts;
  const maneuverWorkflow = maneuverSelection?.workflow;

  // Get potential targets (exclude current actor)
  const targets = participants.filter(p => p.instanceId !== currentActor.instanceId);
  const boundTarget = targets.find(target => target.instanceId === boundTargetId) || null;
  const truthParticipants = (combatState as { participants?: ActionPanelParticipant[] })?.participants || participants;
  const getTruthParticipant = (instanceId: string) => truthParticipants.find(p => p.instanceId === instanceId);
  const boundTargetTruth = boundTargetId ? getTruthParticipant(boundTargetId) : null;
  const truthTargets = targets.map(target => getTruthParticipant(target.instanceId)).filter(Boolean) as ActionPanelParticipant[];
  const resolvedDamageTarget =
    boundTargetTruth ||
    (selectedTargetId ? getTruthParticipant(selectedTargetId) : null) ||
    truthTargets[0] ||
    null;

  const handleStartWorkflow = (workflow: WorkflowType) => {
    setActiveWorkflow(workflow);
    // Initialize target selection for damage workflow
    if (workflow === 'damage' && targets.length > 0) {
      setSelectedTargetId(boundTargetId || targets[0].instanceId);
    }
  };

  const handleCancelWorkflow = () => {
    setActiveWorkflow(null);
  };

  const canTargetDefend = (targetId: string | null): boolean => {
    if (!targetId) return false;
    const truthTarget = getTruthParticipant(targetId);
    if (!truthTarget) return false;
    if (truthTarget.isDead || truthTarget.isUnconscious || truthTarget.isStunned) return false;
    const defenseValues = [
      truthTarget.defenses?.dodge ?? truthTarget.dodge,
      truthTarget.defenses?.parry ?? truthTarget.parry,
      truthTarget.defenses?.block ?? truthTarget.block
    ];
    return defenseValues.some(value => value !== null && value !== undefined);
  };

  const handleAttackComplete = (data: { targetInstanceId: string | null; attack: AttackData }) => {
    const { targetInstanceId, attack } = data;
    setBoundTargetId(targetInstanceId || null);
    setBoundHitLocation(attack?.hitLocation || null);
    setBoundHitLocationRoll(attack?.hitLocationRoll || null);
    setBoundDamageExpression(attack?.damage || null);
    setForceTargetSelection(false);
    if (targetInstanceId) {
      setSelectedTargetId(targetInstanceId);
    }

    // Map the AttackAssist's AttackData format to ActionPanel's Attack format
    const attackForAction: Attack | undefined = attack ? {
      name: attack.name,
      skill: attack.baseSkill,
      damage: attack.damage,
      hitLocation: attack.hitLocation,
      hitLocationRoll: attack.hitLocationRoll,
      success: attack.success ?? undefined
    } : undefined;

    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'attack',
      attack: attackForAction,
      targetInstanceId
    });

    const attackHit = attack?.success === true;
    const canDefend = targetInstanceId && canTargetDefend(targetInstanceId);

    if (attackHit && canDefend) {
      setActiveWorkflow('defense');
      return;
    }

    if (attackHit) {
      setActiveWorkflow('damage');
      return;
    }

    setActiveWorkflow(null);
  };

  const handleDefenseComplete = (defenseData: DefenseData) => {
    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'defense',
      defense: defenseData.defense,
      targetInstanceId: boundTarget?.instanceId || null
    });

    if (defenseData.defense?.success === false) {
      setActiveWorkflow('damage');
      return;
    }

    setActiveWorkflow(null);
  };

  const handleDamageComplete = (injuryData: InjuryData) => {
    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'injury',
      injury: injuryData,
      targetInstanceId: injuryData.targetInstanceId || boundTargetId || targets[0]?.instanceId,
      newHP: injuryData.newHP
    });

    // Reset
    setActiveWorkflow(null);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;

    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'note',
      note: noteText
    });

    // Reset
    setNoteText('');
    setActiveWorkflow(null);
  };

  useEffect(() => {
    setBoundTargetId(null);
    setBoundHitLocation(null);
    setBoundHitLocationRoll(null);
    setBoundDamageExpression(null);
    setForceTargetSelection(false);

    if (!selectedManeuver) {
      setActiveWorkflow(null);
      return;
    }

    if (maneuverPrompts?.allowsAttackPanel) {
      setActiveWorkflow('attack');
      return;
    }

    if (maneuverPrompts?.allowsDefensePanel) {
      setActiveWorkflow('defense');
      return;
    }

    setActiveWorkflow(null);
  }, [selectedManeuver, maneuverPrompts]);

  if (!expanded) {
    return <ActionPanelCollapsedView onToggleExpanded={onToggleExpanded} />;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <ActionPanelHeader onToggleExpanded={onToggleExpanded} />

      {/* Maneuver-specific Widgets (if not in active workflow) */}
      {!activeWorkflow && (maneuverPrompts?.allowsAimPanel || maneuverPrompts?.allowsWaitPanel) && (
        <ActionPanelManeuverPrompts
          prompts={maneuverPrompts}
          targets={targets}
          turnDecision={turnDecision}
          onManeuverWorkflow={onManeuverWorkflow}
        />
      )}

      {/* Action Type Selection (if not in active workflow) */}
      {!activeWorkflow && (
        <ActionPanelWorkflowSelector
          selectedManeuver={selectedManeuver}
          maneuverPrompts={maneuverPrompts}
          onStartWorkflow={handleStartWorkflow}
        />
      )}

      {/* Active Workflow */}
      {activeWorkflow === 'attack' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Attack Workflow</h4>
          <AttackAssist
            actor={currentActor}
            targets={targets}
            injectedModifiers={maneuverWorkflow?.attack?.modifiers || []}
            onComplete={handleAttackComplete}
            onCancel={handleCancelWorkflow}
          />
        </div>
      )}

      {activeWorkflow === 'defense' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Defense Workflow</h4>
          <div className="mb-3 text-sm text-gray-300">
            Defender:{' '}
            <span className="font-semibold">
              {getPublicDefenderLabel(
                combatState,
                revealState,
                boundTarget?.instanceId || currentActor.instanceId
              )}
            </span>
          </div>
          <DefenseAssist
            defender={boundTarget || currentActor}
            defenderId={boundTarget?.instanceId || currentActor.instanceId}
            combatState={combatState}
            revealState={revealState}
            viewMode={viewMode}
            injectedModifiers={maneuverWorkflow?.defense?.modifiers || []}
            onComplete={handleDefenseComplete}
            onCancel={handleCancelWorkflow}
          />
        </div>
      )}

      {activeWorkflow === 'damage' && (
        <ActionPanelDamageWorkflow
          currentActor={currentActor}
          targets={targets}
          selectedTargetId={selectedTargetId}
          boundTarget={boundTarget}
          resolvedTarget={resolvedDamageTarget}
          combatState={combatState}
          revealState={revealState}
          combatRulesPreset={combatRulesPreset}
          maneuverWorkflow={maneuverWorkflow}
          boundDamageExpression={boundDamageExpression}
          boundHitLocation={boundHitLocation}
          boundHitLocationRoll={boundHitLocationRoll}
          forceTargetSelection={forceTargetSelection}
          onSelectTarget={setSelectedTargetId}
          onForceTargetSelection={() => setForceTargetSelection(true)}
          onComplete={handleDamageComplete}
          onCancel={handleCancelWorkflow}
        />
      )}

      {activeWorkflow === 'note' && (
        <ActionPanelNoteWorkflow
          noteText={noteText}
          onNoteTextChange={setNoteText}
          onAddNote={handleAddNote}
          onCancel={handleCancelWorkflow}
        />
      )}

      {/* Phase 6: Conditions Workflow */}
      {activeWorkflow === 'conditions' && onAddCondition && onRemoveCondition && (
        <ActionPanelConditionsWorkflow
          currentActor={currentActor}
          currentRound={currentRound}
          currentTurn={currentTurn}
          onAddCondition={onAddCondition}
          onRemoveCondition={onRemoveCondition}
          onUpdateCondition={onUpdateCondition}
          onCancel={handleCancelWorkflow}
        />
      )}

      {/* Phase 6: Items Workflow (placeholder) */}
      {activeWorkflow === 'items' && (
        <ActionPanelItemsWorkflow onCancel={handleCancelWorkflow} />
      )}
    </div>
  );
}
