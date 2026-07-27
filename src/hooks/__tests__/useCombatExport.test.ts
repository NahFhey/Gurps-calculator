import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CombatState,
  HistoryState,
  LogEntry,
  Participant,
  RevealState,
} from '../../types/combatTracker';
import { createInitialRevealState } from '../../utils/combatReveal';
import { ViewMode } from '../../utils/combatViewFilter';

vi.mock('../useCombatStore', () => ({
  useCombatStore: vi.fn(),
}));

vi.mock('../../components/ui', () => ({
  useToast: vi.fn(),
}));

import { useToast } from '../../components/ui';
import { useCombatExport } from '../useCombatExport';
import { useCombatStore } from '../useCombatStore';

const mockedUseCombatStore = vi.mocked(useCombatStore);
const mockedUseToast = vi.mocked(useToast);
type CombatStoreValue = ReturnType<typeof useCombatStore>;

interface ExportEnvelope {
  version: number;
  exportType?: string;
  combatState: {
    id: string;
    name: string;
    participants: Array<Record<string, unknown>>;
    log: LogEntry[];
  };
  history?: HistoryState | null;
  revealState?: RevealState | null;
  gmLock?: {
    kdf?: string;
    cipher?: string;
    ciphertext?: string;
  };
}

function makeParticipant(
  overrides: Partial<Participant> = {},
): Participant {
  return {
    instanceId: 'hero',
    id: 'hero',
    name: 'Aria',
    category: 'player',
    st: 11,
    dx: 12,
    iq: 10,
    ht: 11,
    hp: 12,
    fp: 11,
    mp: 0,
    maxHP: 12,
    currentHP: 12,
    currentFP: 11,
    basicSpeed: 5.75,
    basicMove: 5,
    conditions: [],
    ...overrides,
  };
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  const participants = [
    makeParticipant(),
    makeParticipant({
      instanceId: 'ogre',
      id: 'ogre',
      name: 'Ogre',
      category: 'enemy',
      hp: 15,
      maxHP: 15,
      currentHP: 9,
    }),
  ];
  const hiddenEnemyNote = {
    id: 'log-1',
    timestamp: 1_100,
    round: 1,
    turn: 1,
    entryType: 'note',
    text: 'Ogre waits',
    actorInstanceId: 'ogre',
  } satisfies LogEntry & { actorInstanceId: string };

  return {
    id: 'combat-1',
    name: 'Bridge Ambush',
    startTime: 1_000,
    participants,
    turnOrder: participants.map((participant) => participant.instanceId),
    currentTurnIndex: 0,
    currentRound: 1,
    turnDecisions: {},
    log: [hiddenEnemyNote],
    ...overrides,
  };
}

function makeHistory(): HistoryState {
  return {
    version: 1,
    actions: [{ type: 'TURN_ADVANCE' }],
    cursor: 1,
    checkpoints: [],
    checkpointEvery: 25,
    maxActions: 500,
    maxCheckpoints: 30,
  };
}

function makeReveal(combat: CombatState): RevealState {
  const initial = createInitialRevealState(combat.id, combat.participants);
  return {
    version: initial.version,
    combatId: combat.id,
    byInstanceId: initial.byInstanceId,
  };
}

function makeStoreValue(options: {
  combat: CombatState | null;
  reveal: RevealState | null;
  saveCombatActive: CombatStoreValue['saveCombatActive'];
  saveCombatReveal: CombatStoreValue['saveCombatReveal'];
}): CombatStoreValue {
  return {
    combatCharacters: [],
    partyCharacters: [],
    combatActive:
      options.combat as unknown as CombatStoreValue['combatActive'],
    combatHistory: [],
    combatTombstones: [],
    combatRulesPreset: 'standard',
    combatReveal: options.reveal,
    combatItems: [],
    encounterTemplates: {},
    saveCombatCharacters: vi.fn(),
    saveCombatActive: options.saveCombatActive,
    saveCombatHistory: vi.fn(),
    saveCombatTombstones: vi.fn(),
    saveCombatRulesPreset: vi.fn(),
    saveCombatItems: vi.fn(),
    saveCombatReveal: options.saveCombatReveal,
    addEncounterTemplate: vi.fn(),
    updateEncounterTemplate: vi.fn(),
    removeEncounterTemplate: vi.fn(),
    updatePartyCharacter: vi.fn(),
  };
}

