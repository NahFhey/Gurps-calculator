import { describe, expect, it } from 'vitest';
import {
  getHitLocationProfile,
  getAllProfiles,
  rollHitLocation,
  getLocationByKey,
  getLocationDR,
  getProfileLocations,
  type CharacterWithDR,
  type FilteredDR,
} from '../hitLocations';

describe('getHitLocationProfile', () => {
  it('returns the humanoid profile by id', () => {
    const profile = getHitLocationProfile('humanoid');
    expect(profile).not.toBeNull();
    expect(profile?.id).toBe('humanoid');
    expect(profile?.locations.length).toBe(11);
  });

  it('returns null for an unknown profile id', () => {
    expect(getHitLocationProfile('alien')).toBeNull();
  });
});

describe('getAllProfiles', () => {
  it('includes humanoid and returns a copy (mutations do not affect registry)', () => {
    const profiles = getAllProfiles();
    expect(profiles.humanoid).toBeDefined();
    delete (profiles as Record<string, unknown>).humanoid;
    expect(getAllProfiles().humanoid).toBeDefined();
  });
});

describe('getProfileLocations', () => {
  it('returns all 11 humanoid locations', () => {
    const locs = getProfileLocations('humanoid');
    expect(locs.length).toBe(11);
    const keys = locs.map(l => l.key);
    expect(keys).toContain('skull');
    expect(keys).toContain('torso');
    expect(keys).toContain('foot');
  });

  it('returns an empty array for an unknown profile', () => {
    expect(getProfileLocations('nope')).toEqual([]);
  });
});

describe('getLocationByKey', () => {
  it('returns the skull location with correct properties', () => {
    const skull = getLocationByKey('humanoid', 'skull');
    expect(skull).not.toBeNull();
    expect(skull?.label).toBe('Skull');
    expect(skull?.isVital).toBe(true);
    expect(skull?.toHitPenalty).toBe(-7);
  });

  it('returns null for an unknown location key', () => {
    expect(getLocationByKey('humanoid', 'tail')).toBeNull();
  });

  it('returns null for an unknown profile id', () => {
    expect(getLocationByKey('alien', 'skull')).toBeNull();
  });
});

describe('rollHitLocation', () => {
  it('returns a valid location for a known profile', () => {
    const result = rollHitLocation('humanoid');
    expect(result.valid).toBe(true);
    expect(result.location).toBeDefined();
    expect(result.profileId).toBe('humanoid');
    expect(result.roll?.total).toBeGreaterThanOrEqual(3);
    expect(result.roll?.total).toBeLessThanOrEqual(18);
  });

  it('defaults to humanoid when no profile id is supplied', () => {
    const result = rollHitLocation();
    expect(result.valid).toBe(true);
    expect(result.profileId).toBe('humanoid');
  });

  it('returns an error when the profile is unknown', () => {
    const result = rollHitLocation('alien');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Unknown profile/);
    expect(result.location).toBeUndefined();
  });

  it('always lands on a defined location across many rolls', () => {
    for (let i = 0; i < 50; i++) {
      const result = rollHitLocation('humanoid');
      expect(result.valid).toBe(true);
      expect(result.location).toBeDefined();
    }
  });
});

describe('getLocationDR', () => {
  it('returns 0 when character has no DR fields', () => {
    expect(getLocationDR({}, 'torso')).toBe(0);
  });

  it('returns the general numeric DR when no per-location DR is set', () => {
    const character: CharacterWithDR = { dr: 4 };
    expect(getLocationDR(character, 'torso')).toBe(4);
  });

  it('prefers legacy drByLocation entry over general dr', () => {
    const character: CharacterWithDR = {
      dr: 2,
      drByLocation: { skull: 5 },
    };
    expect(getLocationDR(character, 'skull')).toBe(5);
    expect(getLocationDR(character, 'torso')).toBe(2);
  });

  it('reads Phase 5 filtered byLocation exact value', () => {
    const dr: FilteredDR = {
      general: { mode: 'exact', value: 1 },
      byLocation: { torso: { mode: 'exact', value: 7 } },
    };
    const character: CharacterWithDR = { dr };
    expect(getLocationDR(character, 'torso')).toBe(7);
  });

  it('falls back to filtered general DR when location is not specified', () => {
    const dr: FilteredDR = {
      general: { mode: 'exact', value: 3 },
      byLocation: { skull: { mode: 'exact', value: 6 } },
    };
    const character: CharacterWithDR = { dr };
    expect(getLocationDR(character, 'foot')).toBe(3);
  });

  it('uses min for minKnown filtered DR mode', () => {
    const dr: FilteredDR = {
      general: { mode: 'minKnown', min: 2 },
      byLocation: { torso: { mode: 'minKnown', min: 4 } },
    };
    const character: CharacterWithDR = { dr };
    expect(getLocationDR(character, 'torso')).toBe(4);
    expect(getLocationDR(character, 'foot')).toBe(2);
  });

  it('returns 0 for unknown DR mode', () => {
    const dr: FilteredDR = {
      general: { mode: 'unknown' },
      byLocation: {},
    };
    const character: CharacterWithDR = { dr };
    expect(getLocationDR(character, 'torso')).toBe(0);
  });

  it('handles plain numeric byLocation entries inside a filtered DR object', () => {
    const dr: FilteredDR = {
      general: 2,
      byLocation: { torso: 9 },
    };
    const character: CharacterWithDR = { dr };
    expect(getLocationDR(character, 'torso')).toBe(9);
    expect(getLocationDR(character, 'foot')).toBe(2);
  });
});
