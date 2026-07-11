import { useEffect } from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChangelogTab } from '../ChangelogTab';
import { CampaignStoreProvider, useCampaignStore } from '../../state/campaignStore';
import { logEvent } from '../../state/campaignReducer';
import type { LogEntry } from '../../state/campaignReducer';

function SeedLogs({ entries }: { entries: LogEntry[] }) {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.setLogsEntries(entries);
  }, [actions, entries]);
  return null;
}

describe('ChangelogTab visibility rules', () => {
  it('hides gmOnly entries when GM mode is disabled', () => {
    const entries = [logEvent('gm.note', 'gmOnly', { message: 'Secret GM Note' })];
    render(
      <CampaignStoreProvider>
        <SeedLogs entries={entries} />
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
        <SeedLogs entries={entries} />
        <ChangelogTab />
      </CampaignStoreProvider>
    );

    expect(screen.getByText('Player Summary')).toBeInTheDocument();
    expect(screen.queryByText('Secret Details')).not.toBeInTheDocument();
  });
});
