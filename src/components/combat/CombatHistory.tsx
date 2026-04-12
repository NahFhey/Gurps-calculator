import { useState } from 'react';
import { History, Download, Trash2, Eye, EyeOff } from 'lucide-react';
import { useCombatStore } from '../../hooks/useCombatStore';
import { exportCombatLog } from '../../utils/combatHelpers';
import { ConfirmDialog, useConfirmDialog } from '../ui';
import type { CombatSession } from '../../types/campaign';

/**
 * Combat History Component
 * View past combat sessions with logs
 */
export default function CombatHistory() {
  const { combatHistory, saveCombatHistory } = useCombatStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const deleteDialog = useConfirmDialog({
    title: 'Delete Combat History',
    message: 'Are you sure you want to delete this combat history entry? This cannot be undone.',
    confirmLabel: 'Delete',
    variant: 'danger',
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleExport = (combat: CombatSession) => {
    const text = exportCombatLog(combat.log as any, {
      name: combat.name,
      date: Date.now()
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-log-${combat.name}-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await deleteDialog.confirm();
    if (confirmed) {
      saveCombatHistory(combatHistory.filter((c: CombatSession) => c.id !== id));
    }
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
        {combatHistory.map((combat: CombatSession) => (
          <div key={combat.id} className="bg-gray-800 rounded-lg overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700"
              onClick={() => toggleExpand(combat.id as string)}
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{combat.name}</h3>
                <div className="text-sm text-gray-400 flex gap-4 mt-1">
                  <span>{combat.currentRound} rounds</span>
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
                      {combat.participants.map((p, idx) => (
                        <div key={idx} className="text-sm bg-gray-700 rounded p-2">
                          <div className="font-semibold">{p.characterId}</div>
                          <div className="text-gray-400">
                            {p.team} | Final HP: {p.currentHP}
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
                          {entry.action}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog {...deleteDialog.dialogProps} />
    </div>
  );
}
