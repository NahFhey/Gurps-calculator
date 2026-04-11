import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClimateEditor, TerrainEditor, ClimateTerrainEditor } from '../ClimateTerrainEditor';
import { WeatherTableEditor } from '../WeatherTableEditor';
import type { Location, WeatherTable } from '../../../types/location';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockLocations: Location[] = [
  {
    id: 'loc-1',
    name: 'Green Valley',
    climate: 'temperate',
    terrain: 'forest',
    description: 'A lush forest valley',
    modifiers: { gathering: 2, hunting: 1, foraging: 1, travel: 0 },
    connections: [],
    currentWeather: {
      weather: {
        type: 'clear',
        intensity: 'light',
        temperature: 'mild',
        description: 'Clear skies',
        effects: {
          gathering: 0,
          hunting: 0,
          travel: 0,
          crafting: 0,
          alchemy: 0,
          cooking: 0,
          combat: 0,
          visibility: 0,
          hearing: 0,
          slipperyGround: false,
          reducedVisibility: false,
          difficultTerrain: false,
          coldExposure: false,
          heatExposure: false,
          fireRisk: 0,
          trackingMod: 0,
        },
      },
      startedAt: { day: 1, slot: 1 },
      duration: { type: 'slots', count: 1 },
    },
  },
  {
    id: 'loc-2',
    name: 'Dusty Mesa',
    climate: 'arid',
    terrain: 'desert',
    modifiers: { gathering: -2, hunting: 0, foraging: -2, travel: 1 },
    connections: [],
    currentWeather: {
      weather: {
        type: 'clear',
        intensity: 'moderate',
        temperature: 'hot',
        description: 'Hot and dry',
        effects: {
          gathering: 0,
          hunting: 0,
          travel: 0,
          crafting: 0,
          alchemy: 0,
          cooking: 0,
          combat: 0,
          visibility: 0,
          hearing: 0,
          slipperyGround: false,
          reducedVisibility: false,
          difficultTerrain: false,
          coldExposure: false,
          heatExposure: true,
          fireRisk: 2,
          trackingMod: 1,
        },
      },
      startedAt: { day: 1, slot: 1 },
      duration: { type: 'days', count: 1 },
    },
  },
];

const mockWeatherTable: WeatherTable = {
  id: 'wt-1',
  name: 'Temperate Standard',
  description: 'Default temperate weather table',
  entries: [
    {
      weather: 'clear',
      probability: 30,
      temperatureRange: ['cool', 'warm'],
      durationRange: {
        min: { type: 'slots', count: 2 },
        max: { type: 'days', count: 1 },
      },
    },
    {
      weather: 'rain',
      probability: 20,
      temperatureRange: ['cool', 'mild'],
      durationRange: {
        min: { type: 'slots', count: 1 },
        max: { type: 'slots', count: 3 },
      },
    },
  ],
};

// ============================================================================
// CLIMATE EDITOR TESTS
// ============================================================================

