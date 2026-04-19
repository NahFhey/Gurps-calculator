import type { TacticalCommand } from '../../../shared/tactical/commands.js';
import type { TacticalEvent } from '../../../shared/tactical/events.js';
import type {
  TacticalCombatActor,
  TacticalCombatLogEntry,
  TacticalMapState,
  TacticalSnapshot,
  TacticalTile,
} from '../../../shared/tactical/types.js';

export interface TacticalCommandError {
  code:
    | 'COMBAT_REQUIRED'
    | 'MAP_REQUIRED'
    | 'ACTOR_NOT_FOUND'
    | 'TARGET_NOT_FOUND'
    | 'INVALID_PATH'
    | 'DESTINATION_NOT_FOUND'
    | 'NOT_ACTOR_TURN';
  message: string;
}

export interface ApplyTacticalCommandResult {
  ok: boolean;
  snapshot: TacticalSnapshot;
  events: TacticalEvent[];
  error?: TacticalCommandError;
}

export function applyTacticalCommand(
  snapshot: TacticalSnapshot,
  command: TacticalCommand
): ApplyTacticalCommandResult {
  switch (command.type) {
    case 'move':
      return applyMove(snapshot, command);
    case 'set_maneuver':
      return applySetManeuver(snapshot, command);
    case 'end_turn':
      return applyEndTurn(snapshot, command);
    case 'apply_damage':
      return applyDamage(snapshot, command);
    default:
      return reject(snapshot, command, 'INVALID_PATH', 'Unsupported tactical command.');
  }
}

function applyMove(snapshot: TacticalSnapshot, command: Extract<TacticalCommand, { type: 'move' }>): ApplyTacticalCommandResult {
  if (!snapshot.combat) {
    return reject(snapshot, command, 'COMBAT_REQUIRED', 'Move commands require an active combat snapshot.');
  }

  if (!snapshot.map) {
    return reject(snapshot, command, 'MAP_REQUIRED', 'Move commands require an active map snapshot.');
  }

  const actor = snapshot.combat.actors[command.actorId];
  if (!actor) {
    return reject(snapshot, command, 'ACTOR_NOT_FOUND', `Actor "${command.actorId}" was not found.`);
  }

  if (snapshot.combat.currentActorId && snapshot.combat.currentActorId !== command.actorId) {
    return reject(snapshot, command, 'NOT_ACTOR_TURN', 'Only the current actor may move.');
  }

  if (command.path.length === 0) {
    return reject(snapshot, command, 'INVALID_PATH', 'Move commands require at least one tile in the path.');
  }

  const destinationTileId = command.path[command.path.length - 1];
  if (!snapshot.map.tiles[destinationTileId]) {
    return reject(snapshot, command, 'DESTINATION_NOT_FOUND', `Tile "${destinationTileId}" does not exist on the active map.`);
  }

  const nextCombat = {
    ...snapshot.combat,
    actors: {
      ...snapshot.combat.actors,
      [actor.id]: {
        ...actor,
        location: {
          kind: 'tile' as const,
          tileId: destinationTileId,
        },
      },
    },
    log: appendCombatLog(snapshot.combat.log, {
      actorId: actor.id,
      text: `${actor.name} moved to ${destinationTileId}.`,
    }),
  };

  const nextMap = rebuildMapOccupants(snapshot.map, nextCombat.actors);
  return accept(
    {
      ...snapshot,
      combat: nextCombat,
      map: nextMap,
    },
    command
  );
}

function applySetManeuver(
  snapshot: TacticalSnapshot,
  command: Extract<TacticalCommand, { type: 'set_maneuver' }>
): ApplyTacticalCommandResult {
  if (!snapshot.combat) {
    return reject(snapshot, command, 'COMBAT_REQUIRED', 'Maneuver updates require an active combat snapshot.');
  }

  const actor = snapshot.combat.actors[command.actorId];
  if (!actor) {
    return reject(snapshot, command, 'ACTOR_NOT_FOUND', `Actor "${command.actorId}" was not found.`);
  }

  const nextCombat = {
    ...snapshot.combat,
    actors: {
      ...snapshot.combat.actors,
      [actor.id]: {
        ...actor,
        maneuverId: command.maneuverId,
      },
    },
    log: appendCombatLog(snapshot.combat.log, {
      actorId: actor.id,
      text: `${actor.name} selected maneuver "${command.maneuverId}".`,
    }),
  };

  return accept(
    {
      ...snapshot,
      combat: nextCombat,
    },
    command
  );
}

