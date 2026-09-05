import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ConnectionDialog } from '../../components/ConnectionDialog';
import { SyncProvider } from '../SyncProvider';
import { connectionManager } from '../ConnectionManager';
import * as assetSync from '../assetSync';
import { standaloneToast } from '../../components/ui/Toast';
import { useCampaignStore } from '../../state/campaignStore';
import { imageLayer, imageState } from '../../assets/__tests__/fixtures';
import { serializeCampaignState } from '../../persistence/campaignStorage';
import { Role } from '../../../shared/session';
import type { CampaignState } from '../../state/campaignReducer';
import type { SessionInfo } from '../../../shared/session';
import type { AssetSyncProgress } from '../assetSync';

vi.mock('../../state/campaignStore', () => ({ useCampaignStore: vi.fn() }));
vi.mock('../../components/PlayerAssignmentPanel', () => ({ PlayerAssignmentPanel: () => null }));

const session: SessionInfo = { sessionId: 'session', campaignId: 'campaign', joinCode: 'ABC123', role: Role.GM };
const assetId = 'a'.repeat(64);
let state: CampaignState;
let importState: Mock<(state: CampaignState, label?: string) => void>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  state = imageState([imageLayer({ assetId, src: undefined })]).state;
  importState = vi.fn<(state: CampaignState, label?: string) => void>();
  // Only the state and import action are consumed by this dialog.
  vi.mocked(useCampaignStore, { partial: true, deep: true }).mockReturnValue({ state, actions: { importCampaignState: importState } });
  vi.spyOn(connectionManager, 'status', 'get').mockReturnValue('offline');
  vi.spyOn(connectionManager, 'role', 'get').mockReturnValue(null);
  vi.spyOn(connectionManager, 'sessionInfo', 'get').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('asset sync wire-in', () => {
  it('keeps host upload progress visible when the socket connects and warns without aborting hosting', async () => {
    const pending = deferred<AssetSyncProgress>();
    vi.spyOn(connectionManager, 'hostGame').mockResolvedValue(session);
    const push = vi.spyOn(assetSync, 'pushReferencedAssets').mockImplementation(async (_state, opts) => {
      opts?.onProgress?.({ total: 12, done: 3, failed: [] });
      return pending.promise;
    });
    const disconnect = vi.spyOn(connectionManager, 'disconnect');
    const status = vi.spyOn(connectionManager, 'onStatusChange');
    render(<SyncProvider><ConnectionDialog isOpen onClose={vi.fn()} /></SyncProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    await screen.findByText('Uploading map images 3/12…');
    expect(push.mock.calls[0][0]).toBe(state);
    expect(connectionManager.hostGame).toHaveBeenCalledOnce();
    vi.spyOn(connectionManager, 'role', 'get').mockReturnValue(Role.GM);
    vi.spyOn(connectionManager, 'sessionInfo', 'get').mockReturnValue(session);
    act(() => status.mock.calls[0][0]('connected'));
    expect(screen.getByText('Uploading map images 3/12…')).toBeInTheDocument();
    await act(async () => pending.resolve({ total: 12, done: 12, failed: [assetId] }));
    expect(screen.getByText('1 map images could not be uploaded. Hosting can continue.')).toBeInTheDocument();
    expect(screen.queryByText('Uploading map images 3/12…')).not.toBeInTheDocument();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('hydrates joined JSON, awaits the asset pull, then dispatches and closes despite missing images', async () => {
    const pending = deferred<AssetSyncProgress>();
    vi.spyOn(connectionManager, 'joinGame').mockResolvedValue({ sessionInfo: { ...session, role: Role.Player }, stateJson: JSON.stringify({ maps: serializeCampaignState(state).maps }) });
    const pull = vi.spyOn(assetSync, 'pullMissingAssets').mockImplementation(async (_state, opts) => {
      opts?.onProgress?.({ total: 1, done: 0, failed: [] });
      return pending.promise;
    });
    const warning = vi.spyOn(standaloneToast, 'warning').mockImplementation(() => {});
    const close = vi.fn();
    render(<SyncProvider><ConnectionDialog isOpen onClose={close} /></SyncProvider>);
    fireEvent.click(screen.getByRole('tab', { name: 'Join Game' }));
    fireEvent.change(screen.getByLabelText('Join Code'), { target: { value: 'ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
    await screen.findByText('Downloading map images 0/1…');
    expect(pull.mock.calls[0][0].entities).toBeDefined();
    expect(pull.mock.calls[0][0].maps.mapsById).toEqual(state.maps.mapsById);
    expect(importState).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ total: 1, done: 1, failed: [assetId] }));
    expect(importState).toHaveBeenCalledExactlyOnceWith(pull.mock.calls[0][0]);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('1 map images'));
    expect(close).toHaveBeenCalledOnce();
  });

  it('hydrates server updates once and hands off the same state after pulling assets', async () => {
    const pending = deferred<AssetSyncProgress>();
    vi.spyOn(connectionManager, 'campaignId', 'get').mockReturnValue('campaign');
    vi.spyOn(connectionManager, 'fetchState').mockResolvedValue({ state: JSON.stringify({ maps: serializeCampaignState(state).maps }), version: 2 });
    const listener = vi.spyOn(connectionManager, 'onStateUpdated');
    const pull = vi.spyOn(assetSync, 'pullMissingAssets').mockReturnValue(pending.promise);
    const handOver = vi.fn();
    render(<SyncProvider onServerStateUpdate={handOver}><span>Session</span></SyncProvider>);
    act(() => { void listener.mock.calls[0][0]({ version: 2, updatedAt: '2026-09-05' }); });
    await waitFor(() => expect(pull).toHaveBeenCalledOnce());
    expect(pull.mock.calls[0][0].entities).toBeDefined();
    expect(handOver).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ total: 1, done: 1, failed: [] }));
    expect(handOver).toHaveBeenCalledExactlyOnceWith(pull.mock.calls[0][0]);
  });
});
