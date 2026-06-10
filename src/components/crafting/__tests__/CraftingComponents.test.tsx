import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CraftingProjectList } from '../CraftingProjectList';
import { CraftingWorkbench } from '../CraftingWorkbench';
import type { Craft, Material, MaterialType, CustomTemplates } from '../../../types/campaign';
import type { CraftingWorker } from '../../../hooks/useCraftingData';

// Mock DiceRoller since it has its own internal logic
vi.mock('../../DiceRoller', () => ({
  DiceRoller: ({ onRoll }: { onRoll: (dice: number[], total: number) => void }) => (
    <button data-testid="dice-roller" onClick={() => onRoll([3, 3, 3], 9)}>
      Roll
    </button>
  ),
}));

// Mock activity logger
vi.mock('../../../utils/activityLogger', () => ({
  craftingLog: {
    projectStarted: vi.fn(() => ({ type: 'crafting', message: 'started' })),
    projectCompleted: vi.fn(() => ({ type: 'crafting', message: 'completed' })),
  },
}));

// Mock createAutoResolvedTask
vi.mock('../../../utils/createAutoResolvedTask', () => ({
  createAndResolveTask: vi.fn(() => ({ success: true })),
}));

// Mock downtime selectors
vi.mock('../../../state/downtime/downtimeSelectors', () => ({
  selectCharacterAssignmentForSlot: vi.fn(() => null),
}));

// Mock campaign store (inventory bus dispatch on craft completion)
const { acquireItemMock } = vi.hoisted(() => ({ acquireItemMock: vi.fn() }));
vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: () => ({ actions: { acquireItem: acquireItemMock } }),
}));

// ============================================================================
// Shared test data
// ============================================================================

const baseMaterials: Material[] = [
  { id: 'mat-1', name: 'Iron Bar', type: 'metal', quantity: 10 },
  { id: 'mat-2', name: 'Oak Plank', type: 'wood', quantity: 8 },
] as Material[];

const baseMaterialTypes: MaterialType[] = [
  { name: 'metal', ht: 12, difficulty: -1, weightMod: 0, hpMod: 0 },
  { name: 'wood', ht: 8, difficulty: 0, weightMod: -10, hpMod: -5 },
] as MaterialType[];

const baseTemplates: CustomTemplates = {
  weapons: {
    'Longsword': { weight: 4, hp: 10, materials: [{ type: 'metal', amount: 3 }] },
  },
  armor: {},
  ranged: {},
  explosives: {},
} as unknown as CustomTemplates;

const baseWorkers: CraftingWorker[] = [
  { id: 'w1', name: 'Smith', skills: { crafting: 14, designing: 12 } },
];

function makeInProgressCraft(overrides: Partial<Craft> = {}): Craft {
  return {
    id: 'craft-1',
    phase: 'design',
    templateType: 'weapons',
    template: 'Longsword',
    quality: 'good',
    currentQuality: 'good',
    mods: [],
    selectedMaterials: [{ requirementIndex: 0, requiredType: 'metal', requiredAmount: 3, selectedMaterialId: 'mat-1' }],
    shifts: [],
    startDate: '2026-01-01',
    startDay: 1,
    ...overrides,
  };
}

function makeCompletedCraft(overrides: Partial<Craft> = {}): Craft {
  return {
    ...makeInProgressCraft(),
    id: 'craft-2',
    completed: true,
    completedDate: '2026-01-10',
    completedDay: 10,
    phase: 'complete',
    shifts: [{ id: 's1', date: '2026-01-05', day: 5, worker: 'Smith', skill: 14, roll: 8, effectiveSkill: 13, result: 'Success', hoursAdded: 8, qualityChange: 0, phase: 'craft' }],
    ...overrides,
  };
}

// ============================================================================
// CraftingProjectList
// ============================================================================

describe('CraftingProjectList', () => {
  const defaultProps = {
    crafts: [] as Craft[],
    materials: baseMaterials,
    materialTypes: baseMaterialTypes,
    customTemplates: baseTemplates,
    workers: baseWorkers,
    saveCrafts: vi.fn(),
    onSelectProject: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<CraftingProjectList {...defaultProps} />);
  });

  it('shows section headings', () => {
    render(<CraftingProjectList {...defaultProps} />);
    expect(screen.getByText('In-Progress Projects')).toBeInTheDocument();
    expect(screen.getByText('Completed Projects')).toBeInTheDocument();
  });

  it('shows empty state for no in-progress projects', () => {
    render(<CraftingProjectList {...defaultProps} />);
    expect(screen.getByText('No in-progress projects')).toBeInTheDocument();
  });

  it('shows empty state for no completed projects', () => {
    render(<CraftingProjectList {...defaultProps} />);
    expect(screen.getByText('No completed projects')).toBeInTheDocument();
  });

  it('renders an in-progress project with name and phase', () => {
    const crafts = [makeInProgressCraft({ name: 'My Sword' })];
    render(<CraftingProjectList {...defaultProps} crafts={crafts} />);
    expect(screen.getByText('My Sword')).toBeInTheDocument();
    expect(screen.getByText(/design/i)).toBeInTheDocument();
    expect(screen.getByText('Resume')).toBeInTheDocument();
  });

  it('calls onSelectProject when Resume is clicked', () => {
    const onSelectProject = vi.fn();
    const crafts = [makeInProgressCraft({ name: 'My Sword' })];
    render(<CraftingProjectList {...defaultProps} crafts={crafts} onSelectProject={onSelectProject} />);
    fireEvent.click(screen.getByText('Resume'));
    expect(onSelectProject).toHaveBeenCalledWith(crafts[0]);
  });

  it('renders a completed project', () => {
    const crafts = [makeCompletedCraft({ name: 'Finished Blade' })];
    render(<CraftingProjectList {...defaultProps} crafts={crafts} />);
    expect(screen.getByText('Finished Blade')).toBeInTheDocument();
    expect(screen.getByText(/Completed.*2026-01-10/)).toBeInTheDocument();
  });

  it('shows fallback name when craft has no custom name', () => {
    const crafts = [makeInProgressCraft({ name: undefined })];
    render(<CraftingProjectList {...defaultProps} crafts={crafts} />);
    // Falls back to "quality template"
    expect(screen.getByText('good Longsword')).toBeInTheDocument();
  });
});

