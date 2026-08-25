import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../../state/campaignStore';
import { createCampaignState } from '../../../state/campaignReducer';
import type { WeatherTable } from '../../../types/location';
import { ToastProvider } from '../../ui';
import { LocationManager } from '../LocationManager';
import { ClimateView, TerrainView } from '../views/ClimateTerrainViews';
import { LocationFormView } from '../views/LocationFormView';
import { LocationListView } from '../views/LocationListView';
import { ManagerNavigation } from '../views/ManagerNavigation';
import { TerrainModifiersEditor } from '../views/TerrainModifiersEditor';
import { TravelView } from '../views/TravelView';
import { WeatherModifiersEditor } from '../views/WeatherModifiersEditor';
import { WeatherTableFormView, WeatherTablesListView } from '../views/WeatherTableViews';

type CampaignState = ReturnType<typeof createCampaignState>;

const weatherTable: WeatherTable = {
  id: 'weather-table-1',
  name: 'Forest Weather',
  description: 'Weather beneath the canopy',
  entries: [{
    weather: 'rain',
    probability: 10,
    temperatureRange: ['cool', 'mild'],
    durationRange: {
      min: { type: 'slots', count: 1 },
      max: { type: 'days', count: 1 },
    },
  }],
};

function makeState(locationCount = 1): CampaignState {
  const state = createCampaignState();
  const firstLocation = Object.values(state.locations.locations)[0];
  firstLocation.name = 'Home Camp';
  firstLocation.weatherTableId = weatherTable.id;
  state.locations.weatherTables = { [weatherTable.id]: weatherTable };
  if (locationCount > 1) {
    state.locations.locations['location-2'] = {
      ...firstLocation,
      id: 'location-2',
      name: 'Pine Ridge',
      weatherTableId: undefined,
      connections: [],
    };
  }
  return state;
}

function StateProbe({ capture }: { capture: (state: CampaignState) => void }) {
  const { state } = useCampaignStore();
  capture(state);
  return null;
}

function renderRouter({
  state = makeState(),
  capture = () => {},
  onClose,
}: {
  state?: CampaignState;
  capture?: (state: CampaignState) => void;
  onClose?: () => void;
} = {}) {
  render(
    <ToastProvider>
      <CampaignStoreProvider initialCampaignState={state}>
        <StateProbe capture={capture} />
        <LocationManager onClose={onClose} />
      </CampaignStoreProvider>
    </ToastProvider>,
  );
}

