/**
 * Manager Import/Export → campaign store wiring (review claim C).
 *
 * Drives the real ManagerTab + ImportExportPanel + GMLockModal through the real
 * CampaignStoreProvider: a file chosen in the panel must replace the campaign,
 * and a GM unlock must only enable GM mode when decryption actually succeeded.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ManagerTab } from '../../ManagerTab';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { createCampaignState, type CampaignState } from '../../../state/campaignReducer';
import { setPendingGMLock } from '../../../state/pendingGMLock';
import { exportLocked, exportUnlocked, splitState, type LegacyCampaignState } from '../../../utils/exportImport';
import { ToastProvider } from '../../ui';

const PASSWORD = 'correct horse battery';

function makeSourceCampaign(): CampaignState {
  const state = createCampaignState();
  state.time = { ...state.time, day: 42 };
  state.entities.alchemyReagents = {
    'reagent-ember': {
      id: 'reagent-ember',
      name: 'Ember Moss',
      quantity: 3,
      identificationLevel: 1,
      aspects: { primary: 'Fire' },
      hazards: ['Volatile when heated'],
      notes: 'GM: harvested under a new moon',
    },
  };
  return state;
}

let latest: CampaignState = createCampaignState();

function StateProbe() {
  latest = useCampaignStore().state;
  return null;
}

function renderManager() {
  latest = createCampaignState();
  render(
    <ToastProvider>
      <CampaignStoreProvider initialCampaignState={createCampaignState()}>
        <ManagerTab />
        <StateProbe />
      </CampaignStoreProvider>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Import/Export' }));
}

/** Chooses a file in the panel; returns a reader for the input's value afterwards. */
async function chooseFile(contents: unknown) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const json = JSON.stringify(contents);
  const file = new File([json], 'campaign.json', { type: 'application/json' });
  // jsdom's File has no text(); browsers do.
  Object.defineProperty(file, 'text', { value: async () => json });
  // jsdom keeps a file input's value internal; track it so the reset after import is observable.
  let value = 'C:\\fakepath\\campaign.json';
  Object.defineProperty(input, 'value', { configurable: true, get: () => value, set: (next: string) => { value = next; } });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  return () => value;
}

const exportButtons = () => [
  screen.getByRole('button', { name: /Export Unlocked/ }),
  screen.getByRole('button', { name: /Export Locked/ }),
];

function fillExportPassword() {
  fireEvent.change(screen.getByPlaceholderText('Enter password (min 8 characters)'), { target: { value: PASSWORD } });
  fireEvent.change(screen.getByPlaceholderText('Re-enter password'), { target: { value: PASSWORD } });
}

async function unlockWith(password: string) {
  fireEvent.click(screen.getByRole('button', { name: /Enable GM Mode/ }));
  const field = await screen.findByPlaceholderText('Enter GM password');
  fireEvent.change(field, { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Unlock GM Mode/ }));
  });
}

/**
 * Mirrors UnifiedShell: an active combat re-wraps the shell in CombatContextProvider,
 * which remounts everything below it, ManagerTab included.
 */
function CombatRemountingShell() {
  const combatActive = !!useCampaignStore().state.combat.activeSession;
  return combatActive ? <section><ManagerTab /></section> : <ManagerTab />;
}

