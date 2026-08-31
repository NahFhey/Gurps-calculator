import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MapHeader } from '../MapHeader';
import { Map3DView } from '../Map3DView';
import { MapCreateDialog } from '../MapCreateDialog';
import { MapContextMenu } from '../MapContextMenu';
import { ElevationDialog } from '../ElevationDialog';
import { TerrainPalette } from '../TerrainPalette';
import { MarkerEditor } from '../MarkerEditor';
import { MarkerIcon } from '../MarkerIcon';
import { TravelStep3Confirm } from '../TravelStep3Confirm';
import { LinkEditor } from '../LinkEditor';
import { LinksMenu } from '../LinksMenu';

import type {
  MapModel,
  MapId,
  TileId,
  TerrainId,
  TerrainModel,
  MarkerModel,
  LinkModel,
  TravelBlocker,
} from '../../../../types/map';

// ============================================================================
// SHARED MOCK DATA
// ============================================================================

const mockTerrainId1: TerrainId = 'terrain-forest';
const mockTerrainId2: TerrainId = 'terrain-desert';
const mockTerrainId3: TerrainId = 'terrain-water';

const mockTerrain: Record<TerrainId, TerrainModel> = {
  [mockTerrainId1]: {
    id: mockTerrainId1,
    name: 'Forest',
    color: '#22c55e',
    perMode: {
      foot: { passable: true, speedModifier: 0.8 },
      boat: { passable: false, speedModifier: 1.0 },
      airship: { passable: true, speedModifier: 1.0 },
    },
  },
  [mockTerrainId2]: {
    id: mockTerrainId2,
    name: 'Desert',
    color: '#eab308',
    perMode: {
      foot: { passable: true, speedModifier: 0.6 },
      boat: { passable: false, speedModifier: 1.0 },
      airship: { passable: true, speedModifier: 1.0 },
    },
  },
  [mockTerrainId3]: {
    id: mockTerrainId3,
    name: 'Water',
    color: '#3b82f6',
    perMode: {
      foot: { passable: false, speedModifier: 1.0 },
      boat: { passable: true, speedModifier: 1.0 },
      airship: { passable: true, speedModifier: 1.0 },
    },
  },
};

const mockMapId1: MapId = 'map-1';
const mockMapId2: MapId = 'map-2';

const mockMap: MapModel = ({
  id: mockMapId1,
  name: 'Thornwood Region',
  description: 'A lush forest region',
  climate: 'temperate',
  visionMode: 'lineOfSight',
  scaleMilesPerTile: 12,
  rows: 3,
  cols: 3,
  grid: Array(3)
    .fill(null)
    .map((_, r) =>
      Array(3)
        .fill(null)
        .map((_, c) => {
          const tileId: TileId = `tile-${r}-${c}`;
          return {
            id: tileId,
            terrainId: r === 0 ? mockTerrainId1 : mockTerrainId2,
            markerIds: r === 1 && c === 1 ? ['marker-1'] : [],
            linkIds: [],
          };
        })
    ),
  markersById: {
    'marker-1': {
      id: 'marker-1',
      tileId: 'tile-1-1',
      type: 'settlement',
      label: 'Thornwood Town',
      notes: 'Major settlement',
      visibility: 'player',
    } as MarkerModel,
  },
  linksById: {},
  tileRevealMap: {},
  tileVisibilityMap: {},
}) as unknown as MapModel;

const mockMaps: Record<MapId, MapModel> = {
  [mockMapId1]: mockMap,
  [mockMapId2]: {
    ...mockMap,
    id: mockMapId2,
    name: 'Crystal Peaks',
    scaleMilesPerTile: 50,
  },
};

// ============================================================================
// MAPHEADER
// ============================================================================

