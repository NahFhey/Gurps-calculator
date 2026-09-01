import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mock stores and heavy dependencies
// ---------------------------------------------------------------------------

vi.mock('../../../hooks/useCombatStore', () => ({
  useCombatStore: vi.fn(),
}));

vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: vi.fn(),
}));

// Mock conditionsEngine (JS util) — keep return values simple
vi.mock('../../../utils/conditionsEngine', () => ({
  formatConditionDuration: vi.fn(() => '2 rounds'),
  formatConditionTooltip: vi.fn(() => 'Stunned for 2 rounds'),
  getActiveConditions: vi.fn(() => []),
  createConditionInstance: vi.fn(() => null),
}));

// Mock conditions constants
vi.mock('../../../constants/conditions', () => ({
  getConditionIcon: vi.fn(() => '💫'),
  getAllConditions: vi.fn(() => [
    { id: 'stunned', label: 'Stunned', icon: '💫', description: 'Cannot act' },
    { id: 'prone', label: 'Prone', icon: '⬇', description: 'On the ground' },
  ]),
  getCondition: vi.fn((id: string) => {
    const map: Record<string, unknown> = {
      stunned: { id: 'stunned', label: 'Stunned', icon: '💫', description: 'Cannot act' },
      prone: { id: 'prone', label: 'Prone', icon: '⬇', description: 'On the ground' },
    };
    return map[id] ?? null;
  }),
  DurationType: {
    PERMANENT: 'permanent',
    TURNS: 'turns',
    ROUNDS: 'rounds',
    UNTIL_END_OF_COMBAT: 'until_end_of_combat',
  },
}));

// Mock modifiers util
vi.mock('../../../utils/modifiers', () => ({
  sumModifiers: vi.fn((mods: { value: number }[]) =>
    mods.reduce((s: number, m: { value: number }) => s + m.value, 0)
  ),
}));

// Mock combatHelpers (used by EncounterSetup)
vi.mock('../../../utils/combatHelpers', () => ({
  generateTurnOrder: vi.fn(() => []),
  createNumberedEnemies: vi.fn(() => []),
  generateId: vi.fn(() => 'mock-id'),
  createLogEntry: vi.fn(() => ({})),
  createTurnLogEntry: vi.fn(() => ({})),
  exportCombatLog: vi.fn(() => ''),
}));

// Mock combatViewFilter (used by ViewModeToggle)
vi.mock('../../../utils/combatViewFilter', () => ({
  ViewMode: { GM: 'gm', PLAYER: 'player' },
}));

// Mock ui components used across combat components
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

// Mock constants (COMBAT_CATEGORIES used in EncounterSetup)
vi.mock('../../../constants', () => ({
  COMBAT_CATEGORIES: ['player', 'ally', 'enemy', 'object'],
}));

