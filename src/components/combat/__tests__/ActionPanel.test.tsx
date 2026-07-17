import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ManeuverSelection, Participant } from '../../../types/combatTracker';

vi.mock('../AttackAssist', () => ({
  default: () => <div data-testid="attack-assist" />,
}));

vi.mock('../DefenseAssist', () => ({
  default: () => <div data-testid="defense-assist" />,
}));

vi.mock('../InjuryResolutionPanel', () => ({
  default: ({
    onComplete,
    onCancel,
  }: {
    onComplete: (injury: { targetInstanceId?: string; newHP?: number }) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="injury-resolution-panel">
      <button
        type="button"
        aria-label="Complete mocked injury"
        onClick={() => onComplete({ targetInstanceId: 'target-1', newHP: 5 })}
      >
        Complete Injury
      </button>
      <button type="button" aria-label="Cancel mocked injury" onClick={onCancel}>
        Cancel Injury
      </button>
    </div>
  ),
}));

vi.mock('../ConditionsPanel', () => ({
  default: () => <div data-testid="conditions-panel" />,
}));

vi.mock('../ManeuverWorkflowWidgets', () => ({
  default: () => null,
}));

import ActionPanel from '../ActionPanel';

function makeParticipant(
  overrides: Partial<Participant> & { instanceId: string; name: string },
): Participant {
  const { instanceId, name, ...participantOverrides } = overrides;

  return {
    instanceId,
    name,
    category: 'player',
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    hp: 10,
    fp: 10,
    mp: 10,
    basicSpeed: 5,
    basicMove: 5,
    ...participantOverrides,
  };
}

const currentActor = makeParticipant({ instanceId: 'actor-1', name: 'Alice' });
const target = makeParticipant({
  instanceId: 'target-1',
  name: 'Goblin',
  category: 'enemy',
});
const neutralManeuverSelection: ManeuverSelection = {
  selectedId: null,
  prompts: {},
  workflow: {},
};

const actionButtonLabels = [
  'Start attack workflow',
  'Start defense workflow',
  'Start damage workflow',
  'Add note',
  'Use item',
  'Manage conditions',
];

function renderActionPanel(
  props: Partial<
    Pick<
      ComponentProps<typeof ActionPanel>,
      | 'expanded'
      | 'onToggleExpanded'
      | 'onActionComplete'
      | 'onAddCondition'
      | 'onRemoveCondition'
    >
  > = {},
) {
  return render(
    <ActionPanel
      currentActor={currentActor}
      participants={[currentActor, target]}
      onActionComplete={props.onActionComplete ?? (() => undefined)}
      maneuverSelection={neutralManeuverSelection}
      expanded={props.expanded}
      onToggleExpanded={props.onToggleExpanded}
      onAddCondition={props.onAddCondition}
      onRemoveCondition={props.onRemoveCondition}
    />,
  );
}

describe('ActionPanel', () => {
  it('renders only the compact expansion control when collapsed', () => {
    const onToggleExpanded = vi.fn();
    renderActionPanel({ expanded: false, onToggleExpanded });

    expect(screen.getByRole('button', { name: 'Expand Action Panel' })).toBeInTheDocument();
    expect(screen.getByText('Action Panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start damage workflow' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Action Panel' }));
    expect(onToggleExpanded).toHaveBeenCalledOnce();
  });

  it('renders the heading, all six actions, and the collapse control when expanded', () => {
    const onToggleExpanded = vi.fn();
    renderActionPanel({ expanded: true, onToggleExpanded });

    expect(screen.getByRole('heading', { name: 'Action Panel' })).toBeInTheDocument();
    actionButtonLabels.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Collapse Action Panel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Action Panel' }));
    expect(onToggleExpanded).toHaveBeenCalledOnce();
  });

  it('selects workflows, hides the action grid, and switches after cancellation', () => {
    renderActionPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Start damage workflow' }));
    expect(screen.getByTestId('injury-resolution-panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start damage workflow' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel mocked injury' }));
    expect(screen.getByRole('button', { name: 'Start damage workflow' })).toBeInTheDocument();
    expect(screen.queryByTestId('injury-resolution-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.getByLabelText('Note text')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start damage workflow' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel note' }));
    expect(screen.getByRole('button', { name: 'Start damage workflow' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Note text')).not.toBeInTheDocument();
  });

  it('adds a non-empty note and closes the note workflow', () => {
    const onActionComplete = vi.fn();
    renderActionPanel({ onActionComplete });

    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    const submitButton = screen.getByRole('button', { name: 'Submit note' });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Note text'), {
      target: { value: 'Goblin is guarding the north door.' },
    });
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);

    expect(onActionComplete).toHaveBeenCalledOnce();
    expect(onActionComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'note',
        note: 'Goblin is guarding the north door.',
      }),
    );
    expect(screen.queryByLabelText('Note text')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start damage workflow' })).toBeInTheDocument();
  });

  it('dispatches the resolved injury when the damage workflow completes', () => {
    const onActionComplete = vi.fn();
    renderActionPanel({ onActionComplete });

    fireEvent.click(screen.getByRole('button', { name: 'Start damage workflow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete mocked injury' }));

    expect(onActionComplete).toHaveBeenCalledOnce();
    expect(onActionComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'injury',
        injury: { targetInstanceId: target.instanceId, newHP: 5 },
        targetInstanceId: target.instanceId,
        newHP: 5,
      }),
    );
    expect(screen.getByRole('button', { name: 'Start damage workflow' })).toBeInTheDocument();
  });

  it('opens and closes the conditions workflow when condition handlers are available', () => {
    renderActionPanel({ onAddCondition: vi.fn(), onRemoveCondition: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: 'Manage conditions' }));
    expect(screen.getByTestId('conditions-panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage conditions' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close conditions panel' }));
    expect(screen.queryByTestId('conditions-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage conditions' })).toBeInTheDocument();
  });
});
