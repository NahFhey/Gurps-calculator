import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../types/campaign';
import { createDefaultGCSData } from '../../../types/characterSheet';
import { CharacterEquipmentPanel } from '../../character-panels/CharacterEquipmentPanel';

const actions = {
  setCharacterPanelView: vi.fn(),
  updateCharacter: vi.fn(),
  demoteItem: vi.fn(),
};

vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: () => ({
    state: {
      entities: {
        currencyConfig: {
          primaryKey: 'gp',
          currencies: [{ key: 'gp', name: 'Gold Pieces' }],
        },
      },
    },
    actions,
  }),
}));

function makeCharacter(): Character {
  const gcsData = createDefaultGCSData();
  gcsData.equipment = [{
    id: 'eq-1',
    name: 'Longsword',
    quantity: 1,
    weight: 4,
    cost: 700,
    equipped: true,
    category: 'weapon',
  }];
  return { id: 'char-1', name: 'Aldric', work: { skills: {} }, gcsData };
}

describe('CharacterEquipmentPanel equipment demotion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes the row from the local draft and dispatches send-to-pack', () => {
    render(<CharacterEquipmentPanel character={makeCharacter()} />);
    expect(screen.getByText('Cost (gp)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send Longsword to pack' }));
    expect(actions.demoteItem).toHaveBeenCalledWith({
      characterId: 'char-1',
      equipmentId: 'eq-1',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(actions.updateCharacter).toHaveBeenCalledWith('char-1', {
      gcsData: expect.objectContaining({ equipment: [] }),
    });
  });
});
