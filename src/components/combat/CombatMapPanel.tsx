/**
 * CombatMapPanel — bridge component connecting combat state to MapGrid.
 *
 * Builds a token-position map from participants that have grid positions,
 * then renders a MapGrid with token overlays. Used inside CombatTracker
 * when the combat has a linked mapId.
 *
 * Phase D: Also handles movement interaction — shows reachable tiles,
 * path preview on hover, and processes move-to-tile clicks.
 */

import { useState, useMemo, useCallback } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import { MapGrid } from '../map/views/MapGrid';
import { findTacticalRoute, getTacticalReachableTiles } from '../../utils/mapRouter';
import type { TileId } from '../../types/map';
import type { CombatState, Participant } from '../../types/combatTracker';
import type { TokenData } from '../../types/combatToken';

interface CombatMapPanelProps {
  combat: CombatState;
  /** Already reveal-filtered participants from getCombatView */
  participants: Participant[];
  currentActorInstanceId: string;
  selectedParticipantId?: string | null;
  onSelectParticipant?: (instanceId: string | null) => void;
  /** Movement budget in yards for the current actor's selected maneuver. 0 = no movement. */
  movementBudgetYards?: number;
  /** Whether the current actor has already moved this turn. */
  hasMovedThisTurn?: boolean;
  /** Whether GM mode is active (enables unrestricted token placement). */
  isGmMode?: boolean;
  /** Callback when a participant moves to a tile via movement system. */
  onMoveTo?: (tileId: string, path: string[], costYards: number) => void;
  /** Callback when GM places a token directly on a tile. */
  onGmPlaceToken?: (instanceId: string, tileId: string, row: number, col: number) => void;
  /** Phase F: Tile IDs forming the LoS line overlay */
  losTileIds?: string[];
}

export function CombatMapPanel({
  combat,
  participants,
  currentActorInstanceId,
  selectedParticipantId,
  onSelectParticipant,
  movementBudgetYards = 0,
  hasMovedThisTurn = false,
  isGmMode = false,
  onMoveTo,
  onGmPlaceToken,
  losTileIds,
}: CombatMapPanelProps) {
  const { state } = useCampaignStore();

  // Hover state for path preview
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);

  // Look up the linked map
  const map = combat.mapId ? state.maps.mapsById[combat.mapId] : null;

  // Whether movement interaction is active
  const movementActive = movementBudgetYards > 0 && !hasMovedThisTurn && !!map;

  // Current actor's tile ID
  const currentActorTileId = useMemo(() => {
    if (!map) return null;
    const actor = participants.find(p => p.instanceId === currentActorInstanceId);
    if (!actor?.position) return null;
    return map.grid[actor.position.r]?.[actor.position.q] ?? null;
  }, [map, participants, currentActorInstanceId]);

  // Build set of occupied tile IDs (all participants except current actor)
  const occupiedTileIds = useMemo(() => {
    if (!map) return undefined;
    const occupied = new Set<TileId>();
    for (const p of participants) {
      if (!p.position || p.instanceId === currentActorInstanceId) continue;
      if (p.isDead) continue; // Dead participants don't block movement
      const tileId = map.grid[p.position.r]?.[p.position.q];
      if (tileId) occupied.add(tileId);
    }
    return occupied.size > 0 ? occupied : undefined;
  }, [map, participants, currentActorInstanceId]);

  // Reachable tiles for the current actor's movement budget
  const reachableTileIds = useMemo(() => {
    if (!movementActive || !currentActorTileId || !map) return undefined;
    const reachable = getTacticalReachableTiles(map, currentActorTileId, movementBudgetYards, occupiedTileIds);
    // Remove start tile from reachable (no point moving to where you are)
    reachable.delete(currentActorTileId);
    return reachable.size > 0 ? reachable : undefined;
  }, [movementActive, currentActorTileId, map, movementBudgetYards, occupiedTileIds]);

  // Path preview when hovering over a reachable tile
  const previewRoute = useMemo(() => {
    if (!movementActive || !currentActorTileId || !hoveredTileId || !map) return null;
    if (!reachableTileIds?.has(hoveredTileId)) return null;
    const route = findTacticalRoute(map, currentActorTileId, hoveredTileId);
    return route.valid ? route : null;
  }, [movementActive, currentActorTileId, hoveredTileId, map, reachableTileIds]);

  // Build Map<tileId, TokenData[]> from participants with positions
  const tokenMap = useMemo(() => {
    if (!map) return undefined;

    const result = new Map<string, TokenData[]>();

    for (const p of participants) {
      if (!p.position) continue;
      const row = p.position.r;
      const col = p.position.q;
      const tileId = map.grid[row]?.[col];
      if (!tileId) continue;

      const tokenData: TokenData = {
        instanceId: p.instanceId,
        initial: p.name.charAt(0).toUpperCase(),
        category: (p.category as TokenData['category']) || 'object',
        isCurrentActor: p.instanceId === currentActorInstanceId,
        isDead: !!p.isDead,
        isUnconscious: !!p.isUnconscious,
        displayName: p.name,
      };

      const existing = result.get(tileId);
      if (existing) {
        existing.push(tokenData);
      } else {
        result.set(tileId, [tokenData]);
      }
    }

    return result;
  }, [map, participants, currentActorInstanceId]);

  // For tactical maps in player mode, make all tiles visible (no fog-of-war)
  const allTileIds = useMemo(() => {
    if (!map || map.scaleUnit !== 'yards') return undefined;
    const ids = new Set<string>();
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tileId = map.grid[r]?.[c];
        if (tileId) ids.add(tileId);
      }
    }
    return ids;
  }, [map]);

  // Tile click handler
  const handleTileClick = useCallback((tileId: string, row: number, col: number) => {
    // GM direct placement: if GM mode and a participant is selected
    if (isGmMode && selectedParticipantId && onGmPlaceToken) {
      onGmPlaceToken(selectedParticipantId, tileId, row, col);
      return;
    }

    // Movement: if movement is active and tile is reachable
    if (movementActive && reachableTileIds?.has(tileId) && previewRoute && onMoveTo) {
      onMoveTo(tileId, previewRoute.path, previewRoute.totalCost);
      setHoveredTileId(null);
      return;
    }

    // Default: deselect participant
    onSelectParticipant?.(null);
  }, [isGmMode, selectedParticipantId, onGmPlaceToken, movementActive, reachableTileIds, previewRoute, onMoveTo, onSelectParticipant]);

  // Tile hover handler for path preview
  const handleTileMouseEnter = useCallback((_tileId: string, _row: number, _col: number) => {
    if (movementActive) {
      setHoveredTileId(_tileId);
    }
  }, [movementActive]);

  if (!map) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        <p>Linked map not found (mapId: {combat.mapId ?? 'none'})</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <MapGrid
        map={map}
        isGmMode={state.ui.gmModeEnabled}
        tokens={tokenMap}
        selectedParticipantId={selectedParticipantId}
        onTokenClick={(instanceId) => onSelectParticipant?.(instanceId)}
        onTileClick={handleTileClick}
        onTileMouseEnter={handleTileMouseEnter}
        reachableTileIds={reachableTileIds}
        routeTileIds={previewRoute?.path}
        losTileIds={losTileIds}
        visibleTileIds={allTileIds}
      />
      {/* Movement cost tooltip */}
      {movementActive && previewRoute && hoveredTileId && (
        <div className="absolute bottom-2 left-2 bg-gray-900/90 text-white text-xs px-2 py-1 rounded pointer-events-none z-30">
          {Math.round(previewRoute.totalCost * 10) / 10} yard{previewRoute.totalCost !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
