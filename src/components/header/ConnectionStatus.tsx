/**
 * ConnectionStatus — header button showing multiplayer connection state.
 * Clicking opens the ConnectionDialog.
 */

import { useState } from 'react';
import { Globe, Wifi } from 'lucide-react';
import { useSyncContext } from '../../net/SyncProvider';
import { ConnectionDialog } from '../ConnectionDialog';

export function ConnectionStatus() {
  const { status, playerCount } = useSyncContext();
  const [dialogOpen, setDialogOpen] = useState(false);

  const isConnected = status === 'connected';

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
          isConnected
            ? 'border-success-500/60 bg-success-500/10 text-success-300 hover:bg-success-500/20'
            : 'border-edge-strong bg-surface-1 text-fg-muted hover:border-edge-bright hover:text-fg-secondary'
        }`}
        title={isConnected ? `Connected (${playerCount} players)` : 'Multiplayer — click to connect'}
      >
        {isConnected ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : (
          <Globe className="h-3.5 w-3.5" />
        )}
        {isConnected && (
          <span className="tabular-nums">{playerCount}</span>
        )}
      </button>

      <ConnectionDialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
