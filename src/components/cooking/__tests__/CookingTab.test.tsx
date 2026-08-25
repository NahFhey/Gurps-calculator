import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import type { CookingRecipe as Recipe } from '../../../types/campaign';
import { CookingTab } from '../CookingTab';
import type { CreateMealViewProps } from '../views/CreateMealView';
import { CreateMealView } from '../views/CreateMealView';
import type { RecipeLibraryViewProps } from '../views/RecipeLibraryView';
import { RecipeLibraryView } from '../views/RecipeLibraryView';
import type { RemakeViewProps } from '../views/RemakeView';
import { RemakeView } from '../views/RemakeView';
import type { Food } from '../types';

type CampaignState = ReturnType<typeof createCampaignState>;

const foods: Food[] = [
  { id: 'carrot', name: 'Carrot', types: ['vegetable'], quantity: 10 },
  { id: 'apple', name: 'Apple', types: ['fruit'], quantity: 6 },
];

const recipe: Recipe = {
  id: 'stew',
  name: 'Root Stew',
  ingredients: [{ foodId: 'carrot', foodName: 'Carrot', foodTypes: ['vegetable'], amount: 1 }],
  difficulty: 0,
  skills: ['Cooking'],
  criticalSuccess: false,
  creationHistory: [{
    id: 'log-1',
    date: '2025-01-02T00:00:00.000Z',
    worker: 'Alice',
    kitchen: 'Camp Kitchen',
    cookingSkill: 14,
    kitchenBonus: 1,
    effectiveSkill: 15,
    roll: 10,
    mos: 5,
    result: 'Success',
    substitutes: [],
  }],
};

function makeState(withRecipe = false): CampaignState {
  const state = createCampaignState();
  state.entities.foods = { carrot: foods[0], apple: foods[1] };
  state.entities.recipes = withRecipe ? { stew: recipe } : {};
  state.entities.kitchens = {
    camp: { id: 'camp', name: 'Camp Kitchen', rating: 1, description: '' },
  };
  state.entities.cookingSkills = [{ id: 'cooking', name: 'Cooking' }];
  state.entities.characters = {
    alice: { id: 'alice', name: 'Alice', work: { skills: { cooking: 14 } } },
  };
  return state;
}

function StateProbe({ capture }: { capture: (state: CampaignState) => void }) {
  const { state } = useCampaignStore();
  capture(state);
  return null;
}

function renderRouter(withRecipe = false, capture: (state: CampaignState) => void = () => {}) {
  render(
    <CampaignStoreProvider initialCampaignState={makeState(withRecipe)}>
      <StateProbe capture={capture} />
      <CookingTab />
    </CampaignStoreProvider>,
  );
}

const createProps: CreateMealViewProps = {
  foods,
  selected: [{ id: 'selected-1', foodId: 'carrot', amount: 1 }],
  numPeople: 1,
  name: 'Root Stew',
  crit: false,
  skills: ['Cooking'],
  selectedWorker: 'Alice',
  selectedKitchenId: 'camp',
  cookingSkillValue: '14',
  roll: { dice: [3, 3, 4], total: 10 },
  workers: [{ id: 'alice', name: 'Alice', skills: { cooking: 14 } }],
  kitchens: [{ id: 'camp', name: 'Camp Kitchen', rating: 1 }],
  stats: { unique: 1, total: 1, diff: 0, rolls: 1 },
  onNameChange: vi.fn(),
  onNumPeopleChange: vi.fn(),
  onAddIngredient: vi.fn(),
  onIngredientFoodChange: vi.fn(),
  onIngredientAmountChange: vi.fn(),
  onRemoveIngredient: vi.fn(),
  onCritChange: vi.fn(),
  onWorkerChange: vi.fn(),
  onKitchenChange: vi.fn(),
  onCookingSkillChange: vi.fn(),
  onRollChange: vi.fn(),
  onRollTotalChange: vi.fn(),
  onSkillChange: vi.fn(),
  onRandomSkill: vi.fn(),
  onCreate: vi.fn(),
};

const libraryProps: RecipeLibraryViewProps = {
  recipes: [recipe],
  foods,
  expandedRecipes: {},
  onToggleExpanded: vi.fn(),
  onStartRemake: vi.fn(),
  onDelete: vi.fn(),
};

