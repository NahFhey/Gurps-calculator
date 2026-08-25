import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import { MealBuffWidget } from '../MealBuffWidget';

function renderWidget(day: number, buffDay: number | null) {
  const state = createCampaignState();
  state.time.day = day;
  state.mealBuff = buffDay === null ? null : {
    day: buffDay,
    recipeId: 'root-stew',
    recipeName: 'Root Stew',
    skills: ['Cryptography', 'Guns', 'Artist'],
  };

  return render(
    <CampaignStoreProvider initialCampaignState={state}>
      <MealBuffWidget compact />
    </CampaignStoreProvider>,
  );
}

describe('MealBuffWidget', () => {
  it('renders the recipe name and skill bonuses when active', () => {
    renderWidget(3, 3);

    expect(screen.getByTestId('meal-buff-widget-compact')).toHaveTextContent('Root Stew');
    expect(screen.getByTestId('meal-buff-widget-compact')).toHaveTextContent('+1 Cryptography');
    expect(screen.getByTestId('meal-buff-widget-compact')).toHaveTextContent('+1 Guns');
    expect(screen.getByTestId('meal-buff-widget-compact')).toHaveTextContent('+1 Artist');
  });

  it('renders nothing when the meal buff is null', () => {
    const { container } = renderWidget(3, null);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing after the calendar day advances', () => {
    const { container } = renderWidget(4, 3);

    expect(container).toBeEmptyDOMElement();
  });
});
