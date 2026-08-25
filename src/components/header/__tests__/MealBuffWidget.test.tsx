import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import { MealBuffWidget } from '../MealBuffWidget';

function renderWidget(
  day: number,
  buffDay: number | null,
  excludedCharacterIds?: string[],
  compact = true,
) {
  const state = createCampaignState();
  state.time.day = day;
  state.entities.characters = {
    soren: { id: 'soren', name: 'Soren', work: { skills: {} } },
    rina: { id: 'rina', name: 'Rina', work: { skills: {} } },
  };
  state.mealBuff = buffDay === null ? null : {
    day: buffDay,
    recipeId: 'root-stew',
    recipeName: 'Root Stew',
    skills: ['Cryptography', 'Guns', 'Artist'],
    excludedCharacterIds,
  };

  return render(
    <CampaignStoreProvider initialCampaignState={state}>
      <MealBuffWidget compact={compact} />
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

  it('renders a singular abstainer clause with a resolved name', () => {
    renderWidget(3, 3, ['soren']);

    expect(screen.getByTestId('meal-buff-widget-compact')).toHaveTextContent('(Soren abstains)');
  });

  it('renders a plural abstainer clause in full mode', () => {
    renderWidget(3, 3, ['soren', 'rina'], false);

    expect(screen.getByTestId('meal-buff-widget')).toHaveTextContent('(Soren, Rina abstain)');
    expect(screen.getByTestId('meal-buff-widget')).toHaveAttribute(
      'title',
      expect.stringContaining('(Soren, Rina abstain)'),
    );
  });

  it('omits the abstainer clause when the snapshot is empty', () => {
    renderWidget(3, 3, []);

    expect(screen.getByTestId('meal-buff-widget-compact')).not.toHaveTextContent('abstain');
  });

  it('skips an unresolvable character id', () => {
    renderWidget(3, 3, ['missing', 'soren']);

    expect(screen.getByTestId('meal-buff-widget-compact')).toHaveTextContent('(Soren abstains)');
    expect(screen.getByTestId('meal-buff-widget-compact')).not.toHaveTextContent('missing');
  });

  it('omits the clause when every excluded id is unresolvable', () => {
    renderWidget(3, 3, ['missing']);

    expect(screen.getByTestId('meal-buff-widget-compact')).not.toHaveTextContent('abstain');
  });
});
