/**
 * Hit Location System
 * Manages hit location profiles, random rolling, and location properties
 */

import { roll, RollResult } from './dice';

// ============================================================================
// Types
// ============================================================================

export interface HitLocation {
  key: string;
  label: string;
  rollRange: number[];
  drKey: string;
  isVital: boolean;
  isLimb: boolean;
  isExtremity: boolean;
  toHitPenalty: number;
}

export interface HitLocationProfile {
  id: string;
  name: string;
  locations: HitLocation[];
}

export interface HitLocationRollResult {
  valid: boolean;
  location?: HitLocation;
  roll?: RollResult;
  profileId?: string;
  error?: string;
}

/** Phase 5 filtered DR structure */
export interface FilteredDRValue {
  mode: 'exact' | 'minKnown' | 'unknown';
  value?: number;
  min?: number;
}

/** Phase 5 DR structure with byLocation support */
export interface FilteredDR {
  general?: FilteredDRValue | number;
  byLocation?: Record<string, FilteredDRValue | number>;
}

/** Character with DR (supports both legacy and Phase 5 formats) */
export interface CharacterWithDR {
  dr?: number | FilteredDR;
  drByLocation?: Record<string, number>;
}

// ============================================================================
// Hit Location Profiles
// ============================================================================

/**
 * Humanoid Hit Location Profile
 * Based on GURPS Basic Set hit location table (3d6)
 */
const HUMANOID_PROFILE: HitLocationProfile = {
  id: 'humanoid',
  name: 'Humanoid',
  locations: [
    {
      key: 'skull',
      label: 'Skull',
      rollRange: [3, 4],
      drKey: 'skull',
      isVital: true,
      isLimb: false,
      isExtremity: false,
      toHitPenalty: -7
    },
    {
      key: 'face',
      label: 'Face',
      rollRange: [5],
      drKey: 'face',
      isVital: false,
      isLimb: false,
      isExtremity: false,
      toHitPenalty: -5
    },
    {
      key: 'armR',
      label: 'Right Arm',
      rollRange: [6],
      drKey: 'armR',
      isVital: false,
      isLimb: true,
      isExtremity: false,
      toHitPenalty: -2
    },
    {
      key: 'torso',
      label: 'Torso',
      rollRange: [9, 10, 11],
      drKey: 'torso',
      isVital: false,
      isLimb: false,
      isExtremity: false,
      toHitPenalty: 0
    },
    {
      key: 'groin',
      label: 'Groin',
      rollRange: [11],
      drKey: 'groin',
      isVital: false,
      isLimb: false,
      isExtremity: false,
      toHitPenalty: -3
    },
    {
      key: 'armL',
      label: 'Left Arm',
      rollRange: [12],
      drKey: 'armL',
      isVital: false,
      isLimb: true,
      isExtremity: false,
      toHitPenalty: -2
    },
    {
      key: 'legR',
      label: 'Right Leg',
      rollRange: [13, 14],
      drKey: 'legR',
      isVital: false,
      isLimb: true,
      isExtremity: false,
      toHitPenalty: -2
    },
    {
      key: 'hand',
      label: 'Hand',
      rollRange: [15],
      drKey: 'hand',
      isVital: false,
      isLimb: false,
      isExtremity: true,
      toHitPenalty: -4
    },
    {
      key: 'legL',
      label: 'Left Leg',
      rollRange: [16, 17],
      drKey: 'legL',
      isVital: false,
      isLimb: true,
      isExtremity: false,
      toHitPenalty: -2
    },
    {
      key: 'foot',
      label: 'Foot',
      rollRange: [18],
      drKey: 'foot',
      isVital: false,
      isLimb: false,
      isExtremity: true,
      toHitPenalty: -4
    },
    {
      key: 'neck',
      label: 'Neck',
      rollRange: [7, 8],
      drKey: 'neck',
      isVital: true,
      isLimb: false,
      isExtremity: false,
      toHitPenalty: -5
    }
  ]
};

/**
 * Profile registry
 */
const PROFILES: Record<string, HitLocationProfile> = {
  humanoid: HUMANOID_PROFILE
};

// ============================================================================
// Functions
// ============================================================================

/**
 * Get a hit location profile by ID
 * @param profileId - Profile ID
 * @returns Profile object or null if not found
 */
