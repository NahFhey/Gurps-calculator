import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ============================================================================
// MOCKS
// ============================================================================

const mockCampaignStore = {
  state: {
    time: {
      day: 3,
      slot: 1,
      slotLabels: ['Morning', 'Afternoon', 'Night'],
      slotsPerDay: 3,
    },
    locations: {
      currentLocationId: 'loc-1',
      locations: {
        'loc-1': {
          name: 'Darkwood Forest',
          climate: 'temperate',
          currentWeather: {
            weather: {
              type: 'rain',
              temperature: 'cool',
              description: 'Light rain',
              intensity: 'moderate',
              effects: {
                gathering: -1,
                hunting: 0,
                travel: -1,
                crafting: 0,
                combat: 0,
                visibility: -1,
                alchemy: 0,
                cooking: 0,
                hearing: 0,
                fireRisk: 0,
                trackingMod: 0,
              },
            },
            startDay: 2,
            startSlot: 0,
            durationSlots: 6,
          },
        },
      },
      weatherEffectOverrides: {},
    },
    ui: { gmModeEnabled: false },
  },
  actions: {
    rollNewWeather: vi.fn(),
    setWeatherEffectOverrides: vi.fn(),
  },
};

vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: vi.fn(() => mockCampaignStore),
}));

vi.mock('../../../net/SyncProvider', () => ({
  useSyncContext: vi.fn(() => ({
    status: 'disconnected',
    playerCount: 0,
    role: null,
    sessionInfo: null,
    displayName: null,
    playerList: [],
    hostGame: vi.fn(),
  })),
}));

vi.mock('../../ConnectionDialog', () => ({
  ConnectionDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="connection-dialog">Connection Dialog</div> : null,
}));

vi.mock('../../location/LocationManager', () => ({
  LocationManager: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="location-manager">
      <button onClick={onClose}>Close Manager</button>
    </div>
  ),
}));

// Import components after mocks
import { TimeDisplay } from '../TimeDisplay';
import { ConnectionStatus } from '../ConnectionStatus';
import { WeatherWidget } from '../WeatherWidget';
import { useSyncContext } from '../../../net/SyncProvider';
// useCampaignStore imported via mock above

// ============================================================================
// TIME DISPLAY
// ============================================================================

describe('TimeDisplay', () => {
  it('renders day number and slot label in full mode', () => {
    render(<TimeDisplay />);
    const el = screen.getByTestId('time-display');
    expect(el).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // day
    expect(screen.getByText('Afternoon')).toBeInTheDocument(); // slot label
  });

  it('renders compact format (D3 A)', () => {
    render(<TimeDisplay compact />);
    const el = screen.getByTestId('time-display-compact');
    expect(el).toBeInTheDocument();
    expect(el.textContent).toContain('D3');
    expect(el.textContent).toContain('A'); // first char of "Afternoon"
  });

  it('shows slot number when showSlotNumber is true', () => {
    render(<TimeDisplay showSlotNumber />);
    expect(screen.getByText('(2/3)')).toBeInTheDocument(); // slot 1 => display (2/3)
  });

  it('renders Day and Time labels', () => {
    render(<TimeDisplay />);
    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });
});

// ============================================================================
// CONNECTION STATUS
// ============================================================================

describe('ConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button for the connection indicator', () => {
    render(<ConnectionStatus />);
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn.title).toContain('Multiplayer');
  });

  it('shows disconnected styling when status is disconnected', () => {
    render(<ConnectionStatus />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border-gray-600');
  });

  it('shows connected styling and player count when connected', () => {
    vi.mocked(useSyncContext).mockReturnValue({
      status: 'connected',
      playerCount: 4,
      role: 'gm',
      sessionInfo: null,
      displayName: 'GM',
      playerList: [],
      hostGame: vi.fn(),
    } as unknown as ReturnType<typeof useSyncContext>);

    render(<ConnectionStatus />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border-green-500');
    expect(btn.title).toContain('4 players');
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('opens ConnectionDialog when button is clicked', () => {
    render(<ConnectionStatus />);
    expect(screen.queryByTestId('connection-dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('connection-dialog')).toBeInTheDocument();
  });
});

// ============================================================================
// WEATHER WIDGET
// ============================================================================

describe('WeatherWidget', () => {
  it('renders the weather widget with weather description', () => {
    render(<WeatherWidget />);
    const el = screen.getByTestId('weather-widget');
    expect(el).toBeInTheDocument();
    expect(screen.getByText('Light rain')).toBeInTheDocument();
  });

  it('shows location name and climate', () => {
    render(<WeatherWidget />);
    expect(screen.getByText('Darkwood Forest')).toBeInTheDocument();
    expect(screen.getByText(/(Temperate)/i)).toBeInTheDocument();
  });

  it('renders compact view with data-testid weather-widget-compact', () => {
    render(<WeatherWidget compact />);
    expect(screen.getByTestId('weather-widget-compact')).toBeInTheDocument();
  });


  it('displays effects summary text', () => {
    render(<WeatherWidget />);
    // With gathering=-1, travel=-1, visibility=-1 we expect summary like "Gather -1, Travel -1, Vision -1"
    expect(screen.getByText(/Gather -1/)).toBeInTheDocument();
  });

  it('hides location name when showLocation is false', () => {
    render(<WeatherWidget showLocation={false} />);
    expect(screen.queryByText('Darkwood Forest')).not.toBeInTheDocument();
  });
});
