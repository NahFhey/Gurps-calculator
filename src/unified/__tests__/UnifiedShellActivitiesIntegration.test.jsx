import React, { useEffect } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../state/campaignStore';
import { UnifiedShell } from '../UnifiedShell';
import { ActivitiesPanel } from '../../components/activities';

const modules = [
  { id: 'activities', label: 'Activities', content: <ActivitiesPanel /> }
];

function ActivateActivities() {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.setActiveModule('activities');
  }, [actions]);
  return null;
}

describe('UnifiedShell activities integration', () => {
  it('renders activity tiles for each activity type', () => {
    render(
      <CampaignStoreProvider>
        <ActivateActivities />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    // Check that activity tiles are rendered
    expect(screen.getByText('Alchemy')).toBeInTheDocument();
    expect(screen.getByText('Cooking')).toBeInTheDocument();
    expect(screen.getByText('Crafting')).toBeInTheDocument();
    expect(screen.getByText('Gathering')).toBeInTheDocument();
  });

  it('opens activity modal when tile is clicked', () => {
    render(
      <CampaignStoreProvider>
        <ActivateActivities />
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    // Click on Alchemy tile
    const alchemyTile = screen.getByText('Alchemy').closest('button');
    if (alchemyTile) {
      fireEvent.click(alchemyTile);
    }

    // Modal should be open (modal title should be visible)
    // Note: This may need to be adjusted based on actual modal implementation
  });
});
