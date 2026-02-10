/**
 * Combat Token Types
 *
 * Shared interfaces for rendering combat participants as tokens on the map grid.
 */

/**
 * Token data for rendering a combat participant on a map tile.
 * Built from Participant data in CombatMapPanel, consumed by MapTile/CombatToken.
 */
export interface TokenData {
  /** Participant instance ID */
  instanceId: string;
  /** First character of display name (for token label) */
  initial: string;
  /** Team category (determines token color) */
  category: 'player' | 'ally' | 'enemy' | 'object';
  /** Whether this participant is the current turn actor */
  isCurrentActor: boolean;
  /** Whether the participant is dead */
  isDead: boolean;
  /** Whether the participant is unconscious */
  isUnconscious: boolean;
  /** Full display name (for tooltip) */
  displayName: string;
}