function applyEndTurn(
  snapshot: TacticalSnapshot,
  command: Extract<TacticalCommand, { type: 'end_turn' }>
): ApplyTacticalCommandResult {
  if (!snapshot.combat) {
    return reject(snapshot, command, 'COMBAT_REQUIRED', 'Ending a turn requires an active combat snapshot.');
  }

  const actor = snapshot.combat.actors[command.actorId];
  if (!actor) {
    return reject(snapshot, command, 'ACTOR_NOT_FOUND', `Actor "${command.actorId}" was not found.`);
  }

  if (snapshot.combat.currentActorId && snapshot.combat.currentActorId !== command.actorId) {
    return reject(snapshot, command, 'NOT_ACTOR_TURN', 'Only the current actor may end the turn.');
  }

  const currentIndex = snapshot.combat.turnOrder.indexOf(command.actorId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % snapshot.combat.turnOrder.length : -1;
  const nextRound =
    nextIndex === 0 && snapshot.combat.turnOrder.length > 0
      ? snapshot.combat.round + 1
      : snapshot.combat.round;

  const nextCombat = {
    ...snapshot.combat,
    round: nextRound,
    turn: snapshot.combat.turn + 1,
    currentActorId: nextIndex >= 0 ? snapshot.combat.turnOrder[nextIndex] : null,
    log: appendCombatLog(snapshot.combat.log, {
      actorId: actor.id,
      text: `${actor.name} ended their turn.`,
    }),
  };

  return accept(
    {
      ...snapshot,
      combat: nextCombat,
    },
    command
  );
}

function applyDamage(
  snapshot: TacticalSnapshot,
  command: Extract<TacticalCommand, { type: 'apply_damage' }>
): ApplyTacticalCommandResult {
  if (!snapshot.combat) {
    return reject(snapshot, command, 'COMBAT_REQUIRED', 'Damage requires an active combat snapshot.');
  }

  const target = snapshot.combat.actors[command.targetId];
  if (!target) {
    return reject(snapshot, command, 'TARGET_NOT_FOUND', `Target "${command.targetId}" was not found.`);
  }

  const nextHP = target.currentHP - command.amount;
  const nextStatus = nextHP <= 0 ? 'unconscious' : target.status;

  const nextCombat = {
    ...snapshot.combat,
    actors: {
      ...snapshot.combat.actors,
      [target.id]: {
        ...target,
        currentHP: nextHP,
        status: nextStatus,
      },
    },
    log: appendCombatLog(snapshot.combat.log, {
      targetId: target.id,
      text: `${target.name} took ${command.amount} damage${command.damageType ? ` (${command.damageType})` : ''}.`,
    }),
  };

  return accept(
    {
      ...snapshot,
      combat: nextCombat,
    },
    command
  );
}

function rebuildMapOccupants(
  map: TacticalMapState,
  actors: Record<string, TacticalCombatActor>
): TacticalMapState {
  const tiles: Record<string, TacticalTile> = {};

  for (const [tileId, tile] of Object.entries(map.tiles)) {
    tiles[tileId] = {
      ...tile,
      occupantActorIds: [],
    };
  }

  for (const actor of Object.values(actors)) {
    if (actor.location?.kind !== 'tile') {
      continue;
    }

    const tile = tiles[actor.location.tileId];
    if (!tile) {
      continue;
    }

    tile.occupantActorIds = [...tile.occupantActorIds, actor.id];
  }

  return {
    ...map,
    tiles,
  };
}

function appendCombatLog(
  log: TacticalCombatLogEntry[],
  entry: Pick<TacticalCombatLogEntry, 'actorId' | 'targetId' | 'text'>
): TacticalCombatLogEntry[] {
  return [
    ...log,
    {
      id: `log-${Date.now()}-${log.length + 1}`,
      timestamp: Date.now(),
      actorId: entry.actorId,
      targetId: entry.targetId,
      text: entry.text,
    },
  ];
}

function accept(snapshot: TacticalSnapshot, command: TacticalCommand): ApplyTacticalCommandResult {
  const updatedAt = new Date().toISOString();
  const nextSnapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    updatedAt,
  };

  return {
    ok: true,
    snapshot: nextSnapshot,
    events: [
      {
        type: 'tactical:command_accepted',
        command,
        version: nextSnapshot.version,
        updatedAt,
      },
      {
        type: 'tactical:snapshot_updated',
        campaignId: nextSnapshot.campaignId,
        version: nextSnapshot.version,
        updatedAt,
      },
    ],
  };
}

function reject(
  snapshot: TacticalSnapshot,
  command: TacticalCommand,
  code: TacticalCommandError['code'],
  message: string
): ApplyTacticalCommandResult {
  return {
    ok: false,
    snapshot,
    error: { code, message },
    events: [
      {
        type: 'tactical:command_rejected',
        command,
        code,
        message,
      },
    ],
  };
}