// ============================================================================
// CraftingWorkbench
// ============================================================================

describe('CraftingWorkbench', () => {
  const defaultProps = {
    craft: null as Craft | null,
    materials: baseMaterials,
    materialTypes: baseMaterialTypes,
    customTemplates: baseTemplates,
    workers: baseWorkers,
    crafts: [] as Craft[],
    craftDesigns: [],
    saveMaterials: vi.fn(),
    saveCrafts: vi.fn(),
    saveCraftDesigns: vi.fn(),
    addLogEntry: vi.fn(),
    weatherSkillBonus: 0,
    onProjectCompleted: vi.fn(),
    onProjectAbandoned: vi.fn(),
    onDesignPhaseComplete: vi.fn(),
    onCraftUpdated: vi.fn(),
  };

  it('renders without crashing (no active project)', () => {
    render(<CraftingWorkbench {...defaultProps} />);
  });

  it('shows empty state when no project is active', () => {
    render(<CraftingWorkbench {...defaultProps} />);
    expect(screen.getByText(/No active project/)).toBeInTheDocument();
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('renders setup phase when craft is in setup', () => {
    const craft = makeInProgressCraft({ phase: 'setup' });
    render(<CraftingWorkbench {...defaultProps} craft={craft} />);
    expect(screen.getByText('Setup Phase')).toBeInTheDocument();
    expect(screen.getByText('Start Design')).toBeInTheDocument();
  });

  it('renders design phase when craft is in design', () => {
    const craft = makeInProgressCraft({ phase: 'design' });
    render(<CraftingWorkbench {...defaultProps} craft={craft} />);
    expect(screen.getByText('Design Phase')).toBeInTheDocument();
    expect(screen.getByText('Add Shift')).toBeInTheDocument();
  });

  it('renders craft phase', () => {
    const craft = makeInProgressCraft({ phase: 'craft' });
    render(<CraftingWorkbench {...defaultProps} craft={craft} />);
    expect(screen.getByText('Crafting Phase')).toBeInTheDocument();
  });

  it('shows Cancel Current button when a project is active', () => {
    const craft = makeInProgressCraft({ phase: 'setup' });
    render(<CraftingWorkbench {...defaultProps} craft={craft} />);
    expect(screen.getByText('Cancel Current')).toBeInTheDocument();
  });

  it('shows abandon confirm modal when Cancel Current is clicked', () => {
    const craft = makeInProgressCraft({ phase: 'design' });
    render(<CraftingWorkbench {...defaultProps} craft={craft} />);
    fireEvent.click(screen.getByText('Cancel Current'));
    expect(screen.getByText('Abandon Project?')).toBeInTheDocument();
    expect(screen.getByText('Keep Working')).toBeInTheDocument();
    expect(screen.getByText('Abandon Project')).toBeInTheDocument();
  });

  it('shows template type selector in setup phase', () => {
    const craft = makeInProgressCraft({ phase: 'setup' });
    render(<CraftingWorkbench {...defaultProps} craft={craft} />);
    expect(screen.getByText('Template Type')).toBeInTheDocument();
    expect(screen.getByText('Target Quality')).toBeInTheDocument();
  });

  it('dispatches acquireItem to the party pool on craft completion', () => {
    acquireItemMock.mockClear();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Longsword hp=10 -> craftTime=10. One prior 8h shift + one successful
    // 8h shift (mock roll 9 vs skill 14) crosses the threshold and completes.
    const craft = makeInProgressCraft({
      phase: 'craft',
      shifts: [
        { id: 's1', date: '2026-01-05', day: 5, worker: 'Smith', skill: 14, roll: 8, effectiveSkill: 13, result: 'Success', hoursAdded: 8, qualityChange: 0, phase: 'craft' },
      ],
    });
    const onProjectCompleted = vi.fn();
    render(
      <CraftingWorkbench
        {...defaultProps}
        craft={craft}
        onProjectCompleted={onProjectCompleted}
      />
    );

    fireEvent.click(screen.getByTestId('dice-roller')); // roll 9
    fireEvent.click(screen.getByText('Add Shift'));

    expect(onProjectCompleted).toHaveBeenCalled();
    expect(acquireItemMock).toHaveBeenCalledTimes(1);
    const [item, owner, source] = acquireItemMock.mock.calls[0];
    expect(item).toMatchObject({
      kind: 'equipment',
      id: 'crafted-craft-1',
      name: 'Longsword',
      quantity: 1,
    });
    expect(owner).toBe('party');
    expect(source).toBe('crafting');

    alertSpy.mockRestore();
  });
});
