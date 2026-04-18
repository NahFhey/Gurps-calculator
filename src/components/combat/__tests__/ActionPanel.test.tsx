import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActionPanel from '../ActionPanel';
import type {
  ActionPanelParticipant,
  ActionData,
  ManeuverWorkflowUpdate,
  ManeuverSelection,
  TurnDecision
} from '../../../types/actionPanel';

vi.mock('../AttackAssist', () => ({
  default: ({
    injectedModifiers,
  }: {
    injectedModifiers?: Array<{ label: string; value: number }>;
  }) => (
    <div data-testid="attack-assist">
      Attack Assist ({injectedModifiers?.length ?? 0} modifiers)
    </div>
  ),
}));

vi.mock('../DefenseAssist', () => ({
  default: () => <div data-testid="defense-assist">Defense Assist</div>,
}));

vi.mock('../InjuryResolutionPanel', () => ({
  default: () => <div data-testid="injury-resolution">Injury Resolution</div>,
}));

vi.mock('../ConditionsPanel', () => ({
  default: () => <div data-testid="conditions-panel">Conditions Panel</div>,
}));

function createParticipant(
  overrides: Partial<ActionPanelParticipant> = {}
): ActionPanelParticipant {
  return {
    instanceId: 'ally-1',
    id: 'ally-1',
    name: 'Sir Aldren',
    category: 'ally',
    st: 11,
    hp: 12,
    currentHP: 12,
    dodge: 9,
    parry: 10,
    block: 9,
    defenses: {
      dodge: 9,
      parry: 10,
      block: 9,
    },
    conditions: [],
    ...overrides,
  };
}

interface RenderActionPanelOptions {
  currentActor?: ActionPanelParticipant;
  participants?: ActionPanelParticipant[];
  maneuverSelection?: ManeuverSelection | null;
  turnDecision?: TurnDecision | null;
  onActionComplete?: (data: ActionData) => void;
  onManeuverWorkflow?: (update: ManeuverWorkflowUpdate) => void;
}

function renderActionPanel({
  currentActor = createParticipant(),
  participants = [
    createParticipant(),
    createParticipant({
      instanceId: 'enemy-1',
      id: 'enemy-1',
      name: 'Goblin Skirmisher',
      category: 'enemy',
      dodge: 8,
      parry: 0,
      block: 0,
      defenses: { dodge: 8 },
    }),
    createParticipant({
      instanceId: 'enemy-2',
      id: 'enemy-2',
      name: 'Ogre Brute',
      category: 'enemy',
      dodge: 7,
      parry: 0,
      block: 0,
      defenses: { dodge: 7 },
    }),
  ],
  maneuverSelection = null,
  turnDecision = null,
  onActionComplete = vi.fn(),
  onManeuverWorkflow = vi.fn(),
}: RenderActionPanelOptions = {}) {
  return render(
    <ActionPanel
      currentActor={currentActor}
      participants={participants}
      combatState={{ participants }}
      revealState={null}
      onActionComplete={onActionComplete}
      maneuverSelection={maneuverSelection}
      turnDecision={turnDecision}
      onManeuverWorkflow={onManeuverWorkflow}
    />
  );
}

describe('ActionPanel', () => {
  it('shows maneuver prompt widgets and forwards aim/wait updates', () => {
    const onManeuverWorkflow = vi.fn();

    renderActionPanel({
      maneuverSelection: {
        selectedId: 'aim',
        prompts: { allowsAimPanel: true, allowsWaitPanel: true },
        workflow: {},
      },
      turnDecision: {
        aim: { targetInstanceId: 'enemy-1', turnsAimed: 2 },
        wait: { triggerText: 'If the target advances' },
      },
      onManeuverWorkflow,
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'enemy-2' },
    });
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '3' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Describe the trigger condition'),
      {
        target: { value: 'When the ogre charges' },
      }
    );

    expect(onManeuverWorkflow).toHaveBeenNthCalledWith(1, {
      type: 'aim',
      targetInstanceId: 'enemy-2',
    });
    expect(onManeuverWorkflow).toHaveBeenNthCalledWith(2, {
      type: 'aim',
      turnsAimed: 3,
    });
    expect(onManeuverWorkflow).toHaveBeenNthCalledWith(3, {
      type: 'wait',
      triggerText: 'When the ogre charges',
    });
  });

  it('keeps attack and defense gated until a maneuver enables them', () => {
    renderActionPanel();

    expect(screen.getByRole('button', { name: 'Attack' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Defense' })).toBeDisabled();
    expect(
      screen.getByText('Select a maneuver above to enable relevant workflows.')
    ).toBeInTheDocument();
  });

  it('auto-opens the attack workflow when the selected maneuver allows attacks', async () => {
    renderActionPanel({
      maneuverSelection: {
        selectedId: 'attack',
        prompts: { allowsAttackPanel: true },
        workflow: {
          attack: {
            modifiers: [{ label: 'Aim', value: 1 }],
          },
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Attack Workflow')).toBeInTheDocument();
    });

    expect(screen.getByTestId('attack-assist')).toHaveTextContent(
      'Attack Assist (1 modifiers)'
    );
    expect(screen.queryByText('Choose Action')).not.toBeInTheDocument();
  });

  it('submits note actions and returns to the chooser state', async () => {
    const onActionComplete = vi.fn();

    renderActionPanel({ onActionComplete });

    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    fireEvent.change(
      screen.getByPlaceholderText('Enter note or description...'),
      { target: { value: 'Hold the bridge' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }));

    expect(onActionComplete).toHaveBeenCalledWith({
      maneuver: null,
      kind: 'note',
      note: 'Hold the bridge',
    });

    await waitFor(() => {
      expect(screen.getByText('Choose Action')).toBeInTheDocument();
    });
  });
});
