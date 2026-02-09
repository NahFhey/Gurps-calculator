import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeAdvancementBlocker } from '../TimeAdvancementBlocker';
import type { AdvancementCheck } from '../../../../state/downtime/downtimeSelectors';

function createAdvancementCheck(
  overrides: Partial<AdvancementCheck> = {}
): AdvancementCheck {
  return {
    canAdvance: true,
    blockingTaskIds: [],
    ...overrides,
  };
}

describe('TimeAdvancementBlocker', () => {
  it('renders nothing when canAdvance is true', () => {
    const check = createAdvancementCheck({ canAdvance: true });
    const onJumpToTasks = vi.fn();

    const { container } = render(
      <TimeAdvancementBlocker
        advancementCheck={check}
        onJumpToTasks={onJumpToTasks}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders warning when canAdvance is false', () => {
    const check = createAdvancementCheck({
      canAdvance: false,
      blockingTaskIds: ['task-1'],
      reason: '1 task(s) must be resolved or cancelled',
    });
    const onJumpToTasks = vi.fn();

    render(
      <TimeAdvancementBlocker
        advancementCheck={check}
        onJumpToTasks={onJumpToTasks}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('1 task(s) must be resolved or cancelled')
    ).toBeInTheDocument();
  });

  it('shows View task button for single blocking task', () => {
    const check = createAdvancementCheck({
      canAdvance: false,
      blockingTaskIds: ['task-1'],
    });
    const onJumpToTasks = vi.fn();

    render(
      <TimeAdvancementBlocker
        advancementCheck={check}
        onJumpToTasks={onJumpToTasks}
      />
    );

    expect(screen.getByRole('button', { name: 'View task' })).toBeInTheDocument();
  });

  it('shows View tasks button for multiple blocking tasks', () => {
    const check = createAdvancementCheck({
      canAdvance: false,
      blockingTaskIds: ['task-1', 'task-2', 'task-3'],
    });
    const onJumpToTasks = vi.fn();

    render(
      <TimeAdvancementBlocker
        advancementCheck={check}
        onJumpToTasks={onJumpToTasks}
      />
    );

    expect(screen.getByRole('button', { name: 'View tasks' })).toBeInTheDocument();
  });

  it('calls onJumpToTasks when button is clicked', () => {
    const check = createAdvancementCheck({
      canAdvance: false,
      blockingTaskIds: ['task-1'],
    });
    const onJumpToTasks = vi.fn();

    render(
      <TimeAdvancementBlocker
        advancementCheck={check}
        onJumpToTasks={onJumpToTasks}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'View task' }));

    expect(onJumpToTasks).toHaveBeenCalledOnce();
  });

  it('displays fallback message when reason is not provided', () => {
    const check = createAdvancementCheck({
      canAdvance: false,
      blockingTaskIds: ['task-1', 'task-2'],
      reason: undefined,
    });
    const onJumpToTasks = vi.fn();

    render(
      <TimeAdvancementBlocker
        advancementCheck={check}
        onJumpToTasks={onJumpToTasks}
      />
    );

    expect(screen.getByText('2 tasks blocking advancement')).toBeInTheDocument();
  });

  it('displays singular fallback for single task without reason', () => {
    const check = createAdvancementCheck({
      canAdvance: false,
      blockingTaskIds: ['task-1'],
      reason: undefined,
    });
    const onJumpToTasks = vi.fn();

    render(
      <TimeAdvancementBlocker
        advancementCheck={check}
        onJumpToTasks={onJumpToTasks}
      />
    );

    expect(screen.getByText('1 task blocking advancement')).toBeInTheDocument();
  });

  it('has correct styling for warning appearance', () => {
    const check = createAdvancementCheck({
      canAdvance: false,
      blockingTaskIds: ['task-1'],
    });
    const onJumpToTasks = vi.fn();

    render(
      <TimeAdvancementBlocker
        advancementCheck={check}
        onJumpToTasks={onJumpToTasks}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-yellow-100');
    expect(alert).toHaveClass('border-yellow-300');
    expect(alert).toHaveClass('text-yellow-800');
  });

  it('has accessible testid for integration tests', () => {
    const check = createAdvancementCheck({
      canAdvance: false,
      blockingTaskIds: ['task-1'],
    });
    const onJumpToTasks = vi.fn();

    render(
      <TimeAdvancementBlocker
        advancementCheck={check}
        onJumpToTasks={onJumpToTasks}
      />
    );

    expect(screen.getByTestId('time-advancement-blocker')).toBeInTheDocument();
  });
});
