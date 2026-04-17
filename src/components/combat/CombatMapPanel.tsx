/**
 * CombatMapPanel — renders the MapGrid with participant token overlays for combat.
 *
 * Bridges combat data (participants with positions) to the existing MapGrid
 * component, adding coloured token circles at each participant's grid position.
 */

import { useCallback, useMemo } from 'react';
import type { MapModel, TileId } from '../../types/map';
import type { Participant, CombatState } from '../../types/combatTracker';
import { MapGrid } from '../map/views/MapGrid';
import { useEffectiveRole } from '../../hooks/useEffectiveRole';
import { useCampaignStore } from '../../state/campaignStore';
import { computePlayerVisibleTiles } from '../../utils/fogOfWar';

/** Returns a hex colour string for a participant category (used in inline styles). */
function categoryColorHex(cat: string): string {
  switch (cat) {
    case 'pc':
      return '#3b82f6'; // blue-500
    case 'ally':
      return '#22c55e'; // green-500
    case 'enemy':
      return '#ef4444'; // red-500
    case 'neutral':
      return '#eab308'; // yellow-500
    default:
      return '#6b7280'; // gray-500
  }
}

/** Returns Tailwind class string for category colours (used in legend). */
function categoryColorClass(cat: string): string {
  switch (cat) {
    case 'pc':
      return 'bg-blue-500 border-blue-300';
    case 'ally':
      return 'bg-green-500 border-green-300';
    case 'enemy':
      return 'bg-red-500 border-red-300';
    case 'neutral':
      return 'bg-yellow-500 border-yellow-300';
    default:
      return 'bg-gray-500 border-gray-300';
  }
}

export function CombatMapPanel({
  combat,
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
}) {
  const { isPlayer, displayName } = useEffectiveRole();
  const { state } = useCampaignStore();
  const linkedMap = combat.mapId ? (state.maps.mapsById[combat.mapId] as MapModel | null) : null;

  // Per-player fog-of-war: compute visible tiles from player's character positions
  const visibleTileIds = useMemo(() => {
    if (!linkedMap || !isPlayer || isGmMode) return undefined;
    const assignedCharIds = displayName
      ? state.multiplayer?.playerCharacters[displayName] ?? []
      : [];
    // Find positions of assigned characters among participants
    const positions: TileId[] = [];
    for (const p of participants) {
      if (p.position && p.id && assignedCharIds.includes(p.id)) {
        const row = p.position.r;
        const col = p.position.q;
        if (linkedMap.grid[row]?.[col]) {
          positions.push(linkedMap.grid[row][col]);
        }
      }
    }
    if (positions.length === 0) return undefined;
    return computePlayerVisibleTiles(linkedMap, positions);
  }, [linkedMap, isPlayer, isGmMode, displayName, state.multiplayer?.playerCharacters, participants]);

  // Build token overlays for the MapGrid
  const tokenOverlays = useMemo(
    () =>
      participants
        .filter((p) => p.position)
        .map((p) => ({
          row: p.position!.r,
          col: p.position!.q,
          color: categoryColorHex(p.category),
          label: p.name.charAt(0),
          isCurrent: p.instanceId === currentActorInstanceId,
          isSelected: p.instanceId === selectedParticipantId,
        })),
    [participants, currentActorInstanceId, selectedParticipantId],
  );

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

  return (
    <div className="flex-1 w-full min-h-0 relative flex flex-col">
      {linkedMap ? (
        <>
          {/* The grid fills the container */}
          <MapGrid
            map={linkedMap}
            isGmMode={isGmMode}
            routeTileIds={losTileIds}
            visibleTileIds={visibleTileIds}
            onTileClick={handleTileClick}
            tokenOverlays={tokenOverlays}
          />

          {/* Token legend — positioned absolutely over the MapGrid */}
          <TokenOverlay
            participants={participants}
            currentActorInstanceId={currentActorInstanceId}
            selectedParticipantId={selectedParticipantId}
            onSelectParticipant={onSelectParticipant}
            categoryColor={categoryColorClass}
          />
        </>
      ) : (
        <div className="h-full w-full flex items-center justify-center text-gray-500 text-sm">
          No linked map
        </div>
      )}
    </div>
  );
}

/**
 * TokenOverlay — floating legend panel showing placed/unplaced participant list.
 * The actual token circles on the grid are rendered by MapGrid via tokenOverlays.
 */
function TokenOverlay({
  participants,
  currentActorInstanceId,
  selectedParticipantId,
  onSelectParticipant,
  categoryColor,
}: {
  participants: Participant[];
  currentActorInstanceId: string;
  selectedParticipantId: string | null;
  onSelectParticipant: (id: string | null) => void;
  categoryColor: (cat: string) => string;
}) {
  const placedParticipants = participants.filter((p) => p.position);
  const unplacedParticipants = participants.filter((p) => !p.position);

  if (placedParticipants.length === 0 && unplacedParticipants.length === 0) return null;

  return (
    <div className="absolute top-2 left-2 z-20 bg-gray-900/90 border border-gray-700 rounded-lg p-2 backdrop-blur-sm max-h-48 overflow-y-auto w-44">
      <div className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">
        Tokens
      </div>
      {placedParticipants.map((p) => {
        const pos = p.position!;
        const isCurrent = p.instanceId === currentActorInstanceId;
        const isSelected = p.instanceId === selectedParticipantId;
        return (
          <button
            key={p.instanceId}
            type="button"
            onClick={() => onSelectParticipant(isSelected ? null : p.instanceId)}
            className={`w-full flex items-center gap-1.5 py-0.5 px-1 rounded text-[10px] text-left cursor-pointer hover:bg-gray-700/50 ${
              isCurrent
                ? 'bg-blue-500/20 text-blue-200'
                : isSelected
                  ? 'bg-yellow-500/20 text-yellow-200'
                  : 'text-gray-300'
            }`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full border ${categoryColor(p.category)} flex-shrink-0`}
            />
            <span className="truncate">{p.name}</span>
            <span className="text-gray-500 ml-auto flex-shrink-0">
              {pos.q},{pos.r}
            </span>
          </button>
        );
      })}
      {unplacedParticipants.length > 0 && (
        <>
          <div className="text-[10px] text-gray-500 mt-1 mb-0.5">
            Unplaced{selectedParticipantId ? '' : ' · click to select'}:
          </div>
          {unplacedParticipants.map((p) => {
            const isSelected = p.instanceId === selectedParticipantId;
            return (
              <button
                key={p.instanceId}
                type="button"
                onClick={() => onSelectParticipant(isSelected ? null : p.instanceId)}
                className={`w-full flex items-center gap-1.5 py-0.5 px-1 rounded text-[10px] text-left cursor-pointer hover:bg-gray-700/50 ${
                  isSelected
                    ? 'bg-yellow-500/20 text-yellow-200'
                    : 'text-gray-500'
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
