import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterSelector, MultiCharacterSelector } from '../CharacterSelector';
import { ToolSelector, ToolDisplay } from '../ToolSelector';
import { StatusBadge, getStatusBorderColor, getStatusBackgroundColor } from '../StatusBadge';
import { ValidationError, InlineError } from '../ValidationError';
import { TaskActions, ResolveButton, CancelButton } from '../TaskActions';
import { TaskResultsDisplay, CancelledMessage } from '../TaskResultsDisplay';
import type { Character } from '../../../../../types/campaign';
import type { CharacterSlotSummary } from '../../../../../state/downtime/downtimeSelectors';
import type { TaskStatus, TaskResults } from '../../../../../types/downtime';
import { DOWNTIME_ERROR_CODES } from '../../../../../state/downtime/downtimeErrors';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockCharacters: Character[] = [
  { id: 'char-1', name: 'Aldric', st: 10, work: { skills: { fishing: 12 } } },
  { id: 'char-2', name: 'Brina', st: 12, work: { skills: { fishing: 14 } } },
  { id: 'char-3', name: 'Cael', st: 14, work: { skills: { mining: 10 } } },
];

const mockSummaries = new Map<string, CharacterSlotSummary>([
  ['char-2', {
    characterId: 'char-2',
    isAssigned: true,
    activityDisplayName: 'Fishing',
    fatigueStatus: 'rested',
    taskId: 'task-1',
    role: 'leader',
    activityType: 'fishing',
  } as CharacterSlotSummary],
]);

const mockTools = [
  { id: 'tool-1', name: 'Pickaxe', type: 'mining' },
  { id: 'tool-2', name: 'Shovel', type: 'mining' },
  { id: 'tool-3', name: 'Drill', type: 'mining', condition: 'Worn' },
];

// ============================================================================
// CharacterSelector
// ============================================================================