describe('ManagerTab import and GM unlock (claim C)', () => {
  // The pending lock outlives the component on purpose; keep tests independent.
  afterEach(() => setPendingGMLock(null));

  it('an unlocked import replaces the campaign state', async () => {
    renderManager();
    const inputValue = await chooseFile(await exportUnlocked(makeSourceCampaign()));

    await waitFor(() => expect(latest.time.day).toBe(42));
    expect(inputValue()).toBe('');
    expect(latest.entities.alchemyReagents['reagent-ember']?.notes).toBe('GM: harvested under a new moon');
    expect(latest.checkpoints.entries[0]?.label).toBe('Before import');
  });

  it('a locked import loads the public campaign without GM secrets', async () => {
    renderManager();
    await chooseFile(await exportLocked(makeSourceCampaign(), PASSWORD, { iterations: 1000 }));

    await waitFor(() => expect(latest.time.day).toBe(42));
    expect(latest.ui.gmModeEnabled).toBe(false);
    expect(latest.entities.alchemyReagents['reagent-ember']?.name).toBe('Ember Moss');
    expect(latest.entities.alchemyReagents['reagent-ember']?.notes).toBeUndefined();
  });

  it('a wrong password leaves GM mode off and shows the failure', async () => {
    renderManager();
    await chooseFile(await exportLocked(makeSourceCampaign(), PASSWORD, { iterations: 1000 }));
    await waitFor(() => expect(latest.time.day).toBe(42));

    const beforeUnlock = latest;

    await unlockWith('not the password');

    expect(await screen.findByText('Unlock Failed')).toBeInTheDocument();
    expect(latest.ui.gmModeEnabled).toBe(false);
    expect(latest.entities.alchemyReagents['reagent-ember']?.notes).toBeUndefined();
    expect(latest).toEqual(beforeUnlock);
  });

  it('the right password restores GM secrets and enables GM mode', async () => {
    renderManager();
    await chooseFile(await exportLocked(makeSourceCampaign(), PASSWORD, { iterations: 1000 }));
    await waitFor(() => expect(latest.time.day).toBe(42));

    await unlockWith(PASSWORD);

    await waitFor(() => expect(latest.ui.gmModeEnabled).toBe(true));
    expect(latest.entities.alchemyReagents['reagent-ember']?.notes).toBe('GM: harvested under a new moon');
    expect(screen.queryByText('GM Content is Locked')).not.toBeInTheDocument();
    expect(latest.checkpoints.entries.map((entry) => entry.label)).toEqual(['Before GM unlock', 'Before import']);
  });

  it('the unlock dialog says the file replaces the campaign and where changes since import are kept', async () => {
    renderManager();
    await chooseFile(await exportLocked(makeSourceCampaign(), PASSWORD, { iterations: 1000 }));
    await waitFor(() => expect(latest.time.day).toBe(42));

    fireEvent.click(screen.getByRole('button', { name: /Enable GM Mode/ }));

    expect(await screen.findByText(/"Before GM unlock" checkpoint/)).toBeInTheDocument();
  });

  it('exports are disabled while GM content is locked, and enabled again after unlock', async () => {
    renderManager();
    await chooseFile(await exportLocked(makeSourceCampaign(), PASSWORD, { iterations: 1000 }));
    await waitFor(() => expect(latest.time.day).toBe(42));
    fillExportPassword();

    for (const button of exportButtons()) expect(button).toBeDisabled();
    expect(screen.getByText(/Unlock the GM content before exporting/)).toBeInTheDocument();

    await unlockWith(PASSWORD);
    await waitFor(() => expect(latest.ui.gmModeEnabled).toBe(true));
    fillExportPassword();

    for (const button of exportButtons()) expect(button).toBeEnabled();
  });

  it('a locked file whose public half carries secrets and GM flags loads only the player view', async () => {
    const source = makeSourceCampaign();
    source.ui = { ...source.ui, gmModeEnabled: true, gmSessionUnlocked: true };
    const envelope = await exportLocked(source, PASSWORD, { iterations: 1000 });
    // A tampered file, or one exported before the public half was projected: plaintext = the full campaign.
    const tampered = { ...envelope, public: splitState(source).gm };
    renderManager();
    await chooseFile(tampered);
    await waitFor(() => expect(latest.time.day).toBe(42));

    expect(latest.ui.gmModeEnabled).toBe(false);
    expect(latest.ui.gmSessionUnlocked).toBe(false);
    expect(latest.entities.alchemyReagents['reagent-ember']?.notes).toBeUndefined();
    expect(latest.entities.alchemyReagents['reagent-ember']?.hazards).toBeUndefined();

    await unlockWith(PASSWORD);
    await waitFor(() => expect(latest.ui.gmModeEnabled).toBe(true));
    expect(latest.entities.alchemyReagents['reagent-ember']?.notes).toBe('GM: harvested under a new moon');
  });

  it('a pre-campaign (flat) export is refused with a message and changes nothing', async () => {
    renderManager();
    const legacy: LegacyCampaignState = { materials: [], alchemyReagents: [], gmNotes: 'x' };
    const { public: pub, gm } = splitState(legacy);
    const inputValue = await chooseFile({ schemaVersion: '1.6.5', exportDate: '2026-01-01', exportType: 'unlocked', public: pub, gm });

    expect(await screen.findByText(/pre-campaign/i)).toBeInTheDocument();
    expect(inputValue()).toBe('');
    expect(latest.time.day).toBe(createCampaignState().time.day);
    expect(latest.checkpoints.entries).toHaveLength(0);
  });

  it('a locked file with a running combat can still be unlocked after the shell remounts', async () => {
    const source = makeSourceCampaign();
    source.combat = {
      ...source.combat,
      activeSession: {
        id: 'fight', name: 'Ambush', startTime: 1, participants: [],
        currentRound: 1, currentTurnIndex: 0, turnOrder: [], turnDecisions: {}, log: [],
      },
    };
    latest = createCampaignState();
    render(
      <ToastProvider>
        <CampaignStoreProvider initialCampaignState={createCampaignState()}>
          <CombatRemountingShell />
          <StateProbe />
        </CampaignStoreProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Import/Export' }));
    await chooseFile(await exportLocked(source, PASSWORD, { iterations: 1000 }));
    await waitFor(() => expect(latest.combat.activeSession?.id).toBe('fight'));

    await unlockWith(PASSWORD);

    await waitFor(() => expect(latest.ui.gmModeEnabled).toBe(true));
    expect(latest.entities.alchemyReagents['reagent-ember']?.notes).toBe('GM: harvested under a new moon');
  });
});
