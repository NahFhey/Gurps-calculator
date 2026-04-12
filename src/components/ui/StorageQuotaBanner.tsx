/**
 * StorageQuotaBanner — persistent banner shown when localStorage quota is exceeded.
 *
 * Listens for the 'storage-quota-exceeded' custom event dispatched by the storage
 * layer and offers one-click cleanup actions (prune checkpoints, logs, combat history).
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Trash2, HardDrive } from 'lucide-react';
import { getStorageBreakdown, resetQuotaAlert } from '../../utils/storage';
import { useCampaignStore } from '../../state/campaignStore';

export function StorageQuotaBanner() {
  const [visible, setVisible] = useState(false);
  const [breakdown, setBreakdown] = useState<{ key: string; sizeKB: number }[]>([]);
  const { state } = useCampaignStore();

  // Listen for the custom event from the storage layer
  useEffect(() => {
    const handler = () => {
      setBreakdown(getStorageBreakdown());
      setVisible(true);
    };
    window.addEventListener('storage-quota-exceeded', handler);
    return () => window.removeEventListener('storage-quota-exceeded', handler);
  }, []);

  const totalKB = breakdown.reduce((sum, e) => sum + e.sizeKB, 0);
  const totalMB = (totalKB / 1024).toFixed(1);

  const handlePruneCheckpoints = useCallback(() => {
    // TODO: Implement clearCheckpoints action
    console.log('TODO: clear checkpoints');
    setBreakdown(getStorageBreakdown());
    resetQuotaAlert();
  }, []);

  const handlePruneLogs = useCallback(() => {
    // TODO: Implement clearLogs action
    console.log('TODO: clear logs');
    setBreakdown(getStorageBreakdown());
    resetQuotaAlert();
  }, []);

  const handlePruneCombatHistory = useCallback(() => {
    // TODO: Implement clearCombatHistory action
    console.log('TODO: clear combat history');
    setBreakdown(getStorageBreakdown());
    resetQuotaAlert();
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    resetQuotaAlert();
  }, []);

  if (!visible) return null;

  const checkpointCount = state.checkpoints.entries.length;
  const logCount = state.logs.entries.length;
  const combatHistoryCount = state.entities.combatHistory.length;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex justify-center p-3 pointer-events-none">
      <div className="bg-red-950/95 border border-red-500/60 rounded-xl shadow-2xl p-4 max-w-lg w-full pointer-events-auto backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-red-100">Storage Full</h3>
            <p className="text-xs text-red-300 mt-0.5">
              Your browser storage is full ({totalMB} MB used). Changes can't be saved until you free space.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-red-800/50 text-red-400 hover:text-red-200 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Storage breakdown (top 3 keys) */}
        {breakdown.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-red-400">
            <HardDrive className="h-3 w-3" />
            {breakdown.slice(0, 3).map((entry) => (
              <span key={entry.key} className="bg-red-900/50 px-1.5 py-0.5 rounded">
                {entry.key}: {entry.sizeKB > 1024 ? `${(entry.sizeKB / 1024).toFixed(1)} MB` : `${Math.round(entry.sizeKB)} KB`}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {checkpointCount > 0 && (
            <button
              onClick={handlePruneCheckpoints}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-800/60 hover:bg-red-700/60 text-red-100 border border-red-600/40 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear checkpoints ({checkpointCount})
            </button>
          )}
          {logCount > 0 && (
            <button
              onClick={handlePruneLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-800/60 hover:bg-red-700/60 text-red-100 border border-red-600/40 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear logs ({logCount})
            </button>
          )}
          {combatHistoryCount > 0 && (
            <button
              onClick={handlePruneCombatHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-800/60 hover:bg-red-700/60 text-red-100 border border-red-600/40 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear combat history ({combatHistoryCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
