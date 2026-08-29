import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider } from '../../../../state/campaignStore';
import { createCampaignState } from '../../../../state/campaignReducer';
import { downtimeInitialState } from '../../../../state/downtime';
import { DowntimeProvider } from '../../DowntimeContext';
import { TradingTaskForm } from '../TradingTaskForm';
import type { Character } from '../../../../types/campaign';

const characters: Character[] = [
  { id: 'rina', name: 'Rina', work: { skills: { merchant: 13 } } },
  { id: 'soren', name: 'Soren', work: { skills: {} } },
];

function renderForm(onSubmit = vi.fn()) {
  const campaign = createCampaignState();
  characters.forEach((character) => { campaign.entities.characters[character.id] = character; });
  const locationName = campaign.locations.locations[campaign.locations.currentLocationId ?? '']?.name ?? '';
  render(
    <CampaignStoreProvider initialCampaignState={campaign}>
      <DowntimeProvider currentDayKey={1} currentSlot={0}>
        <TradingTaskForm characters={characters} state={downtimeInitialState} currentDayKey={1} currentSlot={0} onSubmit={onSubmit} onCancel={vi.fn()} />
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
  return { onSubmit, locationName };
}

describe('TradingTaskForm', () => {
  it('creates a valid trading payload with default opposing skill', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'rina' } });
    fireEvent.click(screen.getByTestId('submit-button'));
    expect(onSubmit).toHaveBeenCalledWith({
      leaderId: 'rina', helperIds: [],
      activityData: expect.objectContaining({ type: 'trading', opposingSkill: 12 }),
    });
  });

  it('prefills the merchant name from the current location', () => {
    const { locationName } = renderForm();
    expect(screen.getByTestId('merchant-name-input')).toHaveValue(locationName);
  });

  it('shows trained and default Merchant levels', () => {
    renderForm();
    expect(screen.getByRole('option', { name: 'Rina (Merchant-13)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Soren (default IQ−5 = 5)' })).toBeInTheDocument();
    expect(screen.getByTestId('opposing-skill-input')).toHaveValue(12);
  });
});
