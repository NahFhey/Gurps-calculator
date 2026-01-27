import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider, useLegacyAppState } from '../../state/campaignStore';
import { UnifiedShell } from '../UnifiedShell';

function LegacyValueDisplay() {
  const legacyAppState = useLegacyAppState();
  return <div>Legacy Marker: {legacyAppState.marker}</div>;
}

describe('UnifiedShell legacy state bridge', () => {
  it('reflects legacy values passed into the store', () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <LegacyValueDisplay /> }
    ];

    const { unmount } = render(
      <CampaignStoreProvider initialLegacyAppState={{ marker: 'Alpha' }}>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    expect(screen.getByText('Legacy Marker: Alpha')).toBeInTheDocument();

    unmount();

    render(
      <CampaignStoreProvider initialLegacyAppState={{ marker: 'Beta' }}>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    expect(screen.getByText('Legacy Marker: Beta')).toBeInTheDocument();
  });
});