describe('MapHeader', () => {
  it('renders map name and scale badge', () => {
    const onSelectMap = vi.fn();
    const onCreateMap = vi.fn();

    render(
      <MapHeader
        maps={mockMaps}
        activeMapId={mockMapId1}
        isGmMode={true}
        onSelectMap={onSelectMap}
        onCreateMap={onCreateMap}
      />
    );

    expect(screen.getByText('Thornwood Region')).toBeInTheDocument();
    expect(screen.getByText(/Local/)).toBeInTheDocument();
  });

  it('shows "New Map" button in GM mode only', () => {
    const onCreateMap = vi.fn();

    const { rerender } = render(
      <MapHeader
        maps={mockMaps}
        activeMapId={mockMapId1}
        isGmMode={true}
        onSelectMap={vi.fn()}
        onCreateMap={onCreateMap}
      />
    );

    expect(screen.getByText('New Map')).toBeInTheDocument();

    rerender(
      <MapHeader
        maps={mockMaps}
        activeMapId={mockMapId1}
        isGmMode={false}
        onSelectMap={vi.fn()}
        onCreateMap={onCreateMap}
      />
    );

    expect(screen.queryByText('New Map')).not.toBeInTheDocument();
  });

  it('shows "Travel" button when party is on map', () => {
    const onTravel = vi.fn();

    render(
      <MapHeader
        maps={mockMaps}
        activeMapId={mockMapId1}
        isGmMode={false}
        onSelectMap={vi.fn()}
        onCreateMap={vi.fn()}
        hasPartyOnMap={true}
        onTravel={onTravel}
      />
    );

    expect(screen.getByText('Travel')).toBeInTheDocument();
  });

  it('displays the named placement banner', () => {
    render(
      <MapHeader
        maps={mockMaps}
        activeMapId={mockMapId1}
        isGmMode={true}
        onSelectMap={vi.fn()}
        onCreateMap={vi.fn()}
        placingName="the party"
        onCancelPlacement={vi.fn()}
      />
    );

    expect(screen.getByText(/Click any tile to place the party/)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders travel groups with counts, conveyance, and elsewhere marker', () => {
    render(
      <MapHeader
        maps={mockMaps}
        activeMapId={mockMapId1}
        isGmMode={false}
        onSelectMap={vi.fn()}
        onCreateMap={vi.fn()}
        groups={[
          { id: 'main', name: 'Main Party', memberCount: 3, vehicleName: 'Zephyr', onThisMap: true },
          { id: 'scouts', name: 'Scouts', memberCount: 1, vehicleName: null, onThisMap: false },
        ]}
        activeGroupId="main"
        onSelectGroup={vi.fn()}
      />
    );
    expect(screen.getByRole('option', { name: /Main Party \(3\).*aboard Zephyr/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /◆ Scouts \(1\)/ })).toBeInTheDocument();
  });

  it('selects an active travel group', () => {
    const onSelectGroup = vi.fn();
    render(
      <MapHeader
        maps={mockMaps}
        activeMapId={mockMapId1}
        isGmMode={false}
        onSelectMap={vi.fn()}
        onCreateMap={vi.fn()}
        groups={[
          { id: 'main', name: 'Main Party', memberCount: 3, vehicleName: null, onThisMap: true },
          { id: 'scouts', name: 'Scouts', memberCount: 1, vehicleName: null, onThisMap: true },
        ]}
        activeGroupId="main"
        onSelectGroup={onSelectGroup}
      />
    );
    fireEvent.change(screen.getByLabelText('Active travel group'), { target: { value: 'scouts' } });
    expect(onSelectGroup).toHaveBeenCalledWith('scouts');
  });

  it('calls onSelectMap when map is selected from dropdown', async () => {
    const onSelectMap = vi.fn();

    render(
      <MapHeader
        maps={mockMaps}
        activeMapId={mockMapId1}
        isGmMode={true}
        onSelectMap={onSelectMap}
        onCreateMap={vi.fn()}
      />
    );

    // Click to open dropdown
    const dropdownButton = screen.getByText('Thornwood Region').closest('button');
    fireEvent.click(dropdownButton!);

    // Click on second map
    await waitFor(() => {
      const crystalPeaksOption = screen.getByText('Crystal Peaks');
      fireEvent.click(crystalPeaksOption);
    });

    expect(onSelectMap).toHaveBeenCalledWith(mockMapId2);
  });

  it('updates vision, sight range, climate, and weather table from the GM settings popover', () => {
    const onUpdateMapSettings = vi.fn();
    render(
      <MapHeader
        maps={mockMaps}
        activeMapId={mockMapId1}
        isGmMode={true}
        onSelectMap={vi.fn()}
        onCreateMap={vi.fn()}
        onUpdateMapSettings={onUpdateMapSettings}
        climateLabels={{ temperate: 'Temperate', arid: 'Arid' }}
        weatherTables={[{ id: 'weather-1', name: 'Regional Weather', entries: [] }]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Map settings' }));
    fireEvent.change(screen.getByLabelText('Vision'), { target: { value: 'open' } });
    fireEvent.change(screen.getByLabelText('Sight range'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Climate'), { target: { value: 'arid' } });
    fireEvent.change(screen.getByLabelText('Weather table'), { target: { value: 'weather-1' } });
    expect(onUpdateMapSettings).toHaveBeenCalledWith({ visionMode: 'open' });
    expect(onUpdateMapSettings).toHaveBeenCalledWith({ sightRangeTiles: 12 });
    expect(onUpdateMapSettings).toHaveBeenCalledWith({ climate: 'arid' });
    expect(onUpdateMapSettings).toHaveBeenCalledWith({ weatherTableId: 'weather-1' });
  });
});

// ============================================================================
// THREE-DIMENSIONAL MAP
// ============================================================================

describe('three-dimensional map view', () => {
  it('shows the WebGL-unavailable fallback under jsdom without crashing', async () => {
    render(
      <Map3DView
        map={mockMap}
        isGmMode={true}
        visionMode="lineOfSight"
        paintModeActive={false}
        placingToken={false}
      />
    );
    expect(await screen.findByText('3D map unavailable — WebGL could not start.')).toBeInTheDocument();
  });
});

// ============================================================================
// MAPCREATEDIALOG
// ============================================================================

describe('MapCreateDialog', () => {
  it('renders form fields correctly', () => {
    render(
      <MapCreateDialog onConfirm={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByPlaceholderText(/Thornwood Region/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Optional description/)).toBeInTheDocument();
    expect(screen.getByText(/Scale/)).toBeInTheDocument();
    expect(screen.getByText(/Starting Terrain/)).toBeInTheDocument();
  });

  it('validates name is required', () => {
    const onConfirm = vi.fn();

    render(
      <MapCreateDialog onConfirm={onConfirm} onCancel={vi.fn()} />
    );

    const submitButton = screen.getByRole('button', { name: /Create Map/ });
    expect(submitButton).toBeDisabled();

    const nameInput = screen.getByPlaceholderText(/Thornwood Region/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'New Map' } });

    expect(submitButton).not.toBeDisabled();
  });

  it('calls onConfirm with form params on submit', async () => {
    const onConfirm = vi.fn();

    render(
      <MapCreateDialog onConfirm={onConfirm} onCancel={vi.fn()} />
    );

    const nameInput = screen.getByPlaceholderText(/Thornwood Region/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'My Map' } });

    const submitButton = screen.getByRole('button', { name: /Create Map/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
      const call = onConfirm.mock.calls[0][0];
      expect(call.name).toBe('My Map');
      expect(call.scaleMilesPerTile).toBe(12);
      expect(call.climate).toBe('temperate');
    });
  });

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();

    render(
      <MapCreateDialog onConfirm={vi.fn()} onCancel={onCancel} />
    );

    const buttons = screen.getAllByRole('button');
    const cancelButton = buttons.find((btn) => btn.textContent === 'Cancel');
    fireEvent.click(cancelButton!);

    expect(onCancel).toHaveBeenCalled();
  });
});

