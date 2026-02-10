/**
 * MapTile — renders a single tile in the map grid.
 */

import React, { memo } from 'react';
import type { TerrainModel, MarkerModel } from '../../../types/map';
import type { TokenData } from '../../../types/combatToken';
import { TILE_SIZE_PX } from '../../../constants/map';
import { CombatToken } from '../../combat/CombatToken';
import { MapPin, LinkIcon } from 'lucide-react';

interface MapTileProps {
  terrain: TerrainModel | null;
  isRevealed: boolean;
  isVisible: boolean;
  isPartyHere: boolean;
  isGmMode: boolean;
  markers: MarkerModel[];
  hasLinks: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  isRouteHighlight?: boolean;
  isReachable?: boolean;
  row: number;
  col: number;
  /** Dynamic tile size in pixels (defaults to TILE_SIZE_PX) */
  tileSizePx?: number;
  /** Combat tokens on this tile */
  tokens?: TokenData[];
  /** Currently selected participant instanceId */
  selectedParticipantId?: string | null;
  /** Callback when a token is clicked */
  onTokenClick?: (instanceId: string) => void;
  /** Phase F: Whether this tile is part of a LoS line overlay */
  isLoSHighlight?: boolean;
}

export const MapTile = memo(function MapTile({
  terrain,
  isRevealed,
  isVisible,
  isPartyHere,
  isGmMode,
  markers,
  hasLinks,
  onClick,
  onContextMenu,
  onMouseDown,
  onMouseEnter,
  isSelected,
  isRouteHighlight,
  isReachable,
  row,
  col,
  tileSizePx: dynamicTileSizePx,
  tokens,
  selectedParticipantId,
  onTokenClick,
  isLoSHighlight,
}: MapTileProps) {
  const size = dynamicTileSizePx ?? TILE_SIZE_PX;

  // Player view: unrevealed and not visible tiles are void
  if (!isGmMode && !isRevealed && !isVisible) {
    return (
      <div
        className="border border-gray-900/20"
        style={{
          width: size,
          height: size,
          backgroundColor: '#0a0a0a',
        }}
      />
    );
  }

  // Determine background color
  let bgColor = '#1f2937'; // gray-800 for null terrain
  if (terrain) {
    bgColor = terrain.color;
  }

  // Opacity: visible-but-unexplored in player mode = dimmed, unrevealed in GM mode = dimmed
  const isVisibleUnexplored = !isGmMode && !isRevealed && isVisible;
  const opacity = isVisibleUnexplored ? 0.35 : (!isRevealed && isGmMode ? 0.4 : 1);

  // Visible markers (GM sees all, players see player-visible only)
  const visibleMarkers = isGmMode
    ? markers
    : markers.filter((m) => m.visibility === 'player');

  return (
    <div
      className={[
        'relative border border-gray-700/30 cursor-pointer transition-all duration-75',
        isSelected ? 'ring-2 ring-yellow-400 z-10' : '',
        isRouteHighlight ? 'ring-2 ring-blue-400 z-10' : '',
        isReachable && !isRouteHighlight ? 'ring-1 ring-green-500/40' : '',
        isLoSHighlight && !isRouteHighlight && !isReachable && !isSelected ? 'ring-1 ring-red-400/60 z-10' : '',
        isPartyHere ? 'ring-2 ring-white z-20' : '',
      ].join(' ')}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        opacity,
        filter: isVisibleUnexplored ? 'grayscale(0.7)' : undefined,
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      title={[
        terrain ? terrain.name : 'Unassigned',
        `(${row}, ${col})`,
        isPartyHere ? '- Party here' : '',
        visibleMarkers.length > 0 ? `- ${visibleMarkers.length} marker(s)` : '',
        hasLinks ? '- Has links' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Party indicator */}
      {isPartyHere && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-white shadow-lg shadow-white/50" />
        </div>
      )}

      {/* Marker indicator */}
      {visibleMarkers.length > 0 && !isPartyHere && (
        <div className="absolute top-0.5 right-0.5">
          <MapPin className="w-2.5 h-2.5 text-white drop-shadow" />
        </div>
      )}

      {/* Link indicator */}
      {hasLinks && (
        <div className="absolute bottom-0.5 right-0.5">
          <LinkIcon className="w-2.5 h-2.5 text-cyan-300 drop-shadow" />
        </div>
      )}

      {/* Null terrain indicator for GM */}
      {isGmMode && !terrain && (
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <span className="text-[8px] text-gray-400">?</span>
        </div>
      )}

      {/* Combat token overlay */}
      {tokens && tokens.length === 1 && (
        <CombatToken
          initial={tokens[0].initial}
          category={tokens[0].category}
          isCurrentActor={tokens[0].isCurrentActor}
          isDead={tokens[0].isDead}
          isUnconscious={tokens[0].isUnconscious}
          isSelected={tokens[0].instanceId === selectedParticipantId}
          tileSizePx={size}
          onClick={(e) => {
            e.stopPropagation();
            onTokenClick?.(tokens[0].instanceId);
          }}
          displayName={tokens[0].displayName}
        />
      )}
      {tokens && tokens.length > 1 && (
        <div className="absolute inset-0 z-10">
          {tokens.slice(0, 4).map((token, idx) => (
            <div
              key={token.instanceId}
              className="absolute"
              style={{
                top: `${idx < 2 ? 0 : 50}%`,
                left: `${idx % 2 === 0 ? 0 : 50}%`,
                width: '50%',
                height: '50%',
              }}
            >
              <CombatToken
                initial={token.initial}
                category={token.category}
                isCurrentActor={token.isCurrentActor}
                isDead={token.isDead}
                isUnconscious={token.isUnconscious}
                isSelected={token.instanceId === selectedParticipantId}
                tileSizePx={Math.round(size / 2)}
                onClick={(e) => {
                  e.stopPropagation();
                  onTokenClick?.(token.instanceId);
                }}
                displayName={token.displayName}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
