import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharacterStatusBadge } from '../CharacterStatusBadge';
import type { CharacterSlotSummary } from '../../../../state/downtime/downtimeSelectors';

function createSummary(
  overrides: Partial<CharacterSlotSummary> = {}
): CharacterSlotSummary {
  return {
    characterId: 'char-1',
    isAssigned: false,
    activityDisplayName: null,
    role: null,
    taskId: null,
    fatigueStatus: 'rested',
    ...overrides,
  };
}

describe('CharacterStatusBadge', () => {
  it('renders nothing when rested and not assigned', () => {
    const summary = createSummary({
      isAssigned: false,
      fatigueStatus: 'rested',
    });

    const { container } = render(<CharacterStatusBadge summary={summary} />);

    // Should have the flex container but no badges inside
    const badges = container.querySelectorAll('span');
    expect(badges).toHaveLength(0);
  });

  it('shows assignment badge when assigned', () => {
    const summary = createSummary({
      isAssigned: true,
      activityDisplayName: 'Fishing',
      role: 'leader',
      taskId: 'task-1',
    });

    render(<CharacterStatusBadge summary={summary} />);

    const badge = screen.getByTitle('Assigned to: Fishing');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-500');
  });

  it('shows tired badge when tired', () => {
    const summary = createSummary({
      fatigueStatus: 'tired',
    });

    render(<CharacterStatusBadge summary={summary} />);

    const badge = screen.getByTitle('Tired - needs rest');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-500');
  });

  it('shows exhausted badge when exhausted', () => {
    const summary = createSummary({
      fatigueStatus: 'exhausted',
    });

    render(<CharacterStatusBadge summary={summary} />);

    const badge = screen.getByTitle('Exhausted - worked without rest');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-500');
  });

  it('shows both assignment and tired badges', () => {
    const summary = createSummary({
      isAssigned: true,
      activityDisplayName: 'Crafting',
      role: 'helper',
      taskId: 'task-2',
      fatigueStatus: 'tired',
    });

    render(<CharacterStatusBadge summary={summary} />);

    expect(screen.getByTitle('Assigned to: Crafting')).toBeInTheDocument();
    expect(screen.getByTitle('Tired - needs rest')).toBeInTheDocument();
  });

  it('shows both assignment and exhausted badges', () => {
    const summary = createSummary({
      isAssigned: true,
      activityDisplayName: 'Alchemy',
      role: 'leader',
      taskId: 'task-3',
      fatigueStatus: 'exhausted',
    });

    render(<CharacterStatusBadge summary={summary} />);

    expect(screen.getByTitle('Assigned to: Alchemy')).toBeInTheDocument();
    expect(
      screen.getByTitle('Exhausted - worked without rest')
    ).toBeInTheDocument();
  });

  it('does not show tired badge when rested', () => {
    const summary = createSummary({
      fatigueStatus: 'rested',
    });

    render(<CharacterStatusBadge summary={summary} />);

    expect(screen.queryByTitle('Tired - needs rest')).not.toBeInTheDocument();
    expect(
      screen.queryByTitle('Exhausted - worked without rest')
    ).not.toBeInTheDocument();
  });

  it('renders dead with visual precedence over other injury badges', () => {
    render(<CharacterStatusBadge summary={createSummary()} status={{
      dead: true,
      conditions: [{ instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' }],
      crippled: ['armR'],
    }} />);

    expect(screen.getByTestId('dead-status-badge')).toHaveTextContent('Dead');
    expect(screen.queryByTestId('unconscious-status-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crippled-status-indicator')).not.toBeInTheDocument();
  });

  it('renders KO, condition icons, and a crippled count from persistent status', () => {
    render(<CharacterStatusBadge summary={createSummary()} status={{
      conditions: [
        { instanceId: 'ko', conditionId: 'unconscious', label: 'Unconscious' },
        { instanceId: 'poison', conditionId: 'poisoned', label: 'Poisoned' },
      ],
      crippled: ['armR', 'legL'],
    }} />);

    expect(screen.getByTestId('unconscious-status-badge')).toHaveTextContent('KO');
    expect(screen.getByTestId('condition-status-indicator')).toHaveTextContent('☠️');
    expect(screen.getByTestId('condition-status-indicator')).toHaveAttribute('title', 'Poisoned');
    expect(screen.getByTestId('crippled-status-indicator')).toHaveTextContent('2');
  });
});
