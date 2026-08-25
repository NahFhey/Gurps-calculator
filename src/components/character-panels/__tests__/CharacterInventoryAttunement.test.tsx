import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CharacterInventoryPanel } from '../CharacterInventoryPanel';
import {
  CampaignStoreProvider,
  useCampaignStore,
} from '../../../state/campaignStore';
import { createCampaignState, type CampaignState } from '../../../state/campaignReducer';
import { createDefaultGCSData } from '../../../types/characterSheet';
import type { Character, ItemInstance } from '../../../types/campaign';

function makeCharacter(mageryLevel: number | null): Character {
  return {
    id: 'char-mage',
    name: 'Mira',
    work: { skills: {} },
    gcsData: {
      ...createDefaultGCSData(),
      advantages: mageryLevel === null
        ? []
        : [{
            id: 'adv-magery',
            name: 'Magery',
            points: 0,
            type: 'advantage',
            level: mageryLevel,
          }],
    },
  };
}

function makeState(character: Character, items: ItemInstance[]): CampaignState {
  const state = createCampaignState();
  state.entities.characters = { [character.id]: character };
  state.entities.inventories = {
    'inv-char-mage': {
      id: 'inv-char-mage',
      ownerType: 'character',
      ownerId: character.id,
      currency: {},
      items,
      tools: [],
      materials: [],
      food: [],
    },
  };
  return state;
}

function StateProbe({ onState }: { onState: (state: CampaignState) => void }) {
  const { state } = useCampaignStore();
  onState(state);
  return null;
}

function renderPanel(character: Character, items: ItemInstance[]) {
  const initialState = makeState(character, items);
  let latestState = initialState;
  render(
    <CampaignStoreProvider initialCampaignState={initialState}>
      <CharacterInventoryPanel character={character} />
      <StateProbe onState={(state) => { latestState = state; }} />
    </CampaignStoreProvider>
  );
  return () => latestState;
}

describe('CharacterInventoryPanel attunement', () => {
  it('shows attune controls only for magical item rows', () => {
    renderPanel(makeCharacter(1), [
      { id: 'rope', name: 'Rope', quantity: 1 },
      { id: 'wand', name: 'Wand', quantity: 1, magical: true },
    ]);

    expect(screen.queryByRole('button', { name: 'Attune: Rope' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attune: Wand' })).toBeInTheDocument();
  });

  it('disables unattuned items at capacity and explains the cap', () => {
    renderPanel(makeCharacter(0), [
      { id: 'ring', name: 'Ring', magical: true, attuned: true },
      { id: 'wand', name: 'Wand', magical: true },
    ]);

    const button = screen.getByRole('button', { name: 'Attune: Wand' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Attunement cap reached (Magery + 1)');
    expect(screen.getByRole('button', { name: 'Unattune: Ring' })).not.toBeDisabled();
  });

  it('requires Magery when capacity is zero', () => {
    renderPanel(makeCharacter(null), [{ id: 'wand', name: 'Wand', magical: true }]);

    const button = screen.getByRole('button', { name: 'Attune: Wand' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Requires Magery');
  });

  it('hides the capacity line without Magery or magical items', () => {
    renderPanel(makeCharacter(null), [{ id: 'rope', name: 'Rope' }]);

    expect(screen.queryByText(/Attuned \d+\/\d+/)).not.toBeInTheDocument();
  });

  it('shows capacity when the character has Magery', () => {
    renderPanel(makeCharacter(2), [{ id: 'rope', name: 'Rope' }]);

    expect(screen.getByText('Attuned 0/3')).toBeInTheDocument();
  });

  it('shows zero capacity when a no-Magery character owns a magical item', () => {
    renderPanel(makeCharacter(null), [{ id: 'wand', name: 'Wand', magical: true }]);

    expect(screen.getByText('Attuned 0/0')).toBeInTheDocument();
  });

  it('marks a mundane item as magical through the real store', () => {
    const getState = renderPanel(makeCharacter(0), [{ id: 'wand', name: 'Wand' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Mark as magical: Wand' }));

    expect(getState().entities.inventories['inv-char-mage'].items[0].magical).toBe(true);
    expect(screen.getByRole('button', { name: 'Attune: Wand' })).toBeInTheDocument();
  });

  it('attunes an item with the explicit true payload through the real store', () => {
    const getState = renderPanel(makeCharacter(0), [
      { id: 'wand', name: 'Wand', magical: true },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Attune: Wand' }));

    expect(getState().entities.inventories['inv-char-mage'].items[0].attuned).toBe(true);
    expect(screen.getByText('Attuned 1/1')).toBeInTheDocument();
  });
});