// ============================================================================
// MAPCONTEXTMENU
// ============================================================================

describe('MapContextMenu', () => {
  it('renders coordinate header', () => {
    render(
      <MapContextMenu
        state={{ tileId: 'tile-1', row: 2, col: 3, x: 100, y: 100 }}
        selectedTileIds={new Set()}
        selectedTerrainId={mockTerrainId1}
        terrains={mockTerrain}
        onStampSelection={vi.fn()}
        onAddMarker={vi.fn()}
        onAddLink={vi.fn()}
        onSetElevation={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Tile \(2, 3\)/)).toBeInTheDocument();
  });

  it('renders Add Marker and Add Link buttons', () => {
    render(
      <MapContextMenu
        state={{ tileId: 'tile-1', row: 0, col: 0, x: 100, y: 100 }}
        selectedTileIds={new Set()}
        selectedTerrainId={mockTerrainId1}
        terrains={mockTerrain}
        onStampSelection={vi.fn()}
        onAddMarker={vi.fn()}
        onAddLink={vi.fn()}
        onSetElevation={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Add Marker')).toBeInTheDocument();
    expect(screen.getByText('Add Link')).toBeInTheDocument();
  });

  it('calls onAddMarker when marker button is clicked', () => {
    const onAddMarker = vi.fn();

    render(
      <MapContextMenu
        state={{ tileId: 'tile-1', row: 0, col: 0, x: 100, y: 100 }}
        selectedTileIds={new Set()}
        selectedTerrainId={mockTerrainId1}
        terrains={mockTerrain}
        onStampSelection={vi.fn()}
        onAddMarker={onAddMarker}
        onAddLink={vi.fn()}
        onSetElevation={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const addMarkerButton = screen.getByText('Add Marker');
    fireEvent.click(addMarkerButton);

    expect(onAddMarker).toHaveBeenCalledWith('tile-1');
  });

  it('shows stamp terrain option when tiles are selected', () => {
    render(
      <MapContextMenu
        state={{ tileId: 'tile-1', row: 0, col: 0, x: 100, y: 100 }}
        selectedTileIds={new Set(['tile-1', 'tile-2'])}
        selectedTerrainId={mockTerrainId1}
        terrains={mockTerrain}
        onStampSelection={vi.fn()}
        onAddMarker={vi.fn()}
        onAddLink={vi.fn()}
        onSetElevation={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Apply Forest to 2 tile\(s\)/)).toBeInTheDocument();
  });

  it('sets elevation for the containing selection', () => {
    const onSetElevation = vi.fn();
    render(
      <MapContextMenu
        state={{ tileId: 'tile-1', row: 0, col: 0, x: 100, y: 100 }}
        selectedTileIds={new Set(['tile-1', 'tile-2'])}
        selectedTerrainId={null}
        terrains={mockTerrain}
        onStampSelection={vi.fn()}
        onAddMarker={vi.fn()}
        onAddLink={vi.fn()}
        onSetElevation={onSetElevation}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Set Elevation…'));
    expect(onSetElevation).toHaveBeenCalledWith(['tile-1', 'tile-2']);
  });
});

describe('ElevationDialog', () => {
  it('confirms an integer elevation', () => {
    const onConfirm = vi.fn();
    render(<ElevationDialog tileCount={2} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Elevation level'), { target: { value: '6' } });
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledWith(6);
    expect(screen.getByText(/affects 2 tiles/)).toBeInTheDocument();
  });

  it('confirms null after clearing the override', () => {
    const onConfirm = vi.fn();
    render(<ElevationDialog tileCount={1} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Clear override (use terrain elevation)'));
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('cancels without confirming', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ElevationDialog tileCount={1} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TERRAINPALETTE
// ============================================================================

describe('TerrainPalette', () => {
  it('renders mode buttons', () => {
    render(
      <TerrainPalette
        terrains={Object.values(mockTerrain)}
        selectedTerrainId={mockTerrainId1}
        interactionMode="view"
        onSelectTerrain={vi.fn()}
        onSetMode={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3); // at least view, paint, select
  });

  it('renders terrain swatches', () => {
    render(
      <TerrainPalette
        terrains={Object.values(mockTerrain)}
        selectedTerrainId={mockTerrainId1}
        interactionMode="view"
        onSelectTerrain={vi.fn()}
        onSetMode={vi.fn()}
      />
    );

    expect(screen.getByText('Forest')).toBeInTheDocument();
    expect(screen.getByText('Desert')).toBeInTheDocument();
    expect(screen.getByText('Water')).toBeInTheDocument();
  });

  it('calls onSelectTerrain when terrain is clicked', () => {
    const onSelectTerrain = vi.fn();

    render(
      <TerrainPalette
        terrains={Object.values(mockTerrain)}
        selectedTerrainId={null}
        interactionMode="view"
        onSelectTerrain={onSelectTerrain}
        onSetMode={vi.fn()}
      />
    );

    const forestButton = screen.getByText('Forest').closest('button');
    fireEvent.click(forestButton!);

    expect(onSelectTerrain).toHaveBeenCalledWith(mockTerrainId1);
  });

  it('shows Add Terrain button when callback is provided', () => {
    const onAddTerrain = vi.fn();

    render(
      <TerrainPalette
        terrains={Object.values(mockTerrain)}
        selectedTerrainId={mockTerrainId1}
        interactionMode="view"
        onSelectTerrain={vi.fn()}
        onSetMode={vi.fn()}
        onAddTerrain={onAddTerrain}
      />
    );

    expect(screen.getByText('Add Terrain')).toBeInTheDocument();
  });
});

// ============================================================================
// MARKEREDITOR
// ============================================================================

describe('MarkerEditor', () => {
  it('shows "Add Marker" title when creating new marker', () => {
    render(
      <MarkerEditor
        tileId="tile-1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Marker' })).toBeInTheDocument();
  });

  it('shows "Edit Marker" title when editing existing marker', () => {
    const existing: MarkerModel = {
      id: 'marker-1',
      tileId: 'tile-1',
      type: 'settlement',
      label: 'Town',
      visibility: 'player',
    };

    render(
      <MarkerEditor
        tileId="tile-1"
        existing={existing}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Marker')).toBeInTheDocument();
  });

  it('validates label is required', () => {
    const onConfirm = vi.fn();

    render(
      <MarkerEditor
        tileId="tile-1"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Add Marker/ });
    expect(submitButton).toBeDisabled();

    const labelInput = screen.getByPlaceholderText(/Iron Deposit/);
    fireEvent.change(labelInput, { target: { value: 'Iron Deposit' } });

    expect(submitButton).not.toBeDisabled();
  });

  it('calls onConfirm with marker data on submit', async () => {
    const onConfirm = vi.fn();

    render(
      <MarkerEditor
        tileId="tile-1"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    const labelInput = screen.getByPlaceholderText(/Iron Deposit/);
    fireEvent.change(labelInput, { target: { value: 'Gold Mine' } });

    const submitButton = screen.getByRole('button', { name: /Add Marker/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
      const marker = onConfirm.mock.calls[0][0];
      expect(marker.label).toBe('Gold Mine');
      expect(marker.tileId).toBe('tile-1');
    });
  });

  it('links a location marker to an existing location', () => {
    const onConfirm = vi.fn();
    render(<MarkerEditor tileId="tile-1" locations={[{ id: 'town', name: 'Town', climate: 'temperate', terrain: 'urban', modifiers: { gathering: 0, hunting: 0, foraging: 0, travel: 0 }, createdAt: 1, modifiedAt: 1 }]} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Location/ }));
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'town' } });
    fireEvent.change(screen.getByPlaceholderText(/Iron Deposit/), { target: { value: 'Town pin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Marker' }));
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ type: 'location', locationId: 'town' });
  });

  it('returns an inline new-location name with a generated location id', () => {
    const onConfirm = vi.fn();
    render(<MarkerEditor tileId="tile-1" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Location/ }));
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: '__create__' } });
    fireEvent.change(screen.getByLabelText('New location name'), { target: { value: 'New Town' } });
    fireEvent.change(screen.getByPlaceholderText(/Iron Deposit/), { target: { value: 'New Town' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Marker' }));
    expect(onConfirm.mock.calls[0][0].locationId).toEqual(expect.any(String));
    expect(onConfirm.mock.calls[0][1]).toBe('New Town');
  });

  it('deletes an existing marker through the editor action', () => {
    const onDelete = vi.fn();
    const existing: MarkerModel = { id: 'marker-1', tileId: 'tile-1', type: 'note', label: 'Note', visibility: 'gm' };
    render(<MarkerEditor tileId="tile-1" existing={existing} onConfirm={vi.fn()} onDelete={onDelete} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(existing);
  });
});

// ============================================================================
// MARKERICON
// ============================================================================

describe('MarkerIcon', () => {
  it('renders without crashing for different types', () => {
    const types = ['note', 'settlement', 'mining_node', 'danger', 'location'];

    types.forEach((type) => {
      const { container } = render(
        <MarkerIcon type={type} />
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('renders with custom size', () => {
    const { container } = render(
      <MarkerIcon type="settlement" size={20} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ width: '20px', height: '20px' });
  });
});

// ============================================================================
// TRAVELSTEP3CONFIRM
// ============================================================================

describe('TravelStep3Confirm', () => {
  it('shows all-clear state when no blockers', () => {
    render(
      <TravelStep3Confirm
        blockers={[]}
        isGmMode={false}
        hasNullTerrain={false}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
  });

  it('displays blocker messages', () => {
    const blockers: TravelBlocker[] = [
      { code: 'impassable', message: 'Impassable terrain detected', details: ['Desert at (2, 3)'] },
    ];

    render(
      <TravelStep3Confirm
        blockers={blockers}
        isGmMode={false}
        hasNullTerrain={false}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('Impassable terrain detected')).toBeInTheDocument();
    expect(screen.getByText('Desert at (2, 3)')).toBeInTheDocument();
  });

  it('disables confirm button when blockers exist', () => {
    const blockers: TravelBlocker[] = [
      { code: 'test', message: 'Test blocker', details: [] },
    ];

    render(
      <TravelStep3Confirm
        blockers={blockers}
        isGmMode={false}
        hasNullTerrain={false}
        onConfirm={vi.fn()}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /Confirm Travel/ });
    expect(confirmButton).toBeDisabled();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();

    render(
      <TravelStep3Confirm
        blockers={[]}
        isGmMode={false}
        hasNullTerrain={false}
        onConfirm={onConfirm}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /Confirm Travel/ });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalled();
  });
});

// ============================================================================
// LINKEDITOR
// ============================================================================

describe('LinkEditor', () => {
  it('renders form fields', () => {
    render(
      <LinkEditor
        fromMapId={mockMapId1}
        fromTileId="tile-1"
        maps={mockMaps}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Create Link' })).toBeInTheDocument();
    expect(screen.getByText(/Target Map/)).toBeInTheDocument();
  });

  it('populates target map selector with other maps only', () => {
    render(
      <LinkEditor
        fromMapId={mockMapId1}
        fromTileId="tile-1"
        maps={mockMaps}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Should show Crystal Peaks (the other map)
    expect(screen.getByText(/Crystal Peaks/)).toBeInTheDocument();
  });

  it('enables submit when target map is selected', async () => {
    render(
      <LinkEditor
        fromMapId={mockMapId1}
        fromTileId="tile-1"
        maps={mockMaps}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Create Link/ });
    expect(submitButton).toBeDisabled();

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: mockMapId2 } });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('calls onConfirm with link data on submit', async () => {
    const onConfirm = vi.fn();

    render(
      <LinkEditor
        fromMapId={mockMapId1}
        fromTileId="tile-1"
        maps={mockMaps}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: mockMapId2 } });

    const labelInput = screen.getByPlaceholderText(/Enter Port City/);
    fireEvent.change(labelInput, { target: { value: 'Portal to Peaks' } });

    const submitButton = screen.getByRole('button', { name: /Create Link/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
      const link = onConfirm.mock.calls[0][0];
      expect(link.fromMapId).toBe(mockMapId1);
      expect(link.fromTileId).toBe('tile-1');
      expect(link.toMapId).toBe(mockMapId2);
      expect(link.label).toBe('Portal to Peaks');
    });
  });
});

// ============================================================================
// LINKSMENU
// ============================================================================

describe('LinksMenu', () => {
  it('returns null when no links', () => {
    const { container } = render(
      <LinksMenu links={[]} maps={mockMaps} onUseLink={vi.fn()} onClose={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders link list with target map info', () => {
    const links: LinkModel[] = [
      {
        id: 'link-1',
        fromMapId: mockMapId1,
        fromTileId: 'tile-1',
        toMapId: mockMapId2,
        toTileId: 'tile-center',
        label: 'To Peaks',
      },
    ];

    render(
      <LinksMenu links={links} maps={mockMaps} onUseLink={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.getByText('To Peaks')).toBeInTheDocument();
    expect(screen.getByText(/Crystal Peaks/)).toBeInTheDocument();
  });

  it('calls onUseLink when link is clicked', () => {
    const onUseLink = vi.fn();
    const link: LinkModel = {
      id: 'link-1',
      fromMapId: mockMapId1,
      fromTileId: 'tile-1',
      toMapId: mockMapId2,
      toTileId: 'tile-center',
      label: 'To Peaks',
    };

    render(
      <LinksMenu links={[link]} maps={mockMaps} onUseLink={onUseLink} onClose={vi.fn()} />
    );

    const linkButton = screen.getByText('To Peaks').closest('button');
    fireEvent.click(linkButton!);

    expect(onUseLink).toHaveBeenCalledWith(link);
  });

  it('displays close button', () => {
    const onClose = vi.fn();
    const link: LinkModel = {
      id: 'link-1',
      fromMapId: mockMapId1,
      fromTileId: 'tile-1',
      toMapId: mockMapId2,
      toTileId: 'tile-center',
    };

    const { container } = render(
      <LinksMenu links={[link]} maps={mockMaps} onUseLink={vi.fn()} onClose={onClose} />
    );

    const closeButton = container.querySelector('button:last-child');
    fireEvent.click(closeButton!);

    expect(onClose).toHaveBeenCalled();
  });
});
