import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CampaignStoreProvider } from '../../../state/campaignStore';
import { ToastContainer, ToastProvider } from '../../ui';
import { LocationManager } from '../LocationManager';

function renderLocationManager() {
  return render(
    <CampaignStoreProvider>
      <ToastProvider>
        <LocationManager />
        <ToastContainer />
      </ToastProvider>
    </CampaignStoreProvider>
  );
}

describe('LocationManager', () => {
  it('creates a location and lets the GM set it as current', () => {
    renderLocationManager();

    expect(screen.getByText('Camp')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ New Location' }));
    fireEvent.change(screen.getByPlaceholderText('Location name'), {
      target: { value: 'Forest Outpost' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Location' }));

    expect(screen.getByText('Forest Outpost')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go Here' }));

    expect(screen.getByText('Forest Outpost').parentElement).toHaveTextContent('Current');
    expect(screen.getByText('Camp').parentElement).not.toHaveTextContent('Current');
  });

  it('warns instead of deleting the last remaining location', () => {
    renderLocationManager();

    fireEvent.click(screen.getByTitle('Delete location'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Cannot delete the last location. Create another location first.'
    );
    expect(screen.getByText('Camp')).toBeInTheDocument();
  });

  it('adds a custom climate and exposes it in the create-location form', () => {
    renderLocationManager();

    fireEvent.click(screen.getByRole('button', { name: 'Climates' }));
    fireEvent.change(screen.getByPlaceholderText('New climate name...'), {
      target: { value: 'Haunted Marsh' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Haunted Marsh')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Locations' }));
    fireEvent.click(screen.getByRole('button', { name: '+ New Location' }));

    expect(screen.getByRole('option', { name: 'Haunted Marsh' })).toBeInTheDocument();
  });

  it('creates a weather table, assigns it to a location, and shows its usage', () => {
    renderLocationManager();

    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    fireEvent.click(screen.getByRole('button', { name: '+ New Table' }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Temperate Forest - Summer'), {
      target: { value: 'Storm Season' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Weather Table' }));

    expect(screen.getByText('Storm Season')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Locations' }));
    fireEvent.click(screen.getByRole('button', { name: '+ New Location' }));
    fireEvent.change(screen.getByPlaceholderText('Location name'), {
      target: { value: 'Rainy Pass' },
    });

    const weatherTableSelect = screen.getAllByRole('combobox')[2];
    const stormSeasonOption = within(weatherTableSelect).getByRole('option', {
      name: 'Storm Season',
    }) as HTMLOptionElement;
    fireEvent.change(weatherTableSelect, { target: { value: stormSeasonOption.value } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Location' }));

    expect(screen.getByText('Rainy Pass')).toBeInTheDocument();
    expect(screen.getByText('Rainy Pass').parentElement?.parentElement).toHaveTextContent('Storm Season');

    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));

    expect(screen.getByText('Used by: Rainy Pass')).toBeInTheDocument();
  });
});
