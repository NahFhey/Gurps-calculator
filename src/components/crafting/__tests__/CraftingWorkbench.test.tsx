import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CraftingWorkbench } from '../CraftingWorkbench';
import type { Craft, CustomTemplates, Material, MaterialType } from '../../../types/campaign';
import type { DowntimeState, DowntimeTask } from '../../../types/downtime';

vi.mock('../../DiceRoller', () => ({
  DiceRoller: () => <div data-testid="dice-roller" />,
}));

const customTemplates = {
  weapons: {
    broadsword: {
      weight: 1,
      hp: 1,
      materials: [{ type: 'steel', amount: 2 }],
    },
  },
  armor: {},
  ranged: {},
  explosives: {},
} as unknown as CustomTemplates;

const materialTypes: MaterialType[] = [
  {
    name: 'steel',
    difficulty: 0,
    ht: 12,
    weightMod: 0,
    hpMod: 0,
  } as MaterialType,
];

const baseMaterials: Material[] = [
  {
    id: 'mat-1',
    name: 'Steel Ingot',
    type: 'steel',
    quantity: 5,
  } as Material,
];

const workers = [
  {
    id: 'worker-1',
    name: 'Alice',
    skills: {
      designing: 14,
      crafting: 13,
    },
  },
  {
    id: 'worker-2',
    name: 'Bob',
    skills: {
      designing: 11,
      crafting: 10,
    },
  },
] as any[];

function createCraft(overrides: Partial<Craft> = {}): Craft {
  return {
    id: 'craft-1',
    phase: 'setup',
    templateType: 'weapons',
    template: 'broadsword',
    quality: 'good',
    currentQuality: 'good',
    mods: [],
    shifts: [],
    selectedMaterials: [
      {
        requirementIndex: 0,
        requiredType: 'steel',
        requiredAmount: 2,
        selectedMaterialId: 'mat-1',
      },
    ],
    startDate: '2026-04-17',
    startDay: 2,
    ...overrides,
  } as Craft;
}

