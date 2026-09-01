import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../../types/campaign';
import type { TravelGroup, Vehicle, VehicleTypeDef } from '../../../../types/party';
import { TravelStep1Party, type TravelPartySource } from '../TravelStep1Party';
import { TravelWizard } from '../TravelWizard';
import { createNewMap } from '../../../../utils/mapUtils';
import { downtimeInitialState } from '../../../../state/downtime';

vi.mock('../../../../hooks/useWeatherModifiers', () => ({
  useWeatherModifiers: () => ({ skillBonus: 0 }),
}));

const character = (id: string, name: string, images?: Character['images']): Character => ({ id, name, work: { skills: {} }, images });
const group = (id: string, name: string, members: string[]): TravelGroup => ({ id, name, memberIds: members, vehicleId: null, position: { mapId: 'm1', tileId: 't1' } });
const active = group('active', 'Main Party', ['a', 'b']);
const scouts = group('scouts', 'Scouts', ['c']);
const characters = {
  a: character('a', 'Ada', { token: 'data:token', portrait: 'data:portrait' }),
  b: character('b', 'Borin'),
  c: character('c', 'Cyra'),
};
const sources: TravelPartySource[] = [
  { group: active, members: [characters.a, characters.b] },
  { group: scouts, members: [characters.c] },
];
const boatType: VehicleTypeDef = { id: 'boat', name: 'Riverboat', mode: 'boat', minCrew: 2, hangarSlots: 0, icon: '⛵' };
const airType: VehicleTypeDef = { id: 'air', name: 'Skyship', mode: 'airship', minCrew: 3, hangarSlots: 1, icon: '✦' };
const vehicle = (id: string, typeId: string): Vehicle => ({ id, name: id, typeId, position: { kind: 'tile', mapId: 'm1', tileId: 't1' }, createdAt: 1, modifiedAt: 1 });
const vehicles = [
  { vehicle: vehicle('Ferry', 'boat'), type: boatType },
  { vehicle: vehicle('Zephyr', 'air'), type: airType },
];

function renderStep(overrides: Partial<React.ComponentProps<typeof TravelStep1Party>> = {}) {
  const props: React.ComponentProps<typeof TravelStep1Party> = {
    mapScale: 12,
    sources,
    travelingMemberIds: ['a', 'b'],
    selectedVehicleId: null,
    vehicles,
    onMoveChip: vi.fn(),
    onSelectVehicle: vi.fn(),
    ...overrides,
  };
  render(<TravelStep1Party {...props} />);
  return props;
}

describe('TravelStep1Party', () => {
  it('renders active and co-located source groups with their member chips', () => {
    renderStep();
    expect(screen.getAllByText('Main Party').length).toBeGreaterThan(0);
    expect(screen.getByText('Scouts')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Cyra')).toBeInTheDocument();
  });

  it('uses token images before portraits', () => {
    renderStep();
    expect(screen.getByRole('img', { name: 'Ada' })).toHaveAttribute('src', 'data:token');
  });

  it('disables scale-incompatible conveyances', () => {
    renderStep({ mapScale: 457 });
    expect(screen.getByRole('radio', { name: /Ferry/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Zephyr/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /On foot/ })).toBeDisabled();
  });

  it('routes accessible chip moves through onMoveChip', () => {
    const onMoveChip = vi.fn();
    renderStep({ onMoveChip });
    fireEvent.click(screen.getByRole('button', { name: 'Move Ada to Staying behind' }));
    expect(onMoveChip).toHaveBeenCalledWith('a', 'staying');
  });

  it('shows the inline travel requirement when everyone stays', () => {
    renderStep({ travelingMemberIds: [] });
    expect(screen.getByRole('alert')).toHaveTextContent('Someone has to travel');
  });

  it('selects a co-located vehicle through the radio list', () => {
    const onSelectVehicle = vi.fn();
    renderStep({ onSelectVehicle });
    fireEvent.click(screen.getByRole('radio', { name: /Ferry/ }));
    expect(onSelectVehicle).toHaveBeenCalledWith('Ferry');
  });

  it('keeps the wizard Next button disabled when nobody is traveling', () => {
    const map = createNewMap({ name: 'Test', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
    render(
      <TravelWizard
        provisioning={{ foodUnits: 0, days: 0, bestCookName: null }}
        map={map}
        step={1}
        selectedMode="foot"
        routeTileIds={[]}
        isGmMode={true}
        group={active}
        characters={characters}
        sources={sources}
        travelingMemberIds={[]}
        selectedVehicleId={null}
        availableVehicles={vehicles}
        vehicle={null}
        vehicleType={null}
        startTileId={map.grid[0][0]}
        day={1}
        slot={0}
        downtimeState={downtimeInitialState}
        slotsPerDay={3}
        navigatorId={null}
        gmNavigationSkill={10}
        forcedMarch={false}
        onSetStep={vi.fn()}
        onMoveChip={vi.fn()}
        onSelectVehicle={vi.fn()}
        onClearRoute={vi.fn()}
        onNavigatorChange={vi.fn()}
        onGmNavigationSkillChange={vi.fn()}
        onForcedMarchChange={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled();
  });
});