export function getHitLocationProfile(profileId: string): HitLocationProfile | null {
  return PROFILES[profileId] || null;
}

/**
 * Get all available profiles
 * @returns Map of profile ID to profile object
 */
export function getAllProfiles(): Record<string, HitLocationProfile> {
  return { ...PROFILES };
}

/**
 * Roll for random hit location using 3d6
 * @param profileId - Profile ID (default 'humanoid')
 * @returns Result with location and roll data
 */
export function rollHitLocation(profileId: string = 'humanoid'): HitLocationRollResult {
  const profile = getHitLocationProfile(profileId);
  if (!profile) {
    return {
      valid: false,
      error: `Unknown profile: ${profileId}`
    };
  }

  const rollResult = roll('3d6');
  if (!rollResult.valid) {
    return {
      valid: false,
      error: rollResult.error
    };
  }

  const total = rollResult.total;
  const location = getLocationByRoll(profile, total);

  if (!location) {
    return {
      valid: false,
      error: `No location found for roll ${total}`
    };
  }

  return {
    valid: true,
    location,
    roll: rollResult,
    profileId: profile.id
  };
}

/**
 * Get location by 3d6 roll total
 * @param profile - Hit location profile
 * @param rollTotal - 3d6 roll total
 * @returns Location object or null
 */
function getLocationByRoll(profile: HitLocationProfile, rollTotal: number): HitLocation | null {
  for (const location of profile.locations) {
    if (location.rollRange.includes(rollTotal)) {
      return location;
    }
  }
  return null;
}

/**
 * Get location by key
 * @param profileId - Profile ID
 * @param locationKey - Location key
 * @returns Location object or null
 */
export function getLocationByKey(profileId: string, locationKey: string): HitLocation | null {
  const profile = getHitLocationProfile(profileId);
  if (!profile) return null;

  return profile.locations.find(loc => loc.key === locationKey) || null;
}

/**
 * Extract DR value from either filtered (Phase 5) or legacy structure
 * @param drValue - DR value (could be number or Phase 5 object)
 * @returns Actual DR number
 */
function extractDRValue(drValue: number | FilteredDRValue | undefined | null): number {
  if (drValue === null || drValue === undefined) return 0;

  // Phase 5 filtered structure: {mode: 'exact', value: 4} or {mode: 'minKnown', min: 3}
  if (typeof drValue === 'object') {
    if (drValue.mode === 'exact' && drValue.value !== undefined) {
      return drValue.value;
    }
    if (drValue.mode === 'minKnown' && drValue.min !== undefined) {
      return drValue.min; // Use minimum known value
    }
    // Unknown DR
    return 0;
  }

  // Legacy: simple number
  return drValue;
}

/**
 * Get DR for a specific location on a character
 * Falls back to general DR if location DR is not set
 * Phase 5 compatible: handles both filtered and legacy DR structures
 * @param character - Character object
 * @param locationKey - Location key
 * @returns DR value
 */
export function getLocationDR(character: CharacterWithDR, locationKey: string): number {
  // Phase 5: Check for filtered structure first
  if (character.dr && typeof character.dr === 'object' && 'byLocation' in character.dr) {
    const filteredDR = character.dr as FilteredDR;
    const locationDR = filteredDR.byLocation?.[locationKey];
    if (locationDR !== undefined) {
      return extractDRValue(locationDR as FilteredDRValue | number);
    }
    // No specific location DR, use general
    return extractDRValue(filteredDR.general as FilteredDRValue | number);
  }

  // Legacy: Check if character has drByLocation and this specific location
  if (character.drByLocation && typeof character.drByLocation[locationKey] === 'number') {
    return character.drByLocation[locationKey];
  }

  // Fall back to general DR (could be number or Phase 5 object)
  if (typeof character.dr === 'number') {
    return character.dr;
  }

  return extractDRValue(character.dr as FilteredDRValue | undefined);
}

/**
 * Get all locations for a profile (sorted for display)
 * @param profileId - Profile ID
 * @returns Array of location objects
 */
export function getProfileLocations(profileId: string): HitLocation[] {
  const profile = getHitLocationProfile(profileId);
  if (!profile) return [];

  return [...profile.locations];
}
