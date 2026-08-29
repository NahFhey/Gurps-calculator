import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createBlankCharacter } from '../../../utils/characterManagement';
import type { Character } from '../../../types/campaign';

const storeMock = vi.hoisted(() => ({ updateCharacter: vi.fn(), addLogEntry: vi.fn() }));
vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: () => ({ actions: storeMock }),
}));

import { PointSpendModal } from '../PointSpendModal';

const characterWithPoints = (points: number): Character => {
  const character = createBlankCharacter('Ari');
  character.id = 'ari';
  if (!character.gcsData) throw new Error('Expected GCS data');
  character.gcsData.unspentPoints = points;
  character.gcsData.attributes.DX = 12;
  character.gcsData.attributePoints.DX = 40;
  character.gcsData.skills = [{
    id: 'sword', name: 'Broadsword', attribute: 'DX', difficulty: 'A',
    points: 1, relativeLevel: -1, level: 11,
  }];
  return character;
};

describe('PointSpendModal', () => {
  beforeEach(() => {
    storeMock.updateCharacter.mockReset();
    storeMock.addLogEntry.mockReset();
  });

  it('previews and accumulates skill costs', () => {
    render(<PointSpendModal character={characterWithPoints(10)} campaignDay={4} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-skill-point-sword'));
    fireEvent.click(screen.getByTestId('add-skill-point-sword'));
    expect(screen.getByText(/Level 11 → 12; \+2 points/)).toBeInTheDocument();
    expect(screen.getByText('Cart total: 2')).toBeInTheDocument();
    expect(screen.getAllByTestId('spend-cart-line')).toHaveLength(1);
  });

  it('blocks confirmation when the cart exceeds the pool', () => {
    render(<PointSpendModal character={characterWithPoints(1)} campaignDay={4} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Attributes'));
    fireEvent.click(screen.getByTestId('add-attribute-DX'));
    expect(screen.getByTestId('insufficient-points-notice')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-spend-button')).toBeDisabled();
    expect(storeMock.updateCharacter).not.toHaveBeenCalled();
  });

  it('allows a negative-cost disadvantage to credit the pool', () => {
    render(<PointSpendModal character={characterWithPoints(0)} campaignDay={4} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Traits'));
    fireEvent.change(screen.getByLabelText('Trait name'), { target: { value: 'Bad Temper' } });
    fireEvent.change(screen.getByLabelText('Trait type'), { target: { value: 'disadvantage' } });
    fireEvent.change(screen.getByLabelText('Trait point cost'), { target: { value: '-10' } });
    fireEvent.click(screen.getByTestId('add-trait-to-cart'));
    fireEvent.click(screen.getByTestId('confirm-spend-button'));

    const changes = storeMock.updateCharacter.mock.calls[0]?.[1];
    expect(changes?.gcsData.unspentPoints).toBe(10);
    expect(changes?.gcsData.disadvantages).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Bad Temper', points: -10 })]));
  });

  it('applies one atomic update and recomputes a DX skill after a DX raise', () => {
    render(<PointSpendModal character={characterWithPoints(25)} campaignDay={9} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-skill-point-sword'));
    fireEvent.click(screen.getByText('Attributes'));
    fireEvent.click(screen.getByTestId('add-attribute-DX'));
    expect(screen.getByTestId('dependent-skill-preview')).toHaveTextContent('Broadsword: 11 → 12');
    fireEvent.click(screen.getByTestId('confirm-spend-button'));

    expect(storeMock.updateCharacter).toHaveBeenCalledTimes(1);
    const [id, changes] = storeMock.updateCharacter.mock.calls[0] ?? [];
    expect(id).toBe('ari');
    expect(changes?.gcsData).toEqual(expect.objectContaining({
      attributes: expect.objectContaining({ DX: 13 }),
      attributePoints: expect.objectContaining({ DX: 60 }),
      unspentPoints: 4,
      skills: [expect.objectContaining({ id: 'sword', points: 2, level: 13 })],
      skillHistory: [expect.objectContaining({ skillId: 'sword', sessionLabel: 'Point spend — Day 9' })],
      pointLedger: [expect.objectContaining({ kind: 'spend', points: -21 })],
    }));
    expect(storeMock.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({ type: 'character.points_spent' }));
  });
});
