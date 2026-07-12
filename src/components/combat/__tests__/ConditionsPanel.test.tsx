import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../ui', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: vi.fn(() => Promise.resolve(false)),
    dialogProps: { open: false, onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
  useToast: () => ({
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../../constants/conditions', () => ({
  getAllConditions: vi.fn(() => [
    { id: 'stunned', label: 'Stunned', icon: '💫', description: 'Cannot act' },
    { id: 'poisoned', label: 'Poisoned', icon: '🧪', description: 'Taking toxin damage' },
  ]),
  getCondition: vi.fn((id: string) => {
    const map: Record<string, unknown> = {
      stunned: { id: 'stunned', label: 'Stunned', icon: '💫', description: 'Cannot act' },
      poisoned: { id: 'poisoned', label: 'Poisoned', icon: '🧪', description: 'Taking toxin damage' },
    };
    return map[id] ?? null;
  }),
  getConditionIcon: vi.fn((id: string) => (id === 'stunned' ? '💫' : '🧪')),
  isConditionObvious: vi.fn((id: string) => id === 'stunned'),
  DurationType: {
    PERMANENT: 'permanent',
    TURNS: 'turns',
    ROUNDS: 'rounds',
    UNTIL_END_OF_COMBAT: 'until_end_of_combat',
  },
}));

vi.mock('../../../utils/conditionsEngine', () => ({
  getActiveConditions: vi.fn(
    (participant: { conditions?: unknown[] }) => participant.conditions || []
  ),
  createConditionInstance: vi.fn(() => null),
  formatConditionDuration: vi.fn(() => 'Permanent'),
}));

import ConditionsPanel from '../ConditionsPanel';
import type { ConditionInstance } from '../../../types/combatTracker';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const EYE_TITLE_CLOSED = "Hidden from players — click to telegraph as 'Afflicted'";
const EYE_TITLE_HALF = "Telegraphed as 'Afflicted' — click to reveal fully";
const EYE_TITLE_OPEN = 'Visible to players — click to hide';

function makeCondition(overrides: Partial<ConditionInstance> = {}): ConditionInstance {
  return {
    instanceId: 'ci-1',
    conditionId: 'poisoned',
    label: 'Poisoned',
    revealed: 'closed',
    ...overrides,
  };
}

function renderPanel({
  category,
  conditions = [makeCondition()],
  onCycleRevealed,
}: {
  category?: string;
  conditions?: ConditionInstance[];
  onCycleRevealed?: (id: string) => void;
}) {
  return render(
    <ConditionsPanel
      participant={{ id: 'p-1', name: 'Ogre', category, conditions }}
      currentRound={1}
      currentTurn={0}
      onAddCondition={vi.fn()}
      onRemoveCondition={vi.fn()}
      onCycleRevealed={onCycleRevealed}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConditionsPanel eye toggle (Phase 12a.6)', () => {
  it('renders an eye button per condition on NPCs', () => {
    renderPanel({
      category: 'enemy',
      conditions: [
        makeCondition({ instanceId: 'ci-1', revealed: 'closed' }),
        makeCondition({ instanceId: 'ci-2', conditionId: 'stunned', label: 'Stunned', revealed: 'open' }),
      ],
      onCycleRevealed: vi.fn(),
    });

    expect(screen.getByLabelText(EYE_TITLE_CLOSED)).toBeInTheDocument();
    expect(screen.getByLabelText(EYE_TITLE_OPEN)).toBeInTheDocument();
  });

  it('describes each of the three states', () => {
    renderPanel({
      category: 'enemy',
      conditions: [
        makeCondition({ instanceId: 'ci-1', revealed: 'closed' }),
        makeCondition({ instanceId: 'ci-2', revealed: 'half' }),
        makeCondition({ instanceId: 'ci-3', revealed: 'open' }),
      ],
      onCycleRevealed: vi.fn(),
    });

    expect(screen.getByLabelText(EYE_TITLE_CLOSED)).toBeInTheDocument();
    expect(screen.getByLabelText(EYE_TITLE_HALF)).toBeInTheDocument();
    expect(screen.getByLabelText(EYE_TITLE_OPEN)).toBeInTheDocument();
  });

  it('calls onCycleRevealed with the condition instanceId on click', () => {
    const onCycleRevealed = vi.fn();
    renderPanel({
      category: 'enemy',
      conditions: [makeCondition({ instanceId: 'ci-42', revealed: 'open' })],
      onCycleRevealed,
    });

    fireEvent.click(screen.getByLabelText(EYE_TITLE_OPEN));
    expect(onCycleRevealed).toHaveBeenCalledExactlyOnceWith('ci-42');
  });

  it('falls back to catalog obviousness for unmigrated instances', () => {
    renderPanel({
      category: 'enemy',
      conditions: [
        // isConditionObvious mock: stunned → true, poisoned → false
        makeCondition({ instanceId: 'ci-1', conditionId: 'stunned', label: 'Stunned', revealed: undefined }),
        makeCondition({ instanceId: 'ci-2', conditionId: 'poisoned', label: 'Poisoned', revealed: undefined }),
      ],
      onCycleRevealed: vi.fn(),
    });

    expect(screen.getByLabelText(EYE_TITLE_OPEN)).toBeInTheDocument();
    expect(screen.getByLabelText(EYE_TITLE_CLOSED)).toBeInTheDocument();
  });

  it('treats a missing category as NPC (matches the player-view filter)', () => {
    renderPanel({ category: undefined, onCycleRevealed: vi.fn() });

    expect(screen.getByLabelText(EYE_TITLE_CLOSED)).toBeInTheDocument();
  });

  it('does not render eye buttons for players', () => {
    renderPanel({ category: 'player', onCycleRevealed: vi.fn() });

    expect(screen.queryByLabelText(/click to/)).not.toBeInTheDocument();
  });

  it('does not render eye buttons for allies', () => {
    renderPanel({ category: 'ally', onCycleRevealed: vi.fn() });

    expect(screen.queryByLabelText(/click to/)).not.toBeInTheDocument();
  });

  it('does not render eye buttons without an onCycleRevealed handler (player view)', () => {
    renderPanel({ category: 'enemy', onCycleRevealed: undefined });

    expect(screen.queryByLabelText(/click to/)).not.toBeInTheDocument();
  });

  it('still renders the condition badges alongside the eye controls', () => {
    renderPanel({
      category: 'enemy',
      conditions: [makeCondition({ revealed: 'half' })],
      onCycleRevealed: vi.fn(),
    });

    expect(screen.getByText('Poisoned')).toBeInTheDocument();
  });
});