function createDowntimeTask(overrides: Partial<DowntimeTask> = {}): DowntimeTask {
  return {
    id: 'task-1',
    activityType: 'fishing',
    dayKey: 2,
    slot: 1,
    leaderId: 'worker-1',
    helperIds: [],
    status: 'resolved',
    activityData: {
      type: 'fishing',
      method: 'Line',
      speciesId: 'trout',
      isRandomCatch: true,
      spotId: 'river',
      toolIds: [],
    },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as DowntimeTask;
}

function createDowntimeState(tasks: DowntimeTask[] = []): DowntimeState {
  return {
    tasksById: Object.fromEntries(tasks.map((task) => [task.id, task])),
    taskOrder: tasks.map((task) => task.id),
    pendingDayLedger: null,
  };
}

function renderWorkbench(overrides: Partial<React.ComponentProps<typeof CraftingWorkbench>> = {}) {
  const saveMaterials = vi.fn();
  const saveCrafts = vi.fn();
  const saveCraftDesigns = vi.fn();
  const addLogEntry = vi.fn();
  const onProjectCompleted = vi.fn();
  const onProjectAbandoned = vi.fn();
  const onDesignPhaseComplete = vi.fn();
  const onCraftUpdated = vi.fn();
  const downtimeDispatch = vi.fn();

  const props: React.ComponentProps<typeof CraftingWorkbench> = {
    craft: createCraft(),
    materials: baseMaterials,
    materialTypes,
    customTemplates,
    workers: workers as any,
    crafts: [createCraft()],
    craftDesigns: [],
    saveMaterials,
    saveCrafts,
    saveCraftDesigns,
    addLogEntry,
    weatherSkillBonus: 0,
    onProjectCompleted,
    onProjectAbandoned,
    onDesignPhaseComplete,
    onCraftUpdated,
    downtimeState: undefined,
    downtimeDispatch,
    currentDayKey: 2,
    currentSlot: 1,
    ...overrides,
  };

  const view = render(<CraftingWorkbench {...props} />);

  return {
    ...view,
    props,
    saveMaterials,
    saveCrafts,
    saveCraftDesigns,
    addLogEntry,
    onProjectCompleted,
    onProjectAbandoned,
    onDesignPhaseComplete,
    onCraftUpdated,
    downtimeDispatch,
  };
}

function setShiftInputs(container: HTMLElement, { skill, roll }: { skill: string; roll: string }) {
  const numberInputs = container.querySelectorAll('input[type="number"]');
  fireEvent.change(numberInputs[1], { target: { value: skill } });
  fireEvent.change(numberInputs[2], { target: { value: roll } });
}

describe('CraftingWorkbench', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('starts the design phase by consuming selected materials and persisting the craft', () => {
    const craft = createCraft();
    const { saveMaterials, saveCrafts, addLogEntry, onCraftUpdated } = renderWorkbench({
      craft,
      crafts: [craft],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start Design' }));

    expect(saveMaterials).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'mat-1',
        quantity: 3,
      }),
    ]);
    expect(saveCrafts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'craft-1',
        phase: 'design',
        consumedMaterials: [
          expect.objectContaining({
            materialId: 'mat-1',
            amount: 2,
            name: 'Steel Ingot',
          }),
        ],
      }),
    ]);
    expect(addLogEntry).toHaveBeenCalledOnce();
    expect(onCraftUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'design',
      }),
    );
    expect(screen.getByText('Design Phase')).toBeInTheDocument();
  });

  it('filters unavailable workers out of the shift worker selector', () => {
    const craft = createCraft({
      phase: 'design',
      selectedMaterials: [],
    });
    const downtimeState = createDowntimeState([
      createDowntimeTask({
        leaderId: 'worker-2',
      }),
    ]);

    renderWorkbench({
      craft,
      crafts: [craft],
      downtimeState,
    });

    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Bob' })).not.toBeInTheDocument();
  });

  it('rejects a shift when the preselected worker is already busy in the current slot', () => {
    const craft = createCraft({
      phase: 'design',
      selectedMaterials: [],
      shifts: [
        {
          id: 'shift-0',
          date: '2026-04-17',
          day: 2,
          worker: 'Alice',
          skill: 12,
          roll: 11,
          effectiveSkill: 12,
          result: 'Success',
          hoursAdded: 0,
          qualityChange: 0,
          phase: 'design',
        },
      ],
    });
    const downtimeState = createDowntimeState([
      createDowntimeTask({
        leaderId: 'worker-1',
      }),
    ]);
    const { container, saveCrafts, downtimeDispatch } = renderWorkbench({
      craft,
      crafts: [craft],
      downtimeState,
    });

    setShiftInputs(container, { skill: '14', roll: '10' });
    fireEvent.click(screen.getByRole('button', { name: 'Add Shift' }));

    expect(alertSpy).toHaveBeenCalledWith('This character is already busy this time slot.');
    expect(saveCrafts).not.toHaveBeenCalled();
    expect(downtimeDispatch).not.toHaveBeenCalled();
  });

  it('moves a design project into the craft phase once enough progress is added', () => {
    const craft = createCraft({
      phase: 'design',
      selectedMaterials: [],
    });
    const { container, saveCrafts, onDesignPhaseComplete, onCraftUpdated, onProjectCompleted } = renderWorkbench({
      craft,
      crafts: [craft],
      downtimeState: createDowntimeState(),
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Alice' } });
    setShiftInputs(container, { skill: '14', roll: '10' });
    fireEvent.click(screen.getByRole('button', { name: 'Add Shift' }));

    expect(saveCrafts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'craft-1',
        phase: 'craft',
        shifts: [],
        designShifts: [
          expect.objectContaining({
            worker: 'Alice',
            result: 'Success',
            hoursAdded: 8,
          }),
        ],
      }),
    ]);
    expect(onDesignPhaseComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'craft',
      }),
    );
    expect(onCraftUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'craft',
      }),
    );
    expect(onProjectCompleted).not.toHaveBeenCalled();
  });

  it('completes a craft project and fires completion callbacks when craft progress reaches the target', () => {
    const craft = createCraft({
      phase: 'craft',
      selectedMaterials: [],
    });
    const { container, saveCrafts, addLogEntry, onProjectCompleted, onCraftUpdated } = renderWorkbench({
      craft,
      crafts: [craft],
      downtimeState: createDowntimeState(),
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Alice' } });
    setShiftInputs(container, { skill: '13', roll: '10' });
    fireEvent.click(screen.getByRole('button', { name: 'Add Shift' }));

    expect(alertSpy).toHaveBeenCalledWith('Craft complete!');
    expect(saveCrafts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'craft-1',
        completed: true,
        completedDate: expect.any(String),
        completedDay: 2,
      }),
    ]);
    expect(addLogEntry).toHaveBeenCalledOnce();
    expect(onProjectCompleted).toHaveBeenCalledOnce();
    expect(onCraftUpdated).toHaveBeenCalledWith(null);
  });

  it('abandons a project by refunding consumed materials and removing the craft', () => {
    const craft = createCraft({
      phase: 'craft',
      selectedMaterials: [],
      consumedMaterials: [
        {
          materialId: 'mat-1',
          amount: 2,
          name: 'Steel Ingot',
          type: 'steel',
        },
      ],
    });
    const { saveMaterials, saveCrafts, onProjectAbandoned, onCraftUpdated } = renderWorkbench({
      craft,
      crafts: [craft],
      materials: [
        {
          ...baseMaterials[0],
          quantity: 3,
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Current' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abandon Project' }));

    expect(saveMaterials).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'mat-1',
        quantity: 5,
      }),
    ]);
    expect(saveCrafts).toHaveBeenCalledWith([]);
    expect(onProjectAbandoned).toHaveBeenCalledOnce();
    expect(onCraftUpdated).toHaveBeenCalledWith(null);
  });
});
