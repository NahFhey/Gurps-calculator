import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VehiclesView } from '../views/VehiclesView';

const mocks = vi.hoisted(() => ({
  store: {
    state: {} as Record<string, unknown>,
    actions: {
      partyUpsertVehicleType: vi.fn(),
      partyRemoveVehicleType: vi.fn(),
      partyUpsertVehicle: vi.fn(),
      partyRemoveVehicle: vi.fn(),
      partyDockVehicle: vi.fn(),
      partyUndockVehicle: vi.fn(),
    },
  },
}));

vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: () => mocks.store,
}));

function makeState() {
  return {
    entities: {
      vehicleTypes: {
        carrierType: { id: 'carrierType', name: 'Sky Carrier', mode: 'airship', minCrew: 3, hangarSlots: 2, icon: '✦', builtin: true },
        scoutType: { id: 'scoutType', name: 'Lancer', mode: 'airship', minCrew: 1, hangarSlots: 0, icon: '◇' },
      },
      vehicles: {
        carrier: { id: 'carrier', name: 'Mothership', typeId: 'carrierType', position: { kind: 'tile', mapId: 'm1', tileId: 't1' }, createdAt: 1, modifiedAt: 1 },
        scout: { id: 'scout', name: 'Swift', typeId: 'scoutType', position: { kind: 'tile', mapId: 'm1', tileId: 't1' }, createdAt: 1, modifiedAt: 1 },
        unplaced: { id: 'unplaced', name: 'Reserve', typeId: 'scoutType', position: null, createdAt: 1, modifiedAt: 1 },
        docked: { id: 'docked', name: 'Nested', typeId: 'scoutType', position: { kind: 'docked', carrierId: 'carrier' }, createdAt: 1, modifiedAt: 1 },
      },
      travelGroups: {
        crew: { id: 'crew', name: 'Bridge Crew', memberIds: ['a'], vehicleId: 'carrier', position: null },
      },
    },
    maps: {
      mapsById: {
        m1: { id: 'm1', name: 'Cloud Sea', grid: [['t1']] },
      },
    },
  };
}

describe('VehiclesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.state = makeState();
  });

  it('lists seeded types and marks built-ins', () => {
    render(<VehiclesView />);
    expect(screen.getByTestId('vehicle-type-row-carrierType')).toBeInTheDocument();
    expect(screen.getByText('Built-in')).toBeInTheDocument();
  });

  it('adds a vehicle type with clamped defaults', () => {
    render(<VehiclesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Add type' }));
    expect(mocks.store.actions.partyUpsertVehicleType).toHaveBeenCalledWith(expect.objectContaining({ minCrew: 1, hangarSlots: 0 }));
  });

  it('edits a vehicle type inline', () => {
    render(<VehiclesView />);
    const input = screen.getByLabelText('Lancer type name');
    fireEvent.change(input, { target: { value: 'Fast Lancer' } });
    fireEvent.blur(input);
    expect(mocks.store.actions.partyUpsertVehicleType).toHaveBeenCalledWith(expect.objectContaining({ id: 'scoutType', name: 'Fast Lancer' }));
  });

  it('deletes a type after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    render(<VehiclesView />);
    fireEvent.click(screen.getByTestId('delete-vehicle-type-scoutType'));
    expect(mocks.store.actions.partyRemoveVehicleType).toHaveBeenCalledWith('scoutType');
  });

  it('creates an unplaced instance from the first catalog type', () => {
    render(<VehiclesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(mocks.store.actions.partyUpsertVehicle).toHaveBeenCalledWith(expect.objectContaining({ position: null, typeId: 'scoutType' }));
  });

  it('shows tile, docked, and unplaced position readouts plus groups aboard', () => {
    render(<VehiclesView />);
    expect(screen.getAllByText('Cloud Sea (0,0)').length).toBeGreaterThan(0);
    expect(screen.getByText('Docked to Mothership')).toBeInTheDocument();
    expect(screen.getByText('Unplaced')).toBeInTheDocument();
    expect(screen.getByText('Aboard: Bridge Crew')).toBeInTheDocument();
  });

  it('enables docking only when an eligible carrier exists', () => {
    render(<VehiclesView />);
    expect(screen.getByTestId('dock-vehicle-scout')).toBeEnabled();
    expect(screen.getByTestId('dock-vehicle-unplaced')).toBeDisabled();
  });

  it('dispatches docking through the eligible carrier selector', () => {
    render(<VehiclesView />);
    fireEvent.click(screen.getByTestId('dock-vehicle-scout'));
    fireEvent.change(screen.getByLabelText('Dock Swift to carrier'), { target: { value: 'carrier' } });
    expect(mocks.store.actions.partyDockVehicle).toHaveBeenCalledWith('scout', 'carrier');
  });

  it('undocks and deletes instances through row actions', () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    render(<VehiclesView />);
    fireEvent.click(screen.getByTestId('undock-vehicle-docked'));
    fireEvent.click(screen.getByTestId('delete-vehicle-unplaced'));
    expect(mocks.store.actions.partyUndockVehicle).toHaveBeenCalledWith('docked');
    expect(mocks.store.actions.partyRemoveVehicle).toHaveBeenCalledWith('unplaced');
  });
});
