import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import CombatTracker from '../CombatTracker';
import { CampaignStoreProvider } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import { createInitialRevealState } from '../../../utils/combatReveal.js';
import type { CombatState, Participant } from '../../../types/combatTracker';

vi.mock('../../ui', () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    dialogProps: {},
  }),
  useToast: () => ({
    error: vi.fn(),
  }),
}));

vi.mock('../ActionPanel', () => ({
  default: () => <div data-testid="action-panel" />,
}));

vi.mock('../ViewModeToggle', () => ({
  default: () => <div data-testid="view-mode-toggle" />,
}));

vi.mock('../RevealPanel', () => ({
  default: () => <div data-testid="reveal-panel" />,
}));

vi.mock('../ManeuverSelector', () => ({
  default: () => <div data-testid="maneuver-selector" />,
}));

vi.mock('../ReinforcementsModal', () => ({
  default: () => <div data-testid="reinforcements-modal" />,
}));

vi.mock('../views', () => ({
  CombatHeaderView: () => <div data-testid="combat-header" />,
  TurnControlsView: ({
    currentActor,
    combat,
    onPrevTurn,
    onNextTurn,
  }: {
    currentActor?: { name?: string };
    combat: { currentRound: number; currentTurnIndex: number; turnOrder: string[] };
    onPrevTurn: () => void;
    onNextTurn: () => void;
  }) => (
    <div>
      <div data-testid="turn-state">
        {currentActor?.name} | round {combat.currentRound} | turn {combat.currentTurnIndex + 1} of{' '}
        {combat.turnOrder.length}
      </div>
      <button onClick={onPrevTurn} type="button">
        Prev Turn
      </button>
      <button onClick={onNextTurn} type="button">
        Next Turn
      </button>
    </div>
  ),
  DicePanelView: () => <div data-testid="dice-panel" />,
  ParticipantListView: ({
    participants,
    currentActorInstanceId,
  }: {
    participants: Array<{ instanceId: string; name: string }>;
    currentActorInstanceId: string;
  }) => (
    <div data-testid="participant-list">
      {participants.map((participant) => (
        <div key={participant.instanceId}>
          {participant.instanceId === currentActorInstanceId ? '* ' : ''}
          {participant.name}
        </div>
      ))}
    </div>
  ),
  CombatLogView: ({
    displayLog,
  }: {
    displayLog: Array<{ id?: string; text?: string }>;
  }) => (
    <div data-testid="combat-log">
      {displayLog.map((entry, index) => (
        <div key={entry.id ?? `log-${index}`}>{entry.text}</div>
      ))}
    </div>
  ),
}));

function createParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    instanceId: 'ally-1',
    id: 'char-1',
    libraryId: 'char-1',
    name: 'Sir Aldren',
    category: 'ally',
    st: 11,
    dx: 12,
    iq: 10,
    ht: 11,
    hp: 12,
    fp: 11,
    mp: 0,
    maxHP: 12,
    maxFP: 11,
    maxMP: 0,
    currentHP: 12,
    currentFP: 11,
    currentMP: 0,
    basicSpeed: 6,
    basicMove: 6,
    dodge: 9,
    parry: 10,
    block: 9,
    dr: 2,
    defenses: {
      dodge: 9,
      parry: 10,
      block: 9,
    },
    attacks: [],
    conditions: [],
    ...overrides,
  };
}

function createCombatState(overrides: Partial<CombatState> = {}): CombatState {
  const participants = overrides.participants ?? [
    createParticipant({
      instanceId: 'ally-1',
      id: 'char-1',
      libraryId: 'char-1',
      name: 'Sir Aldren',
      basicSpeed: 6.25,
    }),
    createParticipant({
      instanceId: 'ally-2',
      id: 'char-2',
      libraryId: 'char-2',
      name: 'Mira',
      basicSpeed: 5.75,
    }),
  ];

  return {
    version: 1,
    id: 'combat-1',
    name: 'Bridge Ambush',
    startTime: 1_713_391_200_000,
    participants,
    turnOrder: participants.map((participant) => participant.instanceId),
    currentTurnIndex: 0,
    currentRound: 1,
    turnDecisions: {},
    log: [],
    ...overrides,
  };
}

function renderCombatTracker(combatOverrides: Partial<CombatState> = {}) {
  const combatState = createCombatState(combatOverrides);
  const initialCampaignState = createCampaignState();
  initialCampaignState.combat.activeSession = combatState as any;
  initialCampaignState.combat.revealState = createInitialRevealState(
    combatState.id,
    combatState.participants
  ) as any;

  return render(
    <CampaignStoreProvider initialCampaignState={initialCampaignState}>
      <CombatTracker />
    </CampaignStoreProvider>
  );
}

describe('CombatTracker', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('advances to the next participant within the same round and records the turn log', async () => {
    renderCombatTracker();

    expect(screen.getByTestId('turn-state')).toHaveTextContent('Sir Aldren | round 1 | turn 1 of 2');

    fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));

    await waitFor(() => {
      expect(screen.getByTestId('turn-state')).toHaveTextContent('Mira | round 1 | turn 2 of 2');
    });

    expect(screen.getByTestId('combat-log')).toHaveTextContent("Mira's turn");
    expect(screen.getByTestId('combat-log')).not.toHaveTextContent('=== Round 2 ===');
  });

  it('wraps from the last participant to a new round and appends round plus turn log entries', async () => {
    renderCombatTracker({
      currentTurnIndex: 1,
    });

    expect(screen.getByTestId('turn-state')).toHaveTextContent('Mira | round 1 | turn 2 of 2');

    fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));

    await waitFor(() => {
      expect(screen.getByTestId('turn-state')).toHaveTextContent('Sir Aldren | round 2 | turn 1 of 2');
    });

    expect(screen.getByTestId('combat-log')).toHaveTextContent("=== Round 2 ===");
    expect(screen.getByTestId('combat-log')).toHaveTextContent("Sir Aldren's turn");
  });

  it('wraps backward from the first participant to the previous round without dropping below round one', async () => {
    renderCombatTracker();

    fireEvent.click(screen.getByRole('button', { name: 'Prev Turn' }));

    await waitFor(() => {
      expect(screen.getByTestId('turn-state')).toHaveTextContent('Mira | round 1 | turn 2 of 2');
    });

    expect(screen.getByTestId('turn-state')).not.toHaveTextContent('round 0');
  });
});
