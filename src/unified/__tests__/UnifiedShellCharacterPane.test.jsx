import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider } from '../../state/campaignStore';
import { UnifiedShell } from '../UnifiedShell';

const modules = [
  { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
  { id: 'downtime', label: 'Downtime', content: <div>Downtime Module</div> }
];

describe('UnifiedShell character pane', () => {
  it('shows party summary when no character is selected', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    expect(screen.getByTestId('party-summary')).toBeInTheDocument();
  });

  it('shows selected character name', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('party-character-char-rina'));

    expect(screen.getByTestId('character-name')).toHaveTextContent('Rina');
  });

  it('renders seeded skill values for the selected character', () => {
    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('party-character-char-rina'));

    const skills = screen.getByTestId('character-skills');
    expect(skills).toHaveTextContent('crafting');
    expect(skills).toHaveTextContent('13');
    expect(skills).toHaveTextContent('alchemy');
    expect(skills).toHaveTextContent('10');
  });
});