function makeToastValue(showError: ReturnType<typeof vi.fn>) {
  return {
    toasts: [],
    toast: vi.fn(),
    success: vi.fn(),
    error: showError,
    warning: vi.fn(),
    info: vi.fn(),
    dismissToast: vi.fn(),
    clearToasts: vi.fn(),
  } as unknown as ReturnType<typeof useToast>;
}

function setup(options: {
  combat?: CombatState | null;
  reveal?: RevealState | null;
  history?: HistoryState;
  viewMode?: typeof ViewMode.GM | typeof ViewMode.PLAYER;
} = {}) {
  const combat =
    options.combat === undefined ? makeCombat() : options.combat;
  const reveal =
    options.reveal === undefined && combat ? makeReveal(combat) : options.reveal ?? null;
  const history = options.history ?? makeHistory();
  const saveCombatActive =
    vi.fn<CombatStoreValue['saveCombatActive']>();
  const saveCombatReveal =
    vi.fn<CombatStoreValue['saveCombatReveal']>();
  const showError = vi.fn();

  mockedUseCombatStore.mockReturnValue(
    makeStoreValue({
      combat,
      reveal,
      saveCombatActive,
      saveCombatReveal,
    }),
  );
  mockedUseToast.mockReturnValue(makeToastValue(showError));

  const hook = renderHook(() =>
    useCombatExport(options.viewMode ?? ViewMode.GM, history),
  );

  return {
    ...hook,
    combat,
    reveal,
    history,
    saveCombatActive,
    saveCombatReveal,
    showError,
  };
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Blob read failed'));
    reader.readAsText(blob);
  });
}

async function downloadedText(downloadedBlobs: Blob[]): Promise<string> {
  const blob = downloadedBlobs[downloadedBlobs.length - 1];
  if (!blob) {
    throw new Error('Expected a generated download blob');
  }
  return readBlob(blob);
}

