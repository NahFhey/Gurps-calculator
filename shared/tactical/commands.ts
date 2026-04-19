export interface TacticalMoveCommand {
  type: 'move';
  actorId: string;
  path: string[];
}

export interface TacticalSetManeuverCommand {
  type: 'set_maneuver';
  actorId: string;
  maneuverId: string;
}

export interface TacticalEndTurnCommand {
  type: 'end_turn';
  actorId: string;
}

export interface TacticalApplyDamageCommand {
  type: 'apply_damage';
  targetId: string;
  amount: number;
  damageType?: string;
}

export type TacticalCommand =
  | TacticalMoveCommand
  | TacticalSetManeuverCommand
  | TacticalEndTurnCommand
  | TacticalApplyDamageCommand;
