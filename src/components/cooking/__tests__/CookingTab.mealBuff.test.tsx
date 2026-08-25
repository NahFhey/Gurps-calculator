import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import type { CookingRecipe, MealBuff } from '../../../types/campaign';
import { CookingTab } from '../CookingTab';

type CampaignState = ReturnType<typeof createCampaignState>;

const rootStew: CookingRecipe = {
  id: 'root-stew',
  name: 'Root Stew',
  ingredients: [{
    foodId: 'carrot',
    foodName: 'Carrot',
    foodTypes: ['vegetable', 'root', 'starchy'],
    amount: 1,
  }],
  difficulty: 0,
  skills: ['Cryptography', 'Guns'],
  criticalSuccess: false,
  creationHistory: [],
};

const lunchBuff: MealBuff = {
  day: 7,
  recipeId: 'lunch',
  recipeName: 'Lunch',
  skills: ['Survival'],
};

function makeState(withRecipe = false, existingBuff: MealBuff | null = null): CampaignState {
  const state = createCampaignState();
  state.time.day = 7;
  state.mealBuff = existingBuff;
  state.entities.foods = {
    carrot: {
      id: 'carrot',
      name: 'Carrot',
      types: ['vegetable', 'root', 'starchy'],
      quantity: 10,
    },
  };
  state.entities.recipes = withRecipe ? { 'root-stew': rootStew } : {};
  state.entities.kitchens = {
    camp: { id: 'camp', name: 'Camp Kitchen', rating: 0, description: '' },
  };
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

function renderRouter(
  withRecipe = false,
  existingBuff: MealBuff | null = null,
): { getState: () => CampaignState } {
  let latest = makeState(withRecipe, existingBuff);
  render(
    <CampaignStoreProvider initialCampaignState={latest}>
      <StateProbe capture={state => { latest = state; }} />
      <CookingTab />
    </CampaignStoreProvider>,
  );
  return { getState: () => latest };
}

function completeCreateForm(roll: number) {
  fireEvent.change(screen.getByPlaceholderText('Recipe name'), { target: { value: 'Carrot Plate' } });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  fireEvent.change(screen.getByPlaceholderText('Skill 1'), { target: { value: 'Cryptography' } });
  fireEvent.change(screen.getByPlaceholderText('Skill 2'), { target: { value: 'Guns' } });
  fireEvent.change(screen.getByDisplayValue('Select worker...'), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByPlaceholderText('3-18'), { target: { value: String(roll) } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Create Recipe' })[1]);
}

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('CookingTab meal buff dispatches', () => {
  it('writes the current day, recipe identity, and skills after a successful cook', () => {
    const { getState } = renderRouter();

    completeCreateForm(10);

    expect(getState().mealBuff).toMatchObject({
      day: 7,
      recipeName: 'Carrot Plate',
      skills: ['Cryptography', 'Guns'],
    });
    expect(getState().mealBuff?.recipeId).toBe(Object.values(getState().entities.recipes)[0].id);
  });

  it('stores a skill-list snapshot separate from the saved recipe array', () => {
    const { getState } = renderRouter();

    completeCreateForm(10);

    const savedRecipe = Object.values(getState().entities.recipes)[0];
    expect(getState().mealBuff?.skills).toEqual(savedRecipe.skills);
    expect(getState().mealBuff?.skills).not.toBe(savedRecipe.skills);
  });

  it('leaves the buff null after a failed cook', () => {
    const { getState } = renderRouter();

    completeCreateForm(16);

    expect(getState().mealBuff).toBeNull();
  });

  it('does not clear a previous buff after a critical failure', () => {
    const { getState } = renderRouter(false, lunchBuff);

    completeCreateForm(18);

    expect(getState().mealBuff).toEqual(lunchBuff);
  });

  it('writes the recipe snapshot through the remake path', () => {
    const { getState } = renderRouter(true);
    fireEvent.click(screen.getByRole('button', { name: 'Library (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make Recipe' }));
    fireEvent.change(screen.getByDisplayValue('Select worker...'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('3-18'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cook Recipe (Difficulty: 0)' }));

    expect(getState().mealBuff).toEqual({
      day: 7,
      recipeId: 'root-stew',
      recipeName: 'Root Stew',
      skills: ['Cryptography', 'Guns'],
    });
    expect(getState().mealBuff?.skills).not.toBe(rootStew.skills);
  });
});
