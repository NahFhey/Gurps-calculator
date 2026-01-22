import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Download, Plus, SkipForward } from 'lucide-react';
import { useCombat } from '../../contexts/CombatContext';
import { calculateHPStatus, exportCombatLog } from '../../utils/combatHelpers';
import { MAX_COMBAT_HISTORY } from '../../constants';

/**
 * Combat Tracker Component
 * Active combat management with turn tracking, resource management, and logging
 */
export default function CombatTracker() {
  const {
    combatActive,
    saveCombatActive,
    combatHistory,
    saveCombatHistory
  } = useCombat();

  const [noteText, setNoteText] = useState('');
  const [editingResource, setEditingResource] = useState(null); // { participantId, resource, value }

  if (!combatActive) {
    return <div className="text-center text-gray-400 py-8">No active combat</div>;
  }

  const currentActorId = combatActive.turnOrder[combatActive.currentTurnIndex];
  const currentActor = combatActive.participants.find(p => p.id === currentActorId);

  // Add log entry
  const addLog = (entry) => {
    const newLog = [
      ...combatActive.log,
      {
        ...entry,
        timestamp: Date.now()
      }
    ];

    saveCombatActive({
      ...combatActive,
      log: newLog
    });
  };

  // Next turn
  const handleNextTurn = () => {
    const nextIndex = combatActive.currentTurnIndex + 1;
    const isNewRound = nextIndex >= combatActive.turnOrder.length;

    const newIndex = isNewRound ? 0 : nextIndex;
    const newRound = isNewRound ? combatActive.currentRound + 1 : combatActive.currentRound;

    const nextActorId = combatActive.turnOrder[newIndex];
    const nextActor = combatActive.participants.find(p => p.id === nextActorId);

    const newLog = [...combatActive.log];

    if (isNewRound) {
      newLog.push({
        type: 'round_change',
        timestamp: Date.now(),
        round: newRound
      });
    }

    newLog.push({
      type: 'turn_change',
      timestamp: Date.now(),
      actorId: nextActorId,
      actorName: nextActor?.name
    });

    saveCombatActive({
      ...combatActive,
      currentTurnIndex: newIndex,
      currentRound: newRound,
      log: newLog
    });
  };

  // Previous turn (navigation only, doesn't revert state)
  const handlePrevTurn = () => {
    const prevIndex = combatActive.currentTurnIndex - 1;
    const isPrevRound = prevIndex < 0;

    const newIndex = isPrevRound ? combatActive.turnOrder.length - 1 : prevIndex;
    const newRound = isPrevRound ? Math.max(1, combatActive.currentRound - 1) : combatActive.currentRound;

    saveCombatActive({
      ...combatActive,
      currentTurnIndex: newIndex,
      currentRound: newRound
    });
  };

  // Update participant resource (HP/FP/MP)
  const updateResource = (participantId, resource, newValue) => {
    const participant = combatActive.participants.find(p => p.id === participantId);
    if (!participant) return;

    const oldValue = participant[`current${resource}`];
    if (oldValue === newValue) return;

    const updatedParticipants = combatActive.participants.map(p =>
      p.id === participantId
        ? { ...p, [`current${resource}`]: newValue }
        : p
    );

    addLog({
      type: `${resource.toLowerCase()}_change`,
      actorId: participantId,
      actorName: participant.name,
      oldValue,
      newValue
    });

    saveCombatActive({
      ...combatActive,
      participants: updatedParticipants
    });
  };

  // Add manual note
  const handleAddNote = () => {
    if (!noteText.trim()) return;

    addLog({
      type: 'note',
      actorId: currentActorId,
      actorName: currentActor?.name,
      note: noteText
    });

    setNoteText('');
  };

  // End combat
  const handleEndCombat = () => {
    if (!confirm('End this combat session?')) return;

    const endedCombat = {
      ...combatActive,
      endTime: Date.now(),
      log: [
        ...combatActive.log,
        {
          type: 'combat_end',
          timestamp: Date.now()
        }
      ]
    };

    // Add to history (cap at MAX_COMBAT_HISTORY)
    const newHistory = [endedCombat, ...combatHistory].slice(0, MAX_COMBAT_HISTORY);
    saveCombatHistory(newHistory);

    // Clear active combat
    saveCombatActive(null);
  };

  // Export combat log
  const handleExportLog = () => {
    const text = exportCombatLog(combatActive.log, {
      name: combatActive.name,
      date: combatActive.startTime
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-log-${combatActive.name}-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{combatActive.name}</h2>
          <p className="text-gray-400">Round {combatActive.currentRound}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportLog}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            <Download size={16} />
            Export Log
          </button>
          <button
            onClick={handleEndCombat}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            <X size={16} />
            End Combat
          </button>
        </div>
      </div>

      {/* Current Turn */}
      <div className="bg-gradient-to-r from-blue-900 to-gray-800 rounded-lg p-4 border-2 border-blue-500">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">Current Turn</p>
            <h3 className="text-2xl font-bold">{currentActor?.name}</h3>
            <p className="text-sm text-gray-400">
              Speed: {currentActor?.basicSpeed} | Turn {combatActive.currentTurnIndex + 1} of {combatActive.turnOrder.length}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrevTurn}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded"
              title="Previous turn (navigation only)"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={handleNextTurn}
              className="p-3 bg-green-600 hover:bg-green-700 rounded"
              title="Next turn"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Participants */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Participants</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {combatActive.participants.map(p => (
              <ParticipantCard
                key={p.id}
                participant={p}
                isCurrent={p.id === currentActorId}
                onUpdateResource={updateResource}
              />
            ))}
          </div>
        </div>

        {/* Combat Log */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Combat Log</h3>
          <div className="bg-gray-800 rounded p-4 h-96 overflow-y-auto font-mono text-sm">
            {combatActive.log.map((entry, index) => (
              <div key={index} className="mb-1">
                {formatLogEntry(entry)}
              </div>
            ))}
          </div>

          {/* Add Note */}
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="Add a note..."
              className="flex-1 px-3 py-2 bg-gray-700 rounded"
            />
            <button
              onClick={handleAddNote}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Participant Card Component
 * Shows participant status with editable resources
 */
function ParticipantCard({ participant, isCurrent, onUpdateResource }) {
  const [editing, setEditing] = useState(null); // 'HP', 'FP', or 'MP'
  const [editValue, setEditValue] = useState('');

  const hpStatus = calculateHPStatus(participant.currentHP, participant.hp);

  const getHPStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'injured': return 'text-yellow-400';
      case 'critical': return 'text-orange-400';
      case 'dead': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const startEdit = (resource) => {
    setEditing(resource);
    setEditValue(participant[`current${resource}`].toString());
  };

  const saveEdit = () => {
    if (editing) {
      const newValue = parseInt(editValue) || 0;
      onUpdateResource(participant.id, editing, newValue);
      setEditing(null);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  return (
    <div className={`bg-gray-800 rounded p-3 ${isCurrent ? 'border-2 border-blue-500' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-semibold">{participant.name}</h4>
          <p className="text-xs text-gray-400">{participant.category}</p>
        </div>
        <span className={`text-xs font-semibold ${getHPStatusColor(hpStatus)}`}>
          {hpStatus.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        {/* HP */}
        <div>
          <div className="text-xs text-gray-400">HP</div>
          {editing === 'HP' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyPress={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="w-full px-1 py-0.5 bg-gray-600 rounded text-sm"
              autoFocus
            />
          ) : (
            <div
              onClick={() => startEdit('HP')}
              className="cursor-pointer hover:bg-gray-700 px-1 rounded"
            >
              {participant.currentHP}/{participant.hp}
            </div>
          )}
        </div>

        {/* FP */}
        <div>
          <div className="text-xs text-gray-400">FP</div>
          {editing === 'FP' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyPress={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="w-full px-1 py-0.5 bg-gray-600 rounded text-sm"
              autoFocus
            />
          ) : (
            <div
              onClick={() => startEdit('FP')}
              className="cursor-pointer hover:bg-gray-700 px-1 rounded"
            >
              {participant.currentFP}/{participant.fp}
            </div>
          )}
        </div>

        {/* MP */}
        {participant.mp > 0 && (
          <div>
            <div className="text-xs text-gray-400">MP</div>
            {editing === 'MP' ? (
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                className="w-full px-1 py-0.5 bg-gray-600 rounded text-sm"
                autoFocus
              />
            ) : (
              <div
                onClick={() => startEdit('MP')}
                className="cursor-pointer hover:bg-gray-700 px-1 rounded"
              >
                {participant.currentMP}/{participant.mp}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Format log entry for display
 */
function formatLogEntry(entry) {
  const time = new Date(entry.timestamp).toLocaleTimeString();

  switch (entry.type) {
    case 'combat_start':
      return `[${time}] ═══ Combat Started ═══`;
    case 'combat_end':
      return `[${time}] ═══ Combat Ended ═══`;
    case 'round_change':
      return `[${time}] ═══ Round ${entry.round} ═══`;
    case 'turn_change':
      return `[${time}] → ${entry.actorName}'s turn`;
    case 'hp_change':
      return `[${time}] ${entry.actorName}: HP ${entry.oldValue} → ${entry.newValue}`;
    case 'fp_change':
      return `[${time}] ${entry.actorName}: FP ${entry.oldValue} → ${entry.newValue}`;
    case 'mp_change':
      return `[${time}] ${entry.actorName}: MP ${entry.oldValue} → ${entry.newValue}`;
    case 'note':
      return `[${time}] ${entry.actorName ? entry.actorName + ': ' : ''}${entry.note}`;
    default:
      return `[${time}] ${entry.message || 'Unknown event'}`;
  }
}
