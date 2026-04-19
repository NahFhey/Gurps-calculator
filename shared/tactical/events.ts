import type { TacticalCommand } from './commands.js';

export interface TacticalSnapshotUpdatedEvent {
  type: 'tactical:snapshot_updated';
  campaignId: string;
  version: number;
  updatedAt: string;
}

export interface TacticalCommandAcceptedEvent {
  type: 'tactical:command_accepted';
  command: TacticalCommand;
  version: number;
  updatedAt: string;
}

export interface TacticalCommandRejectedEvent {
  type: 'tactical:command_rejected';
  command: TacticalCommand;
  code: string;
  message: string;
}

export type TacticalEvent =
  | TacticalSnapshotUpdatedEvent
  | TacticalCommandAcceptedEvent
  | TacticalCommandRejectedEvent;
