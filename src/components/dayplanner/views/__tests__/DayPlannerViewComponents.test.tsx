import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayHeaderBar } from '../DayHeaderBar';
import { DaySummaryPanel } from '../DaySummaryPanel';
import type {
  DayHeaderBarProps,
  PendingDayLedger,
  TaskSummary,
} from '../../../../types/dayplanner';

function makeTaskSummary(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    taskId: 'task-1',
    mode: 'Fishing',
    result: 'success',
    ...overrides,
  };
}

// ============================================================================
// DayHeaderBar
// ============================================================================

describe('DayHeaderBar', () => {
  const defaultProps: DayHeaderBarProps = {
    currentDay: 5,
    currentSlot: 0,
    canAdvance: { canAdvance: true },
    onSleep: vi.fn(),
    onAdvanceSlot: vi.fn(),
  };

  it('renders current day and slot', () => {
    render(<DayHeaderBar {...defaultProps} />);
    expect(screen.getByText('Day 5')).toBeInTheDocument();
    expect(screen.getByText(/Morning/)).toBeInTheDocument();
    expect(screen.getByText(/Slot 1\/3/)).toBeInTheDocument();
  });

  it('calls onSleep when Sleep button clicked', () => {
    const onSleep = vi.fn();
    render(<DayHeaderBar {...defaultProps} onSleep={onSleep} />);
    fireEvent.click(screen.getByText('Sleep'));
    expect(onSleep).toHaveBeenCalled();
  });

  it('calls onAdvanceSlot when Advance Slot button clicked', () => {
    const onAdvanceSlot = vi.fn();
    render(<DayHeaderBar {...defaultProps} onAdvanceSlot={onAdvanceSlot} />);
    fireEvent.click(screen.getByText('Advance Slot'));
    expect(onAdvanceSlot).toHaveBeenCalled();
  });

  it('disables advance button when canAdvance is false', () => {
    render(
      <DayHeaderBar
        {...defaultProps}
        canAdvance={{ canAdvance: false, reason: 'Tasks still pending' }}
      />
    );
    const advanceButton = screen.getByText('Advance Slot');
    expect(advanceButton.closest('button')).toBeDisabled();
    expect(screen.getByText('Tasks still pending')).toBeInTheDocument();
  });

  it('shows "End Day" on last slot', () => {
    render(<DayHeaderBar {...defaultProps} currentSlot={2} />);
    expect(screen.getByText('End Day')).toBeInTheDocument();
    expect(screen.getByText(/Night/)).toBeInTheDocument();
  });

  it('shows Afternoon for slot 1', () => {
    render(<DayHeaderBar {...defaultProps} currentSlot={1} />);
    expect(screen.getByText(/Afternoon/)).toBeInTheDocument();
    expect(screen.getByText(/Slot 2\/3/)).toBeInTheDocument();
  });
});

// ============================================================================
// DaySummaryPanel
// ============================================================================

describe('DaySummaryPanel', () => {
  it('returns null when no ledger', () => {
    const { container } = render(<DaySummaryPanel pendingDayLedger={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when ledger has no task summaries', () => {
    const ledger: PendingDayLedger = {
      dayKey: 5,
      taskSummaries: [],
      pendingInventoryDelta: [],
      committed: false,
    };
    const { container } = render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders task count', () => {
    const ledger: PendingDayLedger = {
      dayKey: 5,
      taskSummaries: [
        makeTaskSummary({ taskId: 't1' }),
        makeTaskSummary({ taskId: 't2', mode: 'Foraging' }),
      ],
      pendingInventoryDelta: [],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(screen.getByText('2 task(s) completed')).toBeInTheDocument();
    expect(screen.getByText('Pending Day Summary')).toBeInTheDocument();
  });

  it('renders food items in inventory delta', () => {
    const ledger: PendingDayLedger = {
      dayKey: 5,
      taskSummaries: [
        makeTaskSummary({ taskId: 't1' }),
      ],
      pendingInventoryDelta: [
        { type: 'food', speciesName: 'Trout', foodType: 'raw', units: 3 },
        { type: 'food', speciesName: 'Bass', foodType: 'raw', units: 2 },
      ],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(screen.getByText(/Trout.*3 units/)).toBeInTheDocument();
    expect(screen.getByText(/Bass.*2 units/)).toBeInTheDocument();
  });

  it('renders material items in inventory delta', () => {
    const ledger: PendingDayLedger = {
      dayKey: 5,
      taskSummaries: [
        makeTaskSummary({ taskId: 't1', mode: 'Foraging' }),
      ],
      pendingInventoryDelta: [
        { type: 'material', name: 'Iron Ore', materialType: 'ore', units: 5 },
      ],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(screen.getByText(/Iron Ore.*5 units/)).toBeInTheDocument();
  });

  it('shows "No items collected" when delta is empty but tasks exist', () => {
    const ledger: PendingDayLedger = {
      dayKey: 5,
      taskSummaries: [
        makeTaskSummary({ taskId: 't1', result: 'failure' }),
      ],
      pendingInventoryDelta: [],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    expect(screen.getByText('No items collected yet')).toBeInTheDocument();
  });

  it('groups duplicate food items', () => {
    const ledger: PendingDayLedger = {
      dayKey: 5,
      taskSummaries: [
        makeTaskSummary({ taskId: 't1' }),
        makeTaskSummary({ taskId: 't2' }),
      ],
      pendingInventoryDelta: [
        { type: 'food', speciesName: 'Trout', foodType: 'raw', units: 2 },
        { type: 'food', speciesName: 'Trout', foodType: 'raw', units: 3 },
      ],
      committed: false,
    };
    render(<DaySummaryPanel pendingDayLedger={ledger} />);
    // Should be grouped: 2 + 3 = 5 units
    expect(screen.getByText(/Trout.*5 units/)).toBeInTheDocument();
  });
});
