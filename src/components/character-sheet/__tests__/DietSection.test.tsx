import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultGCSData } from '../../../types/characterSheet';
import type { Character } from '../../../types/campaign';
import { createCampaignState } from '../../../state/campaignReducer';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { CharacterSheet } from '../CharacterSheet';
import { DietSection } from '../DietSection';

type CampaignState = ReturnType<typeof createCampaignState>;

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'soren',
  name: 'Soren',
  work: { skills: {} },
  ...overrides,
});

const makeDietTraitCharacter = (): Character => {
  const gcsData = createDefaultGCSData();
  gcsData.disadvantages = [{
    id: 'diet',
    type: 'disadvantage',
    name: 'Restricted Diet (Vegetarian)',
    points: -10,
  }];
  return makeCharacter({ gcsData });
};

function renderSection(character: Character, editMode = false) {
  const state = createCampaignState();
  state.entities.foods = {
    beef: { id: 'beef', name: 'Beef', types: ['meat', 'protein'], quantity: 2 },
    carrot: { id: 'carrot', name: 'Carrot', types: ['root', 'vegetable'], quantity: 3 },
  };
  return render(
    <CampaignStoreProvider initialCampaignState={state}>
      <DietSection
        character={character}
        excludedFoodTypes={character.dietExcludedFoodTypes ?? []}
        requiredFoodTypes={character.dietRequiredFoodTypes ?? []}
        editMode={editMode}
        onExcludedFoodTypesChange={vi.fn()}
        onRequiredFoodTypesChange={vi.fn()}
      />
    </CampaignStoreProvider>,
  );
}

function StateProbe({ capture }: { capture: (state: CampaignState) => void }) {
  const { state } = useCampaignStore();
  capture(state);
  return null;
}

describe('DietSection', () => {
  it('renders configured excluded and required chips', () => {
    renderSection(makeCharacter({
      dietExcludedFoodTypes: ['meat'],
      dietRequiredFoodTypes: ['root'],
    }));

    expect(screen.getByText('meat')).toBeInTheDocument();
    expect(screen.getByText('root')).toBeInTheDocument();
    expect(screen.getByText("Won't/can't eat")).toBeInTheDocument();
    expect(screen.getByText('Requires')).toBeInTheDocument();
  });

  it('offers the union of live food types and configured stray values', () => {
    renderSection(makeCharacter({ dietExcludedFoodTypes: ['legacy-fungus'] }), true);

    const optionNames = screen.getAllByRole('option').map(option => option.textContent);
    expect(optionNames).toEqual(expect.arrayContaining([
      'meat',
      'protein',
      'root',
      'vegetable',
      'legacy-fungus',
    ]));
  });

  it('shows the trait nudge when config is empty', () => {
    renderSection(makeDietTraitCharacter());

    expect(screen.getByText('Has a diet-related trait — configure dietary restrictions?')).toBeInTheDocument();
  });

  it('hides the trait nudge when either list is configured', () => {
    renderSection({ ...makeDietTraitCharacter(), dietExcludedFoodTypes: ['meat'] });

    expect(screen.queryByText('Has a diet-related trait — configure dietary restrictions?')).not.toBeInTheDocument();
  });

  it('hides the nudge without a matching trait and renders the empty state', () => {
    renderSection(makeCharacter());

    expect(screen.queryByText('Has a diet-related trait — configure dietary restrictions?')).not.toBeInTheDocument();
    expect(screen.getByText('No dietary restrictions')).toBeInTheDocument();
  });

  it('does not show the nudge for a non-prefix trait name', () => {
    const gcsData = createDefaultGCSData();
    gcsData.quirks = [{
      id: 'diet',
      type: 'quirk',
      name: 'Lacto-Vegetarian',
      points: -1,
    }];

    renderSection(makeCharacter({ gcsData }));

    expect(screen.queryByText('Has a diet-related trait — configure dietary restrictions?')).not.toBeInTheDocument();
  });

  it('adds and removes chips through the CharacterSheet draft and Save action', () => {
    const character = makeCharacter({ dietExcludedFoodTypes: ['meat'] });
    const state = createCampaignState();
    state.entities.characters = { soren: character };
    state.entities.foods = {
      carrot: { id: 'carrot', name: 'Carrot', types: ['root'], quantity: 3 },
      beef: { id: 'beef', name: 'Beef', types: ['meat'], quantity: 2 },
    };
    let latestState = state;

    render(
      <CampaignStoreProvider initialCampaignState={state}>
        <StateProbe capture={currentState => { latestState = currentState; }} />
        <CharacterSheet character={character} />
      </CampaignStoreProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: "Remove meat from Won't/can't eat" }));
    const requiresRow = screen.getByText('Requires').closest('div');
    expect(requiresRow).not.toBeNull();
    const requiresSelect = screen.getByRole('combobox', { name: 'Add food type to Requires' });
    fireEvent.change(requiresSelect, { target: { value: 'root' } });
    fireEvent.click(within(requiresRow as HTMLElement).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(latestState.entities.characters.soren.dietExcludedFoodTypes).toEqual([]);
    expect(latestState.entities.characters.soren.dietRequiredFoodTypes).toEqual(['root']);
  });
});
