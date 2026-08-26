import { useEffect } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChangelogTab } from '../ChangelogTab';
import { CampaignStoreProvider, useCampaignStore } from '../../state/campaignStore';
import { logEvent } from '../../state/campaignReducer';
import type { LogEntry } from '../../state/campaignReducer';
import type { Character } from '../../types/campaign';

function SeedCampaign({ entries, characters }: {
  entries: LogEntry[];
  characters?: Record<string, Character>;
}) {
  const { actions } = useCampaignStore();
  useEffect(() => {
    if (characters) actions.setCharacters(characters);
    actions.setLogsEntries(entries);
  }, [actions, characters, entries]);
  return null;
}

const alice: Character = {
  id: 'alice-id',
  name: 'Alice',
  work: { skills: {} },
};

describe('ChangelogTab visibility rules', () => {
  it('hides gmOnly entries when GM mode is disabled', () => {
    const entries = [logEvent('gm.note', 'gmOnly', { message: 'Secret GM Note' })];
    render(
      <CampaignStoreProvider>
        <SeedCampaign entries={entries} />
        <ChangelogTab />
      </CampaignStoreProvider>
    );

    expect(screen.queryByText('Secret GM Note')).not.toBeInTheDocument();
  });

  it('masks mixed entries when GM mode is disabled', () => {
    const entries = [
      logEvent('mixed.note', 'mixed', {
        message: 'Secret Details',
        maskedMessage: 'Player Summary'
      })
    ];
    render(
      <CampaignStoreProvider>
        <SeedCampaign entries={entries} />
        <ChangelogTab />
      </CampaignStoreProvider>
    );

    expect(screen.getByText('Player Summary')).toBeInTheDocument();
    expect(screen.queryByText('Secret Details')).not.toBeInTheDocument();
  });

  it('finds legacy message-only entries with case-insensitive text search', () => {
    const entries = [
      logEvent('legacy.note', 'player', { message: 'Found an Ancient Compass' }),
      logEvent('legacy.note', 'player', { message: 'Nothing happened' }),
    ];
    render(
      <CampaignStoreProvider>
        <SeedCampaign entries={entries} />
        <ChangelogTab />
      </CampaignStoreProvider>
    );

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ANCIENT' } });

    expect(screen.getByText('Found an Ancient Compass')).toBeInTheDocument();
    expect(screen.queryByText('Nothing happened')).not.toBeInTheDocument();
  });

  it('filters entries by activity family', () => {
    const entries = [
      logEvent('alchemy.batch_started', 'player', { message: 'Potion started' }),
      logEvent('cooking.meal_prepared', 'player', { message: 'Stew prepared' }),
    ];
    render(
      <CampaignStoreProvider>
        <SeedCampaign entries={entries} />
        <ChangelogTab />
      </CampaignStoreProvider>
    );

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'cooking' } });

    expect(screen.getByText('Stew prepared')).toBeInTheDocument();
    expect(screen.queryByText('Potion started')).not.toBeInTheDocument();
  });

  it('applies an inclusive day range and excludes legacy entries only while a range is set', () => {
    const entries = [
      logEvent('inventory.item_added', 'player', { message: 'Legacy entry' }),
      { ...logEvent('inventory.item_added', 'player', { message: 'Day two' }), day: 2 },
      { ...logEvent('inventory.item_added', 'player', { message: 'Day four' }), day: 4 },
    ];
    render(
      <CampaignStoreProvider>
        <SeedCampaign entries={entries} />
        <ChangelogTab />
      </CampaignStoreProvider>
    );

    expect(screen.getByText('Legacy entry')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('From day'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('To day'), { target: { value: '2' } });

    expect(screen.getByText('Day two')).toBeInTheDocument();
    expect(screen.queryByText('Day four')).not.toBeInTheDocument();
    expect(screen.queryByText('Legacy entry')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('From day'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('To day'), { target: { value: '' } });
    expect(screen.getByText('Legacy entry')).toBeInTheDocument();
  });

  it('matches a selected character by id and falls back to a case-insensitive name', () => {
    const entries = [
      { ...logEvent('combat.damage', 'player', { message: 'Matched by id' }), meta: { characterIds: ['alice-id'] } },
      { ...logEvent('crafting.work_applied', 'player', { message: 'Matched by name' }), meta: { characterNames: ['ALICE'] } },
      { ...logEvent('cooking.meal_prepared', 'player', { message: 'No metadata' }) },
    ];
    render(
      <CampaignStoreProvider>
        <SeedCampaign entries={entries} characters={{ [alice.id]: alice }} />
        <ChangelogTab />
      </CampaignStoreProvider>
    );

    fireEvent.change(screen.getByLabelText('Character'), { target: { value: alice.id } });

    expect(screen.getByText('Matched by id')).toBeInTheDocument();
    expect(screen.getByText('Matched by name')).toBeInTheDocument();
    expect(screen.queryByText('No metadata')).not.toBeInTheDocument();
  });

  it('searches only the masked message for mixed entries in player mode', () => {
    const entries = [
      logEvent('combat.damage', 'mixed', {
        message: 'Alice took secret damage',
        maskedMessage: 'A combatant was injured',
      }),
    ];
    render(
      <CampaignStoreProvider>
        <SeedCampaign entries={entries} />
        <ChangelogTab />
      </CampaignStoreProvider>
    );

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'secret damage' } });
    expect(screen.queryByText('A combatant was injured')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice took secret damage')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'combatant was injured' } });
    expect(screen.getByText('A combatant was injured')).toBeInTheDocument();
  });
});
