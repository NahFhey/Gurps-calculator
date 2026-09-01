import { describe, expect, it } from 'vitest';
import {
  PARTY_ACTION_TYPES,
  PARTY_BOARD_VEHICLE,
  PARTY_CREATE_GROUP,
  PARTY_DISEMBARK,
  PARTY_DOCK_VEHICLE,
  PARTY_MOVE_MEMBERS,
  PARTY_PLACE_GROUP,
  PARTY_PLACE_VEHICLE,
  PARTY_REMOVE_VEHICLE,
  PARTY_REMOVE_VEHICLE_TYPE,
  PARTY_RENAME_GROUP,
  PARTY_SET_ACTIVE_GROUP,
  PARTY_UNDOCK_VEHICLE,
  PARTY_UPSERT_VEHICLE,
  PARTY_UPSERT_VEHICLE_TYPE,
  PARTY_ARM_JOURNEY,
  PARTY_PAUSE_JOURNEY,
  PARTY_RESUME_JOURNEY,
  PARTY_ABORT_JOURNEY,
  PARTY_REROUTE_JOURNEY,
  PARTY_UPSERT_TRAVEL_EVENT_TABLE,
  PARTY_REMOVE_TRAVEL_EVENT_TABLE,
  PARTY_UPSERT_TRAVEL_EVENT_TABLE_SET,
  PARTY_REMOVE_TRAVEL_EVENT_TABLE_SET,
  PARTY_RECORD_MEAL,
  isPartyAction,
} from '../partyActions';

const values = [
  PARTY_CREATE_GROUP, PARTY_MOVE_MEMBERS, PARTY_RENAME_GROUP, PARTY_SET_ACTIVE_GROUP,
  PARTY_BOARD_VEHICLE, PARTY_DISEMBARK, PARTY_PLACE_GROUP, PARTY_UPSERT_VEHICLE,
  PARTY_REMOVE_VEHICLE, PARTY_PLACE_VEHICLE, PARTY_DOCK_VEHICLE, PARTY_UNDOCK_VEHICLE,
  PARTY_UPSERT_VEHICLE_TYPE, PARTY_REMOVE_VEHICLE_TYPE,
  PARTY_ARM_JOURNEY, PARTY_PAUSE_JOURNEY, PARTY_RESUME_JOURNEY,
  PARTY_ABORT_JOURNEY, PARTY_REROUTE_JOURNEY,
  PARTY_UPSERT_TRAVEL_EVENT_TABLE, PARTY_REMOVE_TRAVEL_EVENT_TABLE,
  PARTY_UPSERT_TRAVEL_EVENT_TABLE_SET, PARTY_REMOVE_TRAVEL_EVENT_TABLE_SET,
  PARTY_RECORD_MEAL,
];

describe('partyActions', () => {
  it('uses stable party-prefixed constants', () => {
    expect(PARTY_CREATE_GROUP).toBe('party/createGroup');
    expect(PARTY_DOCK_VEHICLE).toBe('party/dockVehicle');
    expect(values.every((value) => value.startsWith('party/'))).toBe(true);
  });

  it('keeps all action constants unique and registered', () => {
    expect(new Set(values).size).toBe(values.length);
    expect(PARTY_ACTION_TYPES).toEqual(new Set(values));
  });

  it('recognizes every party action type', () => {
    for (const type of values) expect(isPartyAction({ type })).toBe(true);
  });

  it('rejects unrelated and empty action types', () => {
    expect(isPartyAction({ type: 'map/unknownTravelAction' })).toBe(false);
    expect(isPartyAction({ type: '' })).toBe(false);
  });
});
