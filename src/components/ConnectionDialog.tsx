/**
 * ConnectionDialog — modal for hosting or joining a multiplayer game.
 */

import { useState } from 'react';
import { Copy, Check, Wifi, WifiOff } from 'lucide-react';
import { useSyncContext } from '../net/SyncProvider';
import { useCampaignStore } from '../state/campaignStore';
import { PlayerAssignmentPanel } from './PlayerAssignmentPanel';
import { Role } from '../../shared/session';
import { serializeCampaignState } from '../persistence/campaignStorage';
import { hydrateCampaignState } from '../persistence/campaignStorage';
import type { CampaignState } from '../state/campaignReducer';
import { Modal } from './ui/Modal';
import { standaloneToast } from './ui/Toast';
import { pullMissingAssets, pushReferencedAssets } from '../net/assetSync';

interface ConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectionDialog({ isOpen, onClose }: ConnectionDialogProps) {
  const { status, sessionInfo, hostGame, joinGame, disconnect } = useSyncContext();
  const { state, actions } = useCampaignStore();

  const [tab, setTab] = useState<'host' | 'join'>('host');
  const [campaignName, setCampaignName] = useState('My Campaign');
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('Player');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [assetProgress, setAssetProgress] = useState<string | null>(null);
  const [assetWarning, setAssetWarning] = useState<string | null>(null);

  const campaignNameId = 'connection-dialog-campaign-name';
  const displayNameId = 'connection-dialog-display-name';
  const joinCodeId = 'connection-dialog-join-code';

  if (!isOpen) return null;

  const handleHost = async () => {
    setError(null);
    setAssetWarning(null);
    setLoading(true);
    try {
      const stateJson = JSON.stringify(serializeCampaignState(state as CampaignState));
      await hostGame(campaignName, stateJson);
      const progress = await pushReferencedAssets(state, {
        onProgress: ({ done, total }) => setAssetProgress(`Uploading map images ${done}/${total}…`),
      });
      if (progress.failed.length > 0) {
        setAssetWarning(`${progress.failed.length} map images could not be uploaded. Hosting can continue.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to host game');
    } finally {
      setAssetProgress(null);
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    setAssetWarning(null);
    setLoading(true);
    try {
      const stateJson = await joinGame(joinCode, displayName);
      // Parse and hydrate the server state, then replace local state
      const parsed = JSON.parse(stateJson);
      const hydrated = hydrateCampaignState(parsed as CampaignState);
      const progress = await pullMissingAssets(hydrated, {
        onProgress: ({ done, total }) => setAssetProgress(`Downloading map images ${done}/${total}…`),
      });
      actions.importCampaignState(hydrated);
      if (progress.failed.length > 0) {
        standaloneToast.warning(`${progress.failed.length} map images could not be downloaded. You have joined the game.`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setAssetProgress(null);
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setError(null);
    setAssetWarning(null);
  };

  const handleCopyCode = () => {
    if (sessionInfo?.joinCode) {
      navigator.clipboard.writeText(sessionInfo.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const assetFeedback = (
    <>
      {assetProgress && <p role="status" className="mt-3 text-xs text-fg-secondary">{assetProgress}</p>}
      {assetWarning && <p role="status" className="mt-3 text-xs text-warning-400">{assetWarning}</p>}
    </>
  );

  // Connected view
  if (status === 'connected' && sessionInfo) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={(
          <span className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-success-400" aria-hidden="true" />
              Connected
          </span>
        )}
        size="md"
        className="rounded-xl border-edge-strong"
      >
          <div className="space-y-3 text-sm text-fg-secondary">
            <div className="flex justify-between">
              <span>Role:</span>
              <span className="font-medium text-fg-bright">{sessionInfo.role.toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Join Code:</span>
              <div className="flex items-center gap-2">
                <code className="bg-surface-0 px-3 py-1 rounded text-lg font-mono tracking-widest text-accent-300">
                  {sessionInfo.joinCode}
                </code>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded hover:bg-surface-2 text-fg-muted"
                  title="Copy join code"
                  aria-label={copied ? 'Join code copied' : 'Copy join code'}
                >
                  {copied
                    ? <Check className="h-4 w-4 text-success-400" aria-hidden="true" />
                    : <Copy className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>

          {assetFeedback}

          {/* Player Assignment (GM only) */}
          {sessionInfo.role === Role.GM && <PlayerAssignmentPanel />}

          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="mt-6 w-full py-2 rounded-lg bg-danger-600/80 hover:bg-danger-600 text-white text-sm font-medium transition-colors"
          >
            Disconnect
          </button>
      </Modal>
    );
  }

  // Host/Join view
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={(
        <span className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-fg-muted" aria-hidden="true" />
            Multiplayer
        </span>
      )}
      size="md"
      className="rounded-xl border-edge-strong"
    >
        {/* Tabs */}
        <div role="tablist" aria-label="Multiplayer mode" className="flex gap-1 mb-4 bg-surface-0 rounded-lg p-1">
          <button
            role="tab"
            aria-selected={tab === 'host'}
            onClick={() => { setTab('host'); setError(null); }}
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'host' ? 'bg-accent-600 text-white' : 'text-fg-muted hover:text-fg-primary'
            }`}
          >
            Host Game
          </button>
          <button
            role="tab"
            aria-selected={tab === 'join'}
            onClick={() => { setTab('join'); setError(null); }}
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'join' ? 'bg-accent-600 text-white' : 'text-fg-muted hover:text-fg-primary'
            }`}
          >
            Join Game
          </button>
        </div>

        {tab === 'host' ? (
          <div className="space-y-3">
            <div>
              <label htmlFor={campaignNameId} className="block text-xs text-fg-muted mb-1">Campaign Name</label>
              <input
                id={campaignNameId}
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full bg-surface-0 border border-edge-strong rounded-lg px-3 py-2 text-sm text-fg-bright focus:outline-none focus:border-accent-500"
                placeholder="My Campaign"
              />
            </div>
            <p className="text-xs text-fg-faint">
              Your current campaign state will be uploaded to the server.
              Players will connect using the generated join code.
            </p>
            <button
              onClick={handleHost}
              disabled={loading || !campaignName.trim()}
              className="w-full py-2 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-surface-3 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {loading ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor={displayNameId} className="block text-xs text-fg-muted mb-1">Your Name</label>
              <input
                id={displayNameId}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-surface-0 border border-edge-strong rounded-lg px-3 py-2 text-sm text-fg-bright focus:outline-none focus:border-accent-500"
                placeholder="Player name"
              />
            </div>
            <div>
              <label htmlFor={joinCodeId} className="block text-xs text-fg-muted mb-1">Join Code</label>
              <input
                id={joinCodeId}
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full bg-surface-0 border border-edge-strong rounded-lg px-3 py-2 text-sm text-fg-bright font-mono tracking-widest text-center text-lg focus:outline-none focus:border-accent-500"
                placeholder="ABC123"
                maxLength={6}
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={loading || !joinCode.trim() || !displayName.trim()}
              className="w-full py-2 rounded-lg bg-success-600 hover:bg-success-500 disabled:bg-surface-3 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {loading ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        )}

        {assetFeedback}
        {error && (
          <div role="alert" className="mt-3 p-2 rounded-lg bg-danger-900/40 border border-danger-600/40 text-xs text-danger-300">
            {error}
          </div>
        )}
    </Modal>
  );
}
