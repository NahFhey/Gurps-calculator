import { useState } from 'react';
import { History, Download, Trash2, Eye, EyeOff } from 'lucide-react';
import { useCombatStore } from '../../hooks/useCombatStore';
import { exportCombatLog } from '../../utils/combatHelpers';
import { ConfirmDialog, useConfirmDialog } from '../ui';
import type { CombatState, Participant } from '../../types/combatTracker';

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

  /** Final HP as archived: currentHP when tracked, else the hp field. */
  const finalHP = (p: Participant): number | string => {
    if (typeof p.currentHP === 'number') return p.currentHP;
    if (typeof p.hp === 'number') return p.hp;
    return p.hp.current ?? '—';
  };

  const handleExport = (combat: CombatState) => {
    const text = exportCombatLog(combat.log, {
      name: combat.name,
      date: combat.endTime ?? combat.startTime
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
      saveCombatHistory(combatHistory.filter((c) => c.id !== id));
    }
  };

  if (combatHistory.length === 0) {
    return (
      <div className="text-center text-fg-muted py-8">
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
        <p className="text-fg-muted">{combatHistory.length} / 50 entries</p>
      </div>

      <div className="space-y-2">
        {combatHistory.map((combat) => (
          <div key={combat.id} className="bg-surface-1 rounded-lg overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-2"
              onClick={() => toggleExpand(combat.id)}
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{combat.name}</h3>
                <div className="text-sm text-fg-muted flex gap-4 mt-1">
                  <span>{combat.currentRound} rounds</span>
                  <span>{combat.participants.length} participants</span>
                </div>
              </div>

              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleExpand(combat.id)}
                  className="p-2 bg-surface-2 hover:bg-surface-3 rounded"
                  title={expandedId === combat.id ? 'Collapse' : 'Expand'}
                >
                  {expandedId === combat.id ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => handleExport(combat)}
                  className="p-2 bg-accent-600 hover:bg-accent-700 rounded"
                  title="Export log"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => handleDelete(combat.id)}
                  className="p-2 bg-danger-600 hover:bg-danger-700 rounded"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedId === combat.id && (
              <div className="border-t border-edge p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Participants */}
                  <div>
                    <h4 className="font-semibold mb-2">Participants</h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {combat.participants.map((p, idx) => (
                        <div key={p.instanceId || idx} className="text-sm bg-surface-2 rounded p-2">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-fg-muted">
                            {p.category} | Final HP: {finalHP(p)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Combat Log */}
                  <div>
                    <h4 className="font-semibold mb-2">Combat Log</h4>
                    <div className="bg-surface-0 rounded p-3 max-h-64 overflow-y-auto font-mono text-xs">
                      {combat.log.map((entry, index) => (
                        <div key={entry.id || index} className="mb-1">
                          {entry.text ?? entry.message ?? ''}
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
