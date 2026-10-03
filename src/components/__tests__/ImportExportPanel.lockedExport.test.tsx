/**
 * Locked export tells the GM what the player projection does not hide yet
 * (combat is deferred to typed boundaries; see docs/REFACTOR_HANDOFF.md).
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ImportExportPanel } from '../ImportExportPanel';
import { createCampaignState, type CampaignState } from '../../state/campaignReducer';
import type { CombatState } from '../../types/combatTracker';

vi.mock('../../utils/exportImport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/exportImport')>()),
  downloadJSON: vi.fn(),
}));

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

async function exportLockedFrom(state: CampaignState) {
  render(<ImportExportPanel state={state} gmMode setGmMode={() => {}} onImport={() => {}} onShowGMLockModal={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText('Enter password (min 8 characters)'), { target: { value: 'correct horse battery' } });
  fireEvent.change(screen.getByPlaceholderText('Re-enter password'), { target: { value: 'correct horse battery' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Export Locked/ }));
  });
}

describe('locked export warnings', () => {
  it('reports success plainly when nothing unprojected is present', async () => {
    await exportLockedFrom(createCampaignState());
    expect(await screen.findByText(/Locked export successful/)).toBeInTheDocument();
    expect(screen.queryByText(/not hidden from players yet/)).not.toBeInTheDocument();
  });

  it('warns when a running encounter or combat history would reach players', async () => {
    const state = createCampaignState();
    const combat: CombatState = { id: 'fight', name: 'Ambush', startTime: 1, participants: [],
      currentRound: 1, currentTurnIndex: 0, turnOrder: [], turnDecisions: {}, log: [] };
    state.combat.activeSession = combat;
    state.entities.combatHistory = [combat];
    await exportLockedFrom(state);
    expect(await screen.findByText(/not hidden from players yet/)).toBeInTheDocument();
    expect(screen.getByText(/the running combat encounter/)).toBeInTheDocument();
    expect(screen.getByText(/past combat records/)).toBeInTheDocument();
  });
});
