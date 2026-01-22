/**
 * Hit Location Constants
 * Defines stable location keys and labels for hit location profiles
 */

/**
 * Humanoid DR fields - stable keys used throughout the system
 */
export const HUMANOID_DR_FIELDS = [
  { key: "skull", label: "Skull" },
  { key: "face", label: "Face" },
  { key: "neck", label: "Neck" },
  { key: "torso", label: "Torso" },
  { key: "groin", label: "Groin" },
  { key: "armL", label: "Left Arm" },
  { key: "armR", label: "Right Arm" },
  { key: "legL", label: "Left Leg" },
  { key: "legR", label: "Right Leg" },
  { key: "hand", label: "Hand" },
  { key: "foot", label: "Foot" },
];

/**
 * Available hit location profiles
 */
export const HIT_LOCATION_PROFILES = {
  HUMANOID: 'humanoid'
};
