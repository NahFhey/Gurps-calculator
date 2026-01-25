import React, { useState } from 'react';
import { Swords, Shield, Zap, MessageSquare, ChevronDown, ChevronUp, Droplet, Activity } from 'lucide-react';
import AttackAssist from './AttackAssist';
import DefenseAssist from './DefenseAssist';
import InjuryResolutionPanel from './InjuryResolutionPanel';
import ConditionsPanel from './ConditionsPanel';

/**
 * ActionPanel Component - Phase 3, 4 & 6
 * Main action interface for the active combatant
 * Provides workflows for Attack, Defense, Damage (Injury), Notes, Items, and Conditions
 */
export default function ActionPanel({
  currentActor,
  participants,
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
}) {
  const [activeWorkflow, setActiveWorkflow] = useState(null); // 'attack', 'defense', 'damage', 'note', 'conditions', 'items', or null
  const [noteText, setNoteText] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const selectedManeuver = maneuverSelection?.selectedId || null;
  const maneuverPrompts = maneuverSelection?.prompts || {};

  // Get potential targets (exclude current actor)
  const targets = participants.filter(p => p.instanceId !== currentActor.instanceId);

  const handleStartWorkflow = (workflow) => {
    setActiveWorkflow(workflow);
    // Initialize target selection for damage workflow
    if (workflow === 'damage' && targets.length > 0) {
      setSelectedTargetId(targets[0].instanceId);
    }
  };

  const handleCancelWorkflow = () => {
    setActiveWorkflow(null);
  };

  const handleAttackComplete = (attackData) => {
    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'attack',
      attack: attackData.attack,
      targetInstanceId: attackData.targetInstanceId
    });

    // Reset
    setActiveWorkflow(null);
  };

  const handleDefenseComplete = (defenseData) => {
    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'defense',
      defense: defenseData.defense
    });

    // Reset
    setActiveWorkflow(null);
  };

  const handleDamageComplete = (injuryData) => {
    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'injury',
      injury: injuryData,
      targetInstanceId: injuryData.targetInstanceId || targets[0]?.instanceId,
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
                  onChange={(e) => onManeuverWorkflow?.({
                    type: 'aim',
                    targetInstanceId: e.target.value || null
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
                  onChange={(e) => onManeuverWorkflow?.({
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
                onChange={(e) => onManeuverWorkflow?.({
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
            onComplete={handleAttackComplete}
            onCancel={handleCancelWorkflow}
          />
        </div>
      )}

      {activeWorkflow === 'defense' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Defense Workflow</h4>
          <DefenseAssist
            defender={currentActor}
            onComplete={handleDefenseComplete}
            onCancel={handleCancelWorkflow}
          />
        </div>
      )}

      {activeWorkflow === 'damage' && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-lg font-semibold mb-3">Injury Workflow (Phase 4)</h4>
          <div className="mb-3">
            <label className="block text-sm font-semibold mb-2">Target</label>
            <select
              className="w-full px-3 py-2 bg-gray-700 rounded"
              value={selectedTargetId || targets[0]?.instanceId || ''}
              onChange={(e) => setSelectedTargetId(e.target.value)}
            >
              {targets.map((target) => (
                <option key={target.instanceId} value={target.instanceId}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>
          {targets.length > 0 && (
            <InjuryResolutionPanel
              attacker={currentActor}
              target={targets.find(t => t.instanceId === selectedTargetId) || targets[0]}
              combatRulesPreset={combatRulesPreset}
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
              onChange={(e) => setNoteText(e.target.value)}
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
      {activeWorkflow === 'conditions' && (
        <div className="border-t border-gray-700 pt-4">
          <ConditionsPanel
            participant={currentActor}
            currentRound={currentRound}
            currentTurn={currentTurn}
            onAddCondition={onAddCondition}
            onRemoveCondition={onRemoveCondition}
            onUpdateCondition={onUpdateCondition}
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
