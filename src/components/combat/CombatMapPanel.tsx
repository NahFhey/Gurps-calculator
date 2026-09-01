/**
 * CombatMapPanel — renders the shared three-dimensional map surface for combat.
 *
 * Bridges combat data (participants with positions) to the map surface.
 */

import { useCallback, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { MapModel, TileId } from '../../types/map';
import type { Participant, CombatState } from '../../types/combatTracker';
import { Map3DView } from '../map/views/Map3DView';
import type { MapToken } from '../map/three/MapScene';
import { useCombatSession } from '../../hooks/useCombatSession';
import { useEffectiveRole } from '../../hooks/useEffectiveRole';
import { useCampaignStore } from '../../state/campaignStore';
import { computeVisibleTiles } from '../../utils/lineOfSight';

/** Returns Tailwind class string for category colours (used in legend). */
function categoryColorClass(cat: string): string {
  switch (cat) {
    case 'pc':
      return 'bg-accent-500 border-accent-300';
    case 'ally':
      return 'bg-success-500 border-success-300';
    case 'enemy':
      return 'bg-danger-500 border-danger-300';
    case 'neutral':
      return 'bg-yellow-500 border-yellow-300';
    default:
      return 'bg-surface-4 border-edge-bright';
  }
}

/** The participant whose token occupies the given grid cell, if any. */
export function findOccupantAt(
  participants: Participant[],
  row: number,
  col: number,
): Participant | undefined {
  return participants.find((p) => p.position?.r === row && p.position?.q === col);
}

/**
 * Whether a token may be picked up by drag.
 * GM: any token. Player: only the current actor, with movement available.
 */
export function canDragToken(
  occupant: Participant | undefined,
  opts: {
    isGmMode: boolean;
    currentActorInstanceId: string;
    movementBudgetYards: number;
    hasMovedThisTurn: boolean;
  },
): boolean {
  if (!occupant) return false;
  if (opts.isGmMode) return true;
  return (
    occupant.instanceId === opts.currentActorInstanceId &&
    !opts.hasMovedThisTurn &&
    opts.movementBudgetYards > 0
  );
}

/** Hex color for a participant category's 3D token. */
function categoryTokenColor(cat: string): string {
  switch (cat) {
    case 'pc':
      return '#3b82f6';
    case 'ally':
      return '#22c55e';
    case 'enemy':
      return '#ef4444';
    case 'neutral':
      return '#eab308';
    default:
      return '#9ca3af';
  }
}

export function CombatMapPanel({
  combat: _combat,
  participants,
  currentActorInstanceId,
  selectedParticipantId,
  onSelectParticipant,
  movementBudgetYards,
  hasMovedThisTurn,
  isGmMode,
  onMoveTo,
  onGmPlaceToken,
  losTileIds,
  onOpenConditions,
}: {
  combat: CombatState;
  participants: Participant[];
  currentActorInstanceId: string;
  selectedParticipantId: string | null;
  onSelectParticipant: (id: string | null) => void;
  movementBudgetYards: number;
  hasMovedThisTurn: boolean;
  isGmMode: boolean;
  onMoveTo: (tileId: string, path: string[], costYards: number) => void;
  onGmPlaceToken: (instanceId: string, tileId: string, row: number, col: number) => void;
  losTileIds: string[] | undefined;
  /** GM-only (Phase 12a.6): opens the condition popover for a participant at a screen point. */
  onOpenConditions?: (instanceId: string, anchor: { x: number; y: number }) => void;
}) {
  const session = useCombatSession();
  const linkedMap = (session?.linkedMap ?? null) as MapModel | null;
  const { isPlayer, displayName } = useEffectiveRole();
  const { state } = useCampaignStore();

  // Per-player fog-of-war: compute visible tiles from player's character positions.
  // With no multiplayer assignment (offline hotseat), the whole party provides
  // vision — otherwise the player view is a black void with nothing pickable.
  const visibleTileIds = useMemo(() => {
    // Keyed off the VIEW, not the multiplayer role: offline hotseat has no
    // Player role (effective role is GM), but player view still needs vision.
    if (!linkedMap || isGmMode) return undefined;
    const assignedCharIds = displayName
      ? (state as any).multiplayer?.playerCharacters[displayName] ?? []
      : [];
    const isVisionSource = (p: Participant): boolean =>
      assignedCharIds.length > 0
        ? !!p.id && assignedCharIds.includes(p.id)
        : p.category === 'player' || p.category === 'ally';
    const positions: TileId[] = [];
    for (const p of participants) {
      if (p.position && isVisionSource(p)) {
        const row = p.position.r;
        const col = p.position.q;
        if (linkedMap.grid[row]?.[col]) {
          positions.push(linkedMap.grid[row][col]);
        }
      }
    }
    if (positions.length === 0) return undefined;
    return computeVisibleTiles(linkedMap, positions);
  }, [linkedMap, isPlayer, isGmMode, displayName, (state as any).multiplayer?.playerCharacters, participants]);

  // 3D tokens for placed participants (participants prop is already view-filtered)
  const tokens = useMemo<MapToken[] | undefined>(() => {
    if (!linkedMap) return undefined;
    const result: MapToken[] = [];
    for (const p of participants) {
      if (!p.position) continue;
      const tileId = linkedMap.grid[p.position.r]?.[p.position.q];
      if (!tileId) continue;
      result.push({
        id: p.instanceId,
        tileId,
        color: categoryTokenColor(p.category),
        isCurrent: p.instanceId === currentActorInstanceId,
        isSelected: p.instanceId === selectedParticipantId,
      });
    }
    return result.length > 0 ? result : undefined;
  }, [linkedMap, participants, currentActorInstanceId, selectedParticipantId]);

  if (!linkedMap) {
    return (
      <div className="h-full w-full flex items-center justify-center text-fg-faint text-sm">
        No linked map
      </div>
    );
  }

  // Handle tile click: move current actor or select participant on that tile
  const handleTileClick = useCallback(
    (tileId: TileId, row: number, col: number) => {
      // Check if a participant is on this tile
      const occupant = participants.find(
        (p) => p.position?.r === row && p.position?.q === col,
      );
      if (occupant) {
        onSelectParticipant(
          occupant.instanceId === selectedParticipantId ? null : occupant.instanceId,
        );
        return;
      }

      // If GM mode, place selected participant (if any) on this tile
      if (isGmMode && selectedParticipantId) {
        onGmPlaceToken(selectedParticipantId, tileId, row, col);
        onSelectParticipant(null);
        return;
      }

      // Move current actor (basic: cost = 1 yard per tile, path = [tileId])
      if (!hasMovedThisTurn && movementBudgetYards > 0) {
        onMoveTo(tileId, [tileId], 1);
      }
    },
    [
      participants,
      selectedParticipantId,
      onSelectParticipant,
      isGmMode,
      onGmPlaceToken,
      hasMovedThisTurn,
      movementBudgetYards,
      onMoveTo,
    ],
  );

  // Drag-to-move: pointer-down on a draggable token starts a drag (empty terrain still orbits).
  const handleTokenDragStart = useCallback(
    (_tileId: TileId, row: number, col: number) => {
      const occupant = findOccupantAt(participants, row, col);
      const draggable = canDragToken(occupant, {
        isGmMode,
        currentActorInstanceId,
        movementBudgetYards,
        hasMovedThisTurn,
      });
      if (draggable) onSelectParticipant(occupant!.instanceId);
      return draggable;
    },
    [
      participants,
      isGmMode,
      currentActorInstanceId,
      movementBudgetYards,
      hasMovedThisTurn,
      onSelectParticipant,
    ],
  );

  const handleTokenDrop = useCallback(
    (from: { tileId: TileId; row: number; col: number }, to: { tileId: TileId; row: number; col: number }) => {
      const occupant = findOccupantAt(participants, from.row, from.col);
      if (!occupant) return;
      // No stacking: dropping onto an occupied tile cancels the drag.
      if (findOccupantAt(participants, to.row, to.col)) return;
      if (isGmMode) {
        onGmPlaceToken(occupant.instanceId, to.tileId, to.row, to.col);
      } else if (occupant.instanceId === currentActorInstanceId) {
        // Same cost model as click-to-move.
        onMoveTo(to.tileId, [to.tileId], 1);
      }
      onSelectParticipant(null);
    },
    [
      participants,
      isGmMode,
      currentActorInstanceId,
      onGmPlaceToken,
      onMoveTo,
      onSelectParticipant,
    ],
  );

  return (
    <div className="flex-1 w-full min-h-0 relative flex flex-col">
      {/* The map surface fills the container */}
      <Map3DView
        map={linkedMap}
        isGmMode={isGmMode}
        visionMode={linkedMap.visionMode}
        routeTileIds={losTileIds}
        visibleTileIds={visibleTileIds}
        tokens={tokens}
        paintModeActive={false}
        placingToken={false}
        onTileClick={handleTileClick}
        onTokenDragStart={handleTokenDragStart}
        onTokenDrop={handleTokenDrop}
      />

      {/* Token legend — positioned absolutely over the map surface */}
      <TokenOverlay
        participants={participants}
        currentActorInstanceId={currentActorInstanceId}
        selectedParticipantId={selectedParticipantId}
        onSelectParticipant={onSelectParticipant}
        categoryColor={categoryColorClass}
        onOpenConditions={onOpenConditions}
      />
    </div>
  );
}

/**
 * TokenOverlay — floating legend panel showing placed/unplaced participant list.
 * Participant placement is summarized here while the shared surface owns terrain.
 */
function TokenOverlay({
  participants,
  currentActorInstanceId,
  selectedParticipantId,
  onSelectParticipant,
  categoryColor,
  onOpenConditions,
}: {
  participants: Participant[];
  currentActorInstanceId: string;
  selectedParticipantId: string | null;
  onSelectParticipant: (id: string | null) => void;
  categoryColor: (cat: string) => string;
  onOpenConditions?: (instanceId: string, anchor: { x: number; y: number }) => void;
}) {
  const placedParticipants = participants.filter((p) => p.position);
  const unplacedParticipants = participants.filter((p) => !p.position);

  if (placedParticipants.length === 0 && unplacedParticipants.length === 0) return null;

  return (
    <div className="absolute top-2 left-2 z-20 bg-surface-0/90 border border-edge rounded-lg p-2 backdrop-blur-sm max-h-48 overflow-y-auto w-44">
      <div className="text-[10px] font-medium text-fg-muted mb-1 uppercase tracking-wide">
        Tokens
      </div>
      {placedParticipants.map((p) => {
        const pos = p.position!;
        const isCurrent = p.instanceId === currentActorInstanceId;
        const isSelected = p.instanceId === selectedParticipantId;
        return (
          <div key={p.instanceId} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onSelectParticipant(isSelected ? null : p.instanceId)}
              className={`flex-1 min-w-0 flex items-center gap-1.5 py-0.5 px-1 rounded text-[10px] text-left cursor-pointer hover:bg-surface-2/50 ${
                isCurrent
                  ? 'bg-accent-500/20 text-accent-200'
                  : isSelected
                    ? 'bg-yellow-500/20 text-yellow-200'
                    : 'text-fg-secondary'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full border ${categoryColor(p.category)} flex-shrink-0`}
              />
              <span className="truncate">{p.name}</span>
              <span className="text-fg-faint ml-auto flex-shrink-0">
                {pos.q},{pos.r}
              </span>
            </button>
            {/* Phase 12a.6: map-surface condition entry (GM only — host gates the prop) */}
            {onOpenConditions && (
              <button
                type="button"
                onClick={(e) =>
                  onOpenConditions(p.instanceId, { x: e.clientX, y: e.clientY })
                }
                aria-label={`Manage conditions for ${p.name}`}
                title="Add / manage conditions"
                className="flex-none p-0.5 rounded text-fg-faint hover:text-purple-300 hover:bg-surface-2/70 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
      {unplacedParticipants.length > 0 && (
        <>
          <div className="text-[10px] text-fg-faint mt-1 mb-0.5">
            Unplaced{selectedParticipantId ? '' : ' · click to select'}:
          </div>
          {unplacedParticipants.map((p) => {
            const isSelected = p.instanceId === selectedParticipantId;
            return (
              <button
                key={p.instanceId}
                type="button"
                onClick={() => onSelectParticipant(isSelected ? null : p.instanceId)}
                className={`w-full flex items-center gap-1.5 py-0.5 px-1 rounded text-[10px] text-left cursor-pointer hover:bg-surface-2/50 ${
                  isSelected
                    ? 'bg-yellow-500/20 text-yellow-200'
                    : 'text-fg-faint'
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full border ${categoryColor(p.category)} ${isSelected ? '' : 'opacity-40'} flex-shrink-0`}
                />
                <span className="truncate">{p.name}</span>
                {isSelected && (
                  <span className="text-yellow-400 ml-auto text-[9px]">▶ click tile</span>
                )}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
