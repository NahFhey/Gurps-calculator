import { describe, expect, it } from 'vitest';
import { migrateData } from '../dataMigrations';

// Legacy key names as string literals on purpose: they no longer exist on the
// types, but pre-1.5.5 saves still carry them and the fixture must match.
const locationTravelsKey = 'activeTravels';
const connectionDifficultyKey = 'travelDifficulty';
const mapWizardKey = 'travelWizard';

const legacyFixture = () => ({
  schemaVersion: '1.5.4',
  locations: {
    currentLocationId: 'camp',
    [locationTravelsKey]: [{ id: 'old-trip' }],
    locations: {
      camp: {
        id: 'camp',
        connections: [{
          targetLocationId: 'ridge',
          travelTime: 2,
          [connectionDifficultyKey]: -1,
          requirements: ['rope'],
          description: 'Rocky trail',
        }],
      },
      partial: { id: 'partial' },
    },
  },
  maps: {
    mapsById: {},
    [mapWizardKey]: { step: 2 },
  },
});

describe('travel state schema migration', () => {
  it('strips retired location and map fields and lands at 1.5.5', () => {
    const migrated = migrateData(legacyFixture(), '1.5.4', '1.5.5');
    const locations = migrated.locations as Record<string, unknown>;
    const locationRecords = locations.locations as Record<string, Record<string, unknown>>;
    const connections = locationRecords.camp.connections as Array<Record<string, unknown>>;
    const maps = migrated.maps as Record<string, unknown>;

    expect(migrated.schemaVersion).toBe('1.5.5');
    expect(locations).not.toHaveProperty(locationTravelsKey);
    expect(connections[0]).toEqual({
      targetLocationId: 'ridge',
      description: 'Rocky trail',
    });
    expect(maps).not.toHaveProperty(mapWizardKey);
    expect(locationRecords.partial).toEqual({ id: 'partial' });
  });

  it('is idempotent when the cleanup migration is applied twice', () => {
    const once = migrateData(legacyFixture(), '1.5.4', '1.5.5');
    const twice = migrateData(once, '1.5.4', '1.5.5');

    expect(twice).toEqual(once);
  });
});
