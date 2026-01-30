import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider } from '../../state/campaignStore';
import { UnifiedShell } from '../UnifiedShell';

describe('UnifiedShell module routing', () => {
  it('shows Rules content after clicking Rules', async () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'rules', label: 'Rules', content: <div>Rules Module</div> }
    ];

    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('rail-module-rules'));

    // The module content is rendered, check for the module's content
    expect(await screen.findByText('Rules Module')).toBeInTheDocument();
  });

  it('shows Inventory content after clicking Inventory', async () => {
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'rules', label: 'Rules', content: <div>Rules Module</div> }
    ];

    render(
      <CampaignStoreProvider>
        <UnifiedShell modules={modules} />
      </CampaignStoreProvider>
    );

    fireEvent.click(screen.getByTestId('rail-module-inventory'));

    // The module content is rendered, check for the module's content
    expect(await screen.findByText('Inventory Module')).toBeInTheDocument();
  });
});
