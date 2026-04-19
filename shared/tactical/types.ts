import type { Role } from '../session.js';

export type TacticalTeam = 'ally' | 'enemy' | 'neutral';
export type TacticalActorStatus = 'active' | 'stunned' | 'unconscious' | 'dead';
export type TacticalVisibility = 'visible' | 'hidden' | 'gm_only';

export interface TacticalLocationTile {
  kind: 'tile';
  tileId: string;
}

export interface TacticalLocationHex {
  kind: 'hex';
  q: number;
  r: number;
}

export type TacticalLocation = TacticalLocationTile | TacticalLocationHex;

export interface TacticalCondition {
  id: string;
  label: string;
  source?: string | null;
  durationLabel?: string | null;
}

export interface TacticalCombatActor {
  id: string;
  name: string;
  team: TacticalTeam;
  initiative: number;
  currentHP: number;
  maxHP: number;
  currentFP?: number;
  maxFP?: number;
  status: TacticalActorStatus;
  maneuverId?: string | null;
  conditions: TacticalCondition[];
  location: TacticalLocation | null;
  visibility: TacticalVisibility;
}

export interface TacticalCombatLogEntry {
  id: string;
  timestamp: number;
  actorId?: string;
  targetId?: string;
  text: string;
}

export interface TacticalCombatState {
  id: string;
  name: string;
  round: number;
  turn: number;
  currentActorId: string | null;
  turnOrder: string[];
  mapId?: string | null;
  actors: Record<string, TacticalCombatActor>;
  log: TacticalCombatLogEntry[];
}

export interface TacticalTerrainSummary {
  id: string;
  name: string;
  color: string;
}

export interface TacticalTile {
  id: string;
  row: number;
  col: number;
  terrainId: string | null;
  revealed: boolean;
  occupantActorIds: string[];
}

export interface TacticalMarker {
  id: string;
  tileId: string;
  type: string;
  label: string;
  visibility: 'gm' | 'player';
  notes?: string;
}

export interface TacticalMapState {
  id: string;
  name: string;
  rows: number;
  cols: number;
  partyTileId: string | null;
  tiles: Record<string, TacticalTile>;
  terrain: Record<string, TacticalTerrainSummary>;
  markers: Record<string, TacticalMarker>;
}

export interface TacticalPermissions {
  role: Role;
  canIssueCommands: boolean;
  canReveal: boolean;
  canEditMap: boolean;
}

export interface TacticalSnapshot {
  campaignId: string;
  version: number;
  updatedAt: string;
  permissions: TacticalPermissions;
  combat: TacticalCombatState | null;
  map: TacticalMapState | null;
}