const representativeState = makeState(2);
const representativeLocations = Object.values(representativeState.locations.locations);
const representativeLocation = representativeLocations[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LocationManager router', () => {
  it('renders the location list by default', () => {
    renderRouter();
    expect(screen.getByRole('heading', { name: 'Locations' })).toBeInTheDocument();
    expect(screen.getByText('Home Camp')).toBeInTheDocument();
  });

  it('switches among weather, climate, terrain, and modifier views', () => {
    renderRouter();
    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    expect(screen.getByRole('heading', { name: 'Weather Tables' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Climates' }));
    expect(screen.getByRole('heading', { name: 'Climate Types' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terrain' }));
    expect(screen.getByRole('heading', { name: 'Terrain Types' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terrain Mods' }));
    expect(screen.getByRole('heading', { name: 'Terrain Modifiers' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Weather Mods' }));
    expect(screen.getByRole('heading', { name: 'Weather Modifiers' })).toBeInTheDocument();
  });

  it('switches into create view and cancels back to the list', () => {
    renderRouter();
    fireEvent.click(screen.getByRole('button', { name: '+ New Location' }));
    expect(screen.getByRole('heading', { name: 'Create Location' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Locations' })).toBeInTheDocument();
  });

  it('switches into edit view from a location card', () => {
    renderRouter();
    fireEvent.click(screen.getByTitle('Edit location'));
    expect(screen.getByRole('heading', { name: 'Edit Location' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Home Camp')).toBeInTheDocument();
  });

  it('switches into travel view and returns with Back', () => {
    renderRouter({ state: makeState(2) });
    fireEvent.click(screen.getByRole('button', { name: 'Travel' }));
    expect(screen.getAllByRole('heading', { name: 'Travel' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Locations' })).toBeInTheDocument();
  });

  it('dispatches a newly created location into campaign state', () => {
    let latest = makeState();
    renderRouter({ capture: (state) => { latest = state; } });
    fireEvent.click(screen.getByRole('button', { name: '+ New Location' }));
    fireEvent.change(screen.getByPlaceholderText('Location name'), {
      target: { value: 'Stone Crossing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Location' }));
    expect(Object.values(latest.locations.locations)).toHaveLength(2);
    expect(Object.values(latest.locations.locations).some((location) => location.name === 'Stone Crossing')).toBe(true);
  });

  it('calls onClose from the manager close button', () => {
    const onClose = vi.fn();
    renderRouter({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('ManagerNavigation', () => {
  it('renders the active navigation and forwards a view change', () => {
    const onChangeView = vi.fn();
    render(<ManagerNavigation view="list" onChangeView={onChangeView} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    expect(onChangeView).toHaveBeenCalledWith('weatherTables');
  });
});

describe('LocationListView', () => {
  it('renders location details and forwards card actions', () => {
    const onEdit = vi.fn();
    render(
      <LocationListView
        locations={representativeLocations}
        currentLocationId={representativeLocation.id}
        weatherTablesById={{ [weatherTable.id]: weatherTable }}
        allClimateLabels={{ temperate: 'Temperate' }}
        allTerrainLabels={{ plains: 'Plains' }}
        onTravel={vi.fn()}
        onCreate={vi.fn()}
        onSetCurrent={vi.fn()}
        onRollWeather={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/Forest Weather/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByTitle('Edit location')[0]);
    expect(onEdit).toHaveBeenCalledWith(representativeLocation);
  });
});

describe('LocationFormView', () => {
  it('renders controlled form values and forwards edits', () => {
    const onChange = vi.fn();
    render(
      <LocationFormView
        isEdit={false}
        editForm={{
          name: 'Home Camp',
          climate: 'temperate',
          terrain: 'plains',
          weatherTableId: weatherTable.id,
        }}
        allClimateLabels={{ temperate: 'Temperate' }}
        allTerrainLabels={{ plains: 'Plains' }}
        weatherTables={[weatherTable]}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Forest Weather')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Location name'), { target: { value: 'New Camp' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Camp' }));
  });
});

describe('TravelView', () => {
  it('renders supplied travel content and forwards Back', () => {
    const onBack = vi.fn();
    render(<TravelView onBack={onBack}><p>Travel options</p></TravelView>);
    expect(screen.getByText('Travel options')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('WeatherTableViews', () => {
  it('renders table usage and forwards editing from the list view', () => {
    const onEdit = vi.fn();
    render(
      <WeatherTablesListView
        locations={[representativeLocation]}
        weatherTables={[weatherTable]}
        onCreate={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Used by: Home Camp')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Edit table'));
    expect(onEdit).toHaveBeenCalledWith(weatherTable.id);
  });

  it('renders the weather table editor shell with representative data', () => {
    render(<WeatherTableFormView table={weatherTable} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Edit Weather Table' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Forest Weather')).toBeInTheDocument();
  });
});

describe('ClimateTerrainViews', () => {
  it('renders the climate editor with representative props', () => {
    render(
      <ClimateView
        customClimates={[{ key: 'mistlands', label: 'Mistlands' }]}
        locations={[]}
        onAddClimate={vi.fn()}
        onRemoveClimate={vi.fn()}
      />,
    );
    expect(screen.getByText('Mistlands')).toBeInTheDocument();
  });

  it('renders the terrain editor with representative props', () => {
    render(
      <TerrainView
        customTerrains={[{ key: 'badlands', label: 'Badlands' }]}
        locations={[]}
        onAddTerrain={vi.fn()}
        onRemoveTerrain={vi.fn()}
      />,
    );
    expect(screen.getByText('Badlands')).toBeInTheDocument();
  });
});

describe('TerrainModifiersEditor', () => {
  it('renders overrides and forwards modifier changes', () => {
    const onSave = vi.fn();
    render(
      <TerrainModifiersEditor
        overrides={{ forest: { gathering: 3 } }}
        allTerrainLabels={{ forest: 'Forest' }}
        onSave={onSave}
      />,
    );
    expect(screen.getByText('Forest')).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '4' } });
    expect(onSave).toHaveBeenCalledWith({ forest: { gathering: 4 } });
  });
});

describe('WeatherModifiersEditor', () => {
  it('renders weather overrides and forwards effect changes', () => {
    const onSave = vi.fn();
    render(<WeatherModifiersEditor overrides={{ clear: { gathering: 2 } }} onSave={onSave} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '3' } });
    expect(onSave).toHaveBeenCalledWith({ clear: { gathering: 3 } });
  });
});
