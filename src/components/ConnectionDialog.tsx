/**
 * ConnectionDialog — modal for hosting or joining a multiplayer game.
 */

import { useState } from 'react';
import { X, Copy, Check, Wifi, WifiOff } from 'lucide-react';
import { useSyncContext } from '../net/SyncProvider';
import { useCampaignStore } from '../state/campaignStore';
import { PlayerAssignmentPanel } from './PlayerAssignmentPanel';
import { Role } from '../../shared/session';
import { serializeCampaignState } from '../persistence/campaignStorage';
import { hydrateCampaignState } from '../persistence/campaignStorage';
import type { CampaignState } from '../state/campaignReducer';

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

  if (!isOpen) return null;

  const handleHost = async () => {
    setError(null);
    setLoading(true);
    try {
      const stateJson = JSON.stringify(serializeCampaignState(state as CampaignState));
      await hostGame(campaignName, stateJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to host game');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    setLoading(true);
    try {
      const stateJson = await joinGame(joinCode, displayName);
      // Parse and hydrate the server state, then replace local state
      const parsed = JSON.parse(stateJson);
      const hydrated = hydrateCampaignState(parsed as CampaignState);
      actions.importCampaignState(hydrated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setError(null);
  };

  const handleCopyCode = () => {
    if (sessionInfo?.joinCode) {
      navigator.clipboard.writeText(sessionInfo.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Connected view
  if (status === 'connected' && sessionInfo) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-gray-800 rounded-xl border border-gray-600 shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-400" />
              Connected
            </h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-700 text-gray-400">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex justify-between">
              <span>Role:</span>
              <span className="font-medium text-gray-100">{sessionInfo.role.toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Join Code:</span>
              <div className="flex items-center gap-2">
                <code className="bg-gray-900 px-3 py-1 rounded text-lg font-mono tracking-widest text-blue-300">
                  {sessionInfo.joinCode}
                </code>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded hover:bg-gray-700 text-gray-400"
                  title="Copy join code"
                >
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Player Assignment (GM only) */}
          {sessionInfo.role === Role.GM && <PlayerAssignmentPanel />}

          <button
            onClick={handleDisconnect}
            className="mt-6 w-full py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  // Host/Join view
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl border border-gray-600 shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-gray-400" />
            Multiplayer
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-700 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-900 rounded-lg p-1">
          <button
            onClick={() => { setTab('host'); setError(null); }}
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'host' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Host Game
          </button>
          <button
            onClick={() => { setTab('join'); setError(null); }}
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'join' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Join Game
          </button>
        </div>

        {tab === 'host' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Campaign Name</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                placeholder="My Campaign"
              />
            </div>
            <p className="text-xs text-gray-500">
              Your current campaign state will be uploaded to the server.
              Players will connect using the generated join code.
            </p>
            <button
              onClick={handleHost}
              disabled={loading || !campaignName.trim()}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {loading ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Your Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                placeholder="Player name"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Join Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono tracking-widest text-center text-lg focus:outline-none focus:border-blue-500"
                placeholder="ABC123"
                maxLength={6}
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={loading || !joinCode.trim() || !displayName.trim()}
              className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {loading ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 rounded-lg bg-red-900/40 border border-red-600/40 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
