import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayHeaderBar } from '../views/DayHeaderBar';
import { DaySummaryPanel } from '../views/DaySummaryPanel';
import { TaskListPanel } from '../views/TaskListPanel';
import type { TaskAssignment, PendingDayLedger, CanAdvanceResult } from '../../../types/dayplanner';

// ============================================================================
// DayHeaderBar
// ============================================================================

describe('DayHeaderBar', () => {
  const defaultProps = {
    currentDay: 3,
    currentSlot: 0,
    canAdvance: { canAdvance: true } as CanAdvanceResult,
    onSleep: vi.fn(),
    onAdvanceSlot: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<DayHeaderBar {...defaultProps} />);
  });

  it('displays the current day number', () => {
    render(<DayHeaderBar {...defaultProps} />);
    expect(screen.getByText('Day 3')).toBeInTheDocument();
  });

  it('displays the current slot name and number', () => {
    render(<DayHeaderBar {...defaultProps} />);
    expect(screen.getByText(/Morning/)).toBeInTheDocument();
    expect(screen.getByText(/Slot 1\/3/)).toBeInTheDocument();
  });

  it('shows Sleep button', () => {
    render(<DayHeaderBar {...defaultProps} />);
    expect(screen.getByText('Sleep')).toBeInTheDocument();
  });

  it('calls onSleep when Sleep button is clicked', () => {
    const onSleep = vi.fn();
    render(<DayHeaderBar {...defaultProps} onSleep={onSleep} />);
    fireEvent.click(screen.getByText('Sleep'));
    expect(onSleep).toHaveBeenCalledTimes(1);
  });

  it('shows Advance Slot button when not on last slot', () => {
    render(<DayHeaderBar {...defaultProps} currentSlot={0} />);
    expect(screen.getByText('Advance Slot')).toBeInTheDocument();
  });

  it('shows End Day button on the last slot', () => {
    render(<DayHeaderBar {...defaultProps} currentSlot={2} />);
    expect(screen.getByText('End Day')).toBeInTheDocument();
  });

  it('disables advance button when canAdvance is false', () => {
    render(
      <DayHeaderBar
        {...defaultProps}
        canAdvance={{ canAdvance: false, reason: 'Tasks incomplete' }}
      />
    );
    const advanceBtn = screen.getByText('Advance Slot');
    expect(advanceBtn.closest('button')).toBeDisabled();
  });

  it('shows reason text when advance is blocked', () => {
    render(
      <DayHeaderBar
        {...defaultProps}
        canAdvance={{ canAdvance: false, reason: 'Tasks incomplete' }}
      />
    );
    expect(screen.getByText('Tasks incomplete')).toBeInTheDocument();
  });

  it('calls onAdvanceSlot when advance button is clicked', () => {
    const onAdvanceSlot = vi.fn();
    render(<DayHeaderBar {...defaultProps} onAdvanceSlot={onAdvanceSlot} />);
    fireEvent.click(screen.getByText('Advance Slot'));
    expect(onAdvanceSlot).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// DaySummaryPanel
// ============================================================================

describe('DaySummaryPanel', () => {
  it('renders without crashing with null ledger', () => {
    const { container } = render(<DaySummaryPanel pendingDayLedger={null} />);
    // Returns null when no ledger
    expect(container.innerHTML).toBe('');
  });

  it('returns null when ledger has no task summaries', () => {
    const ledger: PendingDayLedger = {
      dayKey: 1,
      taskSummaries: [],
      pendingInventoryDelta: [],
      committed: false,
    };
    const { container } = render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(container.innerHTML).toBe('');
  });

  it('displays pending day summary heading when tasks exist', () => {
    const ledger: PendingDayLedger = {
      dayKey: 1,
      taskSummaries: [{ taskId: 't1', mode: 'Fishing', result: 'caught fish' }],
      pendingInventoryDelta: [],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(screen.getByText('Pending Day Summary')).toBeInTheDocument();
  });

  it('displays task count', () => {
    const ledger: PendingDayLedger = {
      dayKey: 1,
      taskSummaries: [
        { taskId: 't1', mode: 'Fishing', result: 'caught fish' },
        { taskId: 't2', mode: 'Foraging', result: 'found herbs' },
      ],
      pendingInventoryDelta: [],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(screen.getByText('2 task(s) completed')).toBeInTheDocument();
  });

  it('shows "No items collected yet" when delta is empty', () => {
    const ledger: PendingDayLedger = {
      dayKey: 1,
      taskSummaries: [{ taskId: 't1', mode: 'Fishing', result: 'nothing' }],
      pendingInventoryDelta: [],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(screen.getByText('No items collected yet')).toBeInTheDocument();
  });

  it('displays food items from inventory delta', () => {
    const ledger: PendingDayLedger = {
      dayKey: 1,
      taskSummaries: [{ taskId: 't1', mode: 'Fishing', result: 'caught trout' }],
      pendingInventoryDelta: [
        { type: 'food', speciesName: 'Trout', foodType: 'fish', units: 5 },
      ],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(screen.getByText('Food:')).toBeInTheDocument();
    expect(screen.getByText(/Trout.*5 units.*fish/)).toBeInTheDocument();
  });

  it('displays material items from inventory delta', () => {
    const ledger: PendingDayLedger = {
      dayKey: 1,
      taskSummaries: [{ taskId: 't1', mode: 'Foraging', result: 'found ore' }],
      pendingInventoryDelta: [
        { type: 'material', name: 'Iron Ore', materialType: 'metal', units: 3 },
      ],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(screen.getByText('Materials:')).toBeInTheDocument();
    expect(screen.getByText(/Iron Ore.*3 units.*metal/)).toBeInTheDocument();
  });
});

// ============================================================================
// TaskListPanel
// ============================================================================

describe('TaskListPanel', () => {
  const defaultProps = {
    tasks: [] as TaskAssignment[],
    selectedTaskId: null as string | null,
    showAddTask: false,
    newTaskMode: 'Fishing' as const,
    onSelectTask: vi.fn(),
    onToggleAddTask: vi.fn(),
    onSetNewTaskMode: vi.fn(),
    onAddTask: vi.fn(),
    onDeleteTask: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<TaskListPanel {...defaultProps} />);
  });

  it('shows task count in heading', () => {
    render(<TaskListPanel {...defaultProps} />);
    expect(screen.getByText('Tasks (0)')).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    render(<TaskListPanel {...defaultProps} />);
    expect(screen.getByText('No tasks planned for this slot')).toBeInTheDocument();
  });

  it('shows Add Task button', () => {
    render(<TaskListPanel {...defaultProps} />);
    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('calls onToggleAddTask when Add Task is clicked', () => {
    const onToggleAddTask = vi.fn();
    render(<TaskListPanel {...defaultProps} onToggleAddTask={onToggleAddTask} />);
    fireEvent.click(screen.getByText('Add Task'));
    expect(onToggleAddTask).toHaveBeenCalledTimes(1);
  });

  it('shows add task form when showAddTask is true', () => {
    render(<TaskListPanel {...defaultProps} showAddTask={true} />);
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onAddTask when Create is clicked', () => {
    const onAddTask = vi.fn();
    render(<TaskListPanel {...defaultProps} showAddTask={true} onAddTask={onAddTask} />);
    fireEvent.click(screen.getByText('Create'));
    expect(onAddTask).toHaveBeenCalledTimes(1);
  });

  it('renders task items with mode and worker count', () => {
    const tasks: TaskAssignment[] = [
      {
        id: 'task-1',
        dayKey: 1,
        slot: 0,
        orderIndex: 0,
        mode: 'Fishing',
        leaderWorkerId: null,
        helperWorkerIds: [],
        assignedWorkerIds: ['w1', 'w2'],
        environmentId: null,
        selectedToolIds: [],
        resolutionState: 'Draft',
      },
    ];
    render(<TaskListPanel {...defaultProps} tasks={tasks} />);
    expect(screen.getByText('Tasks (1)')).toBeInTheDocument();
    expect(screen.getByText('Fishing')).toBeInTheDocument();
    expect(screen.getByText('2 worker(s)')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows "No workers assigned" when task has no workers', () => {
    const tasks: TaskAssignment[] = [
      {
        id: 'task-1',
        dayKey: 1,
        slot: 0,
        orderIndex: 0,
        mode: 'Foraging',
        leaderWorkerId: null,
        helperWorkerIds: [],
        assignedWorkerIds: [],
        environmentId: null,
        selectedToolIds: [],
        resolutionState: 'Draft',
      },
    ];
    render(<TaskListPanel {...defaultProps} tasks={tasks} />);
    expect(screen.getByText('No workers assigned')).toBeInTheDocument();
  });

  it('calls onSelectTask when a task is clicked', () => {
    const onSelectTask = vi.fn();
    const tasks: TaskAssignment[] = [
      {
        id: 'task-1',
        dayKey: 1,
        slot: 0,
        orderIndex: 0,
        mode: 'Fishing',
        leaderWorkerId: null,
        helperWorkerIds: [],
        assignedWorkerIds: [],
        environmentId: null,
        selectedToolIds: [],
        resolutionState: 'Draft',
      },
    ];
    render(<TaskListPanel {...defaultProps} tasks={tasks} onSelectTask={onSelectTask} />);
    fireEvent.click(screen.getByText('Fishing'));
    expect(onSelectTask).toHaveBeenCalledWith('task-1');
  });
});