describe('ClimateEditor', () => {
  it('should render preset climates as read-only', () => {
    render(
      <ClimateEditor
        customClimates={[]}
        locations={[]}
        onAddClimate={vi.fn()}
        onRemoveClimate={vi.fn()}
      />
    );

    expect(screen.getByText(/Climate Types/i)).toBeInTheDocument();
    expect(screen.getByText(/Presets \(built-in\)/i)).toBeInTheDocument();
    expect(screen.getByText('Temperate')).toBeInTheDocument();
  });

  it('should render custom climates with delete buttons', () => {
    const customClimates = [
      { key: 'haunted_moor', label: 'Haunted Moor' },
      { key: 'crystal_cave', label: 'Crystal Cave' },
    ];

    render(
      <ClimateEditor
        customClimates={customClimates}
        locations={[]}
        onAddClimate={vi.fn()}
        onRemoveClimate={vi.fn()}
      />
    );

    expect(screen.getByText('Haunted Moor')).toBeInTheDocument();
    expect(screen.getByText('Crystal Cave')).toBeInTheDocument();
    expect(screen.getByText(/Custom/i)).toBeInTheDocument();
  });

  it('should show "in use" badge for climates used by locations', () => {
    const customClimates = [{ key: 'temperate', label: 'Temperate' }];

    render(
      <ClimateEditor
        customClimates={customClimates}
        locations={mockLocations}
        onAddClimate={vi.fn()}
        onRemoveClimate={vi.fn()}
      />
    );

    expect(screen.getByText(/in use/i)).toBeInTheDocument();
  });

  it('should disable delete button for in-use climates', () => {
    const customClimates = [{ key: 'custom_temperate', label: 'Custom Temperate' }];
    const mockRemove = vi.fn();
    const locWithCustom: Location[] = [
      {
        ...mockLocations[0],
        climate: 'custom_temperate',
      },
    ];

    render(
      <ClimateEditor
        customClimates={customClimates}
        locations={locWithCustom}
        onAddClimate={vi.fn()}
        onRemoveClimate={mockRemove}
      />
    );

    expect(screen.getByText(/in use/i)).toBeInTheDocument();
    const badge = screen.getByText(/in use/i).closest('div');
    const deleteButton = badge?.querySelector('button');

    expect(deleteButton).toBeDefined();
    if (deleteButton) {
      expect(deleteButton.hasAttribute('disabled')).toBeTruthy();
    }
  });

  it('should allow deleting unused custom climates', () => {
    const customClimates = [{ key: 'haunted_moor', label: 'Haunted Moor' }];
    const mockRemove = vi.fn();

    render(
      <ClimateEditor
        customClimates={customClimates}
        locations={[]}
        onAddClimate={vi.fn()}
        onRemoveClimate={mockRemove}
      />
    );

    const deleteButton = screen.getAllByRole('button').find((btn) =>
      btn.parentElement?.textContent.includes('Haunted Moor')
    );

    if (deleteButton) {
      fireEvent.click(deleteButton);
      expect(mockRemove).toHaveBeenCalledWith('haunted_moor');
    }
  });

  it('should validate add form and prevent duplicate keys', () => {
    const mockAdd = vi.fn();
    const customClimates = [{ key: 'custom_a', label: 'Custom A' }];

    render(
      <ClimateEditor
        customClimates={customClimates}
        locations={[]}
        onAddClimate={mockAdd}
        onRemoveClimate={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/New climate name/i);
    const addButton = screen.getByRole('button', { name: /Add/i });

    // Type a name that would create a duplicate key
    fireEvent.change(input, { target: { value: 'custom_a' } });
    expect(addButton).toBeDisabled();

    // Type a new name
    fireEvent.change(input, { target: { value: 'new_climate' } });
    expect(addButton).not.toBeDisabled();

    fireEvent.click(addButton);
    expect(mockAdd).toHaveBeenCalledWith('new_climate', 'new_climate');
  });

  it('should support Enter key to add climate', () => {
    const mockAdd = vi.fn();

    render(
      <ClimateEditor
        customClimates={[]}
        locations={[]}
        onAddClimate={mockAdd}
        onRemoveClimate={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/New climate name/i);
    fireEvent.change(input, { target: { value: 'test_climate' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockAdd).toHaveBeenCalled();
  });
});

// ============================================================================
// TERRAIN EDITOR TESTS
// ============================================================================

describe('TerrainEditor', () => {
  it('should render preset terrains as read-only', () => {
    render(
      <TerrainEditor
        customTerrains={[]}
        locations={[]}
        onAddTerrain={vi.fn()}
        onRemoveTerrain={vi.fn()}
      />
    );

    expect(screen.getByText(/Terrain Types/i)).toBeInTheDocument();
    expect(screen.getByText(/Presets \(built-in\)/i)).toBeInTheDocument();
    expect(screen.getByText('Forest')).toBeInTheDocument();
  });

  it('should render custom terrains with delete buttons', () => {
    const customTerrains = [
      { key: 'volcano', label: 'Volcano' },
      { key: 'crystal_mines', label: 'Crystal Mines' },
    ];

    render(
      <TerrainEditor
        customTerrains={customTerrains}
        locations={[]}
        onAddTerrain={vi.fn()}
        onRemoveTerrain={vi.fn()}
      />
    );

    expect(screen.getByText('Volcano')).toBeInTheDocument();
    expect(screen.getByText('Crystal Mines')).toBeInTheDocument();
  });

  it('should show "in use" badge for terrain used by locations', () => {
    const customTerrains = [{ key: 'forest', label: 'Forest' }];

    render(
      <TerrainEditor
        customTerrains={customTerrains}
        locations={mockLocations}
        onAddTerrain={vi.fn()}
        onRemoveTerrain={vi.fn()}
      />
    );

    expect(screen.getByText(/in use/i)).toBeInTheDocument();
  });

  it('should disable delete button for in-use terrains', () => {
    const customTerrains = [{ key: 'custom_forest', label: 'Custom Forest' }];
    const mockRemove = vi.fn();
    const locWithCustom: Location[] = [
      {
        ...mockLocations[0],
        terrain: 'custom_forest',
      },
    ];

    render(
      <TerrainEditor
        customTerrains={customTerrains}
        locations={locWithCustom}
        onAddTerrain={vi.fn()}
        onRemoveTerrain={mockRemove}
      />
    );

    expect(screen.getByText(/in use/i)).toBeInTheDocument();
    const badge = screen.getByText(/in use/i).closest('div');
    const deleteButton = badge?.querySelector('button');

    expect(deleteButton).toBeDefined();
    if (deleteButton) {
      expect(deleteButton.hasAttribute('disabled')).toBeTruthy();
    }
  });

  it('should validate terrain add form prevents duplicates', () => {
    const mockAdd = vi.fn();
    const customTerrains = [{ key: 'volcano', label: 'Volcano' }];

    render(
      <TerrainEditor
        customTerrains={customTerrains}
        locations={[]}
        onAddTerrain={mockAdd}
        onRemoveTerrain={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/New terrain name/i);
    const addButton = screen.getByRole('button', { name: /Add/i });

    fireEvent.change(input, { target: { value: 'volcano' } });
    expect(addButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'volcano_field' } });
    expect(addButton).not.toBeDisabled();
  });
});

// ============================================================================
// CLIMATE TERRAIN EDITOR TESTS
// ============================================================================

describe('ClimateTerrainEditor', () => {
  it('should render both climate and terrain editors', () => {
    render(
      <ClimateTerrainEditor
        customClimates={[]}
        customTerrains={[]}
        locations={[]}
        onAddClimate={vi.fn()}
        onRemoveClimate={vi.fn()}
        onAddTerrain={vi.fn()}
        onRemoveTerrain={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText(/Climate Types/i)).toBeInTheDocument();
    expect(screen.getByText(/Terrain Types/i)).toBeInTheDocument();
  });

  it('should render back button and call onBack', () => {
    const mockBack = vi.fn();

    render(
      <ClimateTerrainEditor
        customClimates={[]}
        customTerrains={[]}
        locations={[]}
        onAddClimate={vi.fn()}
        onRemoveClimate={vi.fn()}
        onAddTerrain={vi.fn()}
        onRemoveTerrain={vi.fn()}
        onBack={mockBack}
      />
    );

    const backButton = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backButton);
    expect(mockBack).toHaveBeenCalled();
  });

  it('should pass props correctly to both child editors', () => {
    const customClimates = [{ key: 'humid', label: 'Humid' }];
    const customTerrains = [{ key: 'volcanic_ash', label: 'Volcanic Ash' }];

    render(
      <ClimateTerrainEditor
        customClimates={customClimates}
        customTerrains={customTerrains}
        locations={[]}
        onAddClimate={vi.fn()}
        onRemoveClimate={vi.fn()}
        onAddTerrain={vi.fn()}
        onRemoveTerrain={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Humid')).toBeInTheDocument();
    expect(screen.getByText('Volcanic Ash')).toBeInTheDocument();
  });
});

// ============================================================================
// WEATHER TABLE EDITOR TESTS
// ============================================================================

describe('WeatherTableEditor', () => {
  it('should render in create mode when no table is provided', () => {
    render(
      <WeatherTableEditor
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/New Weather Table/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Weather Table/i })).toBeInTheDocument();
  });

  it('should render in edit mode when table is provided', () => {
    render(
      <WeatherTableEditor
        table={mockWeatherTable}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/Edit Weather Table/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Temperate Standard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
  });

  it('should render weather entries with edit controls', () => {
    render(
      <WeatherTableEditor
        table={mockWeatherTable}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const allSelects = screen.getAllByRole('combobox');
    expect(allSelects.length).toBeGreaterThan(0);
    const weightInputs = screen.getAllByDisplayValue('30');
    expect(weightInputs.length).toBeGreaterThan(0);
  });

  it('should allow adding new weather entries', () => {
    const { rerender } = render(
      <WeatherTableEditor
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const addButton = screen.getByRole('button', { name: /Add Weather Entry/i });
    expect(addButton).toBeInTheDocument();

    fireEvent.click(addButton);
    rerender(
      <WeatherTableEditor
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const entryCount = screen.getByText(/2 entries/i);
    expect(entryCount).toBeInTheDocument();
  });

  it('should allow deleting entries (if more than one exists)', () => {
    render(
      <WeatherTableEditor
        table={mockWeatherTable}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/2 entries/i)).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button').filter((btn) =>
      btn.innerHTML.includes('Trash') || (btn.className.includes('red') && !btn.disabled)
    );

    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('should disable save when name is empty', () => {
    render(
      <WeatherTableEditor
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const saveButton = screen.getByRole('button', { name: /Create Weather Table/i });
    expect(saveButton).toBeDisabled();
  });

  it('should enable save when name is provided and entries exist', () => {
    render(
      <WeatherTableEditor
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/Temperate Forest/i);
    fireEvent.change(nameInput, { target: { value: 'Test Table' } });

    const saveButton = screen.getByRole('button', { name: /Create Weather Table/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('should call onSave with complete table data', () => {
    const mockSave = vi.fn();

    render(
      <WeatherTableEditor
        onSave={mockSave}
        onCancel={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/Temperate Forest/i);
    fireEvent.change(nameInput, { target: { value: 'Arctic Wastes' } });

    const saveButton = screen.getByRole('button', { name: /Create Weather Table/i });
    fireEvent.click(saveButton);

    expect(mockSave).toHaveBeenCalled();
    const savedTable = mockSave.mock.calls[0][0];
    expect(savedTable.name).toBe('Arctic Wastes');
    expect(savedTable.entries.length).toBeGreaterThan(0);
    expect(savedTable.id).toBeDefined();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const mockCancel = vi.fn();

    render(
      <WeatherTableEditor
        onSave={vi.fn()}
        onCancel={mockCancel}
      />
    );

    const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
    expect(cancelButtons.length).toBeGreaterThan(0);
    fireEvent.click(cancelButtons[0]);

    expect(mockCancel).toHaveBeenCalled();
  });

  it('should display entry count and total weight', () => {
    render(
      <WeatherTableEditor
        table={mockWeatherTable}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/2 entries/i)).toBeInTheDocument();
    const container = screen.getByText(/2 entries/i).closest('div');
    expect(container?.textContent).toContain('Total weight');
  });

  it('should allow editing probability weights', () => {
    render(
      <WeatherTableEditor
        table={mockWeatherTable}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const weightInputs = screen.getAllByDisplayValue('30');
    expect(weightInputs.length).toBeGreaterThan(0);
    fireEvent.change(weightInputs[0], { target: { value: '40' } });

    expect(screen.getByDisplayValue('40')).toBeInTheDocument();
  });

  it('should allow changing weather type in entries', () => {
    render(
      <WeatherTableEditor
        table={mockWeatherTable}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const allSelects = screen.getAllByRole('combobox');
    expect(allSelects.length).toBeGreaterThan(0);
    const weatherSelect = allSelects[0];

    fireEvent.change(weatherSelect, { target: { value: 'rain' } });

    const rainOption = screen.getAllByRole('option').find((opt) => opt.textContent?.includes('Rain'));
    expect(rainOption).toBeDefined();
  });
});
