import { useState, useEffect } from 'react';
import type { CombatState, RevealState } from '../../types/combatTracker';
import AttackAssist from './AttackAssist';
import DefenseAssist from './DefenseAssist';
import ActionPanelHeader from './action-panel/ActionPanelHeader';
import ActionPanelCollapsedView from './action-panel/ActionPanelCollapsedView';
import ActionPanelDamageWorkflow from './action-panel/ActionPanelDamageWorkflow';
import ActionPanelConditionsWorkflow from './action-panel/ActionPanelConditionsWorkflow';
import ActionPanelNoteWorkflow from './action-panel/ActionPanelNoteWorkflow';
import ActionPanelItemsWorkflow from './action-panel/ActionPanelItemsWorkflow';
import ActionPanelWorkflowSelector from './action-panel/ActionPanelWorkflowSelector';
import ActionPanelManeuverPrompts from './action-panel/ActionPanelManeuverPrompts';
import { getPublicDefenderLabel } from '../../utils/combatViewSelectors';
import { ViewMode } from '../../utils/combatViewFilter';
import { hasCondition } from '../../utils/conditionsEngine';
import { ConditionId } from '../../constants/conditions';
import type {
  Participant,
  ManeuverPrompts,
  ManeuverWorkflow,
  ManeuverSelection,
  TurnDecision,
  ConditionDuration,
  ConditionInstance,
} from '../../types/combatTracker';
import type {
  HitLocation,
  LocationRoll,
  WorkflowType,
} from './action-panel/types';

interface AttackData {
  name: string;
  baseSkill: number;
  modifiers: Array<{ label: string; value: number }>;
  injectedModifiers: Array<{ label: string; value: number }>;
  effectiveSkill: number;
  rollTotal: number | null;
  margin: number | null;
  success: boolean | null;
  damage?: string;
  notes?: string;
  hitLocation: HitLocation | null;
  hitLocationRoll: LocationRoll | null;
}

interface ActionData {
  maneuver: string | null;
  kind: 'attack' | 'defense' | 'injury' | 'note';
  attack?: {
    name: string;
    skill: number;
    damage?: string;
    hitLocation?: HitLocation | null;
    hitLocationRoll?: LocationRoll | null;
    success?: boolean;
  };
  defense?: {
    type: string;
    baseDefense: number;
    effectiveDefense: number;
    success?: boolean | null;
  };
  injury?: { targetInstanceId?: string; newHP?: number };
  note?: string;
  targetInstanceId?: string | null;
  newHP?: number;
}

interface ActionPanelProps {
  currentActor: Participant;
  participants: Participant[];
  combatState?: CombatState | null;
  revealState?: RevealState | null;
  viewMode?: string;
  onActionComplete: (data: ActionData) => void;
  combatRulesPreset?: string;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  maneuverSelection?: ManeuverSelection | null;
  onManeuverWorkflow?: (update: {
    type: string;
    targetInstanceId?: string;
    turnsAimed?: number;
    triggerText?: string;
  }) => void;
  turnDecision?: TurnDecision | null;
  currentRound?: number;
  currentTurn?: number;
  onAddCondition?: (condition: ConditionInstance) => void;
  onRemoveCondition?: (conditionInstanceId: string) => void;
  onUpdateCondition?: (
    conditionInstanceId: string,
    newDuration: ConditionDuration,
  ) => void;
  onCycleRevealed?: (conditionInstanceId: string) => void;
}

