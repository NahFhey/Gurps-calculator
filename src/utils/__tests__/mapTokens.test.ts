import { describe, expect, it } from 'vitest';
import { createCampaignState } from '../../state/campaignReducer';
import type { Character } from '../../types/campaign';
import type { TravelGroup, Vehicle } from '../../types/party';
import { buildMapTokens, nameInitials, stableColorForId } from '../mapTokens';

const character = (id: string, token?: string): Character => ({
  id, name: id, work: { skills: {} }, images: token ? { token } : undefined,
});
const group = (id: string, memberIds: string[], mapId = 'm1', vehicleId: string | null = null): TravelGroup => ({
  id, name: id === 'g1' ? 'Main Party' : 'Scout Team', memberIds, vehicleId,
  position: vehicleId ? null : { mapId, tileId: 't1' },
});
const vehicle = (id: string, position: Vehicle['position']): Vehicle => ({
  id, name: id, typeId: 'ship', position, createdAt: 1, modifiedAt: 1,
});

function fixture() {
  const state = createCampaignState();
  state.entities.characters = { a: character('a', 'data:a'), b: character('b') };
  state.entities.travelGroups = { g1: group('g1', ['a']), g2: group('g2', ['b'], 'm2') };
  state.entities.vehicleTypes = { ship: { id: 'ship', name: 'Ship', mode: 'airship', minCrew: 1, hangarSlots: 1, icon: '✦' } };
  state.entities.vehicles = {
    parked: vehicle('parked', { kind: 'tile', mapId: 'm1', tileId: 't1' }),
    docked: vehicle('docked', { kind: 'docked', carrierId: 'parked' }),
  };
  return state;
}

describe('map token building', () => {
  it('uses stable identity, portrait, color, and current status for groups', () => {
    const token = buildMapTokens(fixture(), 'm1', 'g1')[0];
    expect(token).toMatchObject({ id: 'g1', image: 'data:a', isCurrent: true, kind: 'group' });
    expect(token.color).toBe(stableColorForId('g1'));
  });

  it('uses group initials when no portrait exists', () => {
    const state = fixture();
    state.entities.travelGroups = { g1: group('g1', ['b']) };
    expect(buildMapTokens(state, 'm1', null)[0].label).toBe('MP');
  });

  it('marks parked vehicles dimmed and uses the type icon', () => {
    const token = buildMapTokens(fixture(), 'm1', 'g1').find(({ id }) => id === 'parked');
    expect(token).toMatchObject({ kind: 'vehicle', label: '✦', dimmed: true });
  });

  it('does not dim a vehicle with a group aboard', () => {
    const state = fixture();
    state.entities.travelGroups!.g1 = group('g1', ['a'], 'm1', 'parked');
    expect(buildMapTokens(state, 'm1', 'g1').find(({ id }) => id === 'parked')?.dimmed).toBe(false);
  });

  it('excludes docked vehicles and entities on other maps', () => {
    expect(buildMapTokens(fixture(), 'm1', 'g1').map(({ id }) => id)).toEqual(['g1', 'parked']);
  });

  it('derives compact initials and deterministic palette entries', () => {
    expect(nameInitials('Silver Lancers')).toBe('SL');
    expect(nameInitials('wagon')).toBe('W');
    expect(stableColorForId('same')).toBe(stableColorForId('same'));
  });
});
