import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createBlankCharacter } from '../../../utils/characterManagement';
import type { Character } from '../../../types/campaign';

const storeMock = vi.hoisted(() => ({ updateCharacter: vi.fn(), addLogEntry: vi.fn() }));
vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: () => ({ actions: storeMock }),
}));

import { AwardPointsModal } from '../AwardPointsModal';

const makeCharacter = (id: string, name: string, isPlayer?: boolean): Character => ({
  ...createBlankCharacter(name), id, isPlayer,
});

describe('AwardPointsModal', () => {
  beforeEach(() => {
    storeMock.updateCharacter.mockReset();
    storeMock.addLogEntry.mockReset();
  });

  it('defaults players on and NPCs off, writes each pool and ledger, and logs one batch', () => {
    const characters = [
      makeCharacter('player-1', 'Ari', true),
      makeCharacter('player-2', 'Bea'),
      makeCharacter('npc-1', 'Guard', false),
    ];
    render(<AwardPointsModal characters={characters} onClose={vi.fn()} />);

    expect(screen.getByTestId('award-character-player-1')).toBeChecked();
    expect(screen.getByTestId('award-character-player-2')).toBeChecked();
    expect(screen.getByTestId('award-character-npc-1')).not.toBeChecked();
    fireEvent.change(screen.getByTestId('award-amount-input'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('award-note-input'), { target: { value: 'Saved the caravan' } });
    fireEvent.click(screen.getByTestId('confirm-award-points-button'));

    expect(storeMock.updateCharacter).toHaveBeenCalledTimes(2);
    for (const id of ['player-1', 'player-2']) {
      expect(storeMock.updateCharacter).toHaveBeenCalledWith(id, {
        gcsData: expect.objectContaining({
          unspentPoints: 3,
          pointLedger: [expect.objectContaining({ kind: 'award', points: 3, label: 'Saved the caravan' })],
        }),
      });
    }
    expect(storeMock.addLogEntry).toHaveBeenCalledTimes(1);
    expect(storeMock.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({ type: 'character.points_awarded' }));
  });
});