/**
 * ActionPanel — Phase 11a (decomposed).
 * Main action interface for the active combatant.
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
  currentRound = 0,
  currentTurn = 0,
  onAddCondition,
  onRemoveCondition,
  // onUpdateCondition is not used in this component
  onCycleRevealed,
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
  const maneuverPrompts = (maneuverSelection?.prompts || {}) as ManeuverPrompts;
  const maneuverWorkflow = (maneuverSelection?.workflow || {}) as ManeuverWorkflow;

  const targets = participants.filter((p) => p.instanceId !== currentActor.instanceId);
  const boundTarget = targets.find((t) => t.instanceId === boundTargetId) || null;
  const truthParticipants = (combatState as { participants?: Participant[] })?.participants || participants;
  const getTruthParticipant = (id: string) => truthParticipants.find((p) => p.instanceId === id);
  const boundTargetTruth = boundTargetId ? getTruthParticipant(boundTargetId) : null;
  const truthTargets = targets.map((t) => getTruthParticipant(t.instanceId)).filter(Boolean) as Participant[];

  // ---- Workflow handlers ----

  const canTargetDefend = (targetId: string | null): boolean => {
    if (!targetId) return false;
    const t = getTruthParticipant(targetId);
    if (!t || t.isDead || hasCondition(t, ConditionId.UNCONSCIOUS) || hasCondition(t, ConditionId.STUNNED)) return false;
    const vals = [t.defenses?.dodge ?? t.dodge, t.defenses?.parry ?? t.parry, t.defenses?.block ?? t.block];
    return vals.some((v) => v !== null && v !== undefined);
  };

  const handleAttackComplete = (data: { targetInstanceId: string | null; attack: AttackData }) => {
    const { targetInstanceId, attack } = data;
    setBoundTargetId(targetInstanceId || null);
    setBoundHitLocation(attack?.hitLocation || null);
    setBoundHitLocationRoll(attack?.hitLocationRoll || null);
    setBoundDamageExpression(attack?.damage || null);
    setForceTargetSelection(false);
    if (targetInstanceId) setSelectedTargetId(targetInstanceId);

    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'attack',
      attack: attack
        ? { name: attack.name, skill: attack.baseSkill, damage: attack.damage, hitLocation: attack.hitLocation, hitLocationRoll: attack.hitLocationRoll, success: attack.success ?? undefined }
        : undefined,
      targetInstanceId,
    });

    const attackHit = attack?.success === true;
    if (attackHit && targetInstanceId && canTargetDefend(targetInstanceId)) { setActiveWorkflow('defense'); return; }
    if (attackHit) { setActiveWorkflow('damage'); return; }
    setActiveWorkflow(null);
  };

  const handleDefenseComplete = (defenseData: { defense?: ActionData['defense'] }) => {
    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'defense',
      defense: defenseData.defense,
      targetInstanceId: boundTarget?.instanceId || null,
    });
    if (defenseData.defense?.success === false) { setActiveWorkflow('damage'); return; }
    setActiveWorkflow(null);
  };

  const handleDamageComplete = (injuryData: { targetInstanceId?: string; newHP?: number }) => {
    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'injury',
      injury: injuryData,
      targetInstanceId: injuryData.targetInstanceId || boundTargetId || targets[0]?.instanceId,
      newHP: injuryData.newHP,
    });
    setActiveWorkflow(null);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    onActionComplete({ maneuver: selectedManeuver, kind: 'note', note: noteText });
    setNoteText('');
    setActiveWorkflow(null);
  };

  // Reset bound state when maneuver changes
  useEffect(() => {
    setBoundTargetId(null);
    setBoundHitLocation(null);
    setBoundHitLocationRoll(null);
    setBoundDamageExpression(null);
    setForceTargetSelection(false);
    if (!selectedManeuver) { setActiveWorkflow(null); return; }
    if (maneuverPrompts?.allowsAttackPanel) { setActiveWorkflow('attack'); return; }
    if (maneuverPrompts?.allowsDefensePanel) { setActiveWorkflow('defense'); return; }
    setActiveWorkflow(null);
  }, [selectedManeuver, maneuverPrompts]);

  // ---- Collapsed state ----
  if (!expanded) {
    return <ActionPanelCollapsedView onToggleExpanded={onToggleExpanded} />;
  }

  // ---- Render ----
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <ActionPanelHeader onToggleExpanded={onToggleExpanded} />

      {/* Maneuver-specific aim/wait widgets */}
      {!activeWorkflow && <ActionPanelManeuverPrompts maneuverPrompts={maneuverPrompts} turnDecision={turnDecision} targets={targets} onManeuverWorkflow={onManeuverWorkflow} />}

      {/* Action type selection grid */}
      {!activeWorkflow && <ActionPanelWorkflowSelector selectedManeuver={selectedManeuver} allowsAttackPanel={maneuverPrompts?.allowsAttackPanel} allowsDefensePanel={maneuverPrompts?.allowsDefensePanel} onSelectWorkflow={setActiveWorkflow} />}

      {/* Active workflows */}
      {activeWorkflow === 'attack' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Attack Workflow</h4>
          <AttackAssist actor={currentActor} targets={targets} injectedModifiers={maneuverWorkflow?.attack?.modifiers || []} onComplete={handleAttackComplete} onCancel={() => setActiveWorkflow(null)} />
        </div>
      )}

      {activeWorkflow === 'defense' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Defense Workflow</h4>
          <div className="mb-3 text-sm text-gray-300">
            Defender: <span className="font-semibold">{getPublicDefenderLabel(combatState, revealState, boundTarget?.instanceId || currentActor.instanceId)}</span>
          </div>
          <DefenseAssist defender={boundTarget || currentActor} defenderId={boundTarget?.instanceId || currentActor.instanceId} combatState={combatState} revealState={revealState} viewMode={viewMode} injectedModifiers={maneuverWorkflow?.defense?.modifiers || []} onComplete={handleDefenseComplete} onCancel={() => setActiveWorkflow(null)} />
        </div>
      )}

      {activeWorkflow === 'damage' && (
        <ActionPanelDamageWorkflow
          currentActor={currentActor}
          targets={targets}
          selectedTargetId={selectedTargetId}
          boundTarget={boundTarget}
          resolvedTarget={(boundTargetTruth || getTruthParticipant(selectedTargetId!) || truthTargets[0]) ?? null}
          combatState={combatState}
          revealState={revealState}
          combatRulesPreset={combatRulesPreset}
          damageModifiers={maneuverWorkflow?.damage?.modifiers || []}
          boundDamageExpression={boundDamageExpression}
          boundHitLocation={boundHitLocation}
          boundHitLocationRoll={boundHitLocationRoll}
          forceTargetSelection={forceTargetSelection}
          onSelectTarget={setSelectedTargetId}
          onForceTargetSelection={() => setForceTargetSelection(true)}
          onComplete={handleDamageComplete}
          onCancel={() => setActiveWorkflow(null)}
        />
      )}

      {activeWorkflow === 'note' && (
        <ActionPanelNoteWorkflow
          noteText={noteText}
          onNoteTextChange={setNoteText}
          onSubmit={handleAddNote}
          onCancel={() => setActiveWorkflow(null)}
        />
      )}

      {activeWorkflow === 'conditions' && onAddCondition && onRemoveCondition && (
        <ActionPanelConditionsWorkflow
          currentActor={currentActor}
          currentRound={currentRound}
          currentTurn={currentTurn}
          onAddCondition={onAddCondition}
          onRemoveCondition={onRemoveCondition}
          onCycleRevealed={viewMode === ViewMode.GM ? onCycleRevealed : undefined}
          onClose={() => setActiveWorkflow(null)}
        />
      )}

      {activeWorkflow === 'items' && (
        <ActionPanelItemsWorkflow onClose={() => setActiveWorkflow(null)} />
      )}
    </div>
  );
}
