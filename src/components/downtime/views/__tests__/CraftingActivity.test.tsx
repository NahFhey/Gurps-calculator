import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CraftingActivity } from '../CraftingActivity';
import { useCraftingData } from '../../../../hooks/useCraftingData';
import { useDowntimeContext } from '../../DowntimeContext';

vi.mock('../../../../hooks/useCraftingData', () => ({
  useCraftingData: vi.fn(),
}));

vi.mock('../../DowntimeContext', () => ({
  useDowntimeContext: vi.fn(),
}));

vi.mock('../../../crafting/CraftingProjectList', () => ({
  CraftingProjectList: ({ crafts, onSelectProject }: any) => (
    <div data-testid="project-list">
      <div>project-count:{crafts.length}</div>
      <button type="button" onClick={() => onSelectProject(crafts[0])}>
        Resume First Project
      </button>
    </div>
  ),
}));

vi.mock('../../../crafting/CraftingWorkbench', () => ({
  CraftingWorkbench: ({ craft, onProjectCompleted, onDesignPhaseComplete }: any) => (
    <div data-testid="crafting-workbench">
      <div>active-craft:{craft?.name ?? 'none'}</div>
      <button type="button" onClick={onProjectCompleted}>
        Complete Project
      </button>
      <button type="button" onClick={() => onDesignPhaseComplete(craft)}>
        Save As Design
      </button>
    </div>
  ),
}));

vi.mock('../../../crafting/CraftingDesigns', () => ({
  CraftingDesigns: ({ onStartFromDesign }: any) => (
    <div data-testid="crafting-designs">
      <button
        type="button"
        onClick={() =>
          onStartFromDesign({
            id: 'design-craft',
            name: 'Design Starter',
            templateType: 'weapons',
            template: 'sword',
            currentQuality: 'good',
          })
        }
      >
        Start From Design
      </button>
    </div>
  ),
}));

vi.mock('../../../crafting/SaveDesignModal', () => ({
  SaveDesignModal: ({ onSave, onSkip }: any) => (
    <div data-testid="save-design-modal">
      <button type="button" onClick={() => onSave('Saved Design')}>
        Confirm Save
      </button>
      <button type="button" onClick={onSkip}>
        Skip Save
      </button>
    </div>
  ),
}));

const mockedUseCraftingData = vi.mocked(useCraftingData);
const mockedUseDowntimeContext = vi.mocked(useDowntimeContext);

const saveCraftDesigns = vi.fn();

function createCraftingData() {
  return {
    materials: [],
    materialTypes: [],
    crafts: [
      {
        id: 'craft-1',
        name: 'Iron Sword',
        templateType: 'weapons',
        template: 'broadsword',
        currentQuality: 'good',
        phase: 'craft',
        shifts: [],
      },
    ],
    craftDesigns: [],
    customTemplates: {},
    workers: [],
    saveMaterials: vi.fn(),
    saveCrafts: vi.fn(),
    saveCraftDesigns,
    addLogEntry: vi.fn(),
    activeCraftCount: 1,
    designCount: 2,
    weather: {
      hasEffect: true,
      effectDescription: 'Workshop humidity slows drying time.',
      locationName: 'Forge',
      skillBonus: -1,
    },
  };
}

describe('CraftingActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseDowntimeContext.mockReturnValue({
      state: {},
      dispatch: vi.fn(),
    } as any);

    mockedUseCraftingData.mockReturnValue(createCraftingData() as any);

    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('123e4567-e89b-42d3-a456-426614174000');
  });

  it('renders header state, weather banner, and tab badges from crafting data', () => {
    render(<CraftingActivity currentDayKey={1} currentSlot={0} />);

    expect(screen.getByText('Crafting')).toBeInTheDocument();
    expect(screen.getByText('Weather Effect:')).toBeInTheDocument();
    expect(screen.getByText('Workshop humidity slows drying time.')).toBeInTheDocument();
    expect(screen.getByText('at Forge')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.getByText('Designs')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByTestId('project-list')).toBeInTheDocument();
  });

  it('opens the workbench with the selected project from the projects tab', () => {
    render(<CraftingActivity currentDayKey={1} currentSlot={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resume First Project' }));

    expect(screen.getByTestId('crafting-workbench')).toBeInTheDocument();
    expect(screen.getByText('active-craft:Iron Sword')).toBeInTheDocument();
  });

  it('starts a craft from the designs tab and routes into the workbench', () => {
    render(<CraftingActivity currentDayKey={1} currentSlot={0} />);

    fireEvent.click(screen.getByRole('button', { name: /Designs/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start From Design' }));

    expect(screen.getByTestId('crafting-workbench')).toBeInTheDocument();
    expect(screen.getByText('active-craft:Design Starter')).toBeInTheDocument();
  });

  it('saves a completed design through the modal flow', () => {
    render(<CraftingActivity currentDayKey={3} currentSlot={2} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resume First Project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save As Design' }));

    expect(screen.getByTestId('save-design-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Save' }));

    expect(saveCraftDesigns).toHaveBeenCalledOnce();
    expect(saveCraftDesigns).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '123e4567-e89b-42d3-a456-426614174000',
        name: 'Saved Design',
        templateType: 'weapons',
        template: 'broadsword',
        quality: 'good',
      }),
    ]);
    expect(screen.queryByTestId('save-design-modal')).not.toBeInTheDocument();
  });

  it('returns to the projects tab when the workbench reports completion', () => {
    render(<CraftingActivity currentDayKey={1} currentSlot={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resume First Project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete Project' }));

    expect(screen.getByTestId('project-list')).toBeInTheDocument();
    expect(screen.queryByTestId('crafting-workbench')).not.toBeInTheDocument();
  });
});
