/**
 * Hit Location System
 * Manages hit location profiles, random rolling, and location properties
 */

import { roll } from './dice';

/**
 * Humanoid Hit Location Profile
 * Based on GURPS Basic Set hit location table (3d6)
 */
const HUMANOID_PROFILE = {
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
const PROFILES = {
  humanoid: HUMANOID_PROFILE
};

/**
 * Get a hit location profile by ID
 * @param {string} profileId - Profile ID
 * @returns {Object|null} Profile object or null if not found
 */
export function getHitLocationProfile(profileId) {
  return PROFILES[profileId] || null;
}

/**
 * Get all available profiles
 * @returns {Object} Map of profile ID to profile object
 */
export function getAllProfiles() {
  return { ...PROFILES };
}

/**
 * Roll for random hit location using 3d6
 * @param {string} profileId - Profile ID (default 'humanoid')
 * @returns {Object} Result with location and roll data
 */
export function rollHitLocation(profileId = 'humanoid') {
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
 * @param {Object} profile - Hit location profile
 * @param {number} rollTotal - 3d6 roll total
 * @returns {Object|null} Location object or null
 */
function getLocationByRoll(profile, rollTotal) {
  for (const location of profile.locations) {
    if (location.rollRange.includes(rollTotal)) {
      return location;
    }
  }
  return null;
}

/**
 * Get location by key
 * @param {string} profileId - Profile ID
 * @param {string} locationKey - Location key
 * @returns {Object|null} Location object or null
 */
export function getLocationByKey(profileId, locationKey) {
  const profile = getHitLocationProfile(profileId);
  if (!profile) return null;

  return profile.locations.find(loc => loc.key === locationKey) || null;
}

/**
 * Get DR for a specific location on a character
 * Falls back to general DR if location DR is not set
 * @param {Object} character - Character object
 * @param {string} locationKey - Location key
 * @returns {number} DR value
 */
export function getLocationDR(character, locationKey) {
  // Check if character has drByLocation and this specific location
  if (character.drByLocation && typeof character.drByLocation[locationKey] === 'number') {
    return character.drByLocation[locationKey];
  }

  // Fall back to general DR
  return character.dr || 0;
}

/**
 * Get all locations for a profile (sorted for display)
 * @param {string} profileId - Profile ID
 * @returns {Array} Array of location objects
 */
export function getProfileLocations(profileId) {
  const profile = getHitLocationProfile(profileId);
  if (!profile) return [];

  return [...profile.locations];
}
