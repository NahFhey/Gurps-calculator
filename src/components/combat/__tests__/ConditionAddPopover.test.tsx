import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks (same surface as ConditionsPanel tests — the popover reuses the panel)
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
    { id: 'poisoned', label: 'Poisoned', icon: '🧪', description: 'Taking toxin damage' },
  ]),
  getCondition: vi.fn((id: string) =>
    id === 'poisoned'
      ? { id: 'poisoned', label: 'Poisoned', icon: '🧪', description: 'Taking toxin damage' }
      : null
  ),
  getConditionIcon: vi.fn(() => '🧪'),
  isConditionObvious: vi.fn(() => false),
  DurationType: {
    PERMANENT: 'permanent',
    TURNS: 'turns',
    ROUNDS: 'rounds',
    UNTIL_END_OF_COMBAT: 'until_end_of_combat',
  },
}));

const FAKE_INSTANCE = {
  instanceId: 'ci-new',
  conditionId: 'poisoned',
  label: 'Poisoned',
  revealed: 'closed',
};

vi.mock('../../../utils/conditionsEngine', () => ({
  getActiveConditions: vi.fn(
    (participant: { conditions?: unknown[] }) => participant.conditions || []
  ),
  createConditionInstance: vi.fn(() => FAKE_INSTANCE),
  formatConditionDuration: vi.fn(() => 'Permanent'),
}));

import ConditionAddPopover from '../ConditionAddPopover';
import type { ConditionInstance } from '../../../types/combatTracker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPopover(overrides: Record<string, unknown> = {}) {
  const props = {
    participant: {
      id: 'p-1',
      name: 'Ogre',
      category: 'enemy',
      conditions: [] as ConditionInstance[],
    },
    currentRound: 2,
    currentTurn: 1,
    anchor: { x: 100, y: 100 },
    onClose: vi.fn(),
    onAddCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    onCycleRevealed: vi.fn(),
    ...overrides,
  };
  const utils = render(<ConditionAddPopover {...props} />);
  return { ...utils, props };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConditionAddPopover (Phase 12a.6)', () => {
  it('renders as a dialog for the participant, portaled to document.body', () => {
    renderPopover();

    const dialog = screen.getByRole('dialog', { name: 'Conditions for Ogre' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement).toBe(document.body);
  });

  it('dispatches the same add-condition flow as the panel', () => {
    const { props } = renderPopover();

    // Open the add form, pick a condition, submit. The condition select is
    // the first combobox (the duration-type select renders after it).
    fireEvent.click(screen.getByText('Add Condition'));
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'poisoned' } });
    const submit = screen
      .getAllByText('Add Condition')
      .map((el) => el.closest('button')!)
      .find((b) => b.className.includes('bg-success'))!;
    fireEvent.click(submit);

    expect(props.onAddCondition).toHaveBeenCalledExactlyOnceWith(FAKE_INSTANCE);
  });

  it('shows eye toggles for NPC conditions and forwards cycling', () => {
    const { props } = renderPopover({
      participant: {
        id: 'p-1',
        name: 'Ogre',
        category: 'enemy',
        conditions: [
          { instanceId: 'ci-1', conditionId: 'poisoned', label: 'Poisoned', revealed: 'closed' },
        ],
      },
    });

    fireEvent.click(
      screen.getByLabelText("Hidden from players — click to telegraph as 'Afflicted'")
    );
    expect(props.onCycleRevealed).toHaveBeenCalledExactlyOnceWith('ci-1');
  });

  it('closes on Escape', () => {
    const { props } = renderPopover();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('closes on outside mousedown but not on inside mousedown', () => {
    const { props } = renderPopover();

    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Conditions for Ogre' }));
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.body);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('closes via the header X button', () => {
    const { props } = renderPopover();

    fireEvent.click(screen.getByLabelText('Close conditions popover'));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
