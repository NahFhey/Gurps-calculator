/**
 * Store-level checkpoint restore (TB3): the store decodes the snapshot before
 * dispatching, and a refused restore is reported, not applied.
 */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { CampaignStoreProvider, useCampaignStore } from '../campaignStore';
import { campaignReducer, createCampaignState, type CampaignState } from '../campaignReducer';
import { standaloneToast } from '../../components/ui/Toast';
import { logger } from '../../utils/logger';

vi.mock('../../persistence/campaignStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../persistence/campaignStorage')>()),
  saveCampaignState: vi.fn(() => Promise.resolve()),
  whenCampaignSavesSettled: vi.fn(() => Promise.resolve()),
}));

let current: ReturnType<typeof useCampaignStore> | null = null;

function Probe() {
  const store = useCampaignStore();
  useEffect(() => {
    current = store;
  });
  return null;
}

function renderWithCheckpoint(editSnapshot: (snapshot: { meta: { schemaVersion?: string }; time: { day: number } }) => void) {
  let state: CampaignState = createCampaignState();
  state.time.day = 3;
  state = campaignReducer(state, { type: 'createCheckpoint', payload: 'Day 3' });
  state = { ...state, time: { ...state.time, day: 9 } };
  const entry = state.checkpoints.entries[0];
  const snapshot = JSON.parse(JSON.stringify(entry.snapshot));
  editSnapshot(snapshot);
  state = { ...state, checkpoints: { ...state.checkpoints, entries: [{ ...entry, snapshot }] } };
  render(
    <CampaignStoreProvider initialCampaignState={state}>
      <Probe />
    </CampaignStoreProvider>
  );
  return entry.id;
}

afterEach(() => {
  current = null;
  vi.restoreAllMocks();
});

describe('store restoreCheckpoint', () => {
  it('restores a readable checkpoint', () => {
    const id = renderWithCheckpoint(() => {});
    act(() => current!.actions.restoreCheckpoint(id));
    expect(current!.state.time.day).toBe(3);
    expect(current!.state.logs.entries.some((entry) => entry.type === 'campaign.rollback')).toBe(true);
  });

  it('refuses a checkpoint from a newer version: toast and log, state unchanged', () => {
    const toast = vi.spyOn(standaloneToast, 'error').mockImplementation(() => {});
    const log = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const id = renderWithCheckpoint((snapshot) => { snapshot.meta.schemaVersion = '1.99.0'; });
    const before = current!.state;
    act(() => current!.actions.restoreCheckpoint(id));
    expect(current!.state).toBe(before);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('newer version of the app'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('newer version of the app'));
  });
});
