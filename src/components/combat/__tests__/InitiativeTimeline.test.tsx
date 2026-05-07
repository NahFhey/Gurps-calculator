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
    isUnconscious: false,
    isStunned: false,
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
