import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider } from '../../state/campaignStore';
import { UnifiedShell } from '../UnifiedShell';

describe('UnifiedShell party list', () => {
  it('highlights the selected character when clicked', () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'downtime', label: 'Downtime', content: <div>Downtime Module</div> }
    ];

    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const rinaRow = screen.getByTestId('party-character-char-rina');
    fireEvent.click(rinaRow);

    expect(rinaRow).toHaveAttribute('data-selected', 'true');
  });

  it('sets active module to inventory when Inventory is clicked', () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'downtime', label: 'Downtime', content: <div>Downtime Module</div> }
    ];

    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    const rinaRow = screen.getByTestId('party-character-char-rina');
    const inventoryButton = within(rinaRow).getByRole('button', { name: 'Inventory' });
    const skillsButton = within(rinaRow).getByRole('button', { name: 'Skills' });

    fireEvent.click(skillsButton);
    expect(screen.getByText('Active Module: Downtime')).toBeInTheDocument();

    fireEvent.click(inventoryButton);
    expect(screen.getByText('Active Module: Inventory')).toBeInTheDocument();
  });
});