describe('CharacterSelector', () => {
  const defaultProps = {
    label: 'Leader',
    value: '',
    onChange: vi.fn(),
    characters: mockCharacters,
  };

  it('renders label and placeholder', () => {
    render(<CharacterSelector {...defaultProps} />);
    expect(screen.getByText('Leader')).toBeInTheDocument();
    expect(screen.getByText('Select a character...')).toBeInTheDocument();
  });

  it('renders all characters as options', () => {
    render(<CharacterSelector {...defaultProps} />);
    const select = screen.getByTestId('character-selector');
    expect(select).toBeInTheDocument();
    // All 3 chars + placeholder
    expect(select.querySelectorAll('option')).toHaveLength(4);
  });

  it('calls onChange when selection changes', () => {
    const onChange = vi.fn();
    render(<CharacterSelector {...defaultProps} onChange={onChange} />);
    const select = screen.getByTestId('character-selector');
    fireEvent.change(select, { target: { value: 'char-1' } });
    expect(onChange).toHaveBeenCalledWith('char-1');
  });

  it('shows assignment status when summaries provided', () => {
    render(<CharacterSelector {...defaultProps} summaries={mockSummaries} />);
    // Brina should show "(Fishing)" since she's assigned
    const select = screen.getByTestId('character-selector');
    const options = Array.from(select.querySelectorAll('option'));
    const brinaOption = options.find(o => o.textContent?.includes('Brina'));
    expect(brinaOption?.textContent).toContain('Fishing');
  });

  it('marks excluded characters in options', () => {
    render(<CharacterSelector {...defaultProps} excludeIds={['char-3']} />);
    const select = screen.getByTestId('character-selector');
    const options = Array.from(select.querySelectorAll('option'));
    const caelOption = options.find(o => o.textContent?.includes('Cael'));
    expect(caelOption?.textContent).toContain('Selected above');
  });

  it('disables when disabled prop is true', () => {
    render(<CharacterSelector {...defaultProps} disabled />);
    expect(screen.getByTestId('character-selector')).toBeDisabled();
  });

  it('shows error message and error styling', () => {
    render(<CharacterSelector {...defaultProps} error="Character is required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Character is required');
  });

  it('uses custom placeholder', () => {
    render(<CharacterSelector {...defaultProps} placeholder="Pick one..." />);
    expect(screen.getByText('Pick one...')).toBeInTheDocument();
  });
});

// ============================================================================
// MultiCharacterSelector
// ============================================================================

describe('MultiCharacterSelector', () => {
  const defaultProps = {
    label: 'Helpers',
    value: [] as string[],
    onChange: vi.fn(),
    characters: mockCharacters,
  };

  it('renders label and character checkboxes', () => {
    render(<MultiCharacterSelector {...defaultProps} />);
    expect(screen.getByText('Helpers')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('toggles character selection on click', () => {
    const onChange = vi.fn();
    render(<MultiCharacterSelector {...defaultProps} onChange={onChange} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onChange).toHaveBeenCalled();
  });

  it('shows selected count with maxSelections', () => {
    render(<MultiCharacterSelector {...defaultProps} value={['char-1']} maxSelections={2} />);
    expect(screen.getByText('(1/2)')).toBeInTheDocument();
  });

  it('disables unselected when max reached', () => {
    render(
      <MultiCharacterSelector {...defaultProps} value={['char-1', 'char-2']} maxSelections={2} />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // The third checkbox (not selected) should be disabled
    const unselected = checkboxes.find(cb => !(cb as HTMLInputElement).checked);
    expect(unselected).toBeDisabled();
  });

  it('excludes characters based on excludeIds', () => {
    render(<MultiCharacterSelector {...defaultProps} excludeIds={['char-1', 'char-2', 'char-3']} />);
    expect(screen.getByText('No characters available')).toBeInTheDocument();
  });

  it('filters out assigned characters', () => {
    render(<MultiCharacterSelector {...defaultProps} summaries={mockSummaries} />);
    // Brina is assigned so should be filtered out
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2); // Only Aldric and Cael
  });
});

// ============================================================================
// ToolSelector
// ============================================================================

describe('ToolSelector', () => {
  const defaultProps = {
    label: 'Tools',
    value: [] as string[],
    onChange: vi.fn(),
    tools: mockTools,
  };

  it('renders label and tool checkboxes', () => {
    render(<ToolSelector {...defaultProps} />);
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('toggles tool selection', () => {
    const onChange = vi.fn();
    render(<ToolSelector {...defaultProps} onChange={onChange} />);
    // Tools are sorted alphabetically (Drill, Pickaxe, Shovel), so first checkbox is Drill (tool-3)
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onChange).toHaveBeenCalled();
    // Verify the ID added is one of our tools
    const calledWith = onChange.mock.calls[0][0] as string[];
    expect(calledWith).toHaveLength(1);
    expect(mockTools.map(t => t.id)).toContain(calledWith[0]);
  });

  it('removes tool from selection on second click', () => {
    const onChange = vi.fn();
    render(<ToolSelector {...defaultProps} value={['tool-1']} onChange={onChange} />);
    const checkboxes = screen.getAllByRole('checkbox');
    const selected = checkboxes.find(cb => (cb as HTMLInputElement).checked);
    fireEvent.click(selected!);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows reserved tools as disabled with "In use" label', () => {
    render(<ToolSelector {...defaultProps} reservedToolIds={new Set(['tool-2'])} />);
    expect(screen.getByText('In use')).toBeInTheDocument();
  });

  it('shows min/max requirement counters', () => {
    render(<ToolSelector {...defaultProps} minRequired={1} maxAllowed={2} />);
    expect(screen.getByText('(0/1 min, 2 max)')).toBeInTheDocument();
  });

  it('shows "No tools available" when empty', () => {
    render(<ToolSelector {...defaultProps} tools={[]} />);
    expect(screen.getByText('No tools available')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<ToolSelector {...defaultProps} error="Select at least one tool" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one tool');
  });

  it('shows tool condition text', () => {
    render(<ToolSelector {...defaultProps} />);
    expect(screen.getByText('Worn')).toBeInTheDocument();
  });

  it('shows reserved help text when reserved tools exist', () => {
    render(<ToolSelector {...defaultProps} reservedToolIds={new Set(['tool-2'])} />);
    expect(screen.getByText(/reserved by other tasks/)).toBeInTheDocument();
  });
});

// ============================================================================
// ToolDisplay
// ============================================================================

describe('ToolDisplay', () => {
  it('renders tool names from IDs', () => {
    render(<ToolDisplay toolIds={['tool-1', 'tool-3']} tools={mockTools} />);
    expect(screen.getByText('Pickaxe, Drill')).toBeInTheDocument();
  });

  it('returns null for empty toolIds', () => {
    const { container } = render(<ToolDisplay toolIds={[]} tools={mockTools} />);
    expect(container.firstChild).toBeNull();
  });

  it('falls back to ID for unknown tools', () => {
    render(<ToolDisplay toolIds={['unknown-id']} tools={mockTools} />);
    expect(screen.getByText('unknown-id')).toBeInTheDocument();
  });

  it('uses custom label', () => {
    render(<ToolDisplay toolIds={['tool-1']} tools={mockTools} label="Equipment" />);
    expect(screen.getByText('Equipment:')).toBeInTheDocument();
  });
});

// ============================================================================
// StatusBadge
// ============================================================================

describe('StatusBadge', () => {
  const statuses: TaskStatus[] = ['pending', 'in_progress', 'resolved', 'cancelled'];

  it.each(statuses)('renders %s status with correct label', (status) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-status', status);
  });

  it('uses custom label when provided', () => {
    render(<StatusBadge status="pending" label="Queued" />);
    expect(screen.getByText('Queued')).toBeInTheDocument();
  });

  it('renders default labels correctly', () => {
    const { rerender } = render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();

    rerender(<StatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();

    rerender(<StatusBadge status="resolved" />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();

    rerender(<StatusBadge status="cancelled" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});

describe('getStatusBorderColor', () => {
  it('returns correct border color for each status', () => {
    expect(getStatusBorderColor('pending')).toContain('yellow');
    expect(getStatusBorderColor('in_progress')).toContain('accent');
    expect(getStatusBorderColor('resolved')).toContain('success');
    expect(getStatusBorderColor('cancelled')).toContain('edge');
  });
});

describe('getStatusBackgroundColor', () => {
  it('returns correct background color for each status', () => {
    expect(getStatusBackgroundColor('pending')).toContain('yellow');
    expect(getStatusBackgroundColor('in_progress')).toContain('accent');
    expect(getStatusBackgroundColor('resolved')).toContain('success');
    expect(getStatusBackgroundColor('cancelled')).toContain('surface');
  });
});

// ============================================================================
// ValidationError
// ============================================================================

describe('ValidationError', () => {
  it('renders error message and code', () => {
    render(
      <ValidationError
        code={DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED}
        message="Aldric is already assigned to Fishing"
      />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Aldric is already assigned to Fishing')).toBeInTheDocument();
    expect(screen.getByText('Character Already Assigned')).toBeInTheDocument();
  });

  it('renders dismiss button when onDismiss provided', () => {
    const onDismiss = vi.fn();
    render(
      <ValidationError
        code={DOWNTIME_ERROR_CODES.UNKNOWN_ERROR}
        message="Something went wrong"
        onDismiss={onDismiss}
      />
    );
    const dismissButton = screen.getByLabelText('Dismiss error');
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not render dismiss button when onDismiss absent', () => {
    render(
      <ValidationError
        code={DOWNTIME_ERROR_CODES.UNKNOWN_ERROR}
        message="Something went wrong"
      />
    );
    expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument();
  });

  it('shows metadata for assignment errors', () => {
    render(
      <ValidationError
        code={DOWNTIME_ERROR_CODES.LEADER_ALREADY_ASSIGNED}
        message="Already assigned"
        meta={{ existingRole: 'leader', characterId: 'char-1' }}
      />
    );
    expect(screen.getByText(/Currently assigned as: leader/)).toBeInTheDocument();
    expect(screen.getByText(/Character: char-1/)).toBeInTheDocument();
  });

  it('shows lock conflict help text', () => {
    render(
      <ValidationError
        code={DOWNTIME_ERROR_CODES.LOCK_CONFLICT}
        message="Locked"
        meta={{}}
      />
    );
    expect(screen.getByText(/cannot retry the same activity/)).toBeInTheDocument();
  });

  it('shows conflicting tool IDs for tool conflicts', () => {
    render(
      <ValidationError
        code={DOWNTIME_ERROR_CODES.TOOL_CONFLICT}
        message="Tool in use"
        meta={{ conflictingToolIds: ['tool-1', 'tool-2'] }}
      />
    );
    expect(screen.getByText(/Conflicting tools: tool-1, tool-2/)).toBeInTheDocument();
  });

  it('uses default config for unknown error codes', () => {
    render(
      <ValidationError code="CUSTOM_ERROR" message="Custom error occurred" />
    );
    expect(screen.getByText('Validation Error')).toBeInTheDocument();
    expect(screen.getByText('Custom error occurred')).toBeInTheDocument();
  });
});

describe('InlineError', () => {
  it('renders error message with alert role', () => {
    render(<InlineError message="Field is required" />);
    const alert = screen.getByTestId('inline-error');
    expect(alert).toHaveTextContent('Field is required');
    expect(alert).toHaveAttribute('role', 'alert');
  });
});

// ============================================================================
// TaskActions
// ============================================================================

describe('TaskActions', () => {
  it('renders resolve and cancel buttons', () => {
    render(<TaskActions status="pending" />);
    expect(screen.getByTestId('resolve-button')).toHaveTextContent('Resolve');
    expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancel');
  });

  it('calls onResolve when resolve button clicked', () => {
    const onResolve = vi.fn();
    render(<TaskActions status="pending" onResolve={onResolve} />);
    fireEvent.click(screen.getByTestId('resolve-button'));
    expect(onResolve).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<TaskActions status="pending" onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('cancel-button'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables buttons when status is in_progress', () => {
    render(<TaskActions status="in_progress" />);
    expect(screen.getByTestId('resolve-button')).toBeDisabled();
    expect(screen.getByTestId('cancel-button')).toBeDisabled();
  });

  it('shows resolvingLabel when in_progress', () => {
    render(<TaskActions status="in_progress" resolvingLabel="Working..." />);
    expect(screen.getByTestId('resolve-button')).toHaveTextContent('Working...');
  });

  it('uses custom resolveLabel', () => {
    render(<TaskActions status="pending" resolveLabel="Complete" />);
    expect(screen.getByTestId('resolve-button')).toHaveTextContent('Complete');
  });
});

describe('ResolveButton', () => {
  it('renders with default label', () => {
    render(<ResolveButton />);
    expect(screen.getByTestId('resolve-button')).toHaveTextContent('Resolve');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ResolveButton onClick={onClick} />);
    fireEvent.click(screen.getByTestId('resolve-button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('disables when disabled prop set', () => {
    render(<ResolveButton disabled />);
    expect(screen.getByTestId('resolve-button')).toBeDisabled();
  });
});

describe('CancelButton', () => {
  it('renders with default label', () => {
    render(<CancelButton />);
    expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancel');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<CancelButton onClick={onClick} />);
    fireEvent.click(screen.getByTestId('cancel-button'));
    expect(onClick).toHaveBeenCalled();
  });
});

// ============================================================================
// TaskResultsDisplay
// ============================================================================

describe('TaskResultsDisplay', () => {
  it('renders success result with success styling', () => {
    const results: TaskResults = {
      success: true,
      message: 'Caught 3 fish!',
      inventoryChanges: [
        { itemName: 'Trout', quantity: 3, itemId: 'trout' },
      ],
    };
    render(<TaskResultsDisplay results={results} />);
    const container = screen.getByTestId('task-results');
    expect(container).toHaveTextContent('Caught 3 fish!');
    expect(container.className).toContain('success');
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('Trout')).toBeInTheDocument();
  });

  it('renders failure result with surface styling', () => {
    const results: TaskResults = {
      success: false,
      message: 'The fish got away!',
    };
    render(<TaskResultsDisplay results={results} />);
    const container = screen.getByTestId('task-results');
    expect(container.className).toContain('surface');
  });

  it('shows experience gained', () => {
    const results: TaskResults = {
      success: true,
      message: 'Success!',
      experienceGained: 50,
    };
    render(<TaskResultsDisplay results={results} />);
    expect(screen.getByText('+50 XP')).toBeInTheDocument();
  });

  it('hides experience when zero', () => {
    const results: TaskResults = {
      success: true,
      message: 'Success!',
      experienceGained: 0,
    };
    render(<TaskResultsDisplay results={results} />);
    expect(screen.queryByText('XP')).not.toBeInTheDocument();
  });

  it('renders negative inventory changes with red styling', () => {
    const results: TaskResults = {
      success: true,
      message: 'Used materials',
      inventoryChanges: [
        { itemName: 'Iron Ore', quantity: -2, itemId: 'iron' },
      ],
    };
    render(<TaskResultsDisplay results={results} />);
    expect(screen.getByText('-2')).toBeInTheDocument();
  });
});

describe('CancelledMessage', () => {
  it('renders default message', () => {
    render(<CancelledMessage />);
    expect(screen.getByTestId('cancelled-message')).toHaveTextContent('Task was cancelled');
  });

  it('renders custom message', () => {
    render(<CancelledMessage message="Activity aborted by GM" />);
    expect(screen.getByTestId('cancelled-message')).toHaveTextContent('Activity aborted by GM');
  });
});
