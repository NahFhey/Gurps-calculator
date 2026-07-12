import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InitiativeTimeline, type InitiativeTimelineProps } from '../views/InitiativeTimeline';
import type { Participant } from '../../../types/combatTracker';

// ---------------------------------------------------------------------------
// Mock combatHelpers (calculateHPStatus used by the timeline)
// ---------------------------------------------------------------------------

vi.mock('../../../utils/combatHelpers', () => ({
  calculateHPStatus: vi.fn((current: number, max: number) => {
    if (current <= 0) return 'dead';
    if (current < max * 0.25) return 'critical';
    if (current < max * 0.5) return 'injured';
    return 'healthy';
  }),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeParticipant(overrides: Partial<Participant> & { instanceId: string; name: string }): Participant {
  return {
    category: 'player',
    basicSpeed: 6,
    currentHP: 10,
    hp: 10,
    maxHP: 10,
    isDead: false,
    conditions: [],
    ...overrides,
  } as Participant;
}

const alice = makeParticipant({ instanceId: 'alice-1', name: 'Alice', basicSpeed: 7 });
const bob = makeParticipant({ instanceId: 'bob-1', name: 'Bob', basicSpeed: 6, category: 'ally' });
const goblin = makeParticipant({ instanceId: 'goblin-1', name: 'Goblin', basicSpeed: 5, category: 'enemy' });

const defaultProps: InitiativeTimelineProps = {
  participants: [alice, bob, goblin],
  turnOrder: ['alice-1', 'bob-1', 'goblin-1'],
  currentTurnIndex: 0,
  currentRound: 1,
  onPrevTurn: vi.fn(),
  onNextTurn: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InitiativeTimeline', () => {
  it('renders all participants in turn order', () => {
    render(<InitiativeTimeline {...defaultProps} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('displays round and turn info', () => {
    render(<InitiativeTimeline {...defaultProps} />);

    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Turn 1 of 3')).toBeInTheDocument();
  });

  it('calls onPrevTurn and onNextTurn when nav buttons are clicked', () => {
    const onPrevTurn = vi.fn();
    const onNextTurn = vi.fn();
    render(<InitiativeTimeline {...defaultProps} onPrevTurn={onPrevTurn} onNextTurn={onNextTurn} />);

    fireEvent.click(screen.getByTitle('Previous turn'));
    expect(onPrevTurn).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTitle('Next turn'));
    expect(onNextTurn).toHaveBeenCalledOnce();
  });

  it('calls onJumpToTurn when a token is clicked', () => {
    const onJumpToTurn = vi.fn();
    render(<InitiativeTimeline {...defaultProps} onJumpToTurn={onJumpToTurn} />);

    fireEvent.click(screen.getByText('Bob'));
    expect(onJumpToTurn).toHaveBeenCalledWith(1);
  });

  it('shows drag hint when onReorderTurnOrder is provided', () => {
    const onReorder = vi.fn();
    render(<InitiativeTimeline {...defaultProps} onReorderTurnOrder={onReorder} />);

    expect(screen.getByText(/drag to reorder/i)).toBeInTheDocument();
  });

  it('does not show drag hint when onReorderTurnOrder is not provided', () => {
    render(<InitiativeTimeline {...defaultProps} />);

    expect(screen.queryByText(/drag to reorder/i)).not.toBeInTheDocument();
  });

  it('renders correctly with a dead participant', () => {
    const deadGoblin = makeParticipant({
      instanceId: 'goblin-1',
      name: 'Goblin',
      category: 'enemy',
      isDead: true,
      currentHP: 0,
    });

    render(
      <InitiativeTimeline
        {...defaultProps}
        participants={[alice, bob, deadGoblin]}
      />
    );

    // Dead goblin should still appear but the name should be present
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('handles empty turn order gracefully', () => {
    render(
      <InitiativeTimeline
        {...defaultProps}
        participants={[]}
        turnOrder={[]}
        currentTurnIndex={0}
      />
    );

    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Turn 1 of 0')).toBeInTheDocument();
  });

  it('renders participants with correct speed display', () => {
    render(<InitiativeTimeline {...defaultProps} />);

    expect(screen.getByText('7')).toBeInTheDocument(); // Alice's speed
    expect(screen.getByText('6')).toBeInTheDocument(); // Bob's speed
    expect(screen.getByText('5')).toBeInTheDocument(); // Goblin's speed
  });
});

// ---------------------------------------------------------------------------
// Phase 12a.6: condition icons + overflow pill (cap 3)
// ---------------------------------------------------------------------------

describe('InitiativeTimeline condition icons (Phase 12a.6)', () => {
  const conditions = [
    { instanceId: 'ci-1', conditionId: 'stunned', label: 'Stunned' },
    { instanceId: 'ci-2', conditionId: 'prone', label: 'Prone' },
    { instanceId: 'ci-3', conditionId: 'poisoned', label: 'Poisoned' },
    { instanceId: 'ci-4', conditionId: 'bleeding', label: 'Bleeding' },
    { instanceId: 'ci-5', conditionId: 'grappled', label: 'Grappled' },
  ];

  function renderWithConditions(
    conds: typeof conditions,
    onOpenConditions?: (id: string, anchor: { x: number; y: number }) => void
  ) {
    const afflicted = makeParticipant({
      instanceId: 'goblin-1',
      name: 'Goblin',
      category: 'enemy',
      conditions: conds as Participant['conditions'],
    });
    return render(
      <InitiativeTimeline
        {...defaultProps}
        participants={[alice, bob, afflicted]}
        onOpenConditions={onOpenConditions}
      />
    );
  }

  it('shows at most 3 condition icons plus a "+N" pill', () => {
    renderWithConditions(conditions, vi.fn());

    expect(screen.getByLabelText('Stunned')).toBeInTheDocument();
    expect(screen.getByLabelText('Prone')).toBeInTheDocument();
    expect(screen.getByLabelText('Poisoned')).toBeInTheDocument();
    expect(screen.queryByLabelText('Bleeding')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Grappled')).not.toBeInTheDocument();
    expect(screen.getByLabelText('2 more conditions')).toBeInTheDocument();
  });

  it('shows no pill at 3 or fewer conditions', () => {
    renderWithConditions(conditions.slice(0, 3), vi.fn());

    expect(screen.queryByLabelText(/more condition/)).not.toBeInTheDocument();
  });

  it('sorts expiring conditions into the visible set', () => {
    const withExpiring = [
      ...conditions.slice(0, 3),
      {
        instanceId: 'ci-urgent',
        conditionId: 'on_fire',
        label: 'On Fire',
        expiresAt: { type: 'turn', turnsRemaining: 0 },
      },
    ];
    renderWithConditions(withExpiring as typeof conditions, vi.fn());

    // The expiring condition displaces a permanent one from the visible 3
    expect(screen.getByLabelText('On Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('1 more condition')).toBeInTheDocument();
  });

  it('pill click opens the popover and does not jump turns', () => {
    const onOpenConditions = vi.fn();
    const onJumpToTurn = vi.fn();
    const afflicted = makeParticipant({
      instanceId: 'goblin-1',
      name: 'Goblin',
      category: 'enemy',
      conditions: conditions as Participant['conditions'],
    });
    render(
      <InitiativeTimeline
        {...defaultProps}
        participants={[alice, bob, afflicted]}
        onJumpToTurn={onJumpToTurn}
        onOpenConditions={onOpenConditions}
      />
    );

    fireEvent.click(screen.getByLabelText('2 more conditions'));
    expect(onOpenConditions).toHaveBeenCalledWith(
      'goblin-1',
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
    expect(onJumpToTurn).not.toHaveBeenCalled();
  });

  it('renders a static count without onOpenConditions (player view)', () => {
    renderWithConditions(conditions, undefined);

    const pill = screen.getByLabelText('2 more conditions');
    expect(pill.tagName).toBe('SPAN');
  });
});
