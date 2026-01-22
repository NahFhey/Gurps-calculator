import React, { useState } from 'react';
import { Swords, Shield, Zap, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import AttackAssist from './AttackAssist';
import DefenseAssist from './DefenseAssist';
import DamageAssist from './DamageAssist';

/**
 * ActionPanel Component - Phase 3
 * Main action interface for the active combatant
 * Provides workflows for Attack, Defense, Damage, and Notes
 */
export default function ActionPanel({
  currentActor,
  participants,
  onActionComplete,
  expanded = true,
  onToggleExpanded
}) {
  const [selectedManeuver, setSelectedManeuver] = useState(null);
  const [activeWorkflow, setActiveWorkflow] = useState(null); // 'attack', 'defense', 'damage', 'note', or null
  const [noteText, setNoteText] = useState('');

  // Common maneuvers
  const MANEUVERS = [
    'Attack',
    'All-Out Attack',
    'All-Out Defense',
    'Move',
    'Aim',
    'Feint',
    'Evaluate',
    'Ready',
    'Concentrate',
    'Do Nothing',
    'Custom'
  ];

  // Get potential targets (exclude current actor)
  const targets = participants.filter(p => p.instanceId !== currentActor.instanceId);

  const handleStartWorkflow = (workflow) => {
    setActiveWorkflow(workflow);
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
    setSelectedManeuver(null);
  };

  const handleDefenseComplete = (defenseData) => {
    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'defense',
      defense: defenseData.defense
    });

    // Reset
    setActiveWorkflow(null);
    setSelectedManeuver(null);
  };

  const handleDamageComplete = (damageData) => {
    onActionComplete({
      maneuver: selectedManeuver,
      kind: 'damage',
      damage: damageData.damage,
      targetInstanceId: damageData.targetInstanceId,
      newHP: damageData.newHP
    });

    // Reset
    setActiveWorkflow(null);
    setSelectedManeuver(null);
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
    setSelectedManeuver(null);
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

      {/* Maneuver Selection (if not in active workflow) */}
      {!activeWorkflow && (
        <div>
          <label className="block text-sm font-semibold mb-2">1. Choose Maneuver (optional)</label>
          <select
            value={selectedManeuver || ''}
            onChange={(e) => setSelectedManeuver(e.target.value || null)}
            className="w-full px-3 py-2 bg-gray-700 rounded"
          >
            <option value="">No maneuver selected</option>
            {MANEUVERS.map((maneuver) => (
              <option key={maneuver} value={maneuver}>
                {maneuver}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-400 mt-1">
            Phase 3 does not enforce maneuver legality; this is for logging only
          </div>
        </div>
      )}

      {/* Action Type Selection (if not in active workflow) */}
      {!activeWorkflow && (
        <div>
          <label className="block text-sm font-semibold mb-2">2. Choose Action</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleStartWorkflow('attack')}
              className="flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 rounded"
            >
              <Swords size={20} />
              Attack
            </button>
            <button
              onClick={() => handleStartWorkflow('defense')}
              className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded"
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
          </div>
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
          <h4 className="text-lg font-semibold mb-3">Damage Workflow</h4>
          <div className="mb-3">
            <label className="block text-sm font-semibold mb-2">Target</label>
            <select
              className="w-full px-3 py-2 bg-gray-700 rounded"
              id="damage-target-select"
            >
              {targets.map((target) => (
                <option key={target.instanceId} value={target.instanceId}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>
          {targets.length > 0 && (
            <DamageAssist
              attacker={currentActor}
              target={targets.find(t => t.instanceId === document.getElementById('damage-target-select')?.value) || targets[0]}
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
    </div>
  );
}
