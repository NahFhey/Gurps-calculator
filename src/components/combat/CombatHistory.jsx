import React, { useState } from 'react';
import { History, Download, Trash2, Eye, EyeOff } from 'lucide-react';
import { useCombat } from '../../contexts/CombatContext';
import { exportCombatLog } from '../../utils/combatHelpers';

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

/**
 * Combat History Component
 * View past combat sessions with logs
 */
export default function CombatHistory() {
  const { combatHistory, saveCombatHistory } = useCombat();
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleExport = (combat) => {
    const text = exportCombatLog(combat.log, {
      name: combat.name,
      date: combat.startTime
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-log-${combat.name}-${combat.startTime}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this combat history entry?')) return;
    saveCombatHistory(combatHistory.filter(c => c.id !== id));
  };

  const formatDuration = (startTime, endTime) => {
    const duration = endTime - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  if (combatHistory.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        <History size={48} className="mx-auto mb-4 opacity-50" />
        <p>No combat history yet.</p>
        <p className="text-sm mt-2">Completed combats will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Combat History</h2>
        <p className="text-gray-400">{combatHistory.length} / 50 entries</p>
      </div>

      <div className="space-y-2">
        {combatHistory.map((combat) => (
          <div key={combat.id} className="bg-gray-800 rounded-lg overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700"
              onClick={() => toggleExpand(combat.id)}
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{combat.name}</h3>
                <div className="text-sm text-gray-400 flex gap-4 mt-1">
                  <span>{new Date(combat.startTime).toLocaleString()}</span>
                  <span>{combat.currentRound} rounds</span>
                  <span>{formatDuration(combat.startTime, combat.endTime)}</span>
                  <span>{combat.participants.length} participants</span>
                </div>
              </div>

              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleExpand(combat.id)}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                  title={expandedId === combat.id ? 'Collapse' : 'Expand'}
                >
                  {expandedId === combat.id ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => handleExport(combat)}
                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded"
                  title="Export log"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => handleDelete(combat.id)}
                  className="p-2 bg-red-600 hover:bg-red-700 rounded"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedId === combat.id && (
              <div className="border-t border-gray-700 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Participants */}
                  <div>
                    <h4 className="font-semibold mb-2">Participants</h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {combat.participants.map((p) => (
                        <div key={p.id} className="text-sm bg-gray-700 rounded p-2">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-gray-400">
                            {p.category} | Final HP: {p.currentHP}/{p.hp}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Combat Log */}
                  <div>
                    <h4 className="font-semibold mb-2">Combat Log</h4>
                    <div className="bg-gray-900 rounded p-3 max-h-64 overflow-y-auto font-mono text-xs">
                      {combat.log.map((entry, index) => (
                        <div key={index} className="mb-1">
                          {formatLogEntry(entry)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
