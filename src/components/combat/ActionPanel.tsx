import { useState, useEffect, ChangeEvent } from 'react';
import { Swords, Shield, Zap, MessageSquare, ChevronDown, ChevronUp, Droplet, Activity } from 'lucide-react';
import AttackAssist from './AttackAssist';
import DefenseAssist from './DefenseAssist';
import InjuryResolutionPanel from './InjuryResolutionPanel';
import ConditionsPanel from './ConditionsPanel';
import { getPublicDefenderLabel } from '../../utils/combatViewSelectors';
import { ViewMode } from '../../utils/combatViewFilter';

interface Modifier {
  label: string;
  value: number;
}

interface HitLocation {
  key: string;
  label: string;
}

interface LocationRoll {
  dice: number[];
  total: number;
}

interface Attack {
  name: string;
  skill: number;
  damage?: string;
  hitLocation?: HitLocation | null;
  hitLocationRoll?: LocationRoll | null;
  success?: boolean;
}

interface Defense {
  type: string;
  baseDefense: number;
  effectiveDefense: number;
  success?: boolean | null;
}

interface Participant {
  instanceId: string;
  id?: string;  // Alias for instanceId (some components use 'id')
  name: string;
  category: string;
  currentHP?: number;
  hp?: number;
  st?: number;  // Strength attribute for damage calculations
  isDead?: boolean;
  isUnconscious?: boolean;
  isStunned?: boolean;
  defenses?: {
    dodge?: number | { mode: string; value?: number };
    parry?: number | { mode: string; value?: number };
    block?: number | { mode: string; value?: number };
  };
  dodge?: number | { mode: string; value?: number };
  parry?: number | { mode: string; value?: number };
  block?: number | { mode: string; value?: number };
  conditions?: ConditionInstance[];
}

interface ConditionInstance {
  instanceId: string;
  conditionId: string;
  label: string;
  duration?: { type: string; value?: number };
  source?: string;
}

interface ManeuverPrompts {
  allowsAttackPanel?: boolean;
  allowsDefensePanel?: boolean;
  allowsAimPanel?: boolean;
  allowsWaitPanel?: boolean;
}

interface ManeuverWorkflow {
  attack?: { modifiers: Modifier[] };
  defense?: { modifiers: Modifier[] };
  damage?: { modifiers: Modifier[] };
}

interface ManeuverSelection {
  selectedId: string | null;
  prompts: ManeuverPrompts;
  workflow: ManeuverWorkflow;
}

interface TurnDecision {
  aim?: { targetInstanceId?: string; turnsAimed?: number };
  wait?: { triggerText?: string };
}

// AttackData from AttackAssist (different from local Attack interface)
interface AttackData {
  name: string;
  baseSkill: number;
  modifiers: Modifier[];
  injectedModifiers: Modifier[];
  effectiveSkill: number;
  rollTotal: number | null;
  margin: number | null;
  success: boolean | null;
  damage?: string;
  notes?: string;
  hitLocation: HitLocation | null;
  hitLocationRoll: LocationRoll | null;
}

interface DefenseData {
  defense?: Defense;
}

interface InjuryData {
  targetInstanceId?: string;
  newHP?: number;
}

interface ActionData {
  maneuver: string | null;
  kind: 'attack' | 'defense' | 'injury' | 'note';
  attack?: Attack;
  defense?: Defense;
  injury?: InjuryData;
  note?: string;
  targetInstanceId?: string | null;
  newHP?: number;
}