const remakeProps: RemakeViewProps = {
  recipe,
  foods,
  ingredients: [{
    original: recipe.ingredients[0],
    useOriginal: false,
    substitutes: [{ foodId: 'apple', amount: 1 }],
    penalty: -3,
  }],
  workers: [{ id: 'alice', name: 'Alice', skills: { cooking: 14 } }],
  kitchens: [{ id: 'camp', name: 'Camp Kitchen', rating: 1 }],
  worker: 'Alice',
  kitchenId: 'camp',
  skill: '14',
  roll: { dice: [3, 3, 4], total: 10 },
  difficulty: -3,
  onToggleSubstitute: vi.fn(),
  onAddSubstitute: vi.fn(),
  onUpdateSubstitute: vi.fn(),
  onRemoveSubstitute: vi.fn(),
  onPenaltyChange: vi.fn(),
  onWorkerChange: vi.fn(),
  onKitchenChange: vi.fn(),
  onSkillChange: vi.fn(),
  onRollChange: vi.fn(),
  onRollTotalChange: vi.fn(),
  onExecute: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CookingTab router', () => {
  it('renders the create view by default', () => {
    renderRouter();
    expect(screen.getByPlaceholderText('Recipe name')).toBeInTheDocument();
    expect(screen.getByText('Recipe Creation Roll')).toBeInTheDocument();
  });

  it('switches from create to library view', () => {
    renderRouter(true);
    fireEvent.click(screen.getByRole('button', { name: 'Library (1)' }));
    expect(screen.getByText('Root Stew')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Recipe name')).not.toBeInTheDocument();
  });

  it('switches from the library into remake view', () => {
    renderRouter(true);
    fireEvent.click(screen.getByRole('button', { name: 'Library (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make Recipe' }));
    expect(screen.getByText('Make Recipe: Root Stew')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '← Back to Library' })).toBeInTheDocument();
  });

  it('returns from remake to the library', () => {
    renderRouter(true);
    fireEvent.click(screen.getByRole('button', { name: 'Library (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make Recipe' }));
    fireEvent.click(screen.getByRole('button', { name: '← Back to Library' }));
    expect(screen.getByText('Root Stew')).toBeInTheDocument();
    expect(screen.queryByText('Make Recipe: Root Stew')).not.toBeInTheDocument();
  });

  it('dispatches recipe, food, and log updates when a meal is prepared', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    let latest = makeState();
    renderRouter(false, state => { latest = state; });

    fireEvent.change(screen.getByPlaceholderText('Recipe name'), { target: { value: 'Carrot Plate' } });
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByDisplayValue('Select worker...'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('3-18'), { target: { value: '10' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Recipe' })[1]);

    const savedRecipes = Object.values(latest.entities.recipes);
    expect(savedRecipes).toHaveLength(1);
    expect(savedRecipes[0].name).toBe('Carrot Plate');
    expect(latest.entities.foods.carrot.quantity).toBe(9);
    expect(latest.logs.entries[latest.logs.entries.length - 1]?.payload).toMatchObject({
      message: expect.stringContaining('Carrot Plate'),
    });
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Recipe created!'));
    alertSpy.mockRestore();
  });
});

describe('CreateMealView', () => {
  it('renders representative controlled values', () => {
    render(<CreateMealView {...createProps} />);
    expect(screen.getByDisplayValue('Root Stew')).toBeInTheDocument();
    expect(screen.getByText('Unique: 1 | Total: 1/1 | Difficulty: 0 | Skill Rolls: 1')).toBeInTheDocument();
    expect(screen.getByText('Carrot (vegetable) - 10 lbs')).toBeInTheDocument();
  });

  it('forwards ingredient and create actions', () => {
    render(<CreateMealView {...createProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByDisplayValue('Carrot (vegetable) - 10 lbs'), { target: { value: 'apple' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Recipe' })[0]);
    expect(createProps.onAddIngredient).toHaveBeenCalledOnce();
    expect(createProps.onIngredientFoodChange).toHaveBeenCalledWith('selected-1', 'apple');
    expect(createProps.onCreate).toHaveBeenCalledOnce();
  });

  it('forwards worker and skill-name changes', () => {
    render(<CreateMealView {...createProps} />);
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText('Skill 1'), { target: { value: 'Professional Skill' } });
    expect(createProps.onWorkerChange).toHaveBeenCalledWith('');
    expect(createProps.onSkillChange).toHaveBeenCalledWith(0, 'Professional Skill');
  });
});

describe('RecipeLibraryView', () => {
  it('renders a recipe summary', () => {
    render(<RecipeLibraryView {...libraryProps} />);
    expect(screen.getByText('Root Stew')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make Recipe' })).toBeInTheDocument();
  });

  it('forwards expand and remake actions', () => {
    render(<RecipeLibraryView {...libraryProps} />);
    fireEvent.click(screen.getByText('Root Stew'));
    fireEvent.click(screen.getByRole('button', { name: 'Make Recipe' }));
    expect(libraryProps.onToggleExpanded).toHaveBeenCalledWith('stew');
    expect(libraryProps.onStartRemake).toHaveBeenCalledWith(recipe);
  });

  it('renders expanded ingredients and history', () => {
    render(<RecipeLibraryView {...libraryProps} expandedRecipes={{ stew: true }} />);
    expect(screen.getByText(/1 lbs Carrot/)).toBeInTheDocument();
    expect(screen.getByText('Creation History')).toBeInTheDocument();
    expect(screen.getByText(/Worker: Alice/)).toBeInTheDocument();
  });
});

describe('RemakeView', () => {
  it('renders recipe, substitution, and difficulty details', () => {
    render(<RemakeView {...remakeProps} />);
    expect(screen.getByText('Make Recipe: Root Stew')).toBeInTheDocument();
    expect(screen.getByText('Current Difficulty:').parentElement).toHaveTextContent('-3');
    expect(screen.getByDisplayValue('Apple (fruit) - 6 lbs')).toBeInTheDocument();
  });

  it('forwards substitute edits', () => {
    render(<RemakeView {...remakeProps} />);
    const substitutes = screen.getByText('Substitutes:').parentElement;
    if (!substitutes) throw new Error('Expected substitutes controls');
    fireEvent.click(within(substitutes).getByRole('button', { name: 'Add Substitute' }));
    fireEvent.change(screen.getByDisplayValue('Similar Type (fruit - vegetable) (-3)'), { target: { value: '-5' } });
    expect(remakeProps.onAddSubstitute).toHaveBeenCalledWith(0);
    expect(remakeProps.onPenaltyChange).toHaveBeenCalledWith(0, -5);
  });

  it('forwards the cook action', () => {
    render(<RemakeView {...remakeProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cook Recipe (Difficulty: -3)' }));
    expect(remakeProps.onExecute).toHaveBeenCalledOnce();
  });
});
