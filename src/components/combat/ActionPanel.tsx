import { useState, useEffect, ChangeEvent } from 'react';
import {
  Swords,
  Shield,
  Zap,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Droplet,
  Activity,
} from 'lucide-react';
import AttackAssist from './AttackAssist';
import DefenseAssist from './DefenseAssist';
import InjuryResolutionPanel from './InjuryResolutionPanel';
import ConditionsPanel from './ConditionsPanel';
import ManeuverWorkflowWidgets from './ManeuverWorkflowWidgets';
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
} from '../../types/combatTracker';

// Local types for attack/defense data flow within the ActionPanel
interface HitLocation {
  key: string;
  label: string;
}

interface LocationRoll {
  dice: number[];
  total: number;
}

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

type WorkflowType =
  | 'attack'
  | 'defense'
  | 'damage'
  | 'note'
  | 'conditions'
  | 'items'
  | null;

interface ActionPanelProps {
  currentActor: Participant;
  participants: Participant[];
  combatState?: unknown;
  revealState?: unknown;
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
  onAddCondition?: (condition: any) => void;
  onRemoveCondition?: (conditionInstanceId: string) => void;
  onUpdateCondition?: (
    conditionInstanceId: string,
    newDuration: ConditionDuration,
  ) => void;
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
    return (
      <div className="bg-gray-800 rounded-lg p-3">
        <button onClick={onToggleExpanded} className="flex items-center justify-between w-full text-left" aria-label="Expand Action Panel">
          <span className="font-semibold">Action Panel</span>
          <ChevronDown size={20} />
        </button>
      </div>
    );
  }

  // ---- Render ----
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Action Panel</h3>
        {onToggleExpanded && (
          <button onClick={onToggleExpanded} className="text-gray-400 hover:text-white" aria-label="Collapse Action Panel">
            <ChevronUp size={20} />
          </button>
        )}
      </div>

      {/* Maneuver-specific aim/wait widgets */}
      {!activeWorkflow && (maneuverPrompts?.allowsAimPanel || maneuverPrompts?.allowsWaitPanel) && (
        <ManeuverWorkflowWidgets
          maneuverPrompts={maneuverPrompts}
          turnDecision={turnDecision}
          targets={targets}
          onManeuverWorkflow={onManeuverWorkflow}
        />
      )}

      {/* Action type selection grid */}
      {!activeWorkflow && (
        <div>
          <label className="block text-sm font-semibold mb-2">Choose Action</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setActiveWorkflow('attack')} className="flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 rounded" disabled={!maneuverPrompts?.allowsAttackPanel} aria-label="Start attack workflow">
              <Swords size={20} /> Attack
            </button>
            <button onClick={() => setActiveWorkflow('defense')} className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded" disabled={!maneuverPrompts?.allowsDefensePanel} aria-label="Start defense workflow">
              <Shield size={20} /> Defense
            </button>
            <button onClick={() => setActiveWorkflow('damage')} className="flex items-center justify-center gap-2 p-3 bg-orange-600 hover:bg-orange-700 rounded" aria-label="Start damage workflow">
              <Zap size={20} /> Damage
            </button>
            <button onClick={() => setActiveWorkflow('note')} className="flex items-center justify-center gap-2 p-3 bg-gray-600 hover:bg-gray-500 rounded" aria-label="Add note">
              <MessageSquare size={20} /> Note
            </button>
            <button onClick={() => setActiveWorkflow('items')} className="flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 rounded" aria-label="Use item">
              <Droplet size={20} /> Items
            </button>
            <button onClick={() => setActiveWorkflow('conditions')} className="flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-700 rounded" aria-label="Manage conditions">
              <Activity size={20} /> Conditions
            </button>
          </div>
          {selectedManeuver && !maneuverPrompts?.allowsAttackPanel && !maneuverPrompts?.allowsDefensePanel && (
            <div className="text-xs text-gray-400 mt-2">This maneuver doesn&apos;t open attack or defense workflows.</div>
          )}
          {!selectedManeuver && (
            <div className="text-xs text-gray-400 mt-2">Select a maneuver above to enable relevant workflows.</div>
          )}
        </div>
      )}

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
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Injury Workflow</h4>
          {boundTarget && !forceTargetSelection && (
            <div className="mb-3 bg-gray-700/40 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Target (from attack)</div>
              <div className="text-sm font-semibold">{getPublicDefenderLabel(combatState, revealState, boundTarget.instanceId)}</div>
              <button onClick={() => setForceTargetSelection(true)} className="mt-2 text-xs text-blue-300 hover:text-blue-200" type="button" aria-label="Change attack target">Change Target</button>
            </div>
          )}
          {(!boundTarget || forceTargetSelection) && (
            <div className="mb-3">
              <label className="block text-sm font-semibold mb-2">Target</label>
              <select className="w-full px-3 py-2 bg-gray-700 rounded" value={selectedTargetId || targets[0]?.instanceId || ''} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTargetId(e.target.value)} aria-label="Select target">
                {targets.map((t) => (<option key={t.instanceId} value={t.instanceId}>{t.name}</option>))}
              </select>
            </div>
          )}
          {targets.length > 0 ? (
            <InjuryResolutionPanel attacker={{ st: currentActor.st ?? 10, name: currentActor.name }} target={(boundTargetTruth || getTruthParticipant(selectedTargetId!) || truthTargets[0]) as any} combatRulesPreset={combatRulesPreset} damageExpression={boundDamageExpression || ''} injectedDamageModifiers={maneuverWorkflow?.damage?.modifiers || []} initialLocation={boundHitLocation as any} initialLocationRoll={boundHitLocationRoll as any} onComplete={handleDamageComplete} onCancel={() => setActiveWorkflow(null)} />
          ) : (
            <div className="text-gray-400 text-sm">No valid targets available</div>
          )}
        </div>
      )}

      {activeWorkflow === 'note' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Add Note</h4>
          <textarea value={noteText} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNoteText(e.target.value)} placeholder="Enter note or description..." className="w-full px-3 py-2 bg-gray-700 rounded h-24" aria-label="Note text" />
          <div className="flex gap-2 mt-3">
            <button onClick={() => setActiveWorkflow(null)} className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded" aria-label="Cancel note">Cancel</button>
            <button onClick={handleAddNote} disabled={!noteText.trim()} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Submit note">Add Note</button>
          </div>
        </div>
      )}

      {activeWorkflow === 'conditions' && onAddCondition && onRemoveCondition && (
        <div className="border-t border-gray-700 pt-4">
          <ConditionsPanel participant={{ ...currentActor, id: currentActor.instanceId }} currentRound={currentRound} currentTurn={currentTurn} onAddCondition={onAddCondition} onRemoveCondition={onRemoveCondition} />
          <button onClick={() => setActiveWorkflow(null)} className="w-full mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded" aria-label="Close conditions panel">Close</button>
        </div>
      )}

      {activeWorkflow === 'items' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Use Item</h4>
          <div className="text-gray-400 text-sm mb-4">Item system coming soon...</div>
          <button onClick={() => setActiveWorkflow(null)} className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded" aria-label="Close items panel">Close</button>
        </div>
      )}
    </div>
  );
}