type WorkflowType = 'attack' | 'defense' | 'damage' | 'note' | 'conditions' | 'items' | null;

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
  onManeuverWorkflow?: (update: { type: string; targetInstanceId?: string; turnsAimed?: number; triggerText?: string }) => void;
  turnDecision?: TurnDecision | null;
  currentRound?: number;
  currentTurn?: number;
  // Note: ConditionInstance type differs between ActionPanel and ConditionsPanel
  // ActionPanel uses duration: { type, value }, ConditionsPanel uses expiresAt
  onAddCondition?: (condition: any) => void;
  onRemoveCondition?: (conditionInstanceId: string) => void;
  onUpdateCondition?: (conditionInstanceId: string, newDuration: { type: string; value?: number }) => void;
}

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
  const truthParticipants = (combatState as { participants?: Participant[] })?.participants || participants;
  const getTruthParticipant = (instanceId: string) => truthParticipants.find(p => p.instanceId === instanceId);
  const boundTargetTruth = boundTargetId ? getTruthParticipant(boundTargetId) : null;
  const truthTargets = targets.map(target => getTruthParticipant(target.instanceId)).filter(Boolean) as Participant[];

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
    return (
      <div className="bg-gray-800 rounded-lg p-3">
        <button
          onClick={onToggleExpanded}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="font-semibold">Action Panel</span>
          <ChevronDown size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Action Panel</h3>
        {onToggleExpanded && (
          <button onClick={onToggleExpanded} className="text-gray-400 hover:text-white">
            <ChevronUp size={20} />
          </button>
        )}
      </div>

      {/* Maneuver-specific Widgets (if not in active workflow) */}
      {!activeWorkflow && (maneuverPrompts?.allowsAimPanel || maneuverPrompts?.allowsWaitPanel) && (
        <div className="space-y-4">
          {maneuverPrompts?.allowsAimPanel && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold">Aim Tracking</h5>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Target</label>
                <select
                  value={turnDecision?.aim?.targetInstanceId || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => onManeuverWorkflow?.({
                    type: 'aim',
                    targetInstanceId: e.target.value || undefined
                  })}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                >
                  <option value="">No target</option>
                  {targets.map((target) => (
                    <option key={target.instanceId} value={target.instanceId}>
                      {target.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Turns Aimed</label>
                <input
                  type="number"
                  min={0}
                  value={turnDecision?.aim?.turnsAimed ?? 0}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onManeuverWorkflow?.({
                    type: 'aim',
                    turnsAimed: parseInt(e.target.value, 10) || 0
                  })}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
            </div>
          )}
          {maneuverPrompts?.allowsWaitPanel && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold">Wait Trigger</h5>
              <input
                type="text"
                value={turnDecision?.wait?.triggerText || ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onManeuverWorkflow?.({
                  type: 'wait',
                  triggerText: e.target.value
                })}
                placeholder="Describe the trigger condition"
                className="w-full px-3 py-2 bg-gray-700 rounded"
              />
            </div>
          )}
        </div>
      )}

      {/* Action Type Selection (if not in active workflow) */}
      {!activeWorkflow && (
        <div>
          <label className="block text-sm font-semibold mb-2">Choose Action</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleStartWorkflow('attack')}
              className="flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 rounded"
              disabled={!maneuverPrompts?.allowsAttackPanel}
            >
              <Swords size={20} />
              Attack
            </button>
            <button
              onClick={() => handleStartWorkflow('defense')}
              className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded"
              disabled={!maneuverPrompts?.allowsDefensePanel}
            >
              <Shield size={20} />
              Defense
            </button>
            <button
              onClick={() => handleStartWorkflow('damage')}
              className="flex items-center justify-center gap-2 p-3 bg-orange-600 hover:bg-orange-700 rounded"
            >
              <Zap size={20} />
              Damage
            </button>
            <button
              onClick={() => handleStartWorkflow('note')}
              className="flex items-center justify-center gap-2 p-3 bg-gray-600 hover:bg-gray-500 rounded"
            >
              <MessageSquare size={20} />
              Note
            </button>
            <button
              onClick={() => handleStartWorkflow('items')}
              className="flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 rounded"
            >
              <Droplet size={20} />
              Items
            </button>
            <button
              onClick={() => handleStartWorkflow('conditions')}
              className="flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-700 rounded"
            >
              <Activity size={20} />
              Conditions
            </button>
          </div>
          {selectedManeuver && !maneuverPrompts?.allowsAttackPanel && !maneuverPrompts?.allowsDefensePanel && (
            <div className="text-xs text-gray-400 mt-2">
              This maneuver doesn&apos;t open attack or defense workflows. Use notes or other panels as needed.
            </div>
          )}
          {!selectedManeuver && (
            <div className="text-xs text-gray-400 mt-2">
              Select a maneuver above to enable relevant workflows.
            </div>
          )}
        </div>
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
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Injury Workflow (Phase 4)</h4>
          {(boundTarget && !forceTargetSelection) && (
            <div className="mb-3 bg-gray-700/40 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Target (from attack)</div>
              <div className="text-sm font-semibold">
                {getPublicDefenderLabel(combatState, revealState, boundTarget.instanceId)}
              </div>
              <button
                onClick={() => setForceTargetSelection(true)}
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
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTargetId(e.target.value)}
              >
                {targets.map((target) => (
                  <option key={target.instanceId} value={target.instanceId}>
                    {target.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {targets.length > 0 && (
            <InjuryResolutionPanel
              attacker={{ st: currentActor.st ?? 10, name: currentActor.name }}
              target={(boundTargetTruth || getTruthParticipant(selectedTargetId!) || truthTargets[0]) as any}
              combatRulesPreset={combatRulesPreset}
              damageExpression={boundDamageExpression || ''}
              injectedDamageModifiers={maneuverWorkflow?.damage?.modifiers || []}
              initialLocation={boundHitLocation}
              initialLocationRoll={boundHitLocationRoll}
              onComplete={handleDamageComplete}
              onCancel={handleCancelWorkflow}
            />
          )}
          {targets.length === 0 && (
            <div className="text-gray-400 text-sm">No valid targets available</div>
          )}
        </div>
      )}

      {activeWorkflow === 'note' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Add Note</h4>
          <div className="space-y-3">
            <textarea
              value={noteText}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNoteText(e.target.value)}
              placeholder="Enter note or description..."
              className="w-full px-3 py-2 bg-gray-700 rounded h-24"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCancelWorkflow}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 6: Conditions Workflow */}
      {activeWorkflow === 'conditions' && onAddCondition && onRemoveCondition && (
        <div className="border-t border-gray-700 pt-4">
          <ConditionsPanel
            participant={{ ...currentActor, id: currentActor.instanceId }}
            currentRound={currentRound}
            currentTurn={currentTurn}
            onAddCondition={onAddCondition}
            onRemoveCondition={onRemoveCondition}
            onUpdateCondition={onUpdateCondition ? (id: string, dur: number) => onUpdateCondition(id, { type: 'rounds', value: dur }) : undefined}
          />
          <div className="mt-4">
            <button
              onClick={handleCancelWorkflow}
              className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Phase 6: Items Workflow (placeholder) */}
      {activeWorkflow === 'items' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Use Item (Phase 6)</h4>
          <div className="text-gray-400 text-sm mb-4">
            Item system coming soon...
          </div>
          <button
            onClick={handleCancelWorkflow}
            className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