// Mock campaign types
vi.mock('../../../types/characterSheet', () => ({
  DEFAULT_HIT_LOCATION_PROFILE: 'humanoid',
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useCombatStore } from '../../../hooks/useCombatStore';
import { useCampaignStore } from '../../../state/campaignStore';
import { generateId } from '../../../utils/combatHelpers';
import ViewModeToggle from '../ViewModeToggle';
import ConditionBadge from '../ConditionBadge';
import CombatHistory from '../CombatHistory';
import ModifierStack from '../ModifierStack';
import EncounterSetup from '../EncounterSetup';

const mockedUseCombatStore = vi.mocked(useCombatStore);
const mockedUseCampaignStore = vi.mocked(useCampaignStore);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function setupCombatStore(overrides: Record<string, unknown> = {}) {
  mockedUseCombatStore.mockReturnValue({
    combatCharacters: [],
    partyCharacters: [],
    combatHistory: [],
    combatActive: null,
    combatItems: [],
    saveCombatActive: vi.fn(),
    saveCombatCharacters: vi.fn(),
    saveCombatHistory: vi.fn(),
    saveCombatItems: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useCombatStore>);
}

function setupCampaignStore(overrides: Record<string, unknown> = {}) {
  mockedUseCampaignStore.mockReturnValue({
    state: {
      ui: { gmModeEnabled: false, pendingIntent: null },
      maps: { mapsById: {} },
      entities: { combatCharacters: {}, combatItems: {}, characters: {} },
      combat: { activeSession: null },
      ...((overrides.state as object) ?? {}),
    },
    actions: {
      updateState: vi.fn(),
      clearPendingIntent: vi.fn(),
      ...((overrides.actions as object) ?? {}),
    },
  } as unknown as ReturnType<typeof useCampaignStore>);
}

// ============================================================================
// 1. ViewModeToggle
// ============================================================================

describe('ViewModeToggle', () => {
  it('renders Player View button when in player mode', () => {
    render(
      <ViewModeToggle
        viewMode="player"
        setViewMode={vi.fn()}
        gmMode={false}
        setGmMode={vi.fn()}
      />
    );

    expect(screen.getByText('Player View')).toBeInTheDocument();
    expect(screen.getByText('Combat View:')).toBeInTheDocument();
    expect(screen.getByText('(Limited Info)')).toBeInTheDocument();
  });

  it('renders GM View button when in gm mode', () => {
    render(
      <ViewModeToggle
        viewMode="gm"
        setViewMode={vi.fn()}
        gmMode={true}
        setGmMode={vi.fn()}
      />
    );

    expect(screen.getByText('GM View')).toBeInTheDocument();
    expect(screen.getByText('(Full Truth)')).toBeInTheDocument();
    expect(screen.getByText(/Showing all secrets/)).toBeInTheDocument();
  });

  it('shows GM View locked indicator when gmMode is false', () => {
    render(
      <ViewModeToggle
        viewMode="player"
        setViewMode={vi.fn()}
        gmMode={false}
        setGmMode={vi.fn()}
      />
    );

    expect(screen.getByText('GM View locked')).toBeInTheDocument();
  });

  it('shows hidden-info reminder in player view', () => {
    render(
      <ViewModeToggle
        viewMode="player"
        setViewMode={vi.fn()}
        gmMode={false}
        setGmMode={vi.fn()}
      />
    );

    expect(screen.getByText(/Enemy HP\/DR\/Defenses hidden/)).toBeInTheDocument();
  });
});

// ============================================================================
// 2. ConditionBadge
// ============================================================================

describe('ConditionBadge', () => {
  it('renders condition label and icon in full mode', () => {
    render(
      <ConditionBadge
        condition={{ conditionId: 'stunned', label: 'Stunned' }}
        currentRound={1}
        mode="full"
      />
    );

    expect(screen.getByText('Stunned')).toBeInTheDocument();
    // Icon rendered by mock
    expect(screen.getByText('💫')).toBeInTheDocument();
  });

  it('renders icon only in default (icon) mode', () => {
    render(
      <ConditionBadge
        condition={{ conditionId: 'stunned', label: 'Stunned' }}
        currentRound={1}
      />
    );

    expect(screen.getByText('💫')).toBeInTheDocument();
    expect(screen.queryByText('Stunned')).not.toBeInTheDocument();
  });

  it('renders severity when provided', () => {
    render(
      <ConditionBadge
        condition={{ conditionId: 'stunned', label: 'Stunned', severity: 3 }}
        currentRound={1}
        mode="full"
      />
    );

    expect(screen.getByText('×3')).toBeInTheDocument();
  });

  it('renders duration when expiresAt is set', () => {
    render(
      <ConditionBadge
        condition={{ conditionId: 'stunned', label: 'Stunned', expiresAt: { type: 'round', round: 5 } }}
        currentRound={1}
        showDuration={true}
        mode="full"
      />
    );

    // Phase 11b countdown: rounds remaining computed locally (5 - 1 = 4),
    // normal urgency renders parenthesized
    expect(screen.getByText('(4 rounds left)')).toBeInTheDocument();
  });

  it('calls onClick when clicked and handler provided', () => {
    const handleClick = vi.fn();
    render(
      <ConditionBadge
        condition={{ conditionId: 'stunned', label: 'Stunned' }}
        onClick={handleClick}
        mode="full"
      />
    );

    fireEvent.click(screen.getByText('Stunned'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// 3. CombatHistory — empty state
// ============================================================================

describe('CombatHistory', () => {
  beforeEach(() => {
    setupCombatStore({ combatHistory: [] });
  });

  it('renders empty state message when no history', () => {
    render(<CombatHistory />);

    expect(screen.getByText('No combat history yet.')).toBeInTheDocument();
    expect(screen.getByText('Completed combats will appear here.')).toBeInTheDocument();
  });

  it('renders history list when entries exist', () => {
    setupCombatStore({
      combatHistory: [
        {
          id: 'hist-1',
          name: 'Goblin Ambush',
          startTime: Date.now() - 60000,
          endTime: Date.now(),
          currentRound: 4,
          participants: [
            { id: 'p1', name: 'Fighter', category: 'player', currentHP: 8, hp: 12 },
          ],
          log: [],
        },
      ],
      saveCombatHistory: vi.fn(),
    });

    render(<CombatHistory />);

    expect(screen.getByText('Combat History')).toBeInTheDocument();
    expect(screen.getByText('Goblin Ambush')).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 50 entries/)).toBeInTheDocument();
  });
});

// ============================================================================
// 4. ModifierStack
// ============================================================================

describe('ModifierStack', () => {
  it('renders base value and effective total', () => {
    render(
      <ModifierStack
        baseValue={12}
        baseLabel="Skill"
        modifiers={[]}
        onModifiersChange={vi.fn()}
      />
    );

    expect(screen.getByText('Skill:')).toBeInTheDocument();
    // Base and Effective both show 12 (no modifiers)
    const twelves = screen.getAllByText('12');
    expect(twelves.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Effective:')).toBeInTheDocument();
  });

  it('renders modifiers in the list', () => {
    render(
      <ModifierStack
        baseValue={10}
        modifiers={[
          { label: 'Range', value: -2 },
          { label: 'Aim', value: 3 },
        ]}
        onModifiersChange={vi.fn()}
      />
    );

    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Aim')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('shows Quick Add button when presets are provided', () => {
    render(
      <ModifierStack
        baseValue={10}
        modifiers={[]}
        onModifiersChange={vi.fn()}
        presets={{
          darkness: { label: 'Darkness', value: -3, note: 'No light source' },
        }}
      />
    );

    expect(screen.getByText('Quick Add')).toBeInTheDocument();
  });

  it('removes a modifier when X button is clicked', () => {
    const onChange = vi.fn();
    render(
      <ModifierStack
        baseValue={10}
        modifiers={[{ label: 'Range', value: -2 }]}
        onModifiersChange={onChange}
      />
    );

    const removeButton = screen.getByTitle('Remove');
    fireEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

// ============================================================================
// 5. EncounterSetup
// ============================================================================

describe('EncounterSetup', () => {
  beforeEach(() => {
    setupCombatStore();
    setupCampaignStore();
  });

  it('renders the setup heading and name input', () => {
    render(<EncounterSetup />);

    expect(screen.getByText('Encounter Setup')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Goblin Ambush')).toBeInTheDocument();
  });

  it('renders empty encounter placeholder', () => {
    render(<EncounterSetup />);

    expect(screen.getByText('Add participants from the party or library')).toBeInTheDocument();
  });

  it('renders empty library message when no characters exist', () => {
    render(<EncounterSetup />);

    expect(
      screen.getByText(/No characters in library/)
    ).toBeInTheDocument();
  });

  it('renders Clear button disabled when no participants', () => {
    render(<EncounterSetup />);

    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeDisabled();
  });

  it('adds all party characters to the encounter when Add All is clicked', () => {
    // Unique ids per participant so React keys don't collide
    let idCounter = 0;
    vi.mocked(generateId).mockImplementation(() => `participant-${++idCounter}`);

    const names = ['Aria', 'Brom', 'Cira', 'Dorn'];
    setupCombatStore({
      partyCharacters: names.map((name, i) => ({ id: `party-${i + 1}`, name })),
    });

    render(<EncounterSetup />);

    fireEvent.click(screen.getByTitle('Add all party characters to encounter'));

    // Empty-encounter placeholder is gone
    expect(
      screen.queryByText('Add participants from the party or library')
    ).not.toBeInTheDocument();

    // Each character appears twice: once in the party list, once in Current Encounter
    for (const name of names) {
      expect(screen.getAllByText(name)).toHaveLength(2);
    }
  });

  it('consumes a travel intent, loads its template, and uses the event name', async () => {
    const clearPendingIntent = vi.fn();
    const template = { id: 'wolves', name: 'Wolf Pack', description: 'Template description', participants: [], createdAt: 1, updatedAt: 1 };
    setupCombatStore({ encounterTemplates: { wolves: template } });
    setupCampaignStore({
      state: {
        ui: { gmModeEnabled: true, pendingIntent: { kind: 'encounter', templateId: 'wolves', groupId: 'g' } },
        maps: { mapsById: {} }, combat: { activeSession: null },
        entities: { combatCharacters: {}, combatItems: {}, characters: {}, travelEventTables: { road: { id: 'road', name: 'Road', entries: [{ id: 'e', kind: 'encounter', weight: 1, name: 'Howls on the road', description: '', encounterTemplateId: 'wolves' }] } } },
      },
      actions: { clearPendingIntent },
    });
    render(<EncounterSetup />);
    await waitFor(() => expect(screen.getByPlaceholderText('e.g., Goblin Ambush')).toHaveValue('Howls on the road'));
    expect(clearPendingIntent).toHaveBeenCalledOnce();
  });

  it('clears a dangling travel template intent without crashing', async () => {
    const clearPendingIntent = vi.fn();
    setupCampaignStore({
      state: { ui: { gmModeEnabled: true, pendingIntent: { kind: 'encounter', templateId: 'missing', groupId: 'g' } }, maps: { mapsById: {} }, combat: { activeSession: null }, entities: { combatCharacters: {}, combatItems: {}, characters: {}, travelEventTables: {} } },
      actions: { clearPendingIntent },
    });
    render(<EncounterSetup />);
    await waitFor(() => expect(clearPendingIntent).toHaveBeenCalledOnce());
  });
});