function installImportFileClick(json: string): void {
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
    this: HTMLInputElement,
  ) {
    const file = new File([json], 'combat.json', {
      type: 'application/json',
    });
    Object.defineProperty(this, 'files', {
      configurable: true,
      value: [file],
    });
    this.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('useCombatExport', () => {
  let downloadedBlobs: Blob[];

  beforeEach(() => {
    vi.clearAllMocks();
    downloadedBlobs = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      (object: Blob | MediaSource) => {
        if (object instanceof Blob) {
          downloadedBlobs.push(object);
        }
        return 'blob:combat-export';
      },
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when there is no active combat', () => {
    const { result } = setup({ combat: null, reveal: null });

    expect(result.current).toBeNull();
  });

  it('generates a player-filtered text log in player mode', async () => {
    const { result } = setup({ viewMode: ViewMode.PLAYER });

    act(() => result.current?.handleExportLog());

    const text = await downloadedText(downloadedBlobs);
    expect(text).toContain('=== GURPS Combat Log ===');
    expect(text).toContain('Encounter: Bridge Ambush');
    expect(text).toContain('Unknown Foe waits');
    expect(text).not.toContain('Ogre waits');
  });

  it('generates a player-view payload without truth stats or history', async () => {
    const { result } = setup();

    act(() => result.current?.handleExportPlayerView());

    const payload = JSON.parse(
      await downloadedText(downloadedBlobs),
    ) as ExportEnvelope;
    const enemy = payload.combatState.participants.find(
      (participant) => participant.instanceId === 'ogre',
    );
    expect(payload).toMatchObject({
      version: 2,
      exportType: 'player-view',
      history: null,
    });
    expect(enemy).toMatchObject({
      instanceId: 'ogre',
      name: 'Unknown Foe',
      hp: { mode: 'unknown' },
    });
    expect(enemy).not.toHaveProperty('currentHP');
    expect(payload.combatState.log[0].text).toBe('Unknown Foe waits');
  });

  it('rejects a player-view export when reveal state is unavailable', () => {
    const { result, showError } = setup({ reveal: null });

    act(() => result.current?.handleExportPlayerView());

    expect(downloadedBlobs).toHaveLength(0);
    expect(showError).toHaveBeenCalledWith(
      'Reveal state not initialized. Cannot export player view.',
    );
  });

  it('generates a GM-locked envelope with filtered public data and encrypted truth', async () => {
    const { result } = setup();
    vi.spyOn(window, 'prompt').mockReturnValue('swordfish');

    await act(async () => {
      await result.current?.handleExportGMLocked();
    });

    const payload = JSON.parse(
      await downloadedText(downloadedBlobs),
    ) as ExportEnvelope;
    const enemy = payload.combatState.participants.find(
      (participant) => participant.instanceId === 'ogre',
    );
    expect(payload).toMatchObject({
      version: 2,
      exportType: 'gm-locked',
      gmLock: {
        kdf: 'PBKDF2',
        cipher: 'AES-GCM',
      },
    });
    expect(payload.gmLock?.ciphertext).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(enemy).toMatchObject({
      name: 'Unknown Foe',
      hp: { mode: 'unknown' },
    });
    expect(JSON.stringify(payload.combatState)).not.toContain('"currentHP":9');
  });

  it('does not generate a GM-locked payload when the password prompt is cancelled', async () => {
    const { result } = setup();
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    await act(async () => {
      await result.current?.handleExportGMLocked();
    });

    expect(downloadedBlobs).toHaveLength(0);
  });

  it('generates a save payload containing full combat truth and history', async () => {
    const { result, history } = setup();

    act(() => result.current?.handleSaveCombat());

    const payload = JSON.parse(
      await downloadedText(downloadedBlobs),
    ) as ExportEnvelope;
    const enemy = payload.combatState.participants.find(
      (participant) => participant.instanceId === 'ogre',
    );
    expect(payload.version).toBe(1);
    expect(payload.history).toEqual(history);
    expect(enemy).toMatchObject({
      name: 'Ogre',
      currentHP: 9,
      maxHP: 15,
    });
  });

  it('loads an unlocked payload after confirmation and migrates legacy condition visibility', async () => {
    const combat = makeCombat();
    const legacyTarget = {
      ...combat.participants[1],
      isStunned: true,
      conditions: [
        {
          instanceId: 'condition-1',
          conditionId: 'bleeding',
          label: 'Bleeding',
        },
      ],
    };
    const importedCombat: CombatState = {
      ...combat,
      participants: [combat.participants[0], legacyTarget],
    };
    const importedReveal = makeReveal(importedCombat);
    installImportFileClick(
      JSON.stringify({
        version: 2,
        exportType: 'player-view',
        combatState: importedCombat,
        revealState: importedReveal,
        history: null,
      }),
    );
    const { result, saveCombatActive, saveCombatReveal } = setup();
    const onConfirm = vi.fn(async () => true);

    act(() => result.current?.handleLoadCombat(onConfirm));

    await waitFor(() => expect(saveCombatActive).toHaveBeenCalledOnce());
    const saved = saveCombatActive.mock.calls[0][0] as CombatState;
    const target = saved.participants.find(
      (participant) => participant.instanceId === 'ogre',
    );
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(target).not.toHaveProperty('isStunned');
    expect(target?.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instanceId: 'condition-1',
          revealed: 'open',
        }),
        expect.objectContaining({
          conditionId: 'stunned',
          revealed: 'open',
        }),
      ]),
    );
    expect(saveCombatReveal).toHaveBeenCalledWith(importedReveal);
  });

  it('leaves the current session untouched when loading is not confirmed', async () => {
    const importedCombat = makeCombat({ id: 'imported-combat' });
    installImportFileClick(
      JSON.stringify({
        version: 2,
        exportType: 'player-view',
        combatState: importedCombat,
        revealState: makeReveal(importedCombat),
      }),
    );
    const { result, saveCombatActive, saveCombatReveal } = setup();

    act(() =>
      result.current?.handleLoadCombat(vi.fn(async () => false)),
    );

    await waitFor(() => {
      expect(saveCombatActive).not.toHaveBeenCalled();
      expect(saveCombatReveal).not.toHaveBeenCalled();
    });
  });

  it('reports malformed imported JSON instead of replacing combat state', async () => {
    installImportFileClick('{not-json');
    const { result, saveCombatActive, showError } = setup();

    act(() =>
      result.current?.handleLoadCombat(vi.fn(async () => true)),
    );

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(
        expect.stringMatching(/^Import error:/),
      ),
    );
    expect(saveCombatActive).not.toHaveBeenCalled();
  });
});
